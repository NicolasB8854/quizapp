---
inclusion: always
---

# Projekt-Kontext: Quizapp

Modularer Quizabend-Baukasten für Freundes-Runden. Aktuell in v0.1 — reines Skelett, das Konzept wird gerade extern mit Freunden abgestimmt.

## Repo-Fakten

- **GitHub:** https://github.com/NicolasB8854/quizapp (public)
- **Owner:** Nicolas (nbogun001 lokal)
- **Stack:** React 18 + TypeScript + Vite + TailwindCSS
- **Fragen-Storage v0:** JSON in `src/data/questions.json`
- **Fragen-Storage v1 (geplant):** Amplify Gen 2 mit GraphQL/DynamoDB
- **Deployment:** AWS Amplify Hosting (Nicolas macht das später selbst — er ist Steuerberater mit AWS-SAP-Zertifizierungs-Fokus)

## Vision

Zwei Nutzungs-Modi in einer App:

1. **Kuratierter Quizabend** — Gastgeber stellt vorab eine Abendfolge aus mehreren Spielmodi zusammen. Match-Tracker (Best-of-N) über den Abend hinweg. Zeit: 90–150 Min.
2. **Freies Spiel** — Ein einzelner Modus, spontan, ohne Match-Kontext. Zeit: 15–30 Min.

## Spielmodi-Katalog

Sechs bewährte Modi (aus 6 Runden Prototyp-Erfahrung):

- **Warm-up „Genial daneben"** — 5 Rätsel mit stufenweisen Hinweisen, kooperativ, keine Wertung
- **Quizduell / „Wer weiß denn sowas?"** — 12 Kategorien-Grid, Multiple Choice, 500 Punkte je richtig
- **Jeopardy** — 5 × 4 Board, Buzzer, 100/200/300/400
- **Expertenrunde** — Jede/r Spieler:in wählt vorab ein Fachgebiet; Solo-Timer 20 s, dann Buzzer-Steal
- **The Chase** — 90 s pro Team, 15 schnelle Fragen
- **Wer wird Millionär** — 5 Fragen mit steigendem Wert (100 € → 1 Mio €)

Acht neue Modi in Diskussion (Details in `SPEC.md` und `Quizabend_Konzept_v1` im Vault):
Wahr/Falsch Speed, Wortfetzen/Songzeilen, Reihenfolge/Sortieren, Blind Guess, Family Feud, Duell 1:1, Elimination, „Nenn drei", Pantomime.

## Fragen-Kategorien

Breit gefächert, mindestens 500+ Fragen im Startbestand geplant:

- **Popkultur & Medien** (Film, Serien, Musik, Videospiele, Comics, Bücher)
- **Allgemeinbildung** (Geografie, Geschichte, Politik, Wirtschaft, Wissenschaft, Sprache)
- **Alltag & Lifestyle** (Essen, Reisen, Sport, Mode, Beauty, Technologie)
- **Spezialgebiete** (Kunst, Architektur, Philosophie, Recht, Natur)
- **Kurioses & Rätsel** (Alltagsphänomene, Weltrekorde, Statistik-Kuriositäten)

## Fragen-Qualitäts-Prinzipien (aus Runde-6-Feedback)

Diese Prinzipien sind hart — sie führten in der Praxis zu Problemen und müssen vom Content-Prozess UND von der App-Architektur unterstützt werden:

1. **Keine Antwortworte in der Frage.** Wenn die Antwort „Taylor Swift" ist, darf im Fragetext kein „Taylor" auftauchen. Antwort-Kontext gehört in `gmNote`, nicht in `question`.

2. **Schwierigkeit an Punktwert kalibrieren.**
   - `leicht` (z. B. 100 Punkte): Allgemeinwissen, sofort sitzt
   - `mittel` (200): Etwas Erinnerungsarbeit, die meisten kennen es
   - `schwer` (300): Fachwissen, nur Interessierte
   - `experten` (400): Spezialisiert, ohne Vorkenntnis kaum machbar

