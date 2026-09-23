#!/usr/bin/env python3
"""Fügt neue Fragen (Mensch-Fokus + Essen & Trinken) in
`packages/shared/src/data/questions.json` ein.

Idempotent: Fragen mit bereits vorhandener ID werden übersprungen und nur
neue angehängt. Existierende Fragen werden nie überschrieben.
"""

from __future__ import annotations
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
QUESTIONS_PATH = ROOT / 'packages' / 'shared' / 'src' / 'data' / 'questions.json'

NOW = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

MC_MODES = [
    'category-duel',
    'flash',
    'player-spotlight',
    'sprinter',
    'points-ladder',
    'category-board',
    'duel-1v1',
    'elimination',
    'experts',
]
TF_MODES = ['flash']


def mc(qid, topic, difficulty, question, options, correct, gm, tags, category='allgemeinbildung'):
    return {
        'id': qid,
        'type': 'multiple-choice',
        'status': 'approved',
        'category': category,
        'topic': topic,
        'difficulty': difficulty,
        'question': question,
        'options': options,
        'correctIndex': correct,
        'gmNote': gm,
        'tags': tags,
        'compatibleModes': MC_MODES,
        'timeScope': 'timeless',
        'aiGenerated': True,
        'createdAt': NOW,
        'updatedAt': NOW,
    }


def tf(qid, topic, difficulty, question, answer, gm, tags, category='allgemeinbildung'):
    return {
        'id': qid,
        'type': 'true-false',
        'status': 'approved',
        'category': category,
        'topic': topic,
        'difficulty': difficulty,
        'question': question,
        'correctAnswer': answer,
        'gmNote': gm,
        'tags': tags,
        'compatibleModes': TF_MODES,
        'timeScope': 'timeless',
        'aiGenerated': True,
        'createdAt': NOW,
        'updatedAt': NOW,
    }


