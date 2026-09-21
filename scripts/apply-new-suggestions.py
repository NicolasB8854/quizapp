#!/usr/bin/env python3
"""Ersetzt tagsSuggested für die 217 unkuratierten Fragen in docs/content/questions-tags.json.

Der Stil orientiert sich an den 15 vom User kuratierten Essen-Fragen:
- 2-4 Tags pro Frage
- Kanonische deutsche Substantive (Singular oder Plural nach Kontext)
- Fokus: Kern-Thema + Kategorie/Genre + Land/Region

Das Skript überschreibt NUR `tagsSuggested`. Das `tags`-Array bleibt unverändert leer,
damit der User selbst final entscheidet.
"""
from __future__ import annotations
import json
from pathlib import Path

TARGET = Path(__file__).resolve().parent.parent / 'docs/content/questions-tags.json'

# Alle 217 unkuratierten Fragen. Reihenfolge folgt der Sortierung in questions-tags.json.
NEW_SUGGESTIONS: dict[str, list[str]] = {
    # === ESSEN (2 offen) ===
    'q-essen-15':   ['Erdnuss', 'Botanik', 'Hülsenfrucht'],
    'q-flash-24':   ['Balsamico', 'Italien', 'Herkunftsschutz'],

    # === FILM (19) ===
    'q-film-01':    ['Parasite', 'Oscar', 'Südkorea'],
    'q-film-02':    ['Oscar', 'Regie', 'Chloé Zhao', 'Nomadland'],
    'q-film-03':    ['Studio Ghibli', 'Anime', 'Japan'],
    'q-film-04':    ['Oscar', 'Deutschland', 'Das Leben der Anderen'],
    'q-film-05':    ['Wes Anderson', 'Regie', 'USA'],
    'q-film-06':    ['Roger Deakins', 'Kamera', 'Blade Runner'],
    'q-film-07':    ['Titanic', 'DiCaprio', 'Hollywood'],
    'q-film-08':    ['Star Wars', 'George Lucas', 'Regie'],
    'q-flash-09':   ['James Bond', 'Namensherkunft', 'Ornithologie'],
    'q-film-09':    ['Forrest Gump', 'Oscar', 'Hollywood'],
    'q-film-10':    ['Inception', 'Nolan', 'Traumsequenz'],
    'q-film-11':    ['Herr der Ringe', 'New Line Cinema', 'Fantasy'],
    'q-film-12':    ['Die Blechtrommel', 'Oscar', 'Deutschland'],
    'q-film-13':    ['Nino Rota', 'Filmmusik', 'Der Pate'],
    'q-film-14':    ['Terrence Malick', 'Regie', 'USA'],
    'q-film-15':    ['Der Pate', 'Coppola', 'Regie'],
    'q-flash-16':   ['Titanic', 'Oscar', 'Rekord'],
    'q-film-16':    ['Hitchcock', 'Vertigo', 'Cameo'],
    'q-flash-28':   ['Casablanca', 'Oscar', 'Hollywood'],

    # === SERIEN (17) ===
    'q-serien-01':  ['Breaking Bad', 'Albuquerque', 'USA'],
    'q-serien-02':  ['Game of Thrones', 'HBO', 'Emmy'],
    'q-serien-03':  ['Game of Thrones', 'Westeros', 'Fantasy'],
    'q-serien-04':  ['The Wire', 'HBO', 'Baltimore'],
    'q-serien-05':  ['BoJack Horseman', 'Netflix', 'Animation'],
    'q-serien-06':  ['Twin Peaks', 'David Lynch', 'Mystery'],
    'q-serien-07':  ['Breaking Bad', 'Krimi', 'AMC'],
    'q-serien-08':  ['Stranger Things', 'Netflix', 'Hawkins'],
    'q-serien-09':  ['Friends', 'Sitcom', 'New York', 'NBC'],
    'q-serien-10':  ['Succession', 'HBO', 'Familiendrama'],
    'q-serien-11':  ['Suits', 'Anwaltsserie', 'Pearson Hardman'],
    'q-serien-12':  ['Mad Men', 'Matthew Weiner', 'AMC'],
    'q-serien-13':  ['Squid Game', 'Netflix', 'Südkorea'],
    'q-serien-14':  ['Meine geniale Freundin', 'Italien', 'Neapel'],
    'q-serien-15':  ['Sopranos', 'HBO', 'Finale'],
    'q-serien-16':  ['Simpsons', 'Rekord', 'FOX'],
    'q-flash-17':   ['Game of Thrones', 'George R. R. Martin', 'Buchvorlage'],

    # === MUSIK (17) ===
    'q-musik-01':   ['Thriller', 'Michael Jackson', 'Album'],
    'q-musik-02':   ['Bossa Nova', 'Brasilien', 'Genre'],
    'q-musik-03':   ['Mozart', 'Oper', 'Klassik'],
    'q-musik-04':   ['Beatles', 'Yesterday', 'Album'],
    'q-musik-05':   ['Kraftwerk', 'Düsseldorf', 'Elektro'],
    'q-musik-06':   ['Schönberg', 'Zwölftontechnik', 'Österreich'],
    'q-musik-07':   ['Beyoncé', 'Lemonade', 'Album'],
    'q-musik-08':   ['Queen', 'Bohemian Rhapsody', 'Rock'],
    'q-musik-09':   ['Phil Spector', 'Wall of Sound', 'Produktion'],
    'q-musik-10':   ['Scorpions', 'Hannover', 'Rock'],
    'q-musik-11':   ['Coltrane', 'Jazz', 'Saxophon'],
    'q-musik-12':   ['Mozart', 'Da Ponte', 'Libretto', 'Oper'],
    'q-musik-13':   ['Joy Division', 'Manchester', 'Post-Punk'],
    'q-musik-14':   ['Clara Schumann', 'Klassik', 'Komponistin'],
    'q-musik-15':   ['Elvis', 'Graceland', 'Rock’n’Roll'],
    'q-musik-16':   ['Happy Birthday', 'Urheberrecht', 'Gemeinfreiheit'],
    'q-flash-18':   ['Beethoven', 'Sinfonie', 'Taubheit'],

    # === GAMES (16) ===
    'q-games-01':   ['The Witcher 3', 'CD Projekt Red', 'RPG'],
    'q-games-02':   ['Minecraft', 'Release', 'Sandbox'],
    'q-games-03':   ['Nintendo 64', 'Konsole', 'Analog-Stick'],
    'q-games-04':   ['Zelda', 'Nintendo', 'Franchise'],
    'q-games-05':   ['Hades', 'Supergiant Games', 'Roguelike'],
    'q-games-06':   ['Pong', 'Atari', 'Arcade'],
    'q-games-07':   ['Sonic', 'SEGA', 'Maskottchen'],
    'q-games-08':   ['Valve', 'Portal', 'Half-Life'],
    'q-games-09':   ['Skyrim', 'Bethesda', 'RPG'],
    'q-games-10':   ['FromSoftware', 'Souls', 'Elden Ring'],
    'q-games-11':   ['PUBG', 'Battle Royale', 'Südkorea'],
    'q-games-12':   ['Minecraft', 'Rekord', 'Verkauf'],
    'q-games-13':   ['GTA III', 'Rockstar', 'Open World'],
    'q-games-14':   ['Tetris', 'Pajitnov', 'Sowjetunion'],
    'q-games-15':   ['Pac-Man', 'Arcade', 'Kill Screen'],
    'q-flash-19':   ['Mario', 'Nintendo', 'Donkey Kong'],

    # === GEOGRAFIE (21) ===
    'q-geo-01':         ['Kanada', 'Küste', 'Rekord'],
    'q-geo-02':         ['Helsinki', 'Finnland', 'Hauptstadt'],
    'q-geo-03':         ['Sokotra', 'Jemen', 'Insel'],
    'q-geografie-04':   ['Algerien', 'Afrika', 'Fläche'],
    'q-geografie-05':   ['Elbe', 'Ästuar', 'Nordsee'],
    'q-geografie-06':   ['Kilimandscharo', 'Afrika', 'Berg'],
    'q-geografie-07':   ['Nil', 'Fluss', 'Afrika'],
    'q-flash-08':       ['Eiffelturm', 'Paris', 'Bauwerk'],
    'q-geografie-08':   ['Sahara', 'Wüste', 'Nordafrika'],
    'q-geografie-09':   ['Straße von Gibraltar', 'Meerenge', 'Europa'],
    'q-geografie-10':   ['Indonesien', 'Inselstaat', 'Asien'],
    'q-flash-11':       ['Transsibirische Eisenbahn', 'Russland', 'Rekord'],
    'q-geografie-11':   ['Baikalsee', 'Russland', 'See'],
    'q-geografie-12':   ['Frankreich', 'Zeitzonen', 'Überseegebiete'],
    'q-geografie-13':   ['Panamakanal', 'Pazifik', 'Atlantik'],
    'q-flash-14':       ['Australien', 'Mond', 'Vergleich'],
    'q-geografie-14':   ['La Paz', 'Bolivien', 'Hauptstadt'],
    'q-geografie-15':   ['Antarktis', 'Wüste', 'Klima'],
    'q-geografie-16':   ['Mount Everest', 'Himalaya', 'Berg'],
    'q-geografie-17':   ['Datumsgrenze', 'Zeitzonen', 'Pazifik'],
    'q-flash-20':       ['Australien', 'Kontinent', 'Land'],

    # === GESCHICHTE (19) ===
    'q-gesch-01':       ['Berliner Mauer', 'Deutschland', '1989'],
    'q-gesch-02':       ['Mongolisches Reich', 'Mittelalter', 'Dschingis Khan'],
    'q-gesch-03':       ['Westfälischer Friede', 'Dreißigjähriger Krieg', '1648'],
    'q-geschichte-04':  ['Berliner Mauer', 'Deutschland', '1989'],
    'q-flash-05':       ['Napoleon', 'Frankreich', 'Mythos'],
    'q-geschichte-05':  ['Osmanisches Reich', 'Süleyman', 'Sultan'],
    'q-geschichte-06':  ['Weimarer Republik', 'Ebert', 'Reichspräsident'],
    'q-geschichte-07':  ['Zweiter Weltkrieg', 'Kapitulation', '1945'],
    'q-geschichte-08':  ['Ägypten', 'Pyramiden', 'Antike'],
    'q-geschichte-09':  ['Elisabeth I.', 'England', 'Tudor'],
    'q-geschichte-10':  ['Adenauer', 'Bundeskanzler', 'Bundesrepublik'],
    'q-geschichte-11':  ['Französische Revolution', 'Bastille', '1789'],
    'q-geschichte-12':  ['Nikolaus II.', 'Russland', 'Zar'],
    'q-geschichte-13':  ['Kubakrise', 'Kalter Krieg', '1962'],
    'q-geschichte-14':  ['Vertrag von Tordesillas', 'Kolonialismus', 'Spanien', 'Portugal'],
    'q-flash-15':       ['Newton', 'Physik', 'Mythos'],
    'q-geschichte-15':  ['Berliner Mauer', 'Deutschland', 'Kalter Krieg'],
    'q-geschichte-16':  ['Cleopatra', 'Antike', 'Zeitvergleich'],
    'q-flash-21':       ['Napoleon', 'Korsika', 'Herkunft'],

    # === WISSENSCHAFT (24) ===
    'q-wiss-01':            ['Gold', 'Element', 'Periodensystem'],
    'q-wiss-02':            ['Chromosom', 'Genetik', 'Mensch'],
    'q-flash-02':           ['Gehirn', 'Mythos', 'Neurologie'],
    'q-wiss-03':            ['Elektromagnetismus', 'Physik', 'Atom'],
    'q-flash-04':           ['Venus', 'Planet', 'Astronomie'],
    'q-wissenschaft-04':    ['Natrium', 'Element', 'Chemie'],
    'q-wissenschaft-05':    ['Marie Curie', 'Nobelpreis', 'Physik', 'Chemie'],
    'q-wissenschaft-06':    ['Feinstrukturkonstante', 'Physik', 'Elektromagnetismus'],
    'q-wissenschaft-07':    ['Proxima Centauri', 'Astronomie', 'Stern'],
    'q-wissenschaft-08':    ['Wasserstoff', 'Element', 'Kosmologie'],
    'q-wissenschaft-09':    ['Pest', 'Bakterium', 'Krankheit'],
    'q-flash-10':           ['Fledermaus', 'Echolokation', 'Mythos'],
    'q-wissenschaft-10':    ['Penicillin', 'Fleming', 'Antibiotikum'],
    'q-wissenschaft-11':    ['Volt', 'Spannung', 'Elektrizität'],
    'q-wissenschaft-12':    ['Rutherford', 'Atomkern', 'Streuexperiment'],
    'q-flash-13':           ['Blitz', 'Wetter', 'Mythos'],
    'q-wissenschaft-13':    ['Thermodynamik', 'Entropie', 'Physik'],
    'q-wissenschaft-14':    ['Wasserstoff', 'Isotop', 'Deuterium'],
    'q-wissenschaft-15':    ['Wasser', 'Chemie', 'Molekül'],
    'q-wissenschaft-16':    ['Blitz', 'Physik', 'Temperatur'],
    'q-wissenschaft-17':    ['Diamant', 'Geologie', 'Alter'],
    'q-wissenschaft-18':    ['Vollmond', 'Mond', 'Astronomie'],
    'q-wissenschaft-19':    ['Feuer', 'Holz', 'Verbrennung'],
    'q-flash-22':           ['Licht', 'Optik', 'Physik'],

    # === SPORT (18) ===
    'q-sport-01':   ['Basketball', 'Regel', 'Team'],
    'q-sport-02':   ['Fußball', 'Weltmeisterschaft', 'Uruguay'],
    'q-sport-03':   ['Marathon', 'Leichtathletik', 'Distanz'],
    'q-sport-04':   ['Fußball', 'Weltmeisterschaft', 'Deutschland'],
    'q-sport-05':   ['NBA', 'Basketball', 'Kareem Abdul-Jabbar'],
    'q-sport-06':   ['Formel 1', 'Schumacher', 'Hamilton'],
    'q-sport-07':   ['Olympia', 'Symbol', 'Ringe'],
    'q-sport-08':   ['Tennis', 'Grand Slam', 'Turnier'],
    'q-sport-09':   ['Formel 1', 'Großbritannien', 'Motorsport'],
    'q-sport-10':   ['American Football', 'NFL', 'Touchdown'],
    'q-sport-11':   ['Tour de France', 'Radsport', 'Gelbes Trikot'],
    'q-sport-12':   ['Baseball', 'Perfect Game', 'MLB'],
    'q-sport-13':   ['Ski Alpin', 'Hirscher', 'Weltcup'],
    'q-sport-14':   ['Tennis', 'Djokovic', 'Grand Slam'],
    'q-sport-15':   ['Fußball', 'Regel', 'Team'],
    'q-sport-16':   ['Olympia', 'Boxen', 'Sportgeschichte'],
    'q-flash-23':   ['Olympia', 'Athen', '1896'],
    'q-flash-29':   ['Cricket', 'Weltsport', 'Fußball'],

    # === TECHNIK (16) ===
    'q-tech-01':        ['Linux', 'Torvalds', 'Open Source'],
    'q-tech-02':        ['IPv6', 'Netzwerk', 'Internet'],
    'q-tech-03':        ['3dfx', 'Voodoo', 'Grafikkarte'],
    'q-technik-04':     ['iPhone', 'Apple', 'Smartphone'],
    'q-technik-05':     ['Python', 'Programmiersprache', 'TIOBE'],
    'q-technik-06':     ['Intel 4004', 'Mikroprozessor', '1971'],
    'q-technik-07':     ['HTTP', 'Internet', 'Protokoll'],
    'q-technik-08':     ['Android', 'Google', 'Betriebssystem'],
    'q-technik-09':     ['Byte', 'Bit', 'Informatik'],
    'q-technik-10':     ['Java', 'Gosling', 'Programmiersprache'],
    'q-technik-11':     ['Diskette', 'IBM', 'Speicher'],
    'q-technik-12':     ['MP3', 'Audio', 'Kompression'],
    'q-technik-13':     ['HTTP', 'Header', 'Protokoll'],
    'q-technik-14':     ['TCP/IP', 'ARPANET', 'Internet'],
    'q-technik-15':     ['Computervirus', 'Sicherheit', 'Informatikgeschichte'],
    'q-flash-25':       ['WWW', 'CERN', 'Internet'],

    # === SPRACHE (18) ===
    'q-sprache-01':     ['Algorithmus', 'Etymologie', 'Arabisch'],
    'q-sprache-02':     ['Baskisch', 'Sprachfamilie', 'Europa'],
    'q-sprache-03':     ['Wort des Jahres', 'Deutsch', 'Krisenmodus'],
    'q-flash-03':       ['Brasilien', 'Portugiesisch', 'Amtssprache'],
    'q-sprache-04':     ['Doppelgänger', 'Lehnwort', 'Englisch'],
    'q-sprache-05':     ['Kaffee', 'Etymologie', 'Arabisch'],
    'q-sprache-06':     ['Uralisch', 'Sprachfamilie', 'Finnisch'],
    'q-sprache-07':     ['Mandarin', 'China', 'Muttersprache'],
    'q-sprache-08':     ['Kindergarten', 'Lehnwort', 'Englisch'],
    'q-sprache-09':     ['Arabisch', 'Schrift', 'Konsonanten'],
    'q-sprache-10':     ['Latein', 'Redewendung', 'Cave canem'],
    'q-sprache-11':     ['Kiosk', 'Etymologie', 'Türkisch'],
    'q-flash-12':       ['Englisch', 'Orange', 'Reim'],
    'q-sprache-12':     ['Ungarisch', 'Sprachfamilie', 'Uralisch'],
    'q-sprache-13':     ['Latein', 'Grammatik', 'Kasus'],
    'q-sprache-14':     ['Kyrillisch', 'Alphabet', 'Russisch'],
    'q-sprache-15':     ['Quiz', 'Etymologie', 'Mythos'],
    'q-flash-26':       ['Kindersprache', 'Universalismus', 'Mama'],

    # === KURIOSES (30) ===
    'q-kurios-01':      ['Krake', 'Anatomie', 'Herz'],
    'q-flash-01':       ['Chinesische Mauer', 'Mythos', 'Weltall'],
    'q-klick-01':       ['Golfball', 'Aerodynamik', 'Physik'],
    'q-kurios-02':      ['Gehirn', 'Anatomie', 'Fett'],
    'q-klick-02':       ['Marmeladenglas', 'Vakuum', 'Konservierung'],
    'q-kurios-03':      ['Elefant', 'Tragezeit', 'Säugetier'],
    'q-klick-03':       ['Muschel', 'Akustik', 'Physik'],
    'q-klick-04':       ['Feuerlöscher', 'Warnfarbe', 'Symbolik'],
    'q-kurioses-04':    ['Olympus Mons', 'Mars', 'Vulkan'],
    'q-klick-05':       ['Banane', 'Botanik', 'Zucht'],
    'q-kurioses-05':    ['Chromosom', 'Genetik', 'Mensch'],
    'q-klick-06':       ['Champagner', 'Druck', 'Physik'],
    'q-kurioses-06':    ['Uranus', 'Planet', 'Umlaufzeit'],
    'q-flash-07':       ['Panda', 'Bär', 'Biologie'],
    'q-kurioses-07':    ['Regenbogen', 'Newton', 'Farben'],
    'q-kurioses-08':    ['Karpfen', 'Chromosom', 'Fisch'],
    'q-kurioses-09':    ['Floh', 'Insekt', 'Sprung'],
    'q-kurioses-10':    ['Zebra', 'Streifen', 'Insekten'],
    'q-kurioses-11':    ['Krake', 'Blut', 'Biologie'],
    'q-kurioses-12':    ['Chili', 'ISS', 'Weltraum'],
    'q-kurioses-13':    ['Wimpernschlag', 'Auge', 'Physiologie'],
    'q-kurioses-14':    ['Ultraviolett', 'Licht', 'Auge'],
    'q-kurioses-15':    ['Himmel', 'Streuung', 'Optik'],
    'q-kurioses-16':    ['Überschallknall', 'Schall', 'Physik'],
    'q-kurioses-17':    ['Schwimmen', 'Kälte', 'Wärmeregulation'],
    'q-kurioses-18':    ['Möwe', 'Regenwurm', 'Verhalten'],
    'q-kurioses-19':    ['Kompass', 'Erdmagnetfeld', 'Physik'],
    'q-kurioses-20':    ['Apfel', 'Oxidation', 'Chemie'],
    'q-flash-27':       ['Mond', 'Apollo', 'Fußabdruck'],
    'q-flash-30':       ['Nordpol', 'Arktis', 'Eis'],
}


def main() -> None:
    data = json.loads(TARGET.read_text(encoding='utf-8'))
    total = len(data)
    updated = 0
    missing_ids: list[str] = []
    seen_ids = set()

    for entry in data:
        qid = entry['id']
        seen_ids.add(qid)
        if qid in NEW_SUGGESTIONS:
            entry['tagsSuggested'] = NEW_SUGGESTIONS[qid]
            updated += 1

    # Sanity-Check: alle IDs im Dict tatsächlich in der Datei?
    for qid in NEW_SUGGESTIONS:
        if qid not in seen_ids:
            missing_ids.append(qid)

    TARGET.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + '\n',
        encoding='utf-8',
    )

    print(f'Gesamt Einträge:       {total}')
    print(f'tagsSuggested geändert: {updated}')
    print(f'Im Dict, aber fehlen:   {len(missing_ids)}')
    if missing_ids:
        for m in missing_ids:
            print(f'  - {m}')
    print(f'Restliche (nicht im Dict, bleiben unverändert): {total - updated}')


if __name__ == '__main__':
    main()
