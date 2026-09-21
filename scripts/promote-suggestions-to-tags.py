#!/usr/bin/env python3
"""Setzt in docs/content/questions-tags.json `tags = tagsSuggested` für alle Einträge.

Einmaliger Übergabe-Schritt, wenn die kuratierten Vorschläge final zu Tags werden
sollen. Nach diesem Skript kann `apply-tags.py` normal laufen und schreibt die
Tags in `src/data/questions.json` zurück.

Bereits nicht-leere `tags` werden respektiert und NICHT überschrieben — nur leere
oder fehlende `tags` werden mit den Suggestions befüllt.
"""
from __future__ import annotations
import json
from pathlib import Path

TARGET = Path(__file__).resolve().parent.parent / 'docs/content/questions-tags.json'


def main() -> None:
    data = json.loads(TARGET.read_text(encoding='utf-8'))
    total = len(data)
    promoted = 0
    kept = 0

    for entry in data:
        suggested = entry.get('tagsSuggested') or []
        current = entry.get('tags') or []
        if current:
            kept += 1
            continue
        if not suggested:
            continue
        entry['tags'] = list(suggested)
        promoted += 1

    TARGET.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + '\n',
        encoding='utf-8',
    )

    print(f'Gesamt Einträge:               {total}')
    print(f'tags aus tagsSuggested gefüllt: {promoted}')
    print(f'tags bereits gepflegt, behalten: {kept}')


if __name__ == '__main__':
    main()