NEW_QUESTIONS = [
    # -----------------------------------------------------------------
    # Wissenschaft / Mensch-Fokus: Psychologie, Physiologie, Gesundheit, Medizin
    # -----------------------------------------------------------------
    mc(
        'q-wissenschaft-20', 'wissenschaft', 3,
        'Welcher psychologische Effekt beschreibt, dass Menschen mit geringer Kompetenz ihre eigenen Fähigkeiten systematisch überschätzen?',
        ['Halo-Effekt', 'Dunning-Kruger-Effekt', 'Barnum-Effekt', 'Placebo-Effekt'],
        1,
        'Benannt 1999 nach den Sozialpsychologen David Dunning und Justin Kruger. Wer wenig weiß, weiß auch nicht, was er nicht weiß.',
        ['Psychologie', 'Kognitive Verzerrung', 'Dunning-Kruger'],
    ),
    mc(
        'q-wissenschaft-21', 'wissenschaft', 2,
        'Welcher russische Forscher zeigte am Speichelfluss von Hunden erstmals das Prinzip der klassischen Konditionierung?',
        ['B. F. Skinner', 'Sigmund Freud', 'Iwan Pawlow', 'Carl Rogers'],
        2,
        'Nobelpreis für Medizin 1904 — Experimente mit dem Glockensignal vor der Fütterung.',
        ['Psychologie', 'Konditionierung', 'Pawlow'],
    ),
    mc(
        'q-wissenschaft-22', 'wissenschaft', 3,
        'Welche Blutgruppe gilt bei Erythrozyten-Transfusionen als universeller Spender?',
        ['A negativ', '0 negativ', 'AB positiv', 'B positiv'],
        1,
        'Ohne A/B-Antigene und ohne Rhesus-D — passt in praktisch jedes Empfängerblut. Für Plasma ist es umgekehrt AB.',
        ['Medizin', 'Blutgruppe', 'Transfusion'],
    ),
    mc(
        'q-wissenschaft-23', 'wissenschaft', 2,
        'Wie heißt das schneckenförmige Sinnesorgan im Innenohr, in dem Schallwellen in Nervenimpulse umgewandelt werden?',
        ['Trommelfell', 'Amboss', 'Cochlea', 'Bogengang'],
        2,
        'Cochlea = lateinisch „Schnecke“. Die Sinneshaarzellen sitzen auf der Basilarmembran und feuern tonotopisch.',
        ['Anatomie', 'Ohr', 'Cochlea'],
    ),
    mc(
        'q-wissenschaft-24', 'wissenschaft', 2,
        'Welche Infektionskrankheit erklärte die WHO 1980 offiziell als weltweit ausgerottet?',
        ['Kinderlähmung', 'Diphtherie', 'Masern', 'Pocken'],
        3,
        'Letzter natürlicher Fall 1977 in Somalia. Bis heute die einzige beim Menschen ausgerottete Infektionskrankheit.',
        ['Medizin', 'Pocken', 'WHO'],
    ),
    mc(
        'q-wissenschaft-25', 'wissenschaft', 2,
        'Wie viele Knochen hat ein erwachsener Mensch typischerweise?',
        ['178', '206', '258', '316'],
        1,
        'Neugeborene starten mit rund 270, viele wachsen später zusammen. Wirbel- und Schädelknochen liefern den größten Zählunterschied.',
        ['Anatomie', 'Knochen'],
    ),
    mc(
        'q-wissenschaft-26', 'wissenschaft', 2,
        'Welcher Umweltreiz ist entscheidend, damit die Haut Vitamin D selbst herstellen kann?',
        ['Wärme über 30 °C', 'UVB-Strahlung', 'Salzhaltige Luft', 'Kontakt mit Wasser'],
        1,
        '7-Dehydrocholesterol wird durch UVB (~290–315 nm) zu Prävitamin D3 umgewandelt. Fensterglas filtert UVB heraus.',
        ['Gesundheit', 'Vitamin D', 'UV-Strahlung'],
    ),
    mc(
        'q-wissenschaft-27', 'wissenschaft', 2,
        'Welche Stufe steht in Abraham Maslows klassischer Bedürfnispyramide an der Spitze?',
        ['Sicherheit', 'Zugehörigkeit', 'Wertschätzung', 'Selbstverwirklichung'],
        3,
        'Reihenfolge von unten nach oben: physiologisch, Sicherheit, Zugehörigkeit, Wertschätzung, Selbstverwirklichung.',
        ['Psychologie', 'Maslow', 'Motivation'],
    ),
    mc(
        'q-wissenschaft-28', 'wissenschaft', 2,
        'Welcher Botenstoff wird populär als „Glückshormon“ bezeichnet und ist an der Stimmungsregulation beteiligt?',
        ['Insulin', 'Adrenalin', 'Serotonin', 'Kortisol'],
        2,
        'SSRI-Antidepressiva erhöhen die verfügbare Menge im synaptischen Spalt. Serotonin wird zu über 90 % im Darm produziert.',
        ['Psychologie', 'Serotonin', 'Neurotransmitter'],
    ),
    mc(
        'q-wissenschaft-29', 'wissenschaft', 2,
        'Wer entdeckte 1928 durch Zufall die antibakterielle Wirkung des Penicillins?',
        ['Louis Pasteur', 'Robert Koch', 'Alexander Fleming', 'Paul Ehrlich'],
        2,
        'Ein Schimmelpilz (Penicillium notatum) wuchs in einer vergessenen Bakterienkultur — um die Kolonie herum hemmte er das Wachstum.',
        ['Medizin', 'Penicillin', 'Fleming'],
    ),
    mc(
        'q-wissenschaft-30', 'wissenschaft', 1,
        'Wie viele Kammern hat das menschliche Herz insgesamt?',
        ['2', '3', '4', '5'],
        2,
        'Zwei Vorhöfe (Atrien) plus zwei Hauptkammern (Ventrikel), getrennt durch die Herzscheidewand.',
        ['Anatomie', 'Herz'],
    ),
    mc(
        'q-wissenschaft-31', 'wissenschaft', 2,
        'In welcher Schlafphase treten die intensivsten und lebhaftesten Träume auf?',
        ['Einschlafphase (N1)', 'Leichtschlaf (N2)', 'Tiefschlaf (N3)', 'REM-Schlaf'],
        3,
        'Namensgebende Rapid Eye Movements + fast vollständige Muskelatonie. Ein Erwachsener durchläuft pro Nacht 4–6 REM-Zyklen.',
        ['Gesundheit', 'Schlaf', 'REM'],
    ),
    mc(
        'q-wissenschaft-32', 'wissenschaft', 3,
        'Wie nennt man die Tendenz, Informationen bevorzugt so wahrzunehmen, dass sie die eigenen Überzeugungen bestätigen?',
        ['Ankereffekt', 'Attributionsfehler', 'Confirmation Bias', 'Framing-Effekt'],
        2,
        'Deutsch auch „Bestätigungsfehler“. Wirkt auf Recherche, Erinnerung und Bewertung von Argumenten.',
        ['Psychologie', 'Bias', 'Confirmation Bias'],
    ),
    mc(
        'q-wissenschaft-33', 'wissenschaft', 3,
        'Welcher Muskel gilt gemessen an seiner Kraft pro Querschnittsfläche als der stärkste des menschlichen Körpers?',
        ['Bizeps', 'Waden­muskel (Gastrocnemius)', 'Kaumuskel (Masseter)', 'Großer Gesäßmuskel'],
        2,
        'Der Masseter kann kurzfristig Kaudrücke von über 700 N erreichen — bezogen auf seine Größe ist er die Nummer 1.',
        ['Anatomie', 'Muskel', 'Masseter'],
    ),
    mc(
        'q-wissenschaft-34', 'wissenschaft', 4,
        'Welche Erbkrankheit wird durch einen Defekt auf dem X-Chromosom verursacht und tritt darum fast ausschließlich bei Männern auf?',
        ['Mukoviszidose', 'Sichelzellanämie', 'Hämophilie A', 'Chorea Huntington'],
        2,
        'Männer haben nur ein X-Chromosom — ein Defekt schlägt sofort durch. Frauen sind meist heterozygote Überträgerinnen.',
        ['Medizin', 'Genetik', 'Hämophilie'],
    ),

    # Wissenschaft — True/False
    tf(
        'q-flash-31', 'wissenschaft', 2,
        'Der Mensch nutzt im Alltag nur rund 10 Prozent seines Gehirns.',
        False,
        'Populärer Mythos. Bildgebende Verfahren zeigen, dass im Verlauf eines Tages praktisch alle Hirnregionen aktiv sind.',
        ['Gehirn', 'Mythos', 'Neurowissenschaft'],
    ),
    tf(
        'q-flash-32', 'wissenschaft', 3,
        'Das menschliche Herz pumpt pro Tag rund 7 000 Liter Blut durch den Körper.',
        True,
        'Bei ca. 5 Liter pro Minute × 60 × 24 = 7 200 Liter. In etwa 70 Jahren rund 180 Millionen Liter.',
        ['Herz', 'Physiologie'],
    ),
    tf(
        'q-flash-33', 'wissenschaft', 3,
        'Die Leber ist das einzige menschliche Organ, das sich nach teilweiser Entfernung wieder regenerieren kann.',
        True,
        'Bis zu zwei Drittel können entfernt werden — die Restleber wächst innerhalb von Wochen nahezu auf Originalgröße nach.',
        ['Anatomie', 'Leber', 'Regeneration'],
    ),

    # -----------------------------------------------------------------
    # Essen & Trinken
    # -----------------------------------------------------------------
    mc(
        'q-essen-16', 'essen', 3,
        'Welches deutsche Weinanbaugebiet ist mit rund 27 000 Hektar Rebfläche das größte des Landes?',
        ['Mosel', 'Rheinhessen', 'Pfalz', 'Baden'],
        1,
        'Rheinhessen liegt zwischen Mainz, Bingen, Alzey und Worms — die Pfalz folgt auf Platz 2.',
        ['Wein', 'Deutschland', 'Rheinhessen'],
        category='alltag-lifestyle',
    ),
    mc(
        'q-essen-17', 'essen', 2,
        'Welches Land ist heute mit weitem Abstand der größte Kaffee-Produzent der Welt?',
        ['Kolumbien', 'Vietnam', 'Brasilien', 'Äthiopien'],
        2,
        'Brasilien produziert seit über 150 Jahren rund ein Drittel der weltweiten Kaffee-Ernte, überwiegend Arabica in Minas Gerais.',
        ['Kaffee', 'Brasilien'],
        category='alltag-lifestyle',
    ),
    mc(
        'q-essen-18', 'essen', 2,
        'Welches Gewürz stammt vom Blütengriffel einer Krokus-Art und gilt gewichtsbezogen als das teuerste der Welt?',
        ['Vanille', 'Kardamom', 'Sternanis', 'Safran'],
        3,
        'Rund 150 000 Blüten für ein Kilogramm — Handarbeit, deshalb der Preis. Hauptanbau: Iran und Kaschmir.',
        ['Gewürz', 'Safran'],
        category='alltag-lifestyle',
    ),
    mc(
        'q-essen-19', 'essen', 3,
        'Wie heißt die Garmethode, bei der Lebensmittel im vakuumierten Beutel bei niedriger Temperatur langsam im Wasserbad gegart werden?',
        ['Blanchieren', 'Pochieren', 'Sous-vide', 'Confieren'],
        2,
        'Französisch „unter Vakuum“. Typisch 55–65 °C, mehrere Stunden — gleichmäßiger Garpunkt ohne Übergarung an den Rändern.',
        ['Kochtechnik', 'Sous-vide'],
        category='alltag-lifestyle',
    ),
    mc(
        'q-essen-20', 'essen', 3,
        'Aus welchem Land kam die Nudelsuppe Ramen ursprünglich, bevor sie in Japan zum Nationalgericht wurde?',
        ['China', 'Korea', 'Vietnam', 'Taiwan'],
        0,
        'Ende des 19./Anfang des 20. Jahrhunderts von chinesischen Gastwirten in Yokohama eingeführt (Lāmiàn / Ramen).',
        ['Nudeln', 'Ramen', 'Asien'],
        category='alltag-lifestyle',
    ),
    mc(
        'q-essen-21', 'essen', 3,
        'Welche Pflanze verleiht dem Getränk Absinth seinen bitteren Geschmack und den historischen Ruf als „grüne Fee“?',
        ['Anis', 'Wermut (Artemisia absinthium)', 'Fenchel', 'Ysop'],
        1,
        'Neben Wermut gehören Anis und Fenchel dazu — grüne Farbe kommt vom Chlorophyll der Kräuter, nicht vom Thujon.',
        ['Getränk', 'Absinth', 'Kräuter'],
        category='alltag-lifestyle',
    ),
    mc(
        'q-essen-22', 'essen', 1,
        'Aus welcher Pflanze wird Rohrzucker gewonnen?',
        ['Zuckerrübe', 'Ahornbaum', 'Zuckerrohr', 'Agave'],
        2,
        'Ein bis fünf Meter hohes Süßgras aus tropischen Regionen. Der Saft aus dem Halm wird eingedickt und kristallisiert.',
        ['Zucker', 'Zuckerrohr'],
        category='alltag-lifestyle',
    ),
    mc(
        'q-essen-23', 'essen', 2,
        'Welche Zutat gibt dem Bier hauptsächlich seine bittere Note und wirkt außerdem als natürliches Konservierungsmittel?',
        ['Malz', 'Hefe', 'Hopfen', 'Gerstenkorn'],
        2,
        'Alpha-Säuren (Humulone) aus den Dolden entfalten sich beim Kochen der Würze — je länger, desto bitterer.',
        ['Bier', 'Hopfen'],
        category='alltag-lifestyle',
    ),
    mc(
        'q-essen-24', 'essen', 2,
        'Aus welchem Land stammt das Gericht Bibimbap — eine warme Reisschüssel mit Gemüse, Ei und oft Fleisch?',
        ['China', 'Japan', 'Vietnam', 'Korea'],
        3,
        'Wörtlich „gemischter Reis“. Klassisch in der heißen Steinschale Dolsot, mit rotem Gochujang-Paprikapaste-Klecks obendrauf.',
        ['Küche', 'Korea', 'Bibimbap'],
        category='alltag-lifestyle',
    ),
    mc(
        'q-essen-25', 'essen', 2,
        'Wodurch unterscheidet sich klassischer Espresso in der Zubereitung vom Filterkaffee?',
        ['Er wird über 10 Minuten mit heißem Wasser aufgegossen', 'Wasser wird mit rund 9 bar Druck durch feines Kaffeemehl gepresst', 'Er wird bei Raumtemperatur kalt extrahiert', 'Er wird über offener Flamme aufgekocht'],
        1,
        'Etwa 25 ml in 25–30 Sekunden bei rund 9 bar und ~90 °C — daraus resultiert die typische Crema.',
        ['Kaffee', 'Espresso'],
        category='alltag-lifestyle',
    ),
    mc(
        'q-essen-26', 'essen', 2,
        'Aus welcher Pflanze wird der kalorienarme Süßstoff Stevia gewonnen?',
        ['Aloe Vera', 'Yucca', 'Steviablätter (Süßkraut)', 'Palme'],
        2,
        'Stevia rebaudiana, ein südamerikanisches Korbblütengewächs. Die Steviolglykoside süßen bis zu 300× stärker als Zucker.',
        ['Süßstoff', 'Stevia'],
        category='alltag-lifestyle',
    ),
    mc(
        'q-essen-27', 'essen', 2,
        'Welche Geschmacksrichtung wurde neben süß, sauer, salzig und bitter als fünfter Grundgeschmack anerkannt?',
        ['Fettig', 'Metallisch', 'Umami', 'Scharf'],
        2,
        'Vom japanischen Chemiker Kikunae Ikeda 1908 an Glutaminsäure aus Kombu-Alge beschrieben. Wörtlich „schmackhaft“.',
        ['Geschmack', 'Umami'],
        category='alltag-lifestyle',
    ),

    # Essen — True/False
    tf(
        'q-flash-34', 'essen', 2,
        'Champagner darf laut EU-Recht nur aus der französischen Region Champagne stammen.',
        True,
        'Geschützte Ursprungsbezeichnung (AOC seit 1936, EU-weit anerkannt). Deutsche Winzer nennen ihre Version darum Sekt oder Crémant.',
        ['Champagner', 'Wein', 'EU-Recht'],
        category='alltag-lifestyle',
    ),
    tf(
        'q-flash-35', 'essen', 3,
        'Weißer und grüner Spargel sind zwei verschiedene Sorten der Spargelpflanze.',
        False,
        'Es ist dieselbe Sorte — weißer Spargel wächst nur unter der Erde und bildet ohne Licht kein Chlorophyll. Sobald er die Erde durchstößt, wird er grün.',
        ['Spargel', 'Botanik'],
        category='alltag-lifestyle',
    ),
]


