/**
 * Vordefinierte Sub-Interessen pro Topic für den Interest-Editor (Session AA).
 *
 * Die Liste ist bewusst kurz (10-12 pro Topic) und deckt die verbreitetsten
 * Sub-Kategorien ab — was die meisten Spieler tatsächlich als „Ich mag XYZ"
 * angeben. Freier Text bleibt erlaubt; das ist nur das Vorschlags-Set für die
 * Auto-Complete.
 *
 * Konzept-PDF, Kapitel 3: „Ein Spielerinteresse wie „Lakers" oder „Fantasy"
 * darf als freier Input erfasst werden, muss intern aber auf bestehende
 * Kategorien/Tags normalisiert werden können." Die Vorschläge hier sind
 * bereits die kanonischen Tag-Formen, in denen wir sie auch in den Fragen-
 * Tags anstreben.
 *
 * Reihenfolge = grobe Relevanz für Deutschsprachige (Fußball vor Cricket etc.).
 */

import type { Topic } from '../types/question'

export const INTEREST_SUGGESTIONS: Record<Topic, readonly string[]> = {
  film: [
    'Marvel',
    'Star Wars',
    'Oscars',
    'Christopher Nolan',
    'Studio Ghibli',
    'Disney',
    'Sci-Fi',
    'Horror',
    'Animationsfilm',
    'Quentin Tarantino',
    'Kult-Klassiker',
    'Deutscher Film',
  ],
  serien: [
    'HBO',
    'Netflix',
    'Game of Thrones',
    'Breaking Bad',
    'Sitcom',
    'Krimi',
    'Sci-Fi',
    'Anime',
    'True Crime',
    'Deutsche Serien',
    'Fantasy',
    'Historische Serien',
  ],
  musik: [
    'Rock',
    'Pop',
    'Hip-Hop',
    'Deutschrap',
    'Klassik',
    'Jazz',
    'Elektronik',
    'Metal',
    'Beatles',
    'Charts',
    'Indie',
    'Singer-Songwriter',
  ],
  games: [
    'Nintendo',
    'PlayStation',
    'RPGs',
    'Indie-Games',
    'Retro-Games',
    'Multiplayer',
    'FromSoftware',
    'Sportspiele',
    'Strategiespiele',
    'Minecraft',
    'FPS',
    'Mario',
  ],
  geografie: [
    'Europa',
    'Asien',
    'Afrika',
    'Amerika',
    'Hauptstädte',
    'Berge & Gebirge',
    'Meere & Seen',
    'Nationalflaggen',
    'Ozeane',
    'Klimazonen',
    'Deutschland',
    'Karten',
  ],
  geschichte: [
    'Antike',
    'Mittelalter',
    'Weltkriege',
    'Kalter Krieg',
    'Deutsche Geschichte',
    'Römisches Reich',
    'US-Geschichte',
    'Französische Revolution',
    'Napoleon',
    'Wikinger',
    'Ägypten',
    'DDR',
  ],
  wissenschaft: [
    'Astronomie',
    'Physik',
    'Chemie',
    'Biologie',
    'Medizin',
    'Mathematik',
    'Nobelpreise',
    'Erfindungen',
    'Evolution',
    'Klimaforschung',
    'Weltraum',
    'Quantenphysik',
  ],
  sport: [
    'Fußball',
    'Basketball',
    'Tennis',
    'Formel 1',
    'Olympia',
    'NFL',
    'Baseball',
    'Boxen',
    'Golf',
    'Wintersport',
    'Radsport',
    'Bundesliga',
    'Champions League',
    'NBA',
  ],
  essen: [
    'Italienisch',
    'Asiatisch',
    'Deutsche Küche',
    'Backen',
    'Wein',
    'Bier',
    'Kaffee',
    'Vegetarisch',
    'Süßspeisen',
    'Käse',
    'Kräuter & Gewürze',
    'Streetfood',
  ],
  technik: [
    'Apple',
    'Programmierung',
    'Retro-Computer',
    'Internet-Geschichte',
    'Gaming-Hardware',
    'Smartphones',
    'Betriebssysteme',
    'KI',
    'Open Source',
    'Cybersecurity',
    'Startups',
    'Hardware',
  ],
  sprache: [
    'Etymologie',
    'Fremdsprachen',
    'Redewendungen',
    'Anglizismen',
    'Latein',
    'Grammatik',
    'Rechtschreibung',
    'Sprachfamilien',
    'Zitate',
    'Idiome',
    'Dialekte',
    'Sprichwörter',
  ],
  kurioses: [
    'Tierwelt',
    'Weltrekorde',
    'Naturphänomene',
    'Menschlicher Körper',
    'Kuriose Erfindungen',
    'Aberglaube',
    'Legenden',
    'Alltagsphysik',
    'Vulkane',
    'Wetter',
    'Pflanzen',
    'Wahnsinns-Fakten',
  ],
}

/**
 * Liefert Vorschläge pro Topic — kombiniert die statische Liste oben mit
 * allen Tags, die im Fragen-Katalog zu diesem Topic gepflegt sind.
 *
 * Reihenfolge:
 *   1. Katalog-Tags (weil das die Fragen sind, die tatsächlich existieren)
 *   2. Statische Vorschläge (was Nutzer üblicherweise wollen)
 *
 * Dedupliziert, Case-insensitive. Bereits gewählte Tags werden ausgefiltert.
 */
export function getInterestSuggestionsForTopic(
  topic: Topic,
  catalogTagsForTopic: readonly string[],
  alreadyChosen: readonly string[],
): string[] {
  const chosenLower = new Set(alreadyChosen.map((t) => t.toLowerCase()))
  const seenLower = new Set<string>()
  const out: string[] = []

  const pushIfNew = (tag: string) => {
    const key = tag.toLowerCase()
    if (chosenLower.has(key) || seenLower.has(key)) return
    seenLower.add(key)
    out.push(tag)
  }

  for (const t of catalogTagsForTopic) pushIfNew(t)
  for (const t of INTEREST_SUGGESTIONS[topic]) pushIfNew(t)
  return out
}