3. **ABCD-Verteilung balancieren.** Die App **muss** Multiple-Choice-Optionen beim Rendern shufflen. Reihenfolge im JSON ist egal — Utility `src/lib/shuffle.ts` liefert das mit Original-Index-Mapping. Bei 5 Millionär-Fragen dürfen nicht 5× dieselbe Position richtig sein.

4. **Keine Duplikate zwischen Runden.** Vor jeder Runde-Konfiguration Duplicate-Check gegen `question.usedInRounds[]`. Legacy-Handbücher der Runden 1–6 liegen unter `~/private/quizabend-legacy-handbooks/` und müssen beim Aufbau des Katalogs auf Duplikate geprüft werden.

5. **Zeit-genaue Formulierung.** Bei Fakten mit Datum/Rekorden: `timeReference.referenceDate` setzen, damit die Frage später filterbar/warnbar wird („Achtung, älter als 2 Jahre").

6. **Antworten müssen eindeutig sein.** Keine „vermutlich"-Antworten. Wenn mehrere richtige Lösungen möglich sind: entweder umformulieren oder als Multiple-Answer-Frage markieren.

7. **Popkultur mit Verfallsdatum kennzeichnen.** Trends wie „Brat Summer 2024" mit `timeReference.isTimeSensitive: true` markieren.

## Team-Struktur (Standard)

- 2 Teams à 2–4 Personen
- Team-Farben und Namen im Setup-Screen
- App muss aus vielen Freundeskreisen einsetzbar sein — **keine hardcoded Personen** oder personalisierten Themen (die Show-Runner-App aus Runde 6 hatte das, ist bewusst wegfallen). Fachgebiete für die Expertenrunde werden pro Runde im Setup konfiguriert.

## Bekannte Anti-Patterns (aus Runde-6-App)

Diese Sachen sind in der Vorgänger-App aufgefallen und sollten hier nicht wiederholt werden:

- **Deutsche typografische Anführungszeichen in JS-Strings** (`„Text"` mit ASCII-Anführungszeichen schließend) brechen JS-Syntax. In TypeScript + Bundler ist das entschärft, weil Strings über Encoding-Import laufen.
- **State-Mutation ohne einzige Wahrheitsquelle.** In der Vorgänger-App waren Punktzahlen und Match-Punkte in verschiedenen `STATE.*.*`-Slots verteilt und mussten manuell synchronisiert werden. Hier: **ein zentraler State-Manager** (React-Reducer oder Zustand), der die ganze Runde kapselt.
- **Native `alert()`/`confirm()`-Dialoge.** Für Ja/Nein-Entscheidungen und Sieger-Popups eigene stylische Modals bauen, keine Browser-nativen Dialoge.
- **Kein Fragen-Recycling-Schutz.** Duplicate-Check gegen `usedInRounds[]` muss vor Runden-Konfiguration laufen.

## Nächste Prioritäten

Siehe `SPEC.md`. Zusammengefasst:

1. Konzept mit Freunden stabilisieren (extern, in Google Docs)
2. React-Router einbauen, Hub-Page bauen
3. Ein Muster-Modus umsetzen (Vorschlag: Quizduell) — als Blaupause für alle weiteren Modi
4. Fragen-Katalog-Import aus Google Sheet als Skript

## Ton und Format

- **Sprache:** UI und Content Deutsch. Code-Kommentare Englisch ok.
- **Anführungszeichen im Content:** typografisch (`„…"`), nicht ASCII.
- **Deutsch-freundliche Sortierung:** Umlaute korrekt (`ä` = `ae` beim Sortieren? Diskussion offen).
- **Namen von Modi in Code:** englisch, in `kebab-case` (`quizduell`, `true-false-speed`, `blindguess`).
- **Namen von Modi in UI:** deutsch, freundlich (`Quizduell`, `Wahr oder Falsch – Speed`, `Blind Guess`).
