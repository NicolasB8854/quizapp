#!/usr/bin/env python3
"""Neue Wahr/Falsch-Aussagen und Klick!-Rätsel via headless kiro-cli erzeugen.

  python3 scripts/generate-content.py tf [topic ...]   # 4 Wahr/Falsch pro Topic (Stufen 1-4 gemischt)
  python3 scripts/generate-content.py riddles          # Klick!-Rätsel in Batches
  python3 scripts/generate-content.py check
  python3 scripts/generate-content.py merge            # validierte Ergebnisse an questions.json anhängen

Gleiche Rubrik wie der Audit (docs/content/difficulty-rubric.md), Faktencheck per Websuche.
"""
from __future__ import annotations

import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
QFILE = ROOT / "packages/shared/src/data/questions.json"
RUBRIC = ROOT / "docs/content/difficulty-rubric.md"
WORK = ROOT / ".audit-work/gen"
MODEL = "claude-opus-5.5"
TF_PER_TOPIC = 4
RIDDLE_BATCHES = 4
RIDDLES_PER_BATCH = 10


def existing() -> list[dict]:
    return json.loads(QFILE.read_text(encoding="utf-8"))


def topics() -> list[str]:
    return sorted({q["topic"] for q in existing()})


def run(prompt: str, log: Path) -> None:
    with open(log, "a", encoding="utf-8") as lf:
        subprocess.run(
            ["kiro-cli", "chat", "--no-interactive", "--model", MODEL,
             "--trust-tools=fs_read,fs_write,web_search,web_fetch", prompt],
            cwd=WORK, stdout=lf, stderr=subprocess.STDOUT, timeout=3600, check=False,
        )


def tf_prompt(topic: str, out: Path, known: Path) -> str:
    return f"""Du bist Quiz-Redakteur für eine deutsche Quizabend-App. Lies die Rubrik {RUBRIC}.
Lies die vorhandenen Fragen des Topics "{topic}" in {known} (nur um Dubletten zu vermeiden).
Schreibe {TF_PER_TOPIC} NEUE Wahr/Falsch-Aussagen zum Topic "{topic}":
- eindeutig wahr oder eindeutig falsch, keine "meistens"-Fälle; etwa die Hälfte falsch
- überraschend, aber fair; Stufen nach Rubrik gemischt (1 bis 4)
- Faktencheck mit web_search bei jedem Zweifel
- jede mit "explanation" (1–2 Sätze, warum wahr/falsch)
Schreibe ein JSON-Array nach {out} mit Objekten:
{{"id":"q-{topic}-tf-NN","type":"true-false","category":"<wie die vorhandenen Fragen des Topics>","topic":"{topic}",
"difficulty":<1-5>,"question":"<Aussage>","correctAnswer":<true|false>,"explanation":"...","tags":[...],"timeScope":"timeless|dated"}}
NN = 01..{TF_PER_TOPIC:02d}. Antworte am Ende nur mit DONE."""


def riddle_prompt(batch: int, out: Path, known: Path) -> str:
    return f"""Du bist Quiz-Redakteur für eine deutsche Quizabend-App. Modus "Klick!": Alltagsphänomene mit überraschender Erklärung,
die Gruppe rät gemeinsam, drei Hinweise werden nacheinander aufgedeckt.
Lies vorhandene Rätsel in {known} (keine Dubletten!). Schreibe {RIDDLES_PER_BATCH} NEUE Rätsel (Batch {batch}),
abwechslungsreich (Physik im Alltag, Biologie, Sprache, Technik, Essen, Geschichte von Alltagsdingen).
Faktencheck mit web_search. Jedes Rätsel:
{{"id":"q-klick-b{batch}-NN","type":"warmup-riddle","category":"kurioses","topic":"<passendes Topic, z.B. kurioses, physik, biologie, essen, sprache, technik, geschichte>",
"difficulty":<2-4>,"question":"<Warum-/Wie-Frage>","hints":["<vage>","<konkreter>","<fast die Lösung>"],
"solution":"<2-3 Sätze Erklärung>","explanation":"<1 Satz Kernaussage>","tags":[...],"timeScope":"timeless"}}
NN = 01..{RIDDLES_PER_BATCH:02d}. Schreibe ein JSON-Array nach {out}. Antworte am Ende nur mit DONE."""


