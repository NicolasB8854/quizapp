#!/usr/bin/env python3
"""
Erzeugt eine editierbare Tag-Datei aus dem aktuellen Fragen-Katalog.

Ablauf:
  1. Lädt src/data/questions.json.
  2. Für jede Frage schlägt automatisch Tags vor (Jahreszahlen, Eigennamen,
     richtige Antwort bei MC).
  3. Schreibt docs/content/questions-tags.json — Nutzer bearbeitet dort die
     `tags`-Arrays (initial leer, damit er bewusst aus `tagsSuggested`
     auswählt oder eigene ergänzt).
  4. Später: scripts/apply-tags.py schreibt die Tags zurück in questions.json.

Suggestions-Regeln:
  - Fragewörter am Satzanfang werden verworfen (Welche/Welcher/Was/…).
  - 4-stellige Jahreszahlen 1800..2099 werden immer als Tag vorgeschlagen.
  - Eigennamen (großgeschrieben, 1-3 Wörter zusammen) werden vorgeschlagen,
    außer sie beginnen mit einem Stopword.
  - Bei MC: richtige Antwort ist ein starker Tag.
  - Bei warmup-riddle: solution zählt.
  - Max 8 Vorschläge pro Frage.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
QUESTIONS = ROOT / 'src' / 'data' / 'questions.json'
OUT = ROOT / 'docs' / 'content' / 'questions-tags.json'

# Wörter, die (auch am Anfang eines Phrase-Matches) keine Tags werden sollen.
STOPWORDS = {
    # Fragewörter
    'Wer', 'Was', 'Wie', 'Warum', 'Wo', 'Wann', 'Woher', 'Wohin', 'Weshalb',
    'Welche', 'Welcher', 'Welches', 'Welchem', 'Welchen',
    # Artikel / häufige Satz-Anfänge
    'Der', 'Die', 'Das', 'Den', 'Dem', 'Des', 'Ein', 'Eine', 'Einen', 'Einer', 'Eines',
    'In', 'An', 'Auf', 'Bei', 'Für', 'Mit', 'Von', 'Zu', 'Aus', 'Nach', 'Über', 'Unter',
    'Ist', 'Sind', 'War', 'Waren', 'Hat', 'Hatte', 'Haben', 'Wird', 'Wurde',
    'Man', 'Es', 'Er', 'Sie', 'Sein', 'Ihre', 'Seiner', 'Diese', 'Dieser', 'Dieses',
    'Und', 'Oder', 'Aber', 'Doch', 'Sondern', 'Als', 'Wenn', 'Weil', 'Nur',
    # Kürzel, die eher Kontext als Tag sind
    'US', 'USA', 'BRD', 'DDR', 'EU', 'DE', 'UK', 'NM',
    'Prof', 'Herr', 'Frau', 'Dr',
    # Generische Substantive, die häufig groß am Satzanfang stehen
    'Stadt', 'Land', 'Länder', 'Jahr', 'Jahre', 'Jahren', 'Jahrhundert',
    'Film', 'Filme', 'Serie', 'Serien', 'Album', 'Band', 'Song', 'Musiker',
    'Roman', 'Autor', 'Autorin', 'Buch', 'Bücher',
    'Sportart', 'Team', 'Verein', 'Spieler', 'Spielerin',
    'Region', 'Regionen', 'Ort', 'Orte', 'Ortes',
    'Beitrag', 'Beiträge', 'Studium', 'Regie', 'Regisseur', 'Regisseurin',
    'Charakter', 'Rolle', 'Kapitel',
    'Wahr', 'Falsch', 'Ja', 'Nein', 'Nicht',
    'Meisterschaft', 'Meister', 'Trophäe',
}

# Regex für Eigennamen: 1-3 großgeschriebene Wörter hintereinander.
# Nimmt auch Zusammensetzungen wie „New York" oder „Bong Joon-ho".
PROPER_NOUN_RE = re.compile(
    r'\b[A-ZÄÖÜ][a-zäöüß]+(?:[- ][A-ZÄÖÜ][a-zäöüß]+){0,3}\b'
)
YEAR_RE = re.compile(r'\b(1[89]\d{2}|20\d{2})\b')


def is_useful_proper_noun(match: str) -> bool:
    """Filtert Matches raus, die vermutlich generisch/Fragewort sind."""
    m = match.rstrip('.,;:!?')
    parts = m.split(' ')
    first = parts[0]
    if first in STOPWORDS:
        return False
    # Ein-Wort-Matches sind riskanter (häufig generische Substantive).
    # Wir lassen sie trotzdem zu, aber mit Stopwords-Filter oben.
    if m in STOPWORDS:
        return False
    return True


def _extract_from_text(text: str, tags: list[str], seen: set[str]) -> None:
    """Fügt Jahreszahlen + Eigennamen aus `text` in `tags` ein (in-place, dedupliziert).

    Analysiert satzweise, damit Fragewörter am Satzanfang (Wer/Was/Welche/…)
    zuverlässig als Stopwords behandelt werden.
    """
    if not text:
        return
    # Jahreszahlen zuerst
    for m in YEAR_RE.findall(text):
        if m not in seen:
            seen.add(m)
            tags.append(m)
    # Sätze splitten (nach ., ?, !, ; oder Zeilenumbruch)
    sentences = re.split(r'[.!?;\n]+', text)
    for sentence in sentences:
        s = sentence.strip()
        if not s:
            continue
        for m in PROPER_NOUN_RE.findall(s):
            m = m.rstrip('.,;:!?')
            if not is_useful_proper_noun(m):
                continue
            if m in seen:
                continue
            seen.add(m)
            tags.append(m)


def suggest_tags(q: dict[str, Any]) -> list[str]:
    """Extrahiert Vorschlags-Tags aus Fragetext, gmNote und (bei MC) Antwort.

    Jedes Text-Feld wird EINZELN analysiert — keine String-Konkatenation,
    sonst entstehen Cross-Boundary-Matches wie „Parasite Welcher Film".

    Multiple-Choice-Antworten werden direkt als Tag übernommen (nicht durchs
    Regex-Filter), damit englische Titel wie „Game of Thrones" oder „The Hurt
    Locker" nicht in Einzelwörter zerfallen.
    """
    tags: list[str] = []
    seen: set[str] = set()

    # 1) Richtige Antwort direkt als Tag (bei MC + warmup-riddle mit kurzer Solution)
    if q.get('type') == 'multiple-choice':
        options = q.get('options') or []
        idx = q.get('correctIndex')
        if isinstance(idx, int) and 0 <= idx < len(options):
            ans = str(options[idx]).strip()
            if ans and ans not in seen:
                seen.add(ans)
                tags.append(ans)

    # 2) Regex-Analyse der Textfelder in Prioritäts-Reihenfolge
    parts_in_priority: list[str] = [
        q.get('question', '') or '',
        q.get('gmNote', '') or '',
        q.get('explanation', '') or '',
    ]
    for part in parts_in_priority:
        _extract_from_text(part, tags, seen)

    return tags[:8]


def main() -> int:
    if not QUESTIONS.exists():
        print(f'FEHLER: {QUESTIONS} nicht gefunden.', file=sys.stderr)
        return 1

    with QUESTIONS.open('r', encoding='utf-8') as f:
        catalog: list[dict[str, Any]] = json.load(f)

    entries = []
    for q in catalog:
        entry: dict[str, Any] = {
            'id': q['id'],
            'topic': q.get('topic'),
            'difficulty': q.get('difficulty'),
            'type': q.get('type'),
            'question': q.get('question'),
        }
        if q.get('type') == 'multiple-choice':
            options = q.get('options') or []
            idx = q.get('correctIndex')
            if isinstance(idx, int) and 0 <= idx < len(options):
                entry['correctAnswer'] = options[idx]
        elif q.get('type') == 'true-false':
            entry['correctAnswer'] = q.get('correctAnswer')
        elif q.get('type') == 'warmup-riddle':
            entry['solution'] = q.get('solution')
        if q.get('gmNote'):
            entry['gmNote'] = q['gmNote']

        # Bestehende Tags nicht überschreiben — wenn eine Frage schon gepflegte
        # Tags hat, übernehmen wir sie. Sonst bleibt `tags` leer, damit der
        # Nutzer bewusst aus `tagsSuggested` auswählt.
        existing = q.get('tags') or []
        suggested = suggest_tags(q)

        entry['tagsSuggested'] = suggested
        entry['tags'] = existing
        entries.append(entry)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open('w', encoding='utf-8') as f:
        json.dump(entries, f, ensure_ascii=False, indent=2)
        f.write('\n')

    total = len(entries)
    with_existing = sum(1 for e in entries if e['tags'])
    with_suggestions = sum(1 for e in entries if e['tagsSuggested'])
    print(f'✓ {OUT.relative_to(ROOT)} geschrieben.')
    print(f'  {total} Fragen — {with_existing} mit bereits gepflegten tags, {with_suggestions} mit Auto-Vorschlägen.')
    print()
    print(f'  Nutzer bearbeitet die `tags`-Arrays. Reihenfolge und Anzahl frei.')
    print(f'  `tagsSuggested` ist rein informativ — Referenz für den User.')
    print(f'  Import zurück in questions.json via: python3 scripts/apply-tags.py')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
