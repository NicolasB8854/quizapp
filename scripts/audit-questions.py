#!/usr/bin/env python3
"""Fragen-Audit pro Topic via headless kiro-cli.

Ablauf:
  python3 scripts/audit-questions.py split            # questions.json -> .audit-work/in/<topic>.json
  python3 scripts/audit-questions.py run [topic ...]  # Audit (sequentiell), schreibt .audit-work/out/<topic>.json
  python3 scripts/audit-questions.py check [topic ...]# Output validieren
  python3 scripts/audit-questions.py merge            # geprüfte Outputs -> questions.json + Audit-Log

Rubrik: docs/content/difficulty-rubric.md
"""
from __future__ import annotations

import json
import subprocess
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
QFILE = ROOT / "packages/shared/src/data/questions.json"
RUBRIC = ROOT / "docs/content/difficulty-rubric.md"
WORK = ROOT / ".audit-work"
IN, OUT, LOG = WORK / "in", WORK / "out", WORK / "logs"
AUDIT_LOG = ROOT / "docs/content/audit-2026-10.json"
MODEL = "claude-opus-5.5"
MC_MODES = ["category-duel", "flash", "player-spotlight", "sprinter", "points-ladder",
            "category-board", "duel-1v1", "elimination", "experts"]
PCT_RANGES = {1: (90, 100), 2: (70, 90), 3: (40, 70), 4: (15, 40), 5: (0, 15)}
MIN_PER_LEVEL = 4

PROMPT = """Du bist strenger Quiz-Redakteur für eine deutsche Quizabend-App.

Lies die Rubrik: {rubric}
Lies die Fragen des Topics "{topic}": {infile}

Aufgabe — prüfe JEDE Frage gegen die Rubrik:
- Faktencheck: Bei allem, was du nicht zweifelsfrei weißt, nutze web_search. Falsche Fakten korrigieren oder Frage löschen.
- Qualitäts-Checkliste (eindeutige Lösung, kein Leak, plausible Distraktoren gleicher Klasse und Länge, knapp, Thema passt).
- Schwierigkeit NEU und ehrlich einstufen: schätze `knowPct` (% Erwachsener in DE, die es wissen) und leite daraus `difficulty` exakt nach Rubrik ab. Die alte Einstufung ist unzuverlässig — ignoriere sie.
- Jede Frage bekommt eine gute `explanation` (1–2 Sätze, Kontext statt Wiederholung).
- Verdict: keep (unverändert bis auf difficulty/explanation), fix (Text/Optionen geändert), drop (unrettbar, z.B. falsch, trivial-doppelt, mehrdeutig).
- Danach Lücken füllen: pro difficulty 1–5 müssen MINDESTENS {minlvl} multiple-choice-Fragen existieren. Schreibe neue Fragen (verdict "new"), bis das erfüllt ist. Auch neue Fragen faktengeprüft, abwechslungsreich, keine Dubletten. Schwere Fragen (4/5) müssen fair bleiben: knifflig, aber lösbar für Kenner — keine obskuren Zahlen.

Schreibe das Ergebnis als valides JSON (UTF-8, keine Kommentare) mit dem Datei-Schreibtool nach: {outfile}

Schema:
{{
  "topic": "{topic}",
  "questions": [
    // alle behaltenen, reparierten und neuen Fragen als vollständige Objekte im Originalschema
    // multiple-choice: id, type, category, topic, difficulty, question, options[4], correctIndex, explanation, tags[], timeScope
    // true-false: id, type, category, topic, difficulty, question, correctAnswer (bool), explanation, tags[], timeScope
    // warmup-riddle: Felder wie im Input übernehmen, plus difficulty/explanation
    // dazu bei JEDER Frage: "audit": {{"verdict": "keep|fix|new", "knowPct": <int>, "note": "<kurz: was geändert/warum>"}}
  ],
  "dropped": [{{"id": "...", "reason": "..."}}]
}}
Regeln: bestehende ids beibehalten; neue ids "q-{topic}-n01", "q-{topic}-n02", ...; "category" wie die übrigen Fragen des Topics; correctIndex 0-basiert, Position der richtigen Antwort variieren.
Antworte am Ende nur mit DONE."""


def load_questions() -> list[dict]:
    return json.loads(QFILE.read_text(encoding="utf-8"))


def topics_all() -> list[str]:
    return sorted({q["topic"] for q in load_questions()})