def validate(path: Path, kind: str) -> list[str]:
    if not path.exists():
        return ["missing"]
    try:
        items = json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:  # noqa: BLE001
        return [f"json: {e}"]
    errs = []
    valid_topics = set(topics())
    for q in items:
        i = q.get("id", "?")
        if q.get("topic") not in valid_topics:
            errs.append(f"{i}: topic")
        if q.get("difficulty") not in (1, 2, 3, 4, 5):
            errs.append(f"{i}: difficulty")
        if not (q.get("explanation") or "").strip():
            errs.append(f"{i}: explanation")
        if kind == "tf" and (q.get("type") != "true-false" or not isinstance(q.get("correctAnswer"), bool)):
            errs.append(f"{i}: tf")
        if kind == "riddle" and (q.get("type") != "warmup-riddle" or len(q.get("hints") or []) != 3 or not q.get("solution")):
            errs.append(f"{i}: riddle")
    return errs


def cmd_tf(ts: list[str]) -> None:
    WORK.mkdir(parents=True, exist_ok=True)
    allq = existing()
    for t in ts or topics():
        out = WORK / f"tf-{t}.json"
        if not validate(out, "tf"):
            continue
        known = WORK / f"known-{t}.json"
        known.write_text(json.dumps([q["question"] for q in allq if q["topic"] == t], ensure_ascii=False), encoding="utf-8")
        for attempt in (1, 2):
            run(tf_prompt(t, out, known), WORK / f"tf-{t}.log")
            errs = validate(out, "tf")
            print(f"[tf {t}] attempt {attempt}: {'OK' if not errs else errs[:3]}", flush=True)
            if not errs:
                break


def cmd_riddles() -> None:
    WORK.mkdir(parents=True, exist_ok=True)
    known = WORK / "known-riddles.json"
    for b in range(1, RIDDLE_BATCHES + 1):
        out = WORK / f"riddles-{b}.json"
        if not validate(out, "riddle"):
            continue
        prev = [q["question"] for q in existing() if q["type"] == "warmup-riddle"]
        for k in range(1, b):
            p = WORK / f"riddles-{k}.json"
            if p.exists():
                prev += [q["question"] for q in json.loads(p.read_text(encoding="utf-8"))]
        known.write_text(json.dumps(prev, ensure_ascii=False), encoding="utf-8")
        for attempt in (1, 2):
            run(riddle_prompt(b, out, known), WORK / f"riddles-{b}.log")
            errs = validate(out, "riddle")
            print(f"[riddles {b}] attempt {attempt}: {'OK' if not errs else errs[:3]}", flush=True)
            if not errs:
                break


def files() -> list[tuple[Path, str]]:
    return [(p, "tf") for p in sorted(WORK.glob("tf-*.json"))] + [(p, "riddle") for p in sorted(WORK.glob("riddles-*.json"))]


def cmd_check() -> None:
    for p, kind in files():
        errs = validate(p, kind)
        print(f"{p.name}: {'OK' if not errs else errs[:5]}")


def cmd_merge() -> None:
    allq = existing()
    ids = {q["id"] for q in allq}
    texts = {q["question"].strip().lower() for q in allq}
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    added = 0
    for p, kind in files():
        if validate(p, kind):
            print(f"übersprungen (ungültig): {p.name}")
            continue
        for q in json.loads(p.read_text(encoding="utf-8")):
            if q["id"] in ids or q["question"].strip().lower() in texts:
                continue
            q.update({"status": "approved", "aiGenerated": True, "createdAt": now, "updatedAt": now,
                      "compatibleModes": ["flash"] if kind == "tf" else ["around-corner"]})
            q.setdefault("tags", [])
            allq.append(q)
            ids.add(q["id"])
            texts.add(q["question"].strip().lower())
            added += 1
    QFILE.write_text(json.dumps(allq, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"merge: +{added} → {len(allq)} Fragen")


if __name__ == "__main__":
    cmd, *rest = sys.argv[1:] or ["help"]
    {"tf": lambda: cmd_tf(rest), "riddles": cmd_riddles, "check": cmd_check, "merge": cmd_merge}.get(
        cmd, lambda: print(__doc__))()
