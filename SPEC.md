# SPEC – Quizapp Aufgaben-Backlog

Priorisierter Aufgaben-Katalog. Wird gepflegt, während das Konzept mit den Freunden reift. Aufgaben werden nach Fertigstellung entweder gestrichen oder mit einer Referenz zum Commit versehen.

---

## Meilenstein 1 — Skelett steht (aktuell)

- [x] Vite + React + TypeScript-Setup
- [x] TailwindCSS mit Party-Farbpalette
- [x] Ordnerstruktur (`components/`, `modes/`, `pages/`, `hooks/`, `lib/`, `types/`, `data/`)
- [x] Basis-Typen für Question, Round, Team, GameMode
- [x] Shuffle-Utility für ABCD-Balance
- [x] Placeholder `App.tsx` mit Party-Look-Startseite
- [x] `.kiro/steering/`-Kontext für nächste Agent-Sessions
- [x] README + SPEC

## Meilenstein 2 — Konzept-Stabilisierung (aktuell in Arbeit, extern)

- [ ] Konzept mit Freunden durchgehen (Google Doc, Trello, wöchentlicher Sync)
- [ ] Modi-Katalog für v1 finalisieren (welche Modi sind Muss, welche später)
- [ ] Frage-Kategorien-Baum finalisieren
- [ ] Team-Struktur klären (nur Team-Modus? Einzel? Koop?)
- [ ] Solo-Modus / Remote-Modus entscheiden (später oder gar nicht?)
- [ ] Fragen-Katalog-Startbestand: mindestens 100 Fragen aus dem Google Sheet importieren

## Meilenstein 3 — Erste App-Funktionalität

- [ ] React-Router einbinden (Routen: `/`, `/setup`, `/game/:modeId`, `/round`)
- [ ] Startseite (Hub): Wahl zwischen „Kuratierter Abend" und „Freies Spiel"
- [ ] Freies Spiel: Auswahl eines einzelnen Modus, sofort spielen
- [ ] Team-Setup-Screen (Namen, Anzahl, Farbe)
- [ ] Ein Beispiel-Modus implementiert (Vorschlag: **Quizduell**, weil einfachstes Regelwerk)
  - Kategorie-Auswahl (12 Kategorien-Grid)
  - Frage-Modal mit Multiple-Choice
  - Shuffle der Antwort-Optionen beim Rendern
  - Auflösung + Punktevergabe
  - Endabrechnung
- [ ] Session-State-Persistenz via `localStorage`

## Meilenstein 4 — Modi-Erweiterung

- [ ] **Jeopardy** (5×4-Board, Buzzer-Simulation)
- [ ] **The Chase** (Timer, schnelle Fragen-Sequenz)
- [ ] **Wer wird Millionär** (Ladder mit Punktesteigerung)
- [ ] **Expertenrunde** (Setup-Screen für Fachgebiete, 20 s Solo-Timer)
- [ ] **Warm-up** (5 Rätsel mit Hinweisen)

## Meilenstein 5 — Neue Modi (nach Freunde-Feedback priorisieren)

- [ ] Wahr/Falsch Speed-Round
- [ ] Sortieren / Reihenfolge
- [ ] „Nenn drei" (schnell)
- [ ] Duell 1:1
- [ ] Elimination
- [ ] Wortfetzen / Songzeilen
- [ ] Blind Guess (mit Media-Support)
- [ ] Family Feud

## Meilenstein 6 — Kuratierter Abend

- [ ] Round-Builder: Gastgeber wählt Modi + Reihenfolge + Fragen-Filter
- [ ] Match-Tracker Best-of-N (dynamisch je nach Anzahl Modi)
- [ ] Ablauf-Führung durch den Abend
- [ ] Zwischenstände, Sieger-Popup
- [ ] Export der Runde als Handbuch für den Quizmaster (PDF/DOCX)

## Meilenstein 7 — Master-Controls & QoL

- [ ] Live-Master-Controls: Frage zurücksetzen, Punkte manuell setzen, Frage-Text spontan editieren
- [ ] Fullscreen-Präsentationsmodus (Tastatur-Shortcut)
- [ ] Sounds (Ding, Buzzer, Timer-End)
- [ ] Getrennte Master- und Team-Ansicht (Handy + TV)
- [ ] Post-Session Feedback pro Frage (zu leicht / passt / zu schwer / doppeldeutig)

## Meilenstein 8 — Amplify-Backend

- [ ] Amplify Gen 2 Projekt initialisieren (`npx create-amplify@latest`)
- [ ] GraphQL-Schema aus TypeScript-Interfaces generieren
- [ ] Fragen-Migration von JSON zu DynamoDB
- [ ] Amplify Auth (Cognito) für Multi-User-Support (optional)
- [ ] Amplify Hosting Setup + CI/CD

## Meilenstein 9 — Validator-Skripte

- [ ] ABCD-Balance-Check (welche Position ist wie oft die richtige Antwort in der Runde?)
- [ ] Hint-Check (Antwortworte in der Frage? Regex-basiert)
- [ ] Duplicate-Check gegen Legacy-Handbücher (aus `~/private/quizabend-legacy-handbooks/`)
- [ ] Fragen-Schema-Validierung (TypeScript / JSON Schema)

## Meilenstein 10 — Content-Ausbau

- [ ] Fragen-Katalog auf 500+ Fragen ausbauen
- [ ] Automatischer Import aus dem Google Sheet
- [ ] Kategorie-Coverage-Analyse (welche Kategorien sind unterversorgt?)

---

## Offene Diskussionspunkte

Diese Punkte werden im wöchentlichen Sync mit den Freunden geklärt. Sobald entschieden, hier abhaken und im Steering vermerken.

- [ ] Frontend-State-Management: nur `useState`/`useReducer`, oder Zustand/Jotai/Redux?
- [ ] Router: React Router v6, oder simple `useState`-basierte Navigation?
- [ ] Tests: Vitest ab wann relevant? MSW für Amplify-Mocks?
- [ ] i18n: nur Deutsch, oder auch Englisch-Unterstützung?

---

## Deployment-Hinweise (für später)

- Repository: https://github.com/NicolasB8854/quizapp
- Deployment-Target: AWS Amplify Hosting
- Domain: (offen)
- Env-Variablen: (folgt bei Amplify-Integration)
