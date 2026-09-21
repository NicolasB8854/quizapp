#!/usr/bin/env python3
"""
Schreibt die editierten Tags aus docs/content/questions-tags.json zurück in
src/data/questions.json.

Nur das `tags`-Array wird übernommen; alle anderen Felder in
questions-tags.json sind Kontext und werden ignoriert.

Nach dem Import wird `updatedAt` auf jetzt gesetzt, damit Diffs die
Content-Pflege abbilden.
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
QUESTIONS = ROOT / 'src' / 'data' / 'questions.json'
TAGS_FILE = ROOT / 'docs' / 'content' / 'questions-tags.json'


def main() -> int:
    if not QUESTIONS.exists():
        print(f'FEHLER: {QUESTIONS} nicht gefunden.', file=sys.stderr)
        return 1
    if not TAGS_FILE.exists():
        print(f'FEHLER: {TAGS_FILE} nicht gefunden — erst build-tags-editing-file.py laufen lassen.', file=sys.stderr)
        return 1

    with QUESTIONS.open('r', encoding='utf-8') as f:
        catalog: list[dict[str, Any]] = json.load(f)
    with TAGS_FILE.open('r', encoding='utf-8') as f:
        entries: list[dict[str, Any]] = json.load(f)

    tags_by_id: dict[str, list[str]] = {}
    for entry in entries:
        qid = entry.get('id')
        if not isinstance(qid, str):
            continue
        tags = entry.get('tags')
        if not isinstance(tags, list):
            continue
        # Deduplizieren, aber Reihenfolge behalten
        seen: set[str] = set()
        clean = []
        for t in tags:
            if not isinstance(t, str) or not t.strip():
                continue
            t = t.strip()
            if t in seen:
                continue
            seen.add(t)
            clean.append(t)
        tags_by_id[qid] = clean

    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')
    changed = 0
    missing = 0
    for q in catalog:
        qid = q.get('id')
        if qid not in tags_by_id:
            missing += 1
            continue
        new_tags = tags_by_id[qid]
        old_tags = q.get('tags') or []
        if new_tags != old_tags:
            q['tags'] = new_tags
            q['updatedAt'] = now
            changed += 1

    with QUESTIONS.open('w', encoding='utf-8') as f:
        json.dump(catalog, f, ensure_ascii=False, indent=2)
        f.write('\n')

    print(f'✓ {changed} Fragen mit neuen Tags aktualisiert.')
    if missing:
        print(f'  ⚠ {missing} Fragen fehlten in {TAGS_FILE.name} (Katalog hat mehr Einträge).')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
