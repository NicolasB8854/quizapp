/**
 * Katalog der Spielmodi.
 *
 * Namen sind bewusst neutrale Eigenbezeichnungen und referenzieren keine existierenden
 * TV-Show-Marken. IDs bleiben englisch/kebab-case, UI-Namen sind deutsch.
 *
 * Nur `category-duel` ist in v0.1 spielbar (`status: 'ready'`). Alle anderen sind bewusst
 * als „geplant" markiert und tauchen im UI mit einem „Bald verfügbar"-Chip auf, damit die
 * Modus-Auswahl visuell bereits komplett ist.
 */

import type { GameMode } from '@/types/round'

export const MODES: GameMode[] = [
  {
    id: 'category-duel',
    name: 'Themen-Battle',
    chipLabel: 'Wissen',
    tagline: 'Wähle das Feld, kassier die Punkte.',
    description:
      '12 offen liegende Themen. Teams wählen abwechselnd ein Feld, Multiple Choice, 500 Punkte pro richtige Antwort.',
    estimatedMinutes: 20,
    scoresMatchPoint: true,
    accent: 'duel',
    status: 'ready',
  },
  {
    id: 'around-corner',
    name: 'Klick!',
    chipLabel: 'Warm-Up',
    tagline: 'Alltagsphänomene, die eine unerwartete Erklärung haben.',
    description:
      'Fünf Rätsel mit stufenweisen Hinweisen. Alle beraten gemeinsam, ohne Wertung — der ideale Auftakt.',
    estimatedMinutes: 15,
    scoresMatchPoint: false,
    accent: 'corner',
    status: 'ready',
  },
  {
    id: 'category-board',
    name: 'Punktejagd',
    chipLabel: 'Klassiker',
    tagline: 'Fünf Kategorien, vier Punktwerte, klare Ansage.',
    description:
      '5×4-Board mit steigenden Werten. Wer zuerst summt, antwortet. Fehler geben der Gegenseite die Chance.',
    estimatedMinutes: 25,
    scoresMatchPoint: true,
    accent: 'board',
    status: 'ready',
  },
  {
    id: 'experts',
    name: 'Fachrunde',
    chipLabel: 'Expertise',
    tagline: 'Jede:r bringt ein eigenes Fachgebiet mit.',
    description:
      'Vor Rundenstart legt jede:r Spieler:in ein Fachgebiet fest. 20 Sekunden Solo-Zeit, dann Buzzer-Steal für die Gegenseite (halbe Punkte).',
    estimatedMinutes: 20,
    scoresMatchPoint: true,
    accent: 'experts',
    status: 'ready',
  },
  {
    id: 'elimination',
    name: 'Elimination',
    chipLabel: 'Ausdauer',
    tagline: 'Wer falsch antwortet, setzt sich. Letzter bringt den Bonus.',
    description:
      'Alle Spieler stehen im Ring, reihum eine Frage. Fehler → Ausscheiden. Wenn nur noch ein Team steht, gibt es einen Team-Bonus.',
    estimatedMinutes: 10,
    scoresMatchPoint: true,
    accent: 'sprinter',
    status: 'ready',
  },
  {
    id: 'duel-1v1',
    name: 'Duell 1:1',
    chipLabel: 'Direkt',
    tagline: 'Vertreter gegen Vertreter — wer zuerst summt, antwortet.',
    description:
      'Fünf Duelle: jedes Team schickt einen Spieler. Buzzer entscheidet, wer die Frage bekommt. Fehler → das andere Team darf stealen.',
    estimatedMinutes: 10,
    scoresMatchPoint: true,
    accent: 'duel',
    status: 'ready',
  },
  {
    id: 'sprinter',
    name: 'Sprinter',
    chipLabel: 'Tempo',
    tagline: '90 Sekunden pro Team. Weiter oder Antwort — deine Wahl.',
    description:
      'Jedes Team bekommt einen Zeit-Sprint mit möglichst vielen Fragen. „Weiter" kostet nichts, Auslassen ist Strategie.',
    estimatedMinutes: 10,
    scoresMatchPoint: true,
    accent: 'sprinter',
    status: 'ready',
  },
  {
    id: 'points-ladder',
    name: 'Alles oder Nichts',
    chipLabel: 'Spannung',
    tagline: 'Fünf Fragen, jede mehr wert als die vorherige.',
    description:
      'Aufsteigende Punkte-Ladder mit hohem Endgewinn. Verdeckte Antworten der Teams, gleichzeitige Auflösung.',
    estimatedMinutes: 15,
    scoresMatchPoint: true,
    accent: 'ladder',
    status: 'ready',
  },
  {
    id: 'flash',
    name: 'Blitzrunde',
    chipLabel: 'Speed',
    tagline: 'Wahr oder falsch — schnell entschieden.',
    description:
      'Zehn Behauptungen, die Teams zeigen simultan „W" oder „F". Punkte pro Treffer, hohes Tempo.',
    estimatedMinutes: 8,
    scoresMatchPoint: true,
    accent: 'flash',
    status: 'ready',
  },
  {
    id: 'player-spotlight',
    name: 'Heimspiel',
    chipLabel: 'Persönlich',
    tagline: 'Deine Kategorie, dein Moment im Rampenlicht.',
    description:
      'Jeder Spieler bekommt eine Frage aus seinem eigenen Interessensprofil. Antwortet frei — bei Fehler übernimmt das Gegenteam (halbe Punkte).',
    estimatedMinutes: 12,
    scoresMatchPoint: true,
    accent: 'spotlight',
    status: 'ready',
  },
]

export const MODES_BY_ID: Record<string, GameMode> = Object.fromEntries(
  MODES.map((m) => [m.id, m]),
)

/** Hex-Werte parallel zur Tailwind-`mode.*`-Palette — für inline-Styles. */
export const ACCENT_HEX: Record<GameMode['accent'], string> = {
  duel:      '#27D8FF',
  board:     '#F0B23A',
  sprinter:  '#FF6E5C',
  ladder:    '#E9C46A',
  corner:    '#F4A261',
  experts:   '#B78BFF',
  flash:     '#FF3D8B',
  spotlight: '#FFB84D',
}
