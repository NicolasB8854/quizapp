/**
 * Die 50 Themenfelder — Grundlage für Interessen-Matching, Themen-Battle-
 * Grid (12 nach Team-Interessen gewichtete Kacheln), Category-Board (5
 * Kategorien) und Experts-Fachwahl.
 *
 * IDs sind konsistent mit dem `Topic`-Typ (kebab-case ohne Umlaute).
 * `label` = deutsche UI-Anzeige, `emoji` = kleiner Wiedererkennungs-Anker.
 *
 * Session AC: von 12 auf 50 erweitert. Reihenfolge = grobe Cluster für die
 * UI-Darstellung, wenn wir mal eine „alle Kategorien"-Seite bauen.
 */

import type { Topic } from '../types/question'

export interface TopicDef {
  id: Topic
  label: string
  emoji: string
}

export const TOPICS: TopicDef[] = [
  // Klassiker (11)
  { id: 'film',        label: 'Film',                       emoji: '🎬' },
  { id: 'serien',      label: 'Serien',                     emoji: '📺' },
  { id: 'musik',       label: 'Musik',                      emoji: '🎵' },
  { id: 'games',       label: 'Games',                      emoji: '🎮' },
  { id: 'geografie',   label: 'Geografie',                  emoji: '🌍' },
  { id: 'geschichte',  label: 'Geschichte',                 emoji: '⏳' },
  { id: 'sport',       label: 'Sport',                      emoji: '⚽' },
  { id: 'essen',       label: 'Essen',                      emoji: '🍽' },
  { id: 'technik',     label: 'Technik',                    emoji: '💻' },
  { id: 'sprache',     label: 'Sprache',                    emoji: '💬' },
  { id: 'kurioses',    label: 'Kurioses',                   emoji: '🤯' },
  // Denken & Gesellschaft (5)
  { id: 'religion',    label: 'Religion & Philosophie',     emoji: '☯' },
  { id: 'politik',     label: 'Politik & Gesellschaft',     emoji: '🗳' },
  { id: 'wirtschaft',  label: 'Wirtschaft & Finanzen',      emoji: '💰' },
  { id: 'recht',       label: 'Recht & Kriminalität',       emoji: '⚖' },
  { id: 'bildung',     label: 'Bildung & Universitäten',    emoji: '🎓' },
  // Alltag & Lifestyle (6)
  { id: 'gesundheit',  label: 'Gesundheit & Fitness',       emoji: '💪' },
  { id: 'reisen',      label: 'Reisen & Urlaub',            emoji: '🧳' },
  { id: 'mode',        label: 'Mode & Style',               emoji: '👗' },
  { id: 'wohnen',      label: 'Wohnen & Einrichtung',       emoji: '🛋' },
  { id: 'beauty',      label: 'Beauty & Kosmetik',          emoji: '💄' },
  { id: 'autos',       label: 'Autos & Verkehr',            emoji: '🚗' },
  // Natur & Umwelt (3)
  { id: 'natur',       label: 'Natur & Tiere',              emoji: '🐾' },
  { id: 'umwelt',      label: 'Umwelt & Klima',             emoji: '🌱' },
  { id: 'wetter',      label: 'Wetter & Naturphänomene',    emoji: '⛅' },
  // Hobbys & Handwerk (4)
  { id: 'hobbys',      label: 'Hobbys',                     emoji: '🎯' },
  { id: 'handwerk',    label: 'Handwerk & DIY',             emoji: '🔨' },
  { id: 'pflanzen',    label: 'Pflanzen & Gartenarbeit',    emoji: '🌿' },
  { id: 'fotografie',  label: 'Fotografie',                 emoji: '📷' },
  // Kunst & Buchstaben (5)
  { id: 'kunst',       label: 'Bildende Kunst & Malerei',   emoji: '🖼' },
  { id: 'literatur',   label: 'Literatur & Bücher',         emoji: '📚' },
  { id: 'theater',     label: 'Theater & Bühne',            emoji: '🎭' },
  { id: 'architektur', label: 'Architektur & Design',       emoji: '🏛' },
  { id: 'comics',      label: 'Comics & Superhelden',       emoji: '🦸' },
  // Wissenschaft — vertieft (7)
  { id: 'astronomie',  label: 'Astronomie & Weltraum',      emoji: '🌌' },
  { id: 'physik',      label: 'Physik',                     emoji: '⚛' },
  { id: 'biologie',    label: 'Biologie & Genetik',         emoji: '🧬' },
  { id: 'chemie',      label: 'Chemie & Elemente',          emoji: '⚗' },
  { id: 'medizin',     label: 'Medizin & Anatomie',         emoji: '🩺' },
  { id: 'psychologie', label: 'Psychologie & Verhalten',    emoji: '🧠' },
  { id: 'mathematik',  label: 'Mathematik & Zahlen',        emoji: '🔢' },
  // Fantasy & Fandom (2)
  { id: 'anime',       label: 'Anime & Manga',              emoji: '🍥' },
  { id: 'scifi',       label: 'Sci-Fi & Fantasy',           emoji: '🚀' },
  // Party & Fun (4)
  { id: 'beziehungen', label: 'Beziehungen & Liebe',        emoji: '💌' },
  { id: 'mystery',     label: 'Mystery & Übernatürliches',  emoji: '👻' },
  { id: 'astrologie',  label: 'Astrologie & Sternzeichen',  emoji: '✨' },
  { id: 'prominente',  label: 'Prominente & Royals',        emoji: '👑' },
  // Trinken & Genuss (3)
  { id: 'getraenke',   label: 'Wein, Bier & Cocktails',     emoji: '🍷' },
  { id: 'kaffee',      label: 'Kaffee & Tee',               emoji: '☕' },
  { id: 'suesses',     label: 'Süßigkeiten & Desserts',     emoji: '🍩' },
]

export const TOPICS_BY_ID: Record<Topic, TopicDef> = Object.fromEntries(
  TOPICS.map((t) => [t.id, t]),
) as Record<Topic, TopicDef>
