# Quizapp

Modularer Quizabend-Baukasten für Freundes-Runden. Show-Runner-App, mit der man sich einen Abend aus verschiedenen Spielmodi zusammenstellen oder einzelne Modi spontan spielen kann.

**Status:** Skelett. Konzept-Draft wird gerade mit Freunden abgestimmt. Diese v0.1 hat nur die technische Grundstruktur — noch keine Spielmodi, kein Content.

## Stack

- **Frontend:** React 18 + TypeScript
- **Build:** Vite 5
- **Styling:** TailwindCSS 3
- **Fragen-Storage:** aktuell JSON in `src/data/` (Migration zu Amplify GraphQL/DynamoDB geplant für v1)
- **Deployment:** AWS Amplify Hosting (geplant)

## Setup

```bash
git clone git@github.com:NicolasB8854/quizapp.git
cd quizapp
npm install
npm run dev
```

Öffnet http://localhost:5173.

Andere Kommandos:
- `npm run build` – Production-Build in `dist/`
- `npm run preview` – Lokaler Preview des Production-Builds
- `npm run typecheck` – TypeScript-Typprüfung ohne Emit
- `npm run lint` – ESLint (Config folgt)

## Struktur

```
quizapp/
├── src/
│   ├── App.tsx                     ← Root-Component
│   ├── main.tsx                    ← Entry Point
│   ├── index.css                   ← Tailwind Imports + Base
│   ├── components/                 ← wiederverwendbare UI-Bausteine
│   ├── modes/                      ← ein Ordner pro Spielmodus (folgt)
│   ├── pages/                      ← Top-Level-Views (Hub, Setup, Game)
│   ├── hooks/                      ← React-Hooks
│   ├── lib/                        ← Utilities (Shuffle, Formatter etc.)
│   ├── types/                      ← TypeScript-Interfaces (Question, Round, ...)
│   └── data/                       ← JSON-Content (questions.json, rounds.json)
├── public/                         ← statische Assets
├── .kiro/steering/                 ← Projekt-Kontext für Kiro-Agents
├── .github/workflows/              ← CI/CD (folgt)
├── SPEC.md                         ← Aufgaben-Backlog für nächste Iterationen
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
└── postcss.config.js
```

## Was als Nächstes ansteht

Siehe `SPEC.md` für den priorisierten Backlog. Grober Ablauf:

1. Konzept mit Freunden abstimmen (extern, in Google Docs)
2. Steering-Datei mit finalem Konzept füllen
3. Erster Spielmodus implementieren (Vorschlag: Quizduell als einfachster mit klarem Regelwerk)
4. Fragen-Katalog aus dem Google Sheet importieren (`src/data/questions.json`)
5. Weitere Modi inkrementell
6. Amplify-Backend integrieren (Migration von JSON zu DynamoDB)
7. Deployment via Amplify Hosting

## Kontext-Historie

Vorgänger dieses Repos war eine Single-Page-HTML-Show-Runner-App, die als Prototyp für Runde 6 mit Freunden erprobt wurde. Das Feedback lieferte drei Kernlernungen (Schwierigkeit, Formulierungen, ABCD-Balance) — diese fließen in das neue Design ein. Details in `.kiro/steering/project-context.md`.

Legacy-Handbücher der Runden 1–6 liegen unter `~/private/quizabend-legacy-handbooks/` (nicht in diesem Repo) und werden für den Duplicate-Check gegen Vorrunden-Fragen gebraucht.

## Konzept-Draft

Aktuell lebt das Konzept in Nicolas' Obsidian-Vault unter `Quizabend_Konzept_v1.md` und wird parallel in einem Google Doc mit den Freunden weiterentwickelt. Sobald das Konzept stabilisiert ist, wird der finale Stand als Steering-Datei in dieses Repo überführt.
