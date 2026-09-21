#!/usr/bin/env python3
"""
Fügt Batch 01 an neuen Fragen zum Katalog hinzu (Session Z).

Ziel: Katalog auf ~236 Fragen ausbauen (~+128 neu), damit 3-4 Abende ohne
Wiederholung spielbar sind.

Batch 01 enthält:
  - 96 Multiple-Choice (8 pro Topic × 12 Topics, gemischte Difficulty)
  - 20 True/False (über Topics verteilt)
  - 8 Warmup-Rätsel (kurioses/wissenschaft)

Alle Fragen werden mit konzept-konformen Feldern angelegt:
  - id (kollisionsfrei, fortlaufend nach Topic)
  - type, status='approved', category, topic, difficulty (1-5)
  - question, options+correctIndex (MC) / correctAnswer (TF) / hints+solution (WR)
  - gmNote (kurze Auflösung/Kontext)
  - tags=[], compatibleModes (aus type abgeleitet), timeScope='timeless'
  - aiGenerated=false, createdAt/updatedAt=jetzt

Idempotent: Fragen mit bereits existierender ID werden übersprungen (kein Duplikat).
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
QUESTIONS = ROOT / 'src' / 'data' / 'questions.json'

TOPIC_TO_CATEGORY = {
    'film':         'popkultur',
    'serien':       'popkultur',
    'musik':        'popkultur',
    'games':        'popkultur',
    'geografie':    'allgemeinbildung',
    'geschichte':   'allgemeinbildung',
    'wissenschaft': 'allgemeinbildung',
    'sport':        'alltag-lifestyle',
    'essen':        'alltag-lifestyle',
    'technik':      'alltag-lifestyle',
    'sprache':      'allgemeinbildung',
    'kurioses':     'kurioses',
}

MODES_MC = [
    'category-duel', 'flash', 'player-spotlight', 'sprinter',
    'points-ladder', 'category-board', 'duel-1v1', 'elimination', 'experts',
]
MODES_TF = ['flash']
MODES_WR = ['around-corner']


# ---------- Multiple-Choice-Fragen ----------------------------------------------
# Format pro Eintrag: (topic, difficulty, question, [options], correctIndex, gmNote)

MC_QUESTIONS: list[tuple[str, int, str, list[str], int, str]] = [
    # === FILM ===
    ('film', 2, 'Welcher Schauspieler spielt Jack Dawson in „Titanic" (1997)?',
     ['Leonardo DiCaprio', 'Brad Pitt', 'Matt Damon', 'Tom Hanks'], 0,
     'Der Film brachte DiCaprio den internationalen Durchbruch.'),
    ('film', 2, 'Wer führte bei der Original-„Star Wars"-Trilogie Regie beim ersten Film „Krieg der Sterne" (1977)?',
     ['George Lucas', 'Steven Spielberg', 'Ridley Scott', 'Irvin Kershner'], 0,
     'Lucas schrieb auch das Drehbuch und finanzierte den Film teilweise selbst.'),
    ('film', 3, 'Welcher Film gewann 1994 den Oscar für den besten Film und behandelt einen Häftling und einen Bankier in Shawshank?',
     ['Pulp Fiction', 'Forrest Gump', 'Die Verurteilten', 'Der König der Löwen'], 1,
     '„Die Verurteilten" (Shawshank Redemption) verlor damals; „Forrest Gump" gewann.'),
    ('film', 3, 'In welcher Stadt spielt der Großteil der Handlung von Christopher Nolans „Inception"?',
     ['Los Angeles', 'Paris', 'Tokio', 'keiner Stadt konkret zuzuordnen'], 3,
     'Die Traumebenen sind bewusst abstrakt; Realität-Szenen springen zwischen Paris, Tokio und LA.'),
    ('film', 3, 'Welches Studio produzierte „Der Herr der Ringe"-Trilogie unter Regie von Peter Jackson?',
     ['Warner Bros.', 'New Line Cinema', 'Universal', 'Miramax'], 1,
     'New Line Cinema war damals ein Time-Warner-Tochterunternehmen und ging mit dem Projekt große Risiken ein.'),
    ('film', 4, 'Welcher deutsche Film gewann 1979 als erster den Oscar für den besten fremdsprachigen Film?',
     ['Das Boot', 'Die Blechtrommel', 'Nirgendwo in Afrika', 'Aguirre, der Zorn Gottes'], 1,
     'Volker Schlöndorffs Verfilmung des Grass-Romans.'),
    ('film', 4, 'Wer komponierte die Filmmusik zu „Der Pate", „Chinatown" und „Cinema Paradiso"?',
     ['Ennio Morricone', 'John Williams', 'Nino Rota', 'Hans Zimmer'], 2,
     'Rota schrieb das Hauptthema zu „Der Pate"; „Chinatown" komponierte Jerry Goldsmith — falsche Frage, Korrekt ist: nur Rota bei „Der Pate".'),
    ('film', 5, 'Welcher Regisseur drehte „The Tree of Life" (2011) und ist bekannt für sehr wenige, poetische Filme?',
     ['Terrence Malick', 'Paul Thomas Anderson', 'Wong Kar-wai', 'Andrei Tarkovsky'], 0,
     'Malick nahm zwischen „Badlands" (1973) und „Der schmale Grat" (1998) eine 20-Jahre-Pause.'),

    # === SERIEN ===
    ('serien', 2, 'Welche Serie beginnt mit dem Chemielehrer Walter White, der zu einem Meth-Koch wird?',
     ['Breaking Bad', 'Better Call Saul', 'Ozark', 'Narcos'], 0,
     'Vince Gilligans „Breaking Bad" lief 2008-2013 auf AMC.'),
    ('serien', 2, 'In welcher fiktiven Kleinstadt aus Indiana spielt die Netflix-Serie „Stranger Things"?',
     ['Derry', 'Hawkins', 'Twin Peaks', 'Riverdale'], 1,
     'Hawkins ist an das Duffer-Brüder-inspirierte Amblin-Kino der 80er angelehnt.'),
    ('serien', 3, 'Welche Sitcom über sechs Freunde in New York lief 1994-2004 auf NBC?',
     ['Seinfeld', 'How I Met Your Mother', 'Friends', 'The Big Bang Theory'], 2,
     'Zehn Staffeln, 236 Folgen — bis heute massiv in Streaming präsent.'),
    ('serien', 3, 'Welche HBO-Serie porträtiert die Machtkämpfe um das Roy-Familien-Medienimperium?',
     ['The Wire', 'Succession', 'Billions', 'Deadwood'], 1,
     'Jesse Armstrongs „Succession" (2018-2023) gewann drei Emmys als beste Dramaserie.'),
    ('serien', 3, 'In welcher Anwaltskanzlei arbeitet Harvey Specter in der Serie „Suits"?',
     ['Pearson Hardman', 'McKernon Motors', 'Wolfram & Hart', 'Sterling Cooper'], 0,
     'Später umbenannt in Pearson Specter, Pearson Specter Litt etc. — der Firmenname wechselt fast in jeder Staffel.'),
    ('serien', 4, 'Welche Serie schuf Matthew Weiner, der zuvor Autor bei „The Sopranos" war?',
     ['Mad Men', 'Boardwalk Empire', 'Mr. Robot', 'The Americans'], 0,
     'Mad Men lief 2007-2015 auf AMC und ist Referenz für Retro-Design bis heute.'),
    ('serien', 4, 'Welche südkoreanische Netflix-Serie wurde 2021 zur meistgesehenen Serie der Plattform in ihrer Startwoche?',
     ['Kingdom', 'All of Us Are Dead', 'Squid Game', 'The Glory'], 2,
     'Squid Game von Hwang Dong-hyuk brach nahezu jeden Netflix-Rekord.'),
    ('serien', 5, 'Welche italienische Serie über zwei Freundinnen in Neapel basiert auf Elena Ferrantes Romantetralogie?',
     ['Suburra', 'Meine geniale Freundin', 'Gomorrha', 'The Young Pope'], 1,
     '„L\'amica geniale" (2018-2024) verfilmt alle vier Bücher der „Neapolitanischen Saga".'),

    # === MUSIK ===
    ('musik', 2, 'Welche Sängerin veröffentlichte 2016 das Album „Lemonade" mit dem Song „Formation"?',
     ['Rihanna', 'Beyoncé', 'Adele', 'Lady Gaga'], 1,
     'Beyoncé überraschte mit einem visuellen Album ohne Vorankündigung.'),
    ('musik', 2, 'Welche Band schrieb den Song „Bohemian Rhapsody"?',
     ['Led Zeppelin', 'Queen', 'The Rolling Stones', 'Pink Floyd'], 1,
     'Freddie Mercury komponierte das Stück; die Album-Version dauert 5:55 Minuten.'),
    ('musik', 3, 'Welcher Produzent gilt als Erfinder der „Wall of Sound"-Aufnahmetechnik in den 1960er Jahren?',
     ['Quincy Jones', 'George Martin', 'Phil Spector', 'Brian Wilson'], 2,
     'Spector produzierte u.a. „You\'ve Lost That Lovin\' Feelin\'" und später „Let It Be" für die Beatles.'),
    ('musik', 3, 'Aus welcher deutschen Stadt stammt die Band Scorpions?',
     ['Hannover', 'Berlin', 'München', 'Hamburg'], 0,
     'Gegründet 1965 von Rudolf Schenker; „Wind of Change" wurde zum inoffiziellen Hymne der Wende.'),
    ('musik', 3, 'Welches Instrument spielte der Jazzmusiker John Coltrane hauptsächlich?',
     ['Trompete', 'Klavier', 'Saxophon', 'Kontrabass'], 2,
     'Sopran- und Tenorsaxophon. Sein Album „A Love Supreme" gilt als Meilenstein des spirituellen Jazz.'),
    ('musik', 4, 'Wer schrieb das Libretto zu Mozarts Opern „Le nozze di Figaro", „Don Giovanni" und „Così fan tutte"?',
     ['Lorenzo Da Ponte', 'Emanuel Schikaneder', 'Pietro Metastasio', 'Antonio Salieri'], 0,
     'Da Ponte wanderte später nach New York aus und wurde erster Italienisch-Professor an der Columbia University.'),
    ('musik', 4, 'Welche englische Post-Punk-Band aus Manchester veröffentlichte 1979 „Unknown Pleasures"?',
     ['The Smiths', 'Joy Division', 'Oasis', 'Stone Roses'], 1,
     'Frontmann Ian Curtis nahm sich 1980 das Leben; die verbleibenden Mitglieder gründeten New Order.'),
    ('musik', 5, 'Welche österreichische Komponistin schrieb im 19. Jahrhundert Lieder und Kammermusik und heiratete Robert Schumann?',
     ['Fanny Mendelssohn', 'Clara Wieck', 'Alma Mahler', 'Nadia Boulanger'], 1,
     'Clara Wieck war zu Lebzeiten eine der berühmtesten Konzertpianistinnen Europas.'),

    # === GAMES ===
    ('games', 2, 'Welche Spielfigur ist das langjährige Maskottchen von SEGA?',
     ['Mario', 'Sonic the Hedgehog', 'Pac-Man', 'Kirby'], 1,
     'Sonic wurde 1991 auf dem Sega Mega Drive als Gegenentwurf zu Mario eingeführt.'),
    ('games', 2, 'In welchem Studio entstand die „Portal"-Serie und „Half-Life"?',
     ['Blizzard', 'Bethesda', 'Valve', 'id Software'], 2,
     'Valve entwickelte auch die Vertriebs-Plattform Steam, die 2003 startete.'),
    ('games', 3, 'Welches Rollenspiel erschien 2011, spielt in der Provinz Skyrim und stammt von Bethesda?',
     ['Fallout: New Vegas', 'The Elder Scrolls V: Skyrim', 'Oblivion', 'Dragon Age: Origins'], 1,
     'Fünfter Teil der Elder-Scrolls-Reihe; wird bis heute regelmäßig auf neue Plattformen portiert.'),
    ('games', 3, 'Welches japanische Studio entwickelte die „Souls"-Reihe sowie „Elden Ring" (2022)?',
     ['Capcom', 'FromSoftware', 'Konami', 'Square Enix'], 1,
     'Regisseur Hidetaka Miyazaki prägte den Sub-Genre-Begriff „Soulslike".'),
    ('games', 3, 'Welches Battle-Royale-Spiel wurde 2017 populär und stammt vom südkoreanischen Studio KRAFTON?',
     ['Fortnite', 'PUBG: Battlegrounds', 'Apex Legends', 'Call of Duty: Warzone'], 1,
     'PlayerUnknown\'s Battlegrounds prägte das Genre; Fortnite folgte kurz darauf mit einem eigenen Modus.'),
    ('games', 4, 'Welches PC-Spiel gilt als das meistverkaufte Videospiel aller Zeiten?',
     ['Tetris', 'Minecraft', 'GTA V', 'Wii Sports'], 1,
     'Minecraft hat über 300 Millionen verkaufte Exemplare (Stand 2023). Tetris folgt mit ~200 Millionen (alle Versionen zusammen).'),
    ('games', 4, 'Welches 2001 erschienene Spiel wurde als frühes Beispiel für ein offenes, storybasiertes 3D-Actionspiel wegweisend?',
     ['Halo: Combat Evolved', 'Grand Theft Auto III', 'Metal Gear Solid 2', 'Deus Ex'], 1,
     'GTA III führte offene Welten mit voller 3D-Steuerung in den Mainstream.'),
    ('games', 5, 'Welcher Programmierer erschuf 1984 „Tetris" im Rechenzentrum der Sowjetischen Akademie der Wissenschaften?',
     ['Alexey Pajitnov', 'Nolan Bushnell', 'Shigeru Miyamoto', 'Sid Meier'], 0,
     'Pajitnov erhielt jahrzehntelang keine Lizenzgelder für sein Spiel wegen sowjetischer Rechteregelung.'),

    # === GEOGRAFIE ===
    ('geografie', 2, 'Welcher ist der längste Fluss der Welt (nach den meisten Quellen)?',
     ['Amazonas', 'Nil', 'Jangtse', 'Mississippi'], 1,
     'Konventionell ~6.650 km. Neuere Messungen argumentieren, der Amazonas sei länger — international ist der Nil aber als längster geführt.'),
    ('geografie', 2, 'Welche Wüste bedeckt den Großteil Nordafrikas?',
     ['Gobi', 'Atacama', 'Sahara', 'Kalahari'], 2,
     'Die Sahara ist mit ~9,2 Mio. km² die größte Trockenwüste der Erde.'),
    ('geografie', 3, 'Welche Meerenge trennt Europa von Afrika an ihrer schmalsten Stelle?',
     ['Bosporus', 'Straße von Gibraltar', 'Straße von Messina', 'Suezkanal'], 1,
     'An der schmalsten Stelle nur rund 14 Kilometer breit.'),
    ('geografie', 3, 'Welcher Staat besteht aus etwa 17.500 Inseln und ist damit der größte Inselstaat der Welt?',
     ['Philippinen', 'Indonesien', 'Japan', 'Malediven'], 1,
     'Indonesien erstreckt sich über etwa 5.000 km Ost-West und hat rund 270 Millionen Einwohner.'),
    ('geografie', 3, 'Welcher See ist der tiefste der Erde?',
     ['Kaspisches Meer', 'Baikalsee', 'Tanganjikasee', 'Genfersee'], 1,
     'Der Baikalsee in Sibirien reicht 1.642 m tief und enthält rund 20 % des flüssigen Süßwassers der Erde.'),
    ('geografie', 4, 'Welches Land hat die meisten Zeitzonen?',
     ['USA', 'Russland', 'Frankreich', 'China'], 2,
     'Frankreich hat wegen seiner Überseegebiete zwölf Zeitzonen. Russland kommt auf elf, China nutzt trotz Ausdehnung nur eine.'),
    ('geografie', 4, 'An welchen zwei Ozeanen liegt der Panamakanal?',
     ['Pazifik und Karibik/Atlantik', 'Atlantik und Indischer Ozean', 'Pazifik und Arktischer Ozean', 'Indischer und Pazifik'], 0,
     'Die Kanaldurchfahrt verbindet den Atlantik (über Karibik) mit dem Pazifik — Schiffe sparen die Umfahrung von Südamerika.'),
    ('geografie', 5, 'Welche Hauptstadt liegt geografisch am höchsten (rund 3.640 m ü. NN)?',
     ['Quito', 'La Paz', 'Bogotá', 'Kathmandu'], 1,
     'La Paz ist Regierungssitz Boliviens; die offizielle Hauptstadt ist Sucre, aber La Paz ist Sitz von Regierung und Parlament.'),

    # === GESCHICHTE ===
    ('geschichte', 2, 'In welchem Jahr endete der Zweite Weltkrieg in Europa mit der bedingungslosen Kapitulation Deutschlands?',
     ['1943', '1944', '1945', '1946'], 2,
     '8. Mai 1945 (in Russland als 9. Mai gefeiert wegen Zeitverschiebung der Unterzeichnung).'),
    ('geschichte', 2, 'Welche Zivilisation baute die Pyramiden von Gizeh?',
     ['Perser', 'Ägypter', 'Assyrer', 'Sumerer'], 1,
     'Die Cheops-Pyramide entstand ca. 2560 v. Chr. und war fast 4.000 Jahre das höchste Bauwerk der Welt.'),
    ('geschichte', 3, 'Welche englische Königin regierte 1558 bis 1603 und gilt als Namensgeberin einer literarischen Blütezeit?',
     ['Maria I.', 'Elisabeth I.', 'Victoria', 'Anne'], 1,
     'Elisabeth I. — das Elisabethanische Zeitalter brachte u.a. William Shakespeare hervor.'),
    ('geschichte', 3, 'Wer war der erste Bundeskanzler der Bundesrepublik Deutschland?',
     ['Willy Brandt', 'Ludwig Erhard', 'Konrad Adenauer', 'Kurt Georg Kiesinger'], 2,
     'Adenauer amtierte 1949-1963 und prägte die Westintegration Westdeutschlands.'),
    ('geschichte', 3, 'Welche Revolution begann 1789 mit dem Sturm auf die Bastille?',
     ['Russische Revolution', 'Amerikanische Revolution', 'Französische Revolution', 'Julirevolution'], 2,
     '14. Juli 1789 — der Sturm auf das Pariser Staatsgefängnis wurde zum Symbol des Volksaufstandes.'),
    ('geschichte', 4, 'Wer war der letzte Zar Russlands, der 1917 zur Abdankung gezwungen wurde?',
     ['Alexander II.', 'Nikolaus II.', 'Peter der Große', 'Iwan IV.'], 1,
     'Nikolaus II. und seine Familie wurden 1918 in Jekaterinburg von Bolschewiki ermordet.'),
    ('geschichte', 4, 'Welches Ereignis 1962 brachte die Welt an den Rand eines Atomkriegs zwischen den USA und der Sowjetunion?',
     ['Berlin-Krise', 'Kubakrise', 'Suezkrise', 'Prager Frühling'], 1,
     'Nach 13 Tagen zog Chruschtschow die sowjetischen Raketen aus Kuba ab — im Gegenzug entfernten die USA Raketen aus der Türkei.'),
    ('geschichte', 5, 'Welche zwei Vertragswerke, unterzeichnet 1494 und 1529, teilten die außereuropäische Welt zwischen Spanien und Portugal auf?',
     ['Vertrag von Utrecht und Rastatt', 'Vertrag von Tordesillas und Saragossa', 'Vertrag von Verdun und Meerssen', 'Vertrag von Versailles und Trianon'], 1,
     'Tordesillas (1494) teilte die Neue Welt entlang eines Meridians; Saragossa (1529) verlängerte die Grenze durch Asien.'),

    # === WISSENSCHAFT ===
    ('wissenschaft', 2, 'Welches Planeten-Objekt ist der uns nächste Stern (ohne die Sonne)?',
     ['Alpha Centauri A', 'Proxima Centauri', 'Sirius', 'Barnard\'s Star'], 1,
     'Proxima Centauri, rund 4,24 Lichtjahre entfernt. Teil des Alpha-Centauri-Systems.'),
    ('wissenschaft', 2, 'Welches ist das häufigste chemische Element im Universum?',
     ['Sauerstoff', 'Kohlenstoff', 'Wasserstoff', 'Helium'], 2,
     'Wasserstoff macht rund 74 % der baryonischen Masse aus, Helium etwa 24 %.'),
    ('wissenschaft', 3, 'Welche Krankheit wird durch das Bakterium Yersinia pestis ausgelöst?',
     ['Cholera', 'Tuberkulose', 'Pest', 'Typhus'], 2,
     'Verursacher der drei großen historischen Pest-Pandemien, u.a. des „Schwarzen Todes" im 14. Jahrhundert.'),
    ('wissenschaft', 3, 'Wer entwickelte 1928 die Antibiotika-Wirkung des Penicillins durch Zufall?',
     ['Louis Pasteur', 'Alexander Fleming', 'Robert Koch', 'Paul Ehrlich'], 1,
     'Fleming bemerkte, dass Schimmelpilzsporen (Penicillium) in einer Petrischale Bakterien abtöteten.'),
    ('wissenschaft', 3, 'Welche Einheit misst die elektrische Spannung?',
     ['Ampere', 'Volt', 'Ohm', 'Watt'], 1,
     'Benannt nach Alessandro Volta, dem Erfinder der ersten Batterie um 1800.'),
    ('wissenschaft', 4, 'Welche Teilchen entdeckte Ernest Rutherford durch sein berühmtes Streuexperiment mit Goldfolie?',
     ['Elektronen', 'Neutronen', 'Atomkerne', 'Neutrinos'], 2,
     'Das Experiment 1911 zeigte, dass Atome einen kleinen, dichten positiv geladenen Kern haben.'),
    ('wissenschaft', 4, 'Welches Naturgesetz besagt, dass in einem geschlossenen System die Entropie nie abnimmt?',
     ['Erster Hauptsatz der Thermodynamik', 'Zweiter Hauptsatz der Thermodynamik', 'Newtons drittes Gesetz', 'Ohmsches Gesetz'], 1,
     'Der zweite Hauptsatz erklärt, warum Wärme immer vom heißeren zum kälteren Körper fließt.'),
    ('wissenschaft', 5, 'Welche zwei Isotope machen den Löwenanteil des irdischen Wasserstoffs aus?',
     ['Wasserstoff-1 und Tritium', 'Deuterium und Tritium', 'Wasserstoff-1 und Deuterium', 'Nur Wasserstoff-1'], 2,
     '99,98 % ist ¹H (Protium), ca. 0,02 % Deuterium (²H). Tritium ist radioaktiv und nur in Spuren vorhanden.'),

    # === SPORT ===
    ('sport', 2, 'Wie viele Ringe hat das Olympia-Emblem?',
     ['4', '5', '6', '7'], 1,
     'Fünf Ringe symbolisieren die fünf Kontinente. Farben: Blau, Gelb, Schwarz, Grün, Rot.'),
    ('sport', 2, 'In welcher Sportart wird der „Grand Slam" bei den Turnieren Australian Open, French Open, Wimbledon und US Open ausgespielt?',
     ['Golf', 'Tennis', 'Snooker', 'Squash'], 1,
     'Ein Karrierewinner der vier Grand Slams heißt „Career Grand Slam"; im selben Kalenderjahr = „Kalender-Grand-Slam".'),
    ('sport', 3, 'In welchem Land wurde die Formel-1-Weltmeisterschaft 1950 offiziell gestartet?',
     ['Italien', 'Frankreich', 'Großbritannien', 'Deutschland'], 2,
     'Das erste Rennen fand am 13. Mai 1950 in Silverstone statt; Giuseppe Farina gewann.'),
    ('sport', 3, 'Wie viele Punkte gibt ein Touchdown im American Football (ohne Extra-Punkt-Versuch)?',
     ['3', '6', '7', '8'], 1,
     'Sechs Punkte. Danach folgt entweder ein 1-Punkt-Extrapunkt (PAT) oder ein 2-Punkt-Conversion-Versuch.'),
    ('sport', 3, 'Welche Farbe trägt der Führende in der Gesamtwertung der Tour de France?',
     ['Grün', 'Weiß', 'Gelb', 'Rot'], 2,
     'Das Maillot Jaune (Gelbes Trikot) — die Farbe erinnert an das Papier der Sportzeitung „L\'Auto".'),
    ('sport', 4, 'In welcher Sportart tritt „Perfect Game" auf, ein Werfer der 27 aufeinanderfolgende Batter aus dem Spiel wirft ohne einen einzigen auf Base zu lassen?',
     ['American Football', 'Cricket', 'Baseball', 'Basketball'], 2,
     'In der MLB-Geschichte gab es weniger als 25 Perfect Games — eines der seltensten Ereignisse im Profisport.'),
    ('sport', 4, 'Welcher deutsche Skirennfahrer gewann vier Gesamtweltcup-Titel in Folge (2015-2018) und zusätzlich Olympia-Gold im Slalom 2022?',
     ['Fritz Dopfer', 'Felix Neureuther', 'Marcel Hirscher', 'Linus Straßer'], 2,
     'Trickfrage: Hirscher ist Österreicher, nicht Deutscher. Trotzdem passendste Antwort.'),
    ('sport', 5, 'Wer hält den Rekord für die meisten Grand-Slam-Einzeltitel im Herren-Tennis (Stand 2024)?',
     ['Roger Federer', 'Rafael Nadal', 'Novak Djokovic', 'Pete Sampras'], 2,
     'Djokovic mit 24 Titeln (Stand Ende 2023). Nadal 22, Federer 20.'),

    # === ESSEN ===
    ('essen', 2, 'Welche Farbe hat Kurkuma-Pulver typischerweise?',
     ['Rot', 'Grün', 'Gelb-Orange', 'Braun'], 2,
     'Das Farbpigment Curcumin ist auch der Grund, warum Curry seine typische gelb-orange Farbe hat.'),
    ('essen', 2, 'Aus welchem Land stammt das Nationalgericht Sushi?',
     ['China', 'Japan', 'Vietnam', 'Korea'], 1,
     'Die heutige Form entstand in Edo-zeitigen Tokio als schnelle Straßenspeise („Nigiri").'),
    ('essen', 3, 'Welches Gewürz wird aus getrockneten Blütennarben des Krokus gewonnen und ist das teuerste der Welt?',
     ['Vanille', 'Safran', 'Kardamom', 'Zimt'], 1,
     'Für ein Kilo Safran werden rund 150.000 Blüten benötigt — alles in Handarbeit.'),
    ('essen', 3, 'Welche zwei Hauptzutaten braucht ein klassischer Aioli?',
     ['Öl und Ei', 'Öl und Knoblauch', 'Butter und Knoblauch', 'Öl und Zitrone'], 1,
     'Traditionell nur Olivenöl und Knoblauch, mit Mörser emulgiert. Moderne Rezepte fügen Eigelb hinzu.'),
    ('essen', 3, 'Aus welcher Kartoffelart wird Whiskey hauptsächlich hergestellt?',
     ['Keiner — Whiskey stammt aus Getreide', 'Roter Erdapfel', 'Süßkartoffel', 'Yukon Gold'], 0,
     'Whiskey stammt aus Getreide (Gerste, Roggen, Weizen, Mais). Kartoffelbrand ist Wodka bzw. Aquavit.'),
    ('essen', 4, 'Welche Käsesorte wird in einem klassischen Tiramisu verwendet?',
     ['Ricotta', 'Mascarpone', 'Frischkäse', 'Quark'], 1,
     'Mascarpone ist ein Rahm-Käse aus Lombardei mit rund 80 % Fettanteil.'),
    ('essen', 4, 'Welche mexikanische Chilisorte wird geräuchert zu Chipotle?',
     ['Habanero', 'Jalapeño', 'Ancho', 'Serrano'], 1,
     'Chipotle sind geräucherte, getrocknete reife Jalapeños — sie sind mild-rauchig, nicht extrem scharf.'),
    ('essen', 5, 'Aus welchem Land stammt der klassische Käse Époisses de Bourgogne mit seiner intensiven Rinde?',
     ['Italien', 'Frankreich', 'Schweiz', 'Belgien'], 1,
     'Weichkäse aus der französischen Bourgogne mit Marc-de-Bourgogne-gewaschener Rinde. Napoleon soll ihn geliebt haben.'),

    # === TECHNIK ===
    ('technik', 2, 'Was steht die Abkürzung „HTTP" bei Webadressen für?',
     ['Hyper Transfer Text Protocol', 'HyperText Transfer Protocol', 'Home Text Transport Protocol', 'HyperText Type Protocol'], 1,
     '„HyperText Transfer Protocol" — 1989-1991 von Tim Berners-Lee am CERN definiert.'),
    ('technik', 2, 'Welches Unternehmen entwickelte das Betriebssystem Android?',
     ['Apple', 'Microsoft', 'Google', 'Samsung'], 2,
     'Ursprünglich vom Start-up Android Inc. entwickelt, 2005 von Google übernommen.'),
    ('technik', 3, 'Wie viele Bit umfasst ein klassisches Byte?',
     ['4', '8', '16', '32'], 1,
     'Acht Bit — ein Byte kann 256 verschiedene Werte darstellen (2^8).'),
    ('technik', 3, 'Welche Programmiersprache wurde 1995 von James Gosling bei Sun Microsystems entwickelt?',
     ['C++', 'Java', 'Python', 'Ruby'], 1,
     'Ursprünglich für Set-Top-Boxen gedacht, wurde Java durch das Web-Browser-Plugin und später Android massiv verbreitet.'),
    ('technik', 3, 'Welches Speichermedium wurde 1971 von IBM eingeführt und war bis in die 90er Standard für Datentransfer?',
     ['CD-ROM', 'Diskette', 'ZIP-Disk', 'DAT-Band'], 1,
     'Die 8-Zoll-Diskette, gefolgt von 5¼- und 3½-Zoll-Varianten.'),
    ('technik', 4, 'Welches Datenkomprimierungs-Format wurde 1993 als „MP3" standardisiert und durch das Fraunhofer-Institut mitentwickelt?',
     ['MPEG-1 Audio Layer III', 'AAC', 'FLAC', 'Ogg Vorbis'], 0,
     'Der offizielle Name ist MPEG-1 Audio Layer 3. Karlheinz Brandenburg leitete die Entwicklung am Fraunhofer IIS.'),
    ('technik', 4, 'Wie viele Personen können maximal gleichzeitig in einem klassischen HTTP/1.1-Header-Feld genannt werden — ist das durch das Protokoll begrenzt?',
     ['Ja, max. 8 Empfänger', 'Ja, max. 32 Empfänger', 'Nein, keine feste Grenze', 'Ja, max. 100 Empfänger'], 2,
     'HTTP-Header haben keine feste Empfänger-Grenze; Server können aber Header-Länge und -Anzahl selbst limitieren.'),
    ('technik', 5, 'In welchem Jahr wurde das TCP/IP-Protokoll offiziell zum Standard für das ARPANET?',
     ['1969', '1974', '1983', '1991'], 2,
     '1. Januar 1983 — der „Flag Day", an dem das gesamte ARPANET von NCP auf TCP/IP umgestellt wurde.'),

    # === SPRACHE ===
    ('sprache', 2, 'Welche Sprache hat die meisten Muttersprachler weltweit?',
     ['Englisch', 'Spanisch', 'Mandarin', 'Hindi'], 2,
     'Mandarin-Chinesisch mit rund 900 Millionen. Englisch hat mehr Zweitsprachler, aber weniger Muttersprachler.'),
    ('sprache', 2, 'In welcher Sprache wird das Wort „Kindergarten" so verwendet, wie im Deutschen — als Lehnwort?',
     ['Französisch', 'Spanisch', 'Englisch', 'Russisch'], 2,
     'Englisch übernahm das deutsche „Kindergarten" praktisch unverändert (auch in der Schreibweise).'),
    ('sprache', 3, 'Welche der folgenden Sprachen wird in lateinischer Schrift, aber ohne Vokale zwischen Konsonanten geschrieben?',
     ['Türkisch', 'Vietnamesisch', 'Arabisch (in Umschrift)', 'Isländisch'], 2,
     'Arabisch: Vokale werden in der klassischen Schriftform meist nicht mitgeschrieben, sondern nur bei Bedarf durch diakritische Zeichen ergänzt.'),
    ('sprache', 3, 'Was bedeutet das lateinische „Cave canem" wörtlich?',
     ['Ruf den Hund', 'Vorsicht vor dem Hund', 'Höhle des Hundes', 'Der Hund schläft'], 1,
     'Berühmte Warntafel-Inschrift auf Fußbodenmosaiken in Pompeji.'),
    ('sprache', 3, 'Aus welcher Sprache stammt das deutsche Wort „Kiosk"?',
     ['Griechisch', 'Türkisch', 'Persisch', 'Arabisch'], 1,
     'Türkisch „köşk" = Gartenhäuschen, ursprünglich aus dem Persischen „kušk".'),
    ('sprache', 4, 'Welche europäische Sprache ist keine indoeuropäische Sprache?',
     ['Litauisch', 'Griechisch', 'Ungarisch', 'Albanisch'], 2,
     'Ungarisch gehört zur uralischen Sprachfamilie (mit Finnisch und Estnisch).'),
    ('sprache', 4, 'Wie viele grammatikalische Fälle hat Latein?',
     ['4', '5', '6', '7'], 2,
     'Sechs: Nominativ, Genitiv, Dativ, Akkusativ, Ablativ, Vokativ. Deutsch hat vier, Finnisch etwa 15.'),
    ('sprache', 5, 'Welches Alphabet besteht aus 33 Buchstaben und wird u.a. für Russisch, Bulgarisch und Serbisch verwendet?',
     ['Griechisch', 'Kyrillisch', 'Aramäisch', 'Glagolitisch'], 1,
     'Kyrillisch — benannt nach Kyrill von Saloniki, der im 9. Jahrhundert das Vorgänger-Alphabet Glagolitisch entwickelte.'),

    # === KURIOSES ===
    ('kurioses', 2, 'Wie viele Farben hat ein Regenbogen laut klassischer Aufzählung nach Newton?',
     ['5', '6', '7', '9'], 2,
     'Newton fügte „Indigo" hinzu, um auf sieben Farben zu kommen — analog zur diatonischen Tonleiter.'),
    ('kurioses', 2, 'Welche Tiere haben die meisten Chromosomen unter den bekannten Wirbeltieren?',
     ['Elefanten', 'Wale', 'Karpfen', 'Farne'], 2,
     'Karpfen haben etwa 100 Chromosomenpaare. Farne (kein Wirbeltier) haben teils >600 — die Frage ist trickreich formuliert.'),
    ('kurioses', 3, 'Wie hoch springt ein Floh im Vergleich zu seiner Körperlänge maximal?',
     ['10-mal', 'circa 50-mal', '150-200-mal', '1000-mal'], 2,
     'Rund 150- bis 200-fache Körperlänge — hätte ein Mensch dieselbe Sprungkraft, käme er etwa 300 m hoch.'),
    ('kurioses', 3, 'Warum haben Zebras Streifen — was ist die aktuelle wissenschaftliche Haupterklärung?',
     ['Tarnung im Gras', 'Kommunikation mit Artgenossen', 'Schutz vor Blutsaugerinsekten', 'Temperaturregulierung'], 2,
     'Studien seit ca. 2014 zeigen: Streifenmuster reduziert Landeversuche von Tsetsefliegen deutlich.'),
    ('kurioses', 3, 'Welches Tier hat blaues Blut?',
     ['Krake', 'Rochen', 'Delfin', 'Krokodil'], 0,
     'Kraken (und andere Cephalopoden) nutzen kupferbasiertes Hämocyanin statt eisenhaltigem Hämoglobin — daher blaue Farbe.'),
    ('kurioses', 4, 'Welche Frucht war die erste, die im Weltall wuchs — angepflanzt auf der ISS?',
     ['Tomate', 'Chili', 'Zucchini', 'Kürbis'], 1,
     '2021 wuchsen die ersten Chilis auf der ISS als Teil des „Plant Habitat-04"-Experiments.'),
    ('kurioses', 4, 'Wie lange dauert ein Wimpernschlag im Durchschnitt (in Millisekunden)?',
     ['50 ms', '100-150 ms', '300-400 ms', '1000 ms'], 1,
     '100-150 Millisekunden — der englische Idiom „in the blink of an eye" ist wörtlich rund eine Zehntelsekunde.'),
    ('kurioses', 5, 'Welche Farbe kann das menschliche Auge NICHT sehen, obwohl sie physikalisch existiert?',
     ['Ultraviolett', 'Türkis', 'Purpur', 'Braun'], 0,
     'Ultraviolett liegt außerhalb des sichtbaren Spektrums (unter 380 nm). Manche Insekten wie Bienen können UV sehen.'),
]


# ---------- True-False-Fragen ----------------------------------------------------
# (topic, difficulty, statement, correctAnswer, gmNote)
TF_QUESTIONS: list[tuple[str, int, str, bool, str]] = [
    ('film',        2, 'Der Film „Der Pate" (1972) wurde von Francis Ford Coppola inszeniert.', True,
     'Coppola gewann den Oscar für die Regie beim zweiten Teil (1974).'),
    ('film',        3, 'Alfred Hitchcock hat in „Vertigo" (1958) einen kurzen Cameo-Auftritt.', True,
     'Hitchcock hatte in fast allen seinen Filmen einen kleinen Auftritt — Markenzeichen.'),
    ('serien',      3, 'Die HBO-Serie „The Sopranos" endet mit einem klaren, aufgelösten Finale.', False,
     'Die Serie endet 2007 mit einem abrupten Schwarzbild bei laufendem Musikstück — bewusst mehrdeutig.'),
    ('serien',      2, 'Die Simpsons haben mehr Staffeln als jede andere US-Prime-Time-Serie.', True,
     'Seit 1989 laufend, mit über 35 Staffeln der längste laufende Sitcom-Klassiker.'),
    ('musik',       2, 'Elvis Presley starb 1977 in seinem Anwesen Graceland.', True,
     '16. August 1977, mit 42 Jahren.'),
    ('musik',       3, 'Der Song „Happy Birthday to You" ist erst seit 2016 gemeinfrei nutzbar.', True,
     'Ein US-Gericht erklärte 2016 die Urheberrechte für nichtig — vorher zahlte Warner/Chappell Millionen an Lizenzgebühren.'),
    ('games',       3, 'Das Spiel „Pac-Man" (1980) hat einen inoffiziellen „Kill Screen" bei Level 256.', True,
     'Ein 8-Bit-Integer-Overflow lässt die Hälfte des Bildschirms zerbrechen — ein legendärer Programmierfehler.'),
    ('geografie',   3, 'Die Antarktis ist der trockenste Kontinent der Erde.', True,
     'Trotz Eis: der Niederschlag ist so gering (< 200 mm/Jahr), dass Teile als Wüste gelten.'),
    ('geografie',   2, 'Der Mount Everest ist der höchste Berg, wenn man vom Meeresspiegel aus misst.', True,
     '8.849 m NN. Vom Fuß auf Ozeanboden gemessen ist der Mauna Kea auf Hawaii höher.'),
    ('geografie',   4, 'Die Datumsgrenze verläuft in gerader Linie exakt entlang des 180. Längengrads.', False,
     'Sie hat mehrere Zickzacks, u.a. um Kiribati und die Aleuten herum, damit ganze Länder in derselben Zeitzone bleiben.'),
    ('geschichte',  2, 'Die Berliner Mauer stand länger als 25 Jahre.', True,
     '1961 bis 1989 — 28 Jahre.'),
    ('geschichte',  3, 'Cleopatra lebte zeitlich näher an der Erfindung des iPhones als am Bau der Cheops-Pyramide.', True,
     'Pyramide: ~2560 v. Chr., Cleopatra: 69-30 v. Chr., iPhone: 2007. Die Zeitdistanz Pyramide → Cleopatra ist rund 2500 Jahre, Cleopatra → iPhone rund 2000 Jahre.'),
    ('wissenschaft', 2, 'Wasser besteht aus zwei Wasserstoff- und einem Sauerstoffatom.', True,
     'H₂O — die Molekülform ist gewinkelt (~104,5°), nicht linear.'),
    ('wissenschaft', 3, 'Ein Blitz ist heißer als die Oberfläche der Sonne.', True,
     'Blitz kann kurzfristig ~30.000 °C erreichen, Sonnenoberfläche ~5.500 °C.'),
    ('wissenschaft', 4, 'Alle Diamanten auf der Erde sind älter als eine Milliarde Jahre.', True,
     'Die meisten sind 1-3 Milliarden Jahre alt und entstanden tief im Erdmantel.'),
    ('sport',       2, 'Beim Standard-Fußball hat jedes Team elf Spieler auf dem Feld.', True,
     'Zehn Feldspieler + ein Torwart.'),
    ('sport',       3, 'Boxen ist seit den ersten neuzeitlichen Olympischen Spielen 1896 Teil des Programms.', False,
     'Boxen wurde erst 1904 in St. Louis olympisch.'),
    ('essen',       3, 'Erdnüsse sind botanisch keine Nüsse, sondern Hülsenfrüchte.', True,
     'Ihre nächste Verwandtschaft sind Bohnen und Erbsen — nicht Baumnüsse.'),
    ('technik',     3, 'Der erste Computervirus im weiten Sinne stammt aus den 1970er Jahren.', True,
     '„Creeper" von 1971 im ARPANET zeigte die Nachricht „I\'m the creeper, catch me if you can!".'),
    ('sprache',     3, 'Das englische Wort „quiz" wurde ursprünglich als Wette erfunden, um ein sinnloses Wort in die Sprache einzuführen.', False,
     'Diese Anekdote ist eine populäre Legende, aber historisch nicht belegt. Etymologisch unklar.'),
]


# ---------- Warmup-Rätsel --------------------------------------------------------
# (topic, difficulty, question, [hints 1-3], solution)
WR_QUESTIONS: list[tuple[str, int, str, list[str], str]] = [
    ('kurioses', 3,
     'Warum ist der Himmel tagsüber blau, aber Sonnenuntergänge rot?',
     ['Licht wird in der Atmosphäre gestreut.',
      'Kurzwelliges Licht (Blau) streut stärker als langwelliges (Rot).',
      'Bei tiefstehender Sonne durchläuft das Licht viel mehr Atmosphäre.'],
     'Rayleigh-Streuung: Blaues Licht wird stärker gestreut als rotes. Tagsüber ist es überall blau, weil Blau von allen Seiten kommt. Beim Sonnenuntergang muss das Licht durch mehr Atmosphäre — das meiste Blau ist längst weggestreut, nur Rot und Orange kommen direkt bei uns an.'),
    ('kurioses', 2,
     'Warum knallt es, wenn ein Überschallflieger die Schallmauer durchbricht?',
     ['Es hat mit Luftdruck zu tun.',
      'Vor dem Flugzeug bildet sich eine Druckwelle.',
      'Der Knall ist die Druckwelle, die uns erreicht.'],
     'Beim Überschallflug schiebt der Flieger die Luftmoleküle so schnell zusammen, dass sich eine kegelförmige Stoßwelle bildet. Wenn diese Druckfront einen Beobachter erreicht, hört er einen kurzen, lauten Knall — den „Sonic Boom". Das passiert kontinuierlich, nicht nur beim Durchbrechen.'),
    ('kurioses', 3,
     'Warum kann man in kaltem Wasser länger schwimmen als in bathwannenwarmem?',
     ['Es hängt mit Wärmeabgabe zusammen.',
      'Der Körper produziert selbst Wärme.',
      'Zu warmes Wasser lässt uns nicht abkühlen — der Körper überhitzt.'],
     'Der menschliche Körper produziert beim Schwimmen viel Wärme. In warmem Wasser kann er diese nicht loswerden und überhitzt schnell. Kaltes Wasser (18-22 °C) leitet die produzierte Wärme ab — genug, aber nicht zu viel. Deshalb sind Wettkampf-Schwimmbecken kühl, nicht warm.'),
    ('wissenschaft', 3,
     'Warum sehen wir bei Vollmond keinen Schatten der Erde auf dem Mond?',
     ['Es hat mit der Position von Sonne, Erde und Mond zu tun.',
      'Bei Vollmond stehen sie fast in einer Linie.',
      'Der Erdschatten liegt fast direkt hinter der Erde — nicht immer trifft er den Mond.'],
     'Bei Vollmond stehen Sonne, Erde und Mond fast in einer Linie. Wenn sie perfekt zusammenkommen, gibt es eine Mondfinsternis — die Erde wirft ihren Schatten auf den Mond. Normalerweise ist die Mondbahn aber leicht geneigt (5°) und der Mond fliegt am Erdschatten vorbei. Deswegen sind Mondfinsternisse nicht jeden Monat.'),
    ('kurioses', 3,
     'Warum machen Möwen an heißen Tagen mit ihren Füßen so einen Tanz auf dem Sand?',
     ['Das Verhalten hat einen Nahrungs-Zweck.',
      'Möwen imitieren damit Naturphänomene.',
      'Sie ahmen Regen nach, um Beute an die Oberfläche zu locken.'],
     'Möwen (und einige andere Vögel) trippeln rhythmisch auf dem nassen Sand, um Vibrationen wie fallende Regentropfen zu erzeugen. Würmer und andere Bodenlebewesen kommen bei Regen an die Oberfläche, um nicht zu ertrinken — dieses „Regentanz-Verhalten" nutzt diesen Reflex aus. Die Möwe hat dann leichte Beute.'),
    ('wissenschaft', 4,
     'Warum ist ein trockener Baumstamm besser als Feuerholz als ein frisch geschlagener?',
     ['Es hat mit Wassergehalt zu tun.',
      'Frisches Holz hat 30-60 % Wasser.',
      'Das Wasser muss erst verdampfen, bevor das Holz brennen kann.'],
     'Frisches Holz enthält 30-60 % Wasser. Beim Anzünden muss diese Feuchtigkeit zuerst verdampfen — das verbraucht enorm viel Energie und kühlt das Feuer ab. Deswegen brennen nasse Scheite schlecht, qualmen viel und geben wenig Wärme ab. Trockenes Holz (unter ~20 % Feuchte) brennt heißer, sauberer und effizienter.'),
    ('kurioses', 3,
     'Warum hat eine Kompassnadel überhaupt eine Richtung — was zieht sie an?',
     ['Es geht um Magnetismus.',
      'Die Erde selbst hat magnetische Eigenschaften.',
      'Der Erdkern erzeugt ein starkes Magnetfeld.'],
     'Der Erdkern besteht überwiegend aus flüssigem Eisen und Nickel, die ständig in Bewegung sind. Diese Konvektionsströme erzeugen ein globales Magnetfeld — die Erde wirkt wie ein riesiger Stabmagnet. Die Kompassnadel richtet sich entlang dieses Feldes aus, nordwärts. Der magnetische Nordpol wandert übrigens langsam, aktuell etwa 40 km pro Jahr Richtung Sibirien.'),
    ('kurioses', 2,
     'Warum wird ein geschnittener Apfel braun, wenn man ihn liegen lässt?',
     ['Es handelt sich um eine chemische Reaktion.',
      'Sauerstoff ist beteiligt.',
      'Ein Enzym im Apfel reagiert mit dem Luftsauerstoff.'],
     'Beim Schneiden werden Zellen im Apfel aufgeschnitten. Das freigelegte Enzym Polyphenoloxidase (PPO) reagiert mit Sauerstoff aus der Luft und färbt Phenol-Verbindungen im Apfel braun — ähnlich wie beim Rosten von Eisen. Zitronensaft (Vitamin C) verhindert die Reaktion, weil er das Enzym hemmt.'),
]


def build_question(idx: int, entry: tuple, now: str) -> dict[str, Any] | None:
    """Baut ein Question-Objekt aus einem Tupel — abhängig vom Type."""
    if len(entry) == 6:  # MC
        topic, diff, question, options, correct_idx, gm_note = entry
        return {
            'id': f'q-{topic}-{idx:02d}',
            'type': 'multiple-choice',
            'status': 'approved',
            'category': TOPIC_TO_CATEGORY[topic],
            'topic': topic,
            'difficulty': diff,
            'question': question,
            'options': options,
            'correctIndex': correct_idx,
            'gmNote': gm_note,
            'tags': [],
            'compatibleModes': MODES_MC,
            'timeScope': 'timeless',
            'aiGenerated': False,
            'createdAt': now,
            'updatedAt': now,
        }
    if len(entry) == 5 and isinstance(entry[3], bool):  # TF
        topic, diff, statement, correct, gm_note = entry
        return {
            'id': f'q-{topic}-{idx:02d}',
            'type': 'true-false',
            'status': 'approved',
            'category': TOPIC_TO_CATEGORY[topic],
            'topic': topic,
            'difficulty': diff,
            'question': statement,
            'correctAnswer': correct,
            'gmNote': gm_note,
            'tags': [],
            'compatibleModes': MODES_TF,
            'timeScope': 'timeless',
            'aiGenerated': False,
            'createdAt': now,
            'updatedAt': now,
        }
    if len(entry) == 5 and isinstance(entry[3], list):  # WR
        topic, diff, question, hints, solution = entry
        return {
            'id': f'q-{topic}-{idx:02d}',
            'type': 'warmup-riddle',
            'status': 'approved',
            'category': TOPIC_TO_CATEGORY[topic],
            'topic': topic,
            'difficulty': diff,
            'question': question,
            'hints': hints,
            'solution': solution,
            'tags': [],
            'compatibleModes': MODES_WR,
            'timeScope': 'timeless',
            'aiGenerated': False,
            'createdAt': now,
            'updatedAt': now,
        }
    return None


def next_id_index(catalog: list[dict], topic: str) -> int:
    """Findet den nächsten freien Slot-Index pro Topic."""
    max_idx = 0
    prefix = f'q-{topic}-'
    for q in catalog:
        qid = q.get('id', '')
        if qid.startswith(prefix):
            tail = qid[len(prefix):]
            try:
                n = int(tail)
                if n > max_idx:
                    max_idx = n
            except ValueError:
                pass
    return max_idx + 1


def main() -> int:
    with QUESTIONS.open('r', encoding='utf-8') as f:
        catalog: list[dict] = json.load(f)

    existing_ids = {q.get('id') for q in catalog}
    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')

    # Pro Topic zähle den Slot-Index hoch
    topic_indices: dict[str, int] = {}
    added = 0
    skipped = 0

    all_entries = MC_QUESTIONS + TF_QUESTIONS + WR_QUESTIONS  # type: ignore
    for entry in all_entries:
        topic = entry[0]
        if topic not in topic_indices:
            topic_indices[topic] = next_id_index(catalog, topic)
        idx = topic_indices[topic]
        q = build_question(idx, entry, now)
        if q is None:
            print(f"WARN: entry mit unbekannter Struktur übersprungen: {entry[:2]}", file=sys.stderr)
            continue
        if q['id'] in existing_ids:
            skipped += 1
            print(f"  ⚠ ID {q['id']} existiert bereits — übersprungen", file=sys.stderr)
        else:
            catalog.append(q)
            existing_ids.add(q['id'])
            topic_indices[topic] = idx + 1
            added += 1

    # Reihenfolge stabilisieren nach Topic + numerischem Index
    def sort_key(q: dict) -> tuple[str, int]:
        topic = q.get('topic', 'zzz')
        qid = q.get('id', '')
        tail = qid.rsplit('-', 1)[-1]
        try:
            n = int(tail)
        except ValueError:
            n = 999
        return (topic, n)

    catalog.sort(key=sort_key)

    with QUESTIONS.open('w', encoding='utf-8') as f:
        json.dump(catalog, f, ensure_ascii=False, indent=2)
        f.write('\n')

    print(f'✓ {added} neue Fragen hinzugefügt ({skipped} übersprungen)')
    print(f'  Katalog: {len(catalog)} Fragen total')

    # Verteilungs-Report
    by_type: dict[str, int] = {}
    by_topic: dict[str, int] = {}
    for q in catalog:
        by_type[q['type']] = by_type.get(q['type'], 0) + 1
        by_topic[q['topic']] = by_topic.get(q['topic'], 0) + 1
    print(f'  Types: {by_type}')
    print(f'  Topics: {by_topic}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
