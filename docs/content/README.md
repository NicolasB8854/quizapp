# Content-Pflege

## Tags für Fragen einpflegen

Zum Editieren gibt es eine dedizierte Datei, damit du nicht in `src/data/questions.json`
zwischen 108 großen Objekten navigieren musst.

### Ablauf

```bash
# 1. Editier-Datei aus dem aktuellen Katalog neu bauen (Auto-Vorschläge inklusive)
python3 scripts/build-tags-editing-file.py

# 2. Datei öffnen und `tags`-Arrays pflegen
# → docs/content/questions-tags.json

# 3. Zurück in den Katalog importieren
python3 scripts/apply-tags.py
```

### Was in `questions-tags.json` steht

Pro Frage:

```json
{
  "id": "q-film-01",
  "topic": "film",
  "difficulty": 3,
  "type": "multiple-choice",
  "question": "Welcher Film gewann 2020 …?",
  "correctAnswer": "Parasite",
  "gmNote": "Bong Joon-ho gewann außerdem …",

  "tagsSuggested": [        // ← nur Referenz, wird nicht importiert
    "Parasite", "2020", "Oscar", "Bong Joon", "Originaldrehbuch"
  ],
  "tags": []                // ← DAS bearbeitest du
}
```

- **Nur `tags` wird importiert.** Alle anderen Felder sind Kontext / read-only.
- `tagsSuggested` zeigt, was der Auto-Extractor gefunden hat — als Startpunkt.
  Du kopierst raus, was sinnvoll ist, und ergänzt eigene Tags.
- Tags sind freie Strings. Konvention: markante Eigennamen, Jahreszahlen,
  Sub-Themen (z. B. „NBA", „Ghibli", „1990er", „Comeback", „Live-Aid").
- Empfehlung: **3-6 gute Tags** pro Frage. Weniger ist besser als viele
  generische. Ziel = später filtern (Blitzrunde, Themen-Battle, KI-Match).

### Was der Auto-Extractor findet

- 4-stellige Jahreszahlen (1800-2099)
- Eigennamen: 1-3 großgeschriebene Wörter hintereinander (also Personen,
  Marken, Städte, Titel)
- Die richtige Antwort einer MC-Frage direkt

### Was der Auto-Extractor NICHT findet

- Themen-Cluster wie „Weltraum" oder „Kalter Krieg" (musst du selbst hinzufügen)
- Generische Substantive („Regie", „Album", „Team") werden zurecht ausgefiltert;
  wenn du sie doch als Tag willst, tipp sie manuell rein.
- Englische Titel mit „of/the/and" (z. B. „The Lord of the Rings"): nur die
  MC-Antwort wird direkt übernommen, im Fragetext fallen sie in Stücke.

### Zurück-Import

`scripts/apply-tags.py` schreibt die `tags`-Arrays in `src/data/questions.json`
und aktualisiert `updatedAt`. Fragen, deren ID nicht in der Editier-Datei steht,
bleiben unverändert (nützlich, wenn du nur einen Teil pflegen willst).

### Wenn du neue Fragen im Katalog anlegst

Danach einmal `build-tags-editing-file.py` neu laufen lassen — die neuen Fragen
werden mit Auto-Vorschlägen ergänzt, bestehende gepflegte `tags` bleiben erhalten.
