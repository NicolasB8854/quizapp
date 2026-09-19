# docs/

Content-Dokumente für die Konzept- und Content-Phase des Quizapp-Projekts.

## Dateien

| Datei | Zweck |
|---|---|
| `konzept-v1.md` | Konzept-Draft v1 (Vision, Modi-Katalog, Fragen-Kategorien, Qualitäts-Prinzipien, offene Diskussions-Fragen). Basis für Google-Docs-Diskussion mit den Freunden. |
| `konzept-v1.docx` | Word-Version des Konzepts — zum Upload nach Google Drive und Konvertierung in ein Google Doc. |
| `setup-collaboration.md` | Schritt-für-Schritt-Anleitung, wie das kollaborative Setup mit Freunden aufgezogen wird (Google Doc, Trello, Google Sheet, WhatsApp/Discord, monatlicher Sync). |
| `trello-cards-startbestand.md` | Vorformatierte Trello-Karten (Titel + Beschreibung) für die vier Startspalten des Kollaborations-Boards. |
| `questions-sheet-template.csv` | Google-Sheet-Vorlage für den Fragen-Katalog mit 20 Spalten (Kategorie, Schwierigkeit, ABCD, Zeitbezug, Autor, Status …) + 3 Beispiel-Fragen als Format-Referenz. Direkt in Google Sheets importierbar. |

## Verhältnis zum Repo

Diese Dokumente sind die **Content- und Prozess-Grundlage** parallel zum Code:

- **Konzept-Iteration:** `konzept-v1.md` wird zu `konzept-v2.md` etc., je nachdem was aus der Freundes-Diskussion rausfällt. Sobald stabil → Kern-Aussagen wandern in `.kiro/steering/project-context.md`.
- **Fragen-Content:** `questions-sheet-template.csv` definiert das Format. Live-Content läuft im Google Sheet und wird periodisch als CSV exportiert nach `src/data/questions.json` (via Migration-Script, das noch zu bauen ist — siehe `SPEC.md` Meilenstein 3).
- **Kollaboration:** `setup-collaboration.md` und `trello-cards-startbestand.md` sind einmalige Bootstrap-Dokumente. Nach dem initialen Setup nicht mehr täglich relevant, bleiben aber als Referenz.

## Legacy

Die Handbücher der bisherigen Runden 1–6 liegen **nicht** hier, sondern separat unter `~/private/quizabend-legacy-handbooks/`. Grund: sie werden für den Duplicate-Check gegen Vorrunden-Fragen gebraucht, aber sind nicht Teil des aktiven App-Codes.
