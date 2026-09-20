# Quizabend – Konzept-Draft v2

Diese Datei ist die aktuelle Konzept-Grundlage. Sie erweitert v1 um Ergebnisse aus dem gemeinsamen Brainstorming und ist ab jetzt der Ground Truth für alle Entscheidungen. Die v1 bleibt aus historischen Gründen erhalten (`konzept-v1.md` + `konzept-v1.pdf`); die roten Ergänzungen aus dem Brainstorming sind in `konzept-v2.pdf` einzusehen.

**Status:** Zweiter Wurf, deutlich substantieller. Personalisierung ist zum zentralen Alleinstellungsmerkmal geworden.

---

## 1. Vision in einem Satz

Ein modularer Baukasten für gesellige Quizabende: Statt eines fixen Ablaufs stellt man sich einen Abend aus verschiedenen Spielmodi zusammen — oder spielt einzelne Modi einfach zwischendurch. Der Fragenkatalog wächst über die Zeit und deckt viele Themengebiete ab.

**Erweiterung:** Der zentrale USP kann über den Baukasten hinaus ein **personalisierter Spieleabend** sein. Spieler geben Interessen und optional ihre Selbsteinschätzung je Thema an; die App stellt daraus passende Kategorien, Fragen, Schwierigkeitsgrade und – perspektivisch – sogar den Ablauf des Abends zusammen.

## 2. Nutzungs-Szenarien

### 2a. Der kuratierte Quizabend
Der Gastgeber wählt vorab z. B. 4–6 Spielmodi und die App führt strukturiert durch den Abend (wie bisher: Best of 5, Match-Tracker, Timer). Zeit: 90–150 Minuten.

### 2b. Das freie Spiel
Zwischen zwei Bieren, spontan zu viert am Küchentisch, 20 Minuten Zeit — man wählt einen einzelnen Modus, spielt eine schnelle Runde. Kein Match-Tracker nötig, nur der Punktestand der aktuellen Runde.

### 2c. Der personalisierte Auto-Abend
Alle Spieler treten per Raum-Code bei und geben in 30–45 Sekunden einige Interessen an (z. B. Basketball, Reality-TV, Reisen, Harry Potter) sowie optional ihre Selbsteinschätzung „bisschen / gut / Nerd". Der Host wählt nur noch Dauer und Stimmung; die App baut daraus automatisch einen ausgewogenen Abend.

Auswahl vor dem Start:
- **Dauer:** 30 / 60 / 90 Minuten / ganzer Abend
- **Stimmung:** „Locker & lustig" / „Quiz Night" / „Competitive" / „Party"

Dadurch wird aus „Wähle ein Quiz" eher „Wir bauen euren Abend".

## 3. Zielgruppe

Freundeskreise 4–8 Personen, meist gemischte Runden ohne Gender-Vorprägung. Nicht altersspezifisch, aber der Content sollte Millennial-Popkultur (2000er–heute) genauso abdecken wie Klassik-Allgemeinwissen. Kein Kinderquiz, kein Bar-Bingo-Vibe — eher gemütlicher Wohnzimmer-Abend mit Wein/Bier.

**Personalisierung sollte stärker über Interessen als über starre Altersgruppen funktionieren:** Zwei Gruppen im gleichen Alter können komplett andere Kategorien benötigen. Zielbild bleibt bewusst erwachsen und wohnzimmertauglich – eher „Premium Game Night" als Kinderquiz oder klassische Kneipen-Quiz-App.

## 4. Team-Struktur

