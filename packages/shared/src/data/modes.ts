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

import type { GameMode } from '../types/round'

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
      'Jede:r wählt ein Fachgebiet und bekommt fünf Fragen daraus — immer schwerer, 100 bis 500 Punkte. Erst die Frage, dann „Antworten anzeigen“: 20 Sekunden. Fehler → das Gegenteam darf stealen (halbe Punkte).',
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
      'Alle Spieler stehen im Ring, reihum eine Frage — jede Runde eine Stufe schwerer. Fehler → Ausscheiden. Wenn nur noch ein Team steht, gibt es einen Team-Bonus.',
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
      'Jedes Team bekommt einen Zeit-Sprint mit möglichst vielen Fragen. Falsch geantwortet → die anderen dürfen buzzern: richtig gibt Punkte, falsch kostet Punkte. Auslassen kostet nichts.',
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
      'Fünf Stufen von leicht bis Experte mit hohem Endgewinn. Die Teams loggen verdeckt ein, aufgelöst wird gleichzeitig.',
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
      'Jeder Spieler bekommt eine Frage aus seinem eigenen Interessensprofil und tippt die Antwort auf seinem Handy. Bei Fehler übernimmt das Gegenteam (halbe Punkte).',
    estimatedMinutes: 12,
    scoresMatchPoint: true,
    accent: 'spotlight',
    status: 'ready',
  },
  {
    id: 'blindguess',
    name: 'Bilderrätsel',
    chipLabel: 'Bilder',
    tagline: 'Erkennst du, was du siehst?',
    description:
      'Ein Bild wird langsam scharf — alle Teams tippen gleichzeitig. Wer früh richtig liegt, kassiert mehr Punkte. Sechs Bilder, von leicht bis knifflig.',
    estimatedMinutes: 10,
    scoresMatchPoint: true,
    accent: 'picture',
    status: 'ready',
  },
  {
    id: 'geoguess',
    name: 'Wo liegt das?',
    chipLabel: 'Weltkarte',
    tagline: 'Setz die Nadel — wer liegt näher dran?',
    description:
      'Eine Stadt oder ein Ort wird genannt, jedes Team setzt auf der Weltkarte seine Nadel. Je näher dran, desto mehr Punkte — das nächste Team bekommt einen Bonus. Acht Orte, von Rom bis Timbuktu.',
    estimatedMinutes: 12,
    scoresMatchPoint: true,
    accent: 'geo',
    status: 'ready',
  },
  {
    id: 'geo-hints',
    name: 'Heißer Draht',
    chipLabel: 'Weltkarte',
    tagline: 'Wer früh die Nadel setzt, kassiert doppelt.',
    description:
      'Kein Ortsname, nur Hinweise — vom vagen „Hier gibt es keine Autos“ bis zum Volltreffer. Der Host deckt Hinweis für Hinweis auf. Je früher eure Nadel sitzt, desto mehr zählt sie (bis ×2).',
    estimatedMinutes: 12,
    scoresMatchPoint: true,
    accent: 'geo',
    status: 'ready',
  },
  {
    id: 'geo-shape',
    name: 'Länder-Umriss',
    chipLabel: 'Weltkarte',
    tagline: 'Nur die Silhouette — und die ist auch noch gedreht.',
    description:
      'Ihr seht den Umriss eines Landes, ohne Nachbarn und schräg gestellt. Setzt die Nadel dorthin, wo das Land liegt. Wer drinnen landet, bekommt volle Punkte.',
    estimatedMinutes: 10,
    scoresMatchPoint: true,
    accent: 'geo',
    status: 'ready',
  },
  {
    id: 'geo-history',
    name: 'Zeitreise',
    chipLabel: 'Weltkarte',
    tagline: 'Wo ist das passiert?',
    description:
      'Mauerfall, Titanic, Woodstock: Ein Ereignis wird genannt, ihr setzt die Nadel dorthin, wo es stattfand. Geschichte trifft Geografie.',
    estimatedMinutes: 12,
    scoresMatchPoint: true,
    accent: 'geo',
    status: 'ready',
  },
  {
    id: 'hum-duel',
    name: 'Summ-Duell',
    chipLabel: 'Musik',
    tagline: 'Summ es — dein Team muss es erraten.',
    description:
      'Eine Person sieht auf ihrem Handy einen Songtitel und summt ihn, ohne Worte. Das eigene Team rät laut. Klappt es nicht, darf das Gegnerteam einmal stehlen. Reihum, bis jedes Team zweimal dran war.',
    estimatedMinutes: 12,
    scoresMatchPoint: true,
    accent: 'music',
    status: 'ready',
  },
  {
    id: 'song-year',
    name: 'Welches Jahr?',
    chipLabel: 'Musik',
    tagline: 'Wann kam dieser Song raus?',
    description:
      'Ein Song wird genannt, jedes Team schätzt das Erscheinungsjahr. Genau getroffen gibt 300 Punkte, ein Jahr daneben noch 200 — das nächste Team bekommt einen Bonus.',
    estimatedMinutes: 8,
    scoresMatchPoint: true,
    accent: 'music',
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
  picture:   '#3FD0FF',
  geo:       '#3FD98B',
  music:     '#FF77B0',
}