def main() -> int:
    with QUESTIONS_PATH.open('r', encoding='utf-8') as f:
        existing = json.load(f)

    existing_ids = {q['id'] for q in existing}
    to_add = [q for q in NEW_QUESTIONS if q['id'] not in existing_ids]
    skipped = [q['id'] for q in NEW_QUESTIONS if q['id'] in existing_ids]

    if skipped:
        print(f'ℹ  Überspringe {len(skipped)} bereits vorhandene ID(s): {skipped}')
    if not to_add:
        print('Keine neuen Fragen zu ergänzen.')
        return 0

    # Sanity-Check: correctIndex in Range?
    for q in to_add:
        if q['type'] == 'multiple-choice':
            assert 0 <= q['correctIndex'] < len(q['options']), q['id']
            assert len(q['options']) == 4, f'{q["id"]} hat {len(q["options"])} Optionen'

    merged = existing + to_add
    with QUESTIONS_PATH.open('w', encoding='utf-8') as f:
        json.dump(merged, f, ensure_ascii=False, indent=2)
        f.write('\n')

    print(f'✓ {len(to_add)} neue Fragen ergänzt (jetzt {len(merged)} insgesamt).')
    for q in to_add:
        print(f'  + {q["id"]:<24}  {q["topic"]:<14} d={q.get("difficulty")}  {q["question"][:70]}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