- **Team-Modus:** 2 Teams à 2–4 Personen (Standard)
- **Einzel-Modus:** jeder für sich (bis 8 Spieler)
- **Kooperativ:** alle gegen die App (z. B. „Schafft ihr gemeinsam 20 Fragen in 5 Minuten?")

**Dynamische Rollen pro Modus:** Ein Abend muss nicht durchgehend im selben Teamformat bleiben. Denkbar sind Teamrunden, Einzelrunden, 1:1-Duelle und „Alle gegen eine Person" innerhalb derselben Session. Personalisierte Sonderrunden können gezielt einzelne Spieler hervorheben, ohne dass die gesamte Quizlogik auf deren Interessen zugeschnitten wird.

---

## 5. Katalog der Spielmodi

Jeder Modus ist ein eigenständiges Modul mit eigenem Setup, Regelwerk und Frage-Format. Aus diesem Katalog stellt sich der Gastgeber seinen Abend zusammen — oder die App tut es automatisch (siehe 2c).

### Bewährte Modi (aus Runden 1–6)

Die App verwendet eigene UI-Namen; die Original-Bezeichnungen aus den Runden dienen der Wiedererkennung.

**Klick! (Warm-up „Genial daneben")**
- 5 überraschende Rätsel-Fragen mit stufenweisen Hinweisen
- Alle beraten gemeinsam, keine Wertung
- Zeit: 15–20 Min
- **Fragen-Typ:** „Warum ist X so-und-so?" (Alltagsphänomene mit unerwarteter Erklärung)

**Themen-Battle (Quizduell / „Wer weiß denn sowas?")**
- 12 Kategorien liegen offen, Teams wählen abwechselnd
- Multiple Choice (A/B/C)
- Punkte fürs richtige Beantworten der eigenen Wahl
- Zeit: 20–25 Min

**Punktejagd (Jeopardy)**
- 5 Kategorien × 4 Werte (z. B. 100/200/300/400)
- Frage wird aufgedeckt, Team mit erstem Buzzer antwortet
- Fehler → anderes Team darf übernehmen
- Zeit: 25–30 Min

**Fachrunde (Expertenrunde)**
- Jede/r Spieler:in wählt vor der Runde ein Fachgebiet
- Fragen zum Fachgebiet werden gestellt, Fachperson antwortet zuerst (Solo-Phase mit Timer)
- Falsch oder Pass → Buzzer-Steal für die anderen (halbe Punktzahl)
- Zeit: 20–25 Min
- **Wichtig:** Die App braucht einen Setup-Screen, in dem vor dem Spiel die Fachgebiete konfiguriert werden (kein Hardcoding auf Personen).

**Sprinter (The Chase)**
- Jedes Team bekommt 90 Sekunden für eine schnelle Frage-Sequenz
- Richtig = 1 Punkt, „Weiter" jederzeit erlaubt
- Zeit: 8–10 Min

**Alles oder Nichts (Wer wird Millionär)**
- 5 Fragen mit steigendem Wert (z. B. 100 € → 1 Mio €)
- Verdecktes Einloggen der Teams, gleichzeitige Auflösung
- Zeit: 12–15 Min

### Neue Modi (Vorschläge, offen zur Diskussion)

**Blitzrunde (Wahr oder Falsch — Speed Round)**
- 10–15 Behauptungen werden nacheinander schnell vorgelesen
- Teams schreiben „W" oder „F" auf, alle auf Kommando zeigen
- Punkte für jede richtige
- Zeit: 5–8 Min

**Wortfetzen / Songzeilen**
- Ein Filmzitat, Songtext oder berühmter Ausspruch wird gezeigt
- Team muss Titel/Interpret/Kontext raten
- Zeit: 10–15 Min

**Reihenfolge / Sortieren**
- Vier Ereignisse, Länder, Personen — Teams müssen chronologisch/nach Größe/nach Zahl sortieren
- Punkte nach Anzahl richtiger Paare in der Reihenfolge
- Zeit: 10 Min

**Blind Guess**
- Ausschnitt aus Musik / Filmszene / Bild-Detail
- Teams raten (Songtitel / Film / Person)
- Braucht Medien-Support in der App (Audio/Video-Player)
- Zeit: 15–20 Min

**Family Feud / „Die 100 wichtigsten…"**
- Statistische Umfrage wird gestellt („Nennt eine Sportart, die man ohne Ball spielt")
- Teams versuchen, die meistgenannten Antworten aus einer echten Umfrage-Liste zu erraten
- Punkte nach Häufigkeit
- Zeit: 15 Min

**Duell 1:1**
- Jedes Team schickt einen Vertreter
- Direkte Buzzer-Runde zu je einer Frage
- Zeit: 10 Min

**Elimination-Runde**
- Alle Spieler stehen, wer falsch antwortet, setzt sich
- Letzter Stehender gewinnt Bonus-Punkt fürs Team
- Zeit: 10 Min

**„Nenn drei"**
- Team muss 3 Dinge aus einer Kategorie nennen („3 Länder, die an Deutschland grenzen und mit B anfangen")
- Punkte für jedes richtige, Zeitlimit
- Zeit: 8 Min

**Pantomime / Zeichnen / Beschreiben (Activity-Style)**
- Ein Team-Mitglied stellt einen Begriff dar (ohne Worte / mit Zeichnung / mit Umschreibung), Team rät
- Braucht evtl. externe Materialien (Stift/Papier), oder digitale Zeichenfläche
- Zeit: 15 Min

### Personalisierte / soziale Modi (neu in v2)

Diese Modi setzen voraus, dass Spielerprofile mit Interessen vorliegen (siehe 2c und Kapitel 8).

**Player Spotlight / „Heimspiel"**
Ein Spieler bekommt eine Kategorie aus seinem eigenen Interessensprofil. Er antwortet zuerst ohne Multiple Choice; die anderen dürfen bei Fehler/Pass stealen. Ideal als kurzer persönlicher Moment innerhalb eines ansonsten fairen Abends.

**Rivalry / Head-to-Head**
Erkennt die App ein gemeinsames starkes Interesse bei zwei Spielern, kann sie ein kurzes 1:1-Duell starten. Die übrigen Spieler tippen vorher auf den Ausgang und können Bonuspunkte sammeln.

**Common Ground**
Wenn mehrere Spieler dasselbe Interesse gewählt haben, entsteht daraus eine gemeinsame, etwas anspruchsvollere Kategorie oder Mini-Runde.

**Out of Your Element**
Bewusster Gegenpol zur Personalisierung: Spieler bekommen Fragen außerhalb ihrer üblichen Interessensgebiete. Das verhindert, dass der Abend nur aus Komfortzonen besteht.

**Who Said That? / Wer war das?**
Vor oder während des Setups beantworten Spieler kurze persönliche Fragen („Welche Serie könntest du 20-mal schauen?", „Was war dein schlimmster Urlaub?"). Später muss die Gruppe erraten, von wem die Antwort stammt. Damit geht das Produkt über reines Trivia hinaus in Richtung Party-Game.

---

## 6. Fragen-Katalog: Kategorien

Der Fragenkatalog soll breit gefächert sein und mindestens 500+ Fragen im Startbestand haben (Wachstum über die Zeit). Zusätzlich sollten freie Interessen aus den Spielerprofilen auf standardisierte Tags gemappt werden können (z. B. „NBA", „Taylor Swift", „Formel 1", „D&D"). So bleibt der Katalog strukturiert, obwohl Nutzer sehr spezifische Themen eingeben können.

### Popkultur & Medien
- Film (Klassiker, Blockbuster, deutscher Film, Indie/Arthouse)
- Serien (Streaming-Ära, HBO, Netflix, Anime, deutschsprachig)
- Musik (Charts aktuell, 80er/90er/2000er, klassisch, deutsche Musik, Hip-Hop, Rock, K-Pop)
- Videospiele (Retro, Nintendo, PC-Games aktuell, E-Sports, Handy-Games)
- Comics & Graphic Novels
- Bücher (Bestseller, Klassiker, Fantasy, Krimi)

### Allgemeinbildung
- Geografie (Länder, Hauptstädte, Naturphänomene, Flaggen)
- Geschichte (Antike, Mittelalter, Neuzeit, Weltkriege, Deutsche Geschichte, Kalter Krieg)
- Politik (Weltpolitik, deutsche Politik, EU, internationale Organisationen)
- Wirtschaft & Börse (Firmengeschichten, Kennzahlen, Krisen)
- Wissenschaft (Physik, Chemie, Biologie, Astronomie, Medizin)
- Sprache (Etymologie, Redewendungen, Fremdsprachen, Zitate)

### Alltag & Lifestyle
- Essen & Trinken (Kulinarik, Wein, Bier, Cocktails, Regionalküchen)
- Reisen (Städte, Sehenswürdigkeiten, Kulturen, Kuriosa)
- Sport (Fußball, Olympia, Formel 1, US-Sport, weniger populäre Sportarten)
- Mode & Design (Modemarken, Design-Ikonen, Trends)
- Beauty & Kosmetik (Marken, Wirkstoffe, Trends)
- Technologie & Internet (Tech-Firmen, Erfindungen, Social Media, Meme-Kultur)

### Spezialgebiete (nach Bedarf)
- Kunst (Malerei, Skulptur, Ausstellungen, Kunstauktionen)
- Architektur & Städtebau
- Philosophie & Religion
- Recht & Gesellschaft
- Nature & Tierwelt

### Kurioses & Rätsel
- „Genial daneben"-Fakten (Alltagsphänomene mit überraschender Erklärung)
- Weltrekorde
- Statistische Kuriositäten
- Etymologische Ursprünge

### Kategorie-Tags für die App

Jede Frage bekommt Metadaten, damit der Gastgeber vor dem Abend filtern kann und die App personalisieren kann:

- **Thema:** einer der Kategorien oben
- **Schwierigkeit:** leicht / mittel / schwer / experten
- **Zeitbezug:** zeitlos / stichdatum (mit Referenzdatum, falls fakten-getrieben)
- **Zielgruppe:** Millennials / GenZ / gemischt
- **Unterthema / Entität:** z. B. NBA, Marvel, Harry Potter, Taylor Swift, Bundesliga
- **Frageformat:** offen / Multiple Choice / Wahr-Falsch / Sortieren / Schätzen / Buzzer / Medienfrage
- **Medientyp:** Text / Bild / Audio / Video
- **Personalisierungs-Eignung:** Allgemeinwissen / gemeinsames Interesse / Expertenfrage / Wildcard
- **Quelle & Verifikation:** Quelle, `geprüft_am`, ggf. `gültig_bis` / Ablaufdatum
- **Nutzungsdaten:** bereits gespielt, Trefferquote, Feedback zur Schwierigkeit

### Personalisierungs- / Auswahl-Logik (Start-Hypothese „Quiz Director")

Die App sollte nicht einfach jedem Spieler nur Fragen zu dessen Hobbys geben. Stattdessen braucht es einen „Quiz Director", der einen ausgewogenen Mix für die gesamte Gruppe zusammenstellt.

Beispielhafte Verteilung als Ausgangspunkt (Werte sind explizit **Startpunkt für Tests**, keine finale Kalibrierung):
- ca. **30 %** Allgemeinwissen
- ca. **30 %** gemeinsame Interessen der Gruppe
- ca. **25 %** individuelle Interessen fair auf alle Spieler verteilt
- ca. **15 %** Wildcards / Überraschungen

Schwierigkeit kann zusätzlich an der Selbsteinschätzung („bisschen / gut / Nerd") ausgerichtet werden. Eine Expertenfrage für einen NBA-Nerd darf deutlich tiefer gehen als eine Basketballfrage für Gelegenheitsschauer.

---

## 7. Fragen-Qualitäts-Prinzipien

Lessons Learned aus den bisherigen sechs Runden und aus dem Brainstorming:

1. **Keine Antwortworte in der Frage.** Wenn die Antwort „Taylor Swift" ist, darf im Fragetext kein „Taylor" auftauchen. Der Antwort-Kontext gehört in den GM-Hinweis (Auflösungserklärung), nicht in die Frage.

2. **Schwierigkeit an Punktwert kalibrieren.**
   - **Leicht (100):** Allgemeinwissen, das ohne Nachdenken sitzt.
   - **Mittel (200):** Etwas Erinnerungsarbeit; die meisten kennen es, wenn sie überlegen.
   - **Schwer (300):** Fachwissen oder unbekanntere Fakten; nur Interessierte wissen es sofort.
   - **Experten (400):** Spezialisiert; ein Team ohne Vorkenntnisse hat wenig Chance — höchstens durch Ausschluss.

3. **ABCD-Verteilung balancieren.** Bei Multiple-Choice die richtige Antwort NICHT immer an derselben Position. Ideal: **App shufflet die Antworten pro Frage beim Rendern** — dann ist die Position im Katalog egal.

4. **Keine Frage-Duplikate zwischen Runden.** Das System muss vor Verwendung einer Frage prüfen, ob sie schon einmal gestellt wurde (in irgendeiner vergangenen Runde). Duplicate-Check gegen Runden-Historie.

5. **Zeit-genaue Formulierung.** Bei Fakten mit Datum/Rekorden/Zahlen: Bezugsdatum in die Frage einbauen („Stand 2025", „bis 2024"), damit die Antwort durch neue Daten nicht falsch wird.

6. **Antworten mit klarer eindeutiger Lösung.** Keine „vermutlich" oder „meistens"-Antworten. Wenn eine Frage mehrere richtige Lösungen zulässt, entweder umformulieren oder als Multiple-Answer markieren.

7. **Popkultur mit Verfallsdatum kennzeichnen.** Trends wie „Brat Summer 2024" oder aktuelle Charts-Hits sind nach 2–3 Jahren nicht mehr aktuell. Diese Fragen mit Ablauf-Tag versehen (`validUntil`).

8. **KI nur als Assistenz, nicht als Wahrheitsquelle.** KI kann Fragen vorschlagen, umformulieren, Varianten erzeugen und passende Fragen auswählen. Fakten sollten jedoch über gespeicherte Quellen bzw. eine Verifikation abgesichert werden, bevor eine Frage als „live" freigegeben wird.

9. **Fairness bei Personalisierung.** Der Algorithmus soll verhindern, dass dieselbe Person durch ihr Spezialgebiet unverhältnismäßig oft bevorzugt wird. Persönliche Expertenfragen sind bewusst als besondere Spielmomente zu behandeln, nicht als Standard jeder Runde.

10. **Schwierigkeit aus echten Spielen nachkalibrieren.** Trefferquote und Feedback („zu leicht / passt / zu schwer / doppeldeutig") können langfristig die ursprüngliche Schwierigkeitsbewertung ergänzen oder korrigieren.

11. **Erklärung statt nur Lösung.** Zu jeder Frage sollte optional ein kurzer interessanter Auflösungstext hinterlegt werden. Gerade bei Kuriositäten und „Genial daneben"-Fragen ist die Erklärung Teil des Unterhaltungseffekts.

---

## 8. App-Features

### Muss-Features (v1)
- Wahl zwischen kuratiertem Quizabend und freiem Spiel
- Team-Setup vor Spielbeginn (Namen, Anzahl Teams, Anzahl Spieler pro Team)
- **Lobby mit Raum-Code:** Spieler treten über das eigene Smartphone bei; für spontane Runden möglichst ohne Account-Pflicht
- **Spieler-Onboarding:** Name / Avatar sowie 3–6 Interessen; optional Selbsteinschätzung pro Interesse („bisschen / gut / Nerd")
- **Automatische Abend-Zusammenstellung** aus Interessen, gewünschter Dauer, Gruppengröße und gewünschter Stimmung
- **Fairness-Engine** für personalisierte Fragen: Interessen aller Spieler werden berücksichtigt, ohne einzelne Personen dauerhaft zu bevorzugen
- Bei Fachrunde: Setup-Screen für Fachgebiete (jede/r Spieler:in trägt ihr/sein Fachgebiet ein)
- Fragen-Datenbank filterbar nach Kategorie, Schwierigkeit, Zeitbezug
- Match-Tracker und Punktestand pro Modus
- Timer für zeit-basierte Modi
- Antwort-Shuffle bei Multiple Choice
- Duplicate-Check gegen Runden-Historie
- Session-Speicherung (Refresh verliert nichts)

### Nice-to-have (v1 oder v2)
- Live-Master-Controls (Frage zurücksetzen, Punkte korrigieren, Frage-Text editieren)
- Sound-Effekte (Ding, Buzzer, Timer-Endsignal)
- Fullscreen-Präsentationsmodus mit Tastatur-Shortcuts
- **Getrennte Master- und Team-Ansicht** (Master-Handy zeigt Lösung, Fernseher zeigt nur Frage). Für ein späteres öffentliches Produkt könnte diese Trennung vom Nice-to-have zum Kernfeature werden: TV/Beamer = gemeinsame Show; Host-Gerät = Steuerung/Lösung; Spieler-Handys = Buzzer, Antwortoptionen, geheime Eingaben und persönliche Aufgaben
- Handbook-Export für die geplante Runde (Markdown / PDF / DOCX)
- **„Für euch"-Startscreen:** Die App schlägt auf Basis der anwesenden Spieler direkt einen passenden Game-Night-Mix vor; daneben bleiben Quick Play und die freie Spielauswahl verfügbar
- **Post-Session-Statistiken:** Punkte, stärkste Kategorien, knappste Duelle, „MVP"-Momente und lustige Auswertungen – ohne die Runde unnötig zu verkomplizieren
- **Wiederkehrende Spielerprofile** optional speichern, damit Interessen nicht jedes Mal neu eingegeben werden müssen
- Post-Session-Feedback pro Frage (zu leicht / passt / zu schwer / doppeldeutig) → fließt in Frage-Qualitäts-Log

### Für später (v2+)
- Media-Support (Audio-Snippets, Bild-Fragen, Video-Ausschnitte)
- Remote-Modus mit Sync über mehrere Geräte
- Fragen-Import aus Community-Sammlungen
- Analyse-Dashboard: welche Kategorien werden am häufigsten gewählt, wo sind Kalibrierungs-Probleme
- „Wer kennt wen?"- und Profilfragen aus freiwilligen Spielerangaben als eigene Party-Game-Schiene
- Achievements / Jahresrückblick / Gruppenstatistiken für wiederkehrende Freundeskreise
- Community-Quizpacks und kuratierte Themenpakete zusätzlich zum zentralen Fragenpool
- KI-gestützte Erstellung neuer Fragen als Redaktionswerkzeug mit Freigabe-Workflow und Quellenprüfung

---

## 9. Technische Grob-Richtung

- **Aktuell (Prototyp):** Single-Page-Web-App, offline lauffähig, keine Server-Abhängigkeit. Fragen-Katalog als JSON (versionierbar via Git). Persistenz via `sessionStorage`/`localStorage`.
- **Für echten Multi-Device-Betrieb** (Raum-Code, Handys als Controller, Live-Punkte) wird beim Launch voraussichtlich ein kleiner Backend-/Realtime-Layer nötig.
- Sobald Fragenzahl, Quellen, Bewertungen, Nutzungs-Historie, Community-Packs und KI-Freigaben wachsen, wäre eine strukturierte Datenbank mit Import/Export wahrscheinlich robuster als reines JSON.
- **Frontend-Framework:** React + TypeScript + Vite + Tailwind (Entscheidung getroffen).
- Später: serverseitige Session-Historie für wiederkehrende Gruppen, geräteübergreifende Synchronisation und zuverlässiger Duplicate-Check über mehrere Abende hinweg.
- Handbuch-Generierung: Script erzeugt aus JSON automatisch das Quizmaster-Dokument als Markdown und optional als PDF/DOCX.

---

## 10. Produkt- & UX-Richtung

- **Positionierung:** Nicht primär „eine Quiz-Webseite", sondern eine **Game-Night-Plattform**: „Ihr bringt die Leute – die App baut den Spieleabend." Der Baukasten bleibt wichtig, die automatische Personalisierung wäre aber das klarere Alleinstellungsmerkmal.
- **TV-Show statt SaaS-Dashboard:** Der gemeinsame Bildschirm sollte sich wie eine Gameshow bzw. Konsole anfühlen: große Typografie, klare Vollbild-Szenen, wenig Navigation, Animationen, Sounds, Countdown und sichtbare Punkte. Verwaltungsoberflächen gehören eher auf das Host-Gerät.
- **Premium Game Night:** Visuell eher hochwertig, modern und erwachsen als comicartig oder kindlich. Dunkle Grundfläche, starke Typografie und je Spielmodus eine eigene Akzentwelt sind denkbar; die Modi bleiben trotzdem Teil eines gemeinsamen Designsystems.
- **Geräterollen:**
  - **TV/Beamer** = gemeinsames Erlebnis
  - **Spieler-Handy** = möglichst reduzierte Interaktion (Buzzer, A/B/C/D, Eingabe, Abstimmung)
  - **Host-Handy/Notebook** = Kontrolle, Lösungen, Punkte und Notfallkorrekturen
- **Der „Magic Moment":** Nach dem Interessen-Setup sollte sichtbar werden, wie die App den Abend baut: Interessen erscheinen, werden zu Kategorien verdichtet und anschließend als „Euer Mix für heute" präsentiert. Dieser Moment macht die Personalisierung emotional sichtbar.
- **Keine Account-Hürde:** Für spontane Spiele sollte ein Raum-Code reichen. Ein dauerhaftes Profil kann später freiwillig angeboten werden, darf aber nicht Voraussetzung für den ersten Spieleabend sein.
- **MVP-Fokus:** Zuerst muss ein Abend mit 4–8 Personen auf einer Couch zuverlässig Spaß machen. Erst danach lohnen Achievements, Community, komplexe Profile und weitergehende Social-Features.

---

## 11. Offene Fragen für die Freundes-Runde

Sammelstelle für alles, was noch mit den Freunden diskutiert werden soll:

1. **Muss es überhaupt einen menschlichen Quizmaster geben?** Option mit Person als Quizmaster / Alternativ wenn alle spielen wollen: das System als Master.
2. **Wie viele Modi sollen als Minimum in v1 sein?** Nicht alles auf einmal umsetzen; Vorschlag: 3–4 Modi initial, Rest inkrementell.
3. **Party-Modus als Default TV-Optimierung** mit großer Schrift, oder Standard-Layout reicht + Fullscreen?
4. **Fragen-Auswahl-Prozess:** Wählt der Gastgeber die Fragen manuell oder generiert die App zufällig (mit Filtern)? Vielleicht beides als Option?
5. **Frage-Qualität-Feedback:** freiwillig nach jeder Frage bewerten (zu leicht/passt/zu schwer) oder als Retrospektive nach dem Abend?
6. **Media-Fragen** (Audio/Bild) als v1-Feature oder später? Erhöht Aufwand deutlich (Player, Lizenzen).
7. **Wiederkehrende Profile:** Soll die App die Interessen zwischen Abenden merken (Cookie/Account), oder jedes Mal frisch fragen?

---

## 12. Nächste Schritte

Reihenfolge zur Diskussion (siehe auch `trello-cards-v2-erweiterung.md` für den Karten-Nachtrag):

1. **Fundament** (Fragen-Schema erweitern, Antwort-Shuffle, Duplicate-Check, Auflösungs-Erklärung im UI).
2. **Zweiten spielbaren Modus** ausliefern (Kandidat: Blitzrunde — einfach, hoher Impact).
3. **Match-Tracker** über mehrere Modi hinweg.
4. **Personalisierung Light:** Interessen-Setup in der Lobby + Kategorie-Filter im Quiz Director.
5. **Multi-Device / Raum-Code** — eigenes Projektstadium, braucht Architektur-Entscheidung (Realtime-Layer).

---

## 13. Notizen / Sammlung

Freie Zone. Was den Freunden noch einfällt, kommt hier rein, ohne Struktur, bis wir's einordnen können.

- [ ] …
