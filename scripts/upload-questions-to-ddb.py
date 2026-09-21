#!/usr/bin/env python3
"""Lädt den kompletten Fragenkatalog aus src/data/questions.json in
DynamoDB, damit der Server ihn beim Cold-Start dynamisch nachladen kann.

Aufruf:
    AWS_PROFILE=quizapp python3 scripts/upload-questions-to-ddb.py
    AWS_PROFILE=quizapp python3 scripts/upload-questions-to-ddb.py --env prod

Environment-Variablen:
    AWS_PROFILE  — muss gesetzt sein, sonst nutzt boto3 default-credentials
    AWS_REGION   — default eu-central-1

Optionale Argumente:
    --env dev|staging|prod  → wählt Tabelle `quizapp-{env}-questions`
    --table NAME            → überschreibt explizit den Tabellennamen
    --dry-run               → keine Writes, nur Zählen und Sample zeigen
    --clear                 → vorher alle Items löschen (Achtung: destruktiv)
"""

from __future__ import annotations
import argparse
import json
import os
import sys
from decimal import Decimal
from pathlib import Path
from typing import Any

try:
    import boto3
except ImportError:
    print("FEHLER: boto3 nicht installiert. → pip install boto3", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parent.parent
QUESTIONS_PATH = ROOT / 'packages' / 'shared' / 'src' / 'data' / 'questions.json'


def load_questions() -> list[dict[str, Any]]:
    if not QUESTIONS_PATH.exists():
        print(f'FEHLER: {QUESTIONS_PATH} nicht gefunden.', file=sys.stderr)
        sys.exit(1)
    with QUESTIONS_PATH.open('r', encoding='utf-8') as f:
        # `parse_float=Decimal`: DDB Number-Type verlangt Decimal statt float.
        data = json.load(f, parse_float=Decimal)
    if not isinstance(data, list):
        print(f'FEHLER: {QUESTIONS_PATH} enthält kein JSON-Array.', file=sys.stderr)
        sys.exit(1)
    return data


def sanitize(item: Any) -> Any:
    """
    DDB-DocumentClient akzeptiert die meisten JSON-Typen direkt, aber:
    - leere Strings sind erlaubt in `lib-dynamodb`, in `boto3` auch okay
    - `None`-Attribute werden als Null geschrieben; wenn möglich weglassen
    """
    if isinstance(item, dict):
        out = {}
        for k, v in item.items():
            if v is None:
                continue  # optionale Felder weglassen statt NULL schreiben
            out[k] = sanitize(v)
        return out
    if isinstance(item, list):
        return [sanitize(x) for x in item if x is not None]
    return item


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--env', default='dev', choices=['dev', 'staging', 'prod'])
    parser.add_argument('--table', default=None, help='Überschreibt Tabellennamen')
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--clear', action='store_true')
    args = parser.parse_args()

    table_name = args.table or f'quizapp-{args.env}-questions'
    region = os.environ.get('AWS_REGION', 'eu-central-1')

    questions = load_questions()
    print(f'Datei:   {QUESTIONS_PATH}')
    print(f'Fragen:  {len(questions)}')
    print(f'Tabelle: {table_name} (region: {region})')

    if args.dry_run:
        print('\n--- DRY RUN (kein Write) ---')
        for q in questions[:3]:
            print(f'  Sample: id={q.get("id")} topic={q.get("topic")} '
                  f'type={q.get("type")} difficulty={q.get("difficulty")}')
        print(f'  ... {len(questions) - 3} weitere')
        return 0

    dynamodb = boto3.resource('dynamodb', region_name=region)
    table = dynamodb.Table(table_name)

    if args.clear:
        # Alle vorhandenen Items löschen. Nutzt Scan + batch_writer.
        print('\n--- Bestehende Items löschen ---')
        scan = table.scan(ProjectionExpression='id')
        to_delete = scan.get('Items', [])
        while 'LastEvaluatedKey' in scan:
            scan = table.scan(
                ProjectionExpression='id',
                ExclusiveStartKey=scan['LastEvaluatedKey'],
            )
            to_delete.extend(scan.get('Items', []))
        print(f'  Lösche {len(to_delete)} bestehende Fragen …')
        with table.batch_writer() as batch:
            for item in to_delete:
                batch.delete_item(Key={'id': item['id']})
        print('  Alte Items gelöscht.')

    print('\n--- Upload ---')
    written = 0
    with table.batch_writer() as batch:
        for q in questions:
            item = sanitize(q)
            if 'id' not in item:
                print(f'  ⚠ Frage ohne id übersprungen: {item}')
                continue
            batch.put_item(Item=item)
            written += 1
            if written % 50 == 0:
                print(f'  … {written} geschrieben')
    print(f'✓ {written} Fragen in {table_name} geschrieben.')

    return 0


if __name__ == '__main__':
    raise SystemExit(main())