def cmd_split() -> None:
    IN.mkdir(parents=True, exist_ok=True)
    by: dict[str, list] = {}
    for q in load_questions():
        by.setdefault(q["topic"], []).append(q)
    for t, qs in by.items():
        (IN / f"{t}.json").write_text(json.dumps(qs, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"split: {len(by)} topics")


def validate(topic: str) -> list[str]:
    f = OUT / f"{topic}.json"
    if not f.exists():
        return ["missing"]
    try:
        d = json.loads(f.read_text(encoding="utf-8"))
    except Exception as e:  # noqa: BLE001
        return [f"invalid json: {e}"]
    errs: list[str] = []
    src_ids = {q["id"] for q in json.loads((IN / f"{topic}.json").read_text(encoding="utf-8"))}
    qs = d.get("questions", [])
    seen: set[str] = set()
    for q in qs:
        i = q.get("id", "?")
        if i in seen:
            errs.append(f"{i}: duplicate id")
        seen.add(i)
        if q.get("topic") != topic:
            errs.append(f"{i}: topic {q.get('topic')}")
        dif = q.get("difficulty")
        if dif not in PCT_RANGES:
            errs.append(f"{i}: difficulty {dif}")
        a = q.get("audit") or {}
        if a.get("verdict") not in ("keep", "fix", "new"):
            errs.append(f"{i}: verdict {a.get('verdict')}")
        pct = a.get("knowPct")
        if isinstance(pct, (int, float)) and dif in PCT_RANGES:
            lo, hi = PCT_RANGES[dif]
            if not (lo - 3 <= pct <= hi + 3):
                errs.append(f"{i}: knowPct {pct} passt nicht zu difficulty {dif}")
        if not (q.get("explanation") or "").strip():
            errs.append(f"{i}: explanation fehlt")
        t = q.get("type")
        if t == "multiple-choice":
            o = q.get("options")
            if not (isinstance(o, list) and len(o) == 4 and len(set(o)) == 4):
                errs.append(f"{i}: options")
            if q.get("correctIndex") not in (0, 1, 2, 3):
                errs.append(f"{i}: correctIndex")
        elif t == "true-false":
            if not isinstance(q.get("correctAnswer"), bool):
                errs.append(f"{i}: correctAnswer")
        elif t != "warmup-riddle":
            errs.append(f"{i}: type {t}")
        if a.get("verdict") != "new" and i not in src_ids:
            errs.append(f"{i}: unbekannte id ohne verdict new")
    dropped = {x.get("id") for x in d.get("dropped", [])}
    missing = src_ids - seen - dropped
    if missing:
        errs.append(f"nicht behandelt: {sorted(missing)}")
    lvl = Counter(q.get("difficulty") for q in qs if q.get("type") == "multiple-choice")
    for L in range(1, 6):
        if lvl[L] < MIN_PER_LEVEL:
            errs.append(f"nur {lvl[L]} MC auf Stufe {L}")
    return errs


def run_topic(topic: str) -> bool:
    OUT.mkdir(parents=True, exist_ok=True)
    LOG.mkdir(parents=True, exist_ok=True)
    prompt = PROMPT.format(rubric=RUBRIC, topic=topic, infile=IN / f"{topic}.json",
                           outfile=OUT / f"{topic}.json", minlvl=MIN_PER_LEVEL)
    for attempt in (1, 2):
        extra = ""
        if attempt == 2:
            extra = ("\n\nACHTUNG: Ein vorheriger Versuch war fehlerhaft: "
                     + "; ".join(validate(topic)[:15])
                     + f"\nLies ggf. {OUT / (topic + '.json')} und schreibe eine korrigierte, vollständige Fassung.")
        with open(LOG / f"{topic}.log", "a", encoding="utf-8") as lf:
            lf.write(f"\n=== attempt {attempt} {datetime.now().isoformat()} ===\n")
            lf.flush()
            subprocess.run(
                ["kiro-cli", "chat", "--no-interactive", "--model", MODEL,
                 "--trust-tools=fs_read,fs_write,web_search,web_fetch", prompt + extra],
                cwd=WORK, stdout=lf, stderr=subprocess.STDOUT, timeout=3600, check=False,
            )
        errs = validate(topic)
        print(f"[{topic}] attempt {attempt}: {'OK' if not errs else str(len(errs)) + ' Fehler'}", flush=True)
        if not errs:
            return True
    return False


def cmd_run(topics: list[str]) -> None:
    todo = topics or topics_all()
    for t in todo:
        if not validate(t):
            print(f"[{t}] schon fertig", flush=True)
            continue
        run_topic(t)


def cmd_check(topics: list[str]) -> None:
    for t in topics or topics_all():
        errs = validate(t)
        if errs == ["missing"]:
            continue
        print(f"{t}: {'OK' if not errs else errs[:8]}")


def cmd_merge() -> None:
    orig = {q["id"]: q for q in load_questions()}
    topics = topics_all()
    bad = [t for t in topics if validate(t)]
    if bad:
        sys.exit(f"merge abgebrochen, nicht validiert: {bad}")
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    merged: list[dict] = []
    log: dict = {"generatedAt": now, "topics": {}}
    for t in topics:
        d = json.loads((OUT / f"{t}.json").read_text(encoding="utf-8"))
        entries = []
        for q in d["questions"]:
            a = q.pop("audit")
            base = dict(orig.get(q["id"], {}))
            base.update(q)
            base["status"] = "approved"
            base.setdefault("tags", [])
            base.setdefault("timeScope", "timeless")
            if a["verdict"] == "new":
                base["aiGenerated"] = True
                base["createdAt"] = now
            base.setdefault("aiGenerated", False)
            base.setdefault("createdAt", now)
            if a["verdict"] != "keep" or base.get("difficulty") != orig.get(q["id"], {}).get("difficulty"):
                base["updatedAt"] = now
            if "compatibleModes" not in base or a["verdict"] == "new":
                base["compatibleModes"] = (MC_MODES if base["type"] == "multiple-choice"
                                           else ["flash"] if base["type"] == "true-false"
                                           else ["around-corner"])
            merged.append(base)
            entries.append({"id": q["id"], "old": orig.get(q["id"], {}).get("difficulty"),
                            "new": base["difficulty"], **a})
        log["topics"][t] = {"questions": entries, "dropped": d.get("dropped", [])}
    QFILE.write_text(json.dumps(merged, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    AUDIT_LOG.write_text(json.dumps(log, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    c = Counter(q["difficulty"] for q in merged)
    print(f"merge: {len(orig)} -> {len(merged)} Fragen; Verteilung {sorted(c.items())}")


if __name__ == "__main__":
    cmd, *args = sys.argv[1:] or ["help"]
    {"split": lambda: cmd_split(), "run": lambda: cmd_run(args),
     "check": lambda: cmd_check(args), "merge": lambda: cmd_merge()}.get(
        cmd, lambda: print(__doc__))()
