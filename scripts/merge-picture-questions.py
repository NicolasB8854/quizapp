#!/usr/bin/env python3
"""Bilderrätsel: bestes freigegebenes Kandidatenbild pro Frage übernehmen.

Liest scripts/picture-questions.json und die Review-Dateien der Kandidaten
(.audit-work/brand/candidates/pic-<slug>-*.review.txt). Pro Slug gewinnt der
höchste SCORE mit PASST: ja (mindestens MIN_SCORE). Das Bild wird mit sips auf
800 px / Qualität 60 nach public/img/pictures/<slug>.jpg geschrieben und die
Frage als q-pic-<slug> in questions.json eingefügt oder ersetzt.
Slugs ohne brauchbares Bild fallen raus (bestehende q-pic-Einträge werden entfernt).
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CAND = ROOT / ".audit-work/brand/candidates"
OUT = ROOT / "public/img/pictures"
CATALOG = ROOT / "packages/shared/src/data/questions.json"
MIN_SCORE = 7
CATEGORY = {"musik": "popkultur", "essen": "alltag-lifestyle"}


def best_image(slug: str) -> tuple[Path, int] | None:
    best: tuple[Path, int] | None = None
    for rev in CAND.glob(f"pic-{slug}-*.review.txt"):
        text = rev.read_text(encoding="utf-8")
        m = re.search(r"SCORE:\s*(\d+)", text)
        ok = re.search(r"PASST:\s*ja\b", text, re.I) and "Einschränkung" not in text.split("|")[1]
        img = rev.with_suffix("").with_suffix(".jpg")
        if m and ok and img.exists():
            score = int(m.group(1))
            if score >= MIN_SCORE and (best is None or score > best[1]):
                best = (img, score)
    return best


def main() -> None:
    pics = json.loads((ROOT / "scripts/picture-questions.json").read_text(encoding="utf-8"))
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    catalog = [q for q in catalog if not q["id"].startswith("q-pic-")]
    OUT.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    taken, dropped = [], []
    for p in pics:
        hit = best_image(p["slug"])
        if not hit:
            dropped.append(p["slug"])
            continue
        img, score = hit
        target = OUT / f"{p['slug']}.jpg"
        subprocess.run(
            ["sips", "-Z", "800", "-s", "format", "jpeg", "-s", "formatOptions", "60", str(img), "--out", str(target)],
            check=True, capture_output=True,
        )
        catalog.append({
            "id": f"q-pic-{p['slug']}",
            "type": "multiple-choice",
            "status": "approved",
            "category": CATEGORY.get(p["topic"], "allgemeinbildung"),
            "topic": p["topic"],
            "difficulty": p["difficulty"],
            "question": p["question"],
            "options": p["options"],
            "correctIndex": p["correct"],
            "image": f"/img/pictures/{p['slug']}.jpg",
            "tags": ["Bilderrätsel"],
            "compatibleModes": ["blindguess"],
            "timeScope": "timeless",
            "aiGenerated": True,
            "createdAt": now,
            "updatedAt": now,
            "explanation": p["explanation"],
        })
        taken.append(f"{p['slug']}({score})")
    CATALOG.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"übernommen {len(taken)}: {' '.join(taken)}")
    print(f"verworfen {len(dropped)}: {' '.join(dropped)}")
    if len(taken) < 10:
        sys.exit("zu wenige Bild-Fragen für einen Abend (<10)")


if __name__ == "__main__":
    main()
