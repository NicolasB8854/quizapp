#!/usr/bin/env python3
"""Migration: `wissenschaft`-Fragen auf 7 Sub-Disziplinen mappen.

Verwendung:
    python3 scripts/remap-topics.py --dry-run     # Preview, keine Änderung
    python3 scripts/remap-topics.py               # Wende an
    python3 scripts/remap-topics.py --interactive # Für jede Frage einzeln bestätigen

Andere bestehende Topics (film, serien, musik, etc.) bleiben unverändert.
Neue Topics (religion, politik, gesundheit, ...) sind zunächst leer — dafür
werden später neue Fragen ergänzt.
"""

from __future__ import annotations
import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
QUESTIONS_PATH = ROOT / 'packages' / 'shared' / 'src' / 'data' / 'questions.json'

# ---------- Mapping-Regeln ----------
#
# Reihenfolge = Priorität. Für jede Frage wird die erste passende Regel
# angewandt (Tags case-insensitive). Falls keine trifft: default = biologie
# (weil das der breiteste Bio-Rest-Bucket ist).
#
# Bewusst konservativ: nur eindeutige Signale mappen zu spezifischen Topics.

TAG_RULES = [
    # Format: (target_topic, [tags to match, case-insensitive substring])
    ('astronomie', ['astronomie', 'planet', 'kosmologie', 'stern', 'mond', 'venus', 'proxima']),
    ('physik',     ['physik', 'atomkern', 'elektromagnetismus', 'thermodynamik',
                    'entropie', 'streuexperiment', 'rutherford', 'optik',
                    'feinstrukturkonstante', 'volt', 'spannung', 'elektrizität',
                    'lichtgeschwindigkeit']),
    ('chemie',     ['element', 'periodensystem', 'chemie', 'molekül', 'natrium',
                    'wasserstoff', 'isotop', 'deuterium', 'gold', 'diamant']),
    ('psychologie',['psychologie', 'kognitive verzerrung', 'dunning-kruger',
                    'pawlow', 'konditionierung', 'maslow', 'motivation',
                    'serotonin', 'neurotransmitter', 'bias', 'confirmation bias',
                    'gehirn', 'neurologie', 'neurowissenschaft', 'mythos']),
    ('medizin',    ['medizin', 'blutgruppe', 'transfusion', 'anatomie',
                    'krankheit', 'pest', 'pocken', 'penicillin', 'fleming',
                    'cochlea', 'ohr', 'knochen', 'muskel', 'masseter',
                    'herz', 'physiologie', 'leber', 'regeneration', 'schlaf',
                    'rem', 'gesundheit', 'vitamin', 'hämophilie', 'genetik']),
    ('biologie',   ['bio', 'evolution', 'zelle', 'dna', 'chromosom',
                    'fledermaus', 'echolokation']),
]

DEFAULT_TARGET = 'biologie'

