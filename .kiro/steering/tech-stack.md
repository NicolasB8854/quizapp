---
inclusion: always
---

# Technologie-Entscheidungen

## Fixiert (nicht ändern ohne Rücksprache mit Nicolas)

- **Frontend:** React 18 mit TypeScript
- **Build-Tool:** Vite 5
- **Styling:** TailwindCSS 3
- **Deployment (später):** AWS Amplify Hosting
- **Fragen-Storage (v1, später):** Amplify Gen 2 mit GraphQL/DynamoDB

## Offen — pragmatische Wahl bis Rücksprache

- **State-Management:** aktuell nur `useState`/`useReducer` — falls die App wächst und globales State-Sharing komplex wird, in Rücksprache mit Nicolas Zustand oder Jotai einführen. Nicht Redux (Overkill für dieses Projekt).
- **Routing:** React Router v6 planen. Erste Version geht aber auch mit `useState`-basiertem View-Switching.
- **Forms:** wenn nötig, React Hook Form. Sonst Vanilla.
- **Tests:** Vitest + React Testing Library. Ab Meilenstein 4 sinnvoll.
- **Icons:** `lucide-react` bevorzugen (leichtgewichtig, TypeScript-Support).
- **Animations:** Framer Motion, wenn's mehr als CSS-Transitions braucht. Vorerst Tailwind.

## Fragen-Storage-Migration von JSON zu Amplify

**Aktuell (v0):** JSON in `src/data/questions.json` — Vorteile: schnell zu starten, git-versionierbar, kein Backend nötig. Nachteil: nicht skalierbar über ein paar hundert Fragen.

**Später (v1+):** Amplify Gen 2 mit GraphQL API + DynamoDB. Vorteile: skaliert, Filter/Search per Index, kollaborative Bearbeitung möglich. Nachteil: braucht AWS-Account-Setup.

**Migration-Prinzip:** Die TypeScript-Interfaces in `src/types/question.ts` sind so gestaltet, dass sie direkt in ein GraphQL-Schema mappen. Beim Migration-Zeitpunkt wird das Schema aus den Typen generiert (`amplify/data/resource.ts` in Amplify Gen 2). Die App greift dann statt auf JSON auf die Amplify-Client-API zu — die Feld-Struktur bleibt gleich.

## Bekannte Gotchas

- **Vite + Tailwind:** Config über `tailwind.config.js`, PostCSS über `postcss.config.js`. Tailwind-Klassen mit CSS-Variablen-Colors: Farb-Definitionen in `tailwind.config.js` unter `theme.extend.colors`.
- **TypeScript strict mode:** ist an. Kein `any` ohne guten Grund. Wenn nötig `unknown` + Type Guard.
- **Path Alias `@/`:** in `vite.config.ts` und `tsconfig.json` definiert. Nutze `import { Question } from '@/types/question'` statt relative Pfade.
- **Fonts:** Playfair Display + Inter werden via Google Fonts in `index.html` geladen. Kein extra Package nötig.
- **JSON-Import:** Da `resolveJsonModule` in `tsconfig.json` an ist, funktioniert `import questions from '@/data/questions.json'`.

## Amplify Gen 2 Vorbereitungs-Hinweise (für Meilenstein 8)

Wenn die Zeit gekommen ist, das Backend zu bauen:

1. `npm create amplify@latest` im Repo-Root — legt `amplify/`-Ordner an
2. `amplify/data/resource.ts` mit GraphQL-Schema aus TypeScript-Interfaces befüllen
3. `amplify/auth/resource.ts` mit Cognito einrichten (falls Auth gewünscht)
4. `npx amplify sandbox` für lokales Testen
5. `npx amplify deploy` für Deployment
6. Frontend-Integration über `@aws-amplify/data` Client

Nicolas hat AWS-SAP-Kontext und kann bei Amplify-Fragen kompetent mitreden.