# Spezial-Overrides pro ID, wenn Tag-Rules unklar sind.
# Reihenfolge in TAG_RULES ist nicht immer perfekt — hier zwingen wir das
# richtige Ziel wo eindeutig.
OVERRIDES = {
    'q-flash-02':          'psychologie', # 10%-Gehirn-Mythos
    'q-flash-04':          'astronomie',  # Venus-Tag
    'q-flash-10':          'biologie',    # Fledermäuse
    'q-flash-13':          'physik',      # Blitz-Physik (nicht Wetter)
    'q-flash-22':          'physik',      # Licht-Optik
    'q-flash-31':          'psychologie', # 10%-Gehirn-Mythos v2
    'q-flash-32':          'medizin',     # Herz pumpt Blut
    'q-flash-33':          'medizin',     # Leber-Regeneration
    'q-wiss-01':           'chemie',      # Gold-Periodensystem
    'q-wiss-02':           'biologie',    # Chromosom-Genetik
    'q-wiss-03':           'physik',      # Elektromagnetismus
    'q-wissenschaft-04':   'chemie',      # Natrium
    'q-wissenschaft-05':   'physik',      # Marie Curie (Physik+Chemie, primary: Physik)
    'q-wissenschaft-06':   'physik',      # Feinstrukturkonstante
    'q-wissenschaft-07':   'astronomie',  # Proxima Centauri
    'q-wissenschaft-08':   'astronomie',  # Wasserstoff im Universum → astronomie (Kosmologie-Tag)
    'q-wissenschaft-09':   'medizin',     # Pest
    'q-wissenschaft-10':   'medizin',     # Penicillin
    'q-wissenschaft-11':   'physik',      # Volt
    'q-wissenschaft-12':   'physik',      # Rutherford
    'q-wissenschaft-13':   'physik',      # Entropie/Thermodynamik
    'q-wissenschaft-14':   'chemie',      # Wasserstoff-Isotope
    'q-wissenschaft-15':   'chemie',      # H2O
    'q-wissenschaft-16':   'physik',      # Blitz-Temperatur
    'q-wissenschaft-17':   'chemie',      # Diamant (Kohlenstoff)
    'q-wissenschaft-18':   'astronomie',  # Vollmond
    'q-wissenschaft-19':   'physik',      # Verbrennung
    'q-wissenschaft-20':   'psychologie', # Dunning-Kruger
    'q-wissenschaft-21':   'psychologie', # Pawlow
    'q-wissenschaft-22':   'medizin',     # Blutgruppe
    'q-wissenschaft-23':   'medizin',     # Cochlea
    'q-wissenschaft-24':   'medizin',     # Pocken
    'q-wissenschaft-25':   'medizin',     # Knochen
    'q-wissenschaft-26':   'medizin',     # Vitamin D
    'q-wissenschaft-27':   'psychologie', # Maslow
    'q-wissenschaft-28':   'psychologie', # Serotonin
    'q-wissenschaft-29':   'medizin',     # Fleming/Penicillin
    'q-wissenschaft-30':   'medizin',     # Herz Kammern
    'q-wissenschaft-31':   'medizin',     # REM-Schlaf
    'q-wissenschaft-32':   'psychologie', # Confirmation Bias
    'q-wissenschaft-33':   'medizin',     # Masseter
    'q-wissenschaft-34':   'medizin',     # Hämophilie
}


def guess_topic(question: dict) -> str:
    """Ermittelt das neue Topic anhand der Regeln, Overrides gewinnen."""
    qid = question.get('id', '')
    if qid in OVERRIDES:
        return OVERRIDES[qid]
    tags = [t.lower() for t in question.get('tags', []) if t]
    text = (question.get('question') or '').lower()

    for target, keywords in TAG_RULES:
        for kw in keywords:
            if any(kw in t for t in tags):
                return target
            if kw in text:
                return target
    return DEFAULT_TARGET


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--interactive', action='store_true')
    args = parser.parse_args()

    with QUESTIONS_PATH.open('r', encoding='utf-8') as f:
        questions = json.load(f)

    changes: list[tuple[dict, str]] = []
    for q in questions:
        if q.get('topic') != 'wissenschaft':
            continue
        target = guess_topic(q)
        if target != 'wissenschaft':
            changes.append((q, target))

    print(f'Total wissenschaft: {len(changes)} zu re-mappen')
    print()

    # Zusammenfassung per Ziel-Topic
    from collections import Counter
    counter = Counter(t for _, t in changes)
    print('Zielverteilung:')
    for topic, count in counter.most_common():
        print(f'  {topic:<15} {count}')
    print()

    # Detail-Liste
    print('Detail (id → target):')
    for q, target in changes:
        tags = ', '.join(q.get('tags', []))
        marker = '✱' if q.get('id') in OVERRIDES else ' '
        print(f'  {marker} {q["id"]:<24} → {target:<12}  [{tags[:60]}]')

    if args.dry_run:
        print('\nDRY-RUN — keine Änderung angewandt.')
        return 0

    if args.interactive:
        confirm = input('\nAlle Zuordnungen übernehmen? [y/N] ').strip().lower()
        if confirm != 'y':
            print('Abgebrochen.')
            return 1

    # Anwenden
    for q, target in changes:
        q['topic'] = target

    with QUESTIONS_PATH.open('w', encoding='utf-8') as f:
        json.dump(questions, f, ensure_ascii=False, indent=2)
        f.write('\n')

    print(f'\n✓ {len(changes)} Fragen umgemappt und gespeichert.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
