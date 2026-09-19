# Quizabend – Konzept-Draft v1

Diese Datei ist ein lebendes Konzept-Dokument. Nicolas + Freunde + Kiro ergänzen und schärfen es gemeinsam, bis daraus ein umsetzbares Produkt-Design entsteht.

**Status:** Erster Wurf. Alles offen zur Diskussion.

---

## 1. Vision in einem Satz

Ein modularer Baukasten für gesellige Quizabende: Statt eines fixen Ablaufs stellt man sich einen Abend aus verschiedenen Spielmodi zusammen — oder spielt einzelne Modi einfach zwischendurch. Der Fragenkatalog wächst über die Zeit und deckt viele Themengebiete ab.

## 2. Nutzungs-Szenarien

### 2a. Der kuratierte Quizabend
Der Gastgeber wählt vorab z. B. 4–6 Spielmodi und die App führt strukturiert durch den Abend (wie bisher: Best of 5, Match-Tracker, Timer). Zeit: 90–150 Minuten.

### 2b. Das freie Spiel
Zwischen zwei Bieren, spontan zu viert am Küchentisch, 20 Minuten Zeit — man wählt einen einzelnen Modus, spielt eine schnelle Runde. Kein Match-Tracker nötig, nur der Punktestand der aktuellen Runde.

### 2c. Der Solo-Modus (offen zur Diskussion)
Einzelne Person testet sich selbst gegen den Fragenkatalog. Sinn: Sich selbst rauslassen, wenn man alleine ist? Oder unnötiger Scope? **→ Feedback von Freunden gewünscht.**

### 2d. Der Remote-Modus (offen zur Diskussion)
Mehrere Freunde spielen zusammen an verschiedenen Orten (z. B. per Video-Call), aber alle sehen die App synchronisiert. Deutlich mehr Aufwand (Backend, Sync). **→ Feature für v2 oder gar nicht?**

## 3. Zielgruppe

Freundeskreise 4–8 Personen, meist gemischte Runden ohne Gender-Vorprägung. Nicht altersspezifisch, aber der Content sollte Millennial-Popkultur (2000er–heute) genauso abdecken wie Klassik-Allgemeinwissen. Kein Kinderquiz, kein Bar-Bingo-Vibe — eher gemütlicher Wohnzimmer-Abend mit Wein/Bier.

## 4. Team-Struktur (offen zur Diskussion)

- **Team-Modus:** 2 Teams à 2–4 Personen (wie bisher)
- **Einzel-Modus:** jeder für sich (bis 8 Spieler)
- **Kooperativ:** alle gegen die App (z. B. „Schafft ihr gemeinsam 20 Fragen in 5 Minuten?")

Nicolas' Präferenz aus bisheriger Erfahrung: Team-Modus als Standard. **→ Andere Modi als Zusatz-Feature oder komplett rauslassen?**

---

## 5. Katalog der Spielmodi

Jeder Modus ist ein eigenständiges Modul mit eigenem Setup, Regelwerk und Frage-Format. Aus diesem Katalog stellt sich der Gastgeber seinen Abend zusammen.

### Bewährte Modi (aus Runden 1–6)

**Warm-up „Genial daneben"**
- 5 überraschende Rätsel-Fragen mit stufenweisen Hinweisen
- Alle beraten gemeinsam, keine Wertung
- Zeit: 15–20 Min
- **Fragen-Typ:** „Warum ist X so-und-so?" (Alltagsphänomene mit unerwarteter Erklärung)

**Quizduell / „Wer weiß denn sowas?"**
- 12 Kategorien liegen offen, Teams wählen abwechselnd
- Multiple Choice (A/B/C)
- Punkte fürs richtige Beantworten der eigenen Wahl
- Zeit: 20–25 Min

**Jeopardy**
- 5 Kategorien × 4 Werte (z. B. 100/200/300/400)
- Frage wird aufgedeckt, Team mit erstem Buzzer antwortet
- Fehler → anderes Team darf übernehmen
- Zeit: 25–30 Min

**Expertenrunde**
- Jede/r Spieler:in wählt vor der Runde ein Fachgebiet
- Fragen zum Fachgebiet werden gestellt, Fachperson antwortet zuerst (Solo-Phase mit Timer)
- Falsch oder Pass → Buzzer-Steal für die anderen (halbe Punktzahl)
- Zeit: 20–25 Min
- **Wichtig:** Die App braucht einen Setup-Screen, in dem vor dem Spiel die Fachgebiete konfiguriert werden (kein Hardcoding auf Personen).

**The Chase**
- Jedes Team bekommt 90 Sekunden für eine schnelle Frage-Sequenz
- Richtig = 1 Punkt, „Weiter" jederzeit erlaubt
- Zeit: 8–10 Min

**Wer wird Millionär**
- 5 Fragen mit steigendem Wert (z. B. 100 € → 1 Mio €)
- Verdecktes Einloggen der Teams, gleichzeitige Auflösung
- Zeit: 12–15 Min

### Neue Modi (Vorschläge, offen zur Diskussion)

**Wahr oder Falsch — Speed Round**
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

**→ Weitere Vorschläge von Freunden hier ergänzen:**
- [ ] …
- [ ] …

---

## 6. Fragen-Katalog: Kategorien

Der Fragenkatalog soll breit gefächert sein und mindestens 500+ Fragen im Startbestand haben (Wachstum über die Zeit). Kategorien-Struktur zur Einordnung:

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

**→ Weitere Kategorien-Ideen von Freunden:**
- [ ] …
- [ ] …

### Kategorie-Tags für die App

Jede Frage bekommt ein oder mehrere Tags, damit der Gastgeber vor dem Abend filtern kann:

- **Thema:** einer der Kategorien oben
- **Schwierigkeit:** leicht / mittel / schwer / experten
- **Zeitbezug:** zeitlos / stichdatum (mit Referenzdatum, falls fakten-getrieben)
- **Zielgruppe:** Millennials / GenZ / gemischt
- **Region:** DACH / international / global

---

## 7. Fragen-Qualitäts-Prinzipien

Lessons Learned aus den bisherigen sechs Runden:

1. **Keine Antwortworte in der Frage.** Wenn die Antwort „Taylor Swift" ist, darf im Fragetext kein „Taylor" auftauchen. Der Antwort-Kontext gehört in den GM-Hinweis (Auflösungserklärung), nicht in die Frage.

2. **Schwierigkeit an Punktwert kalibrieren.**
   - **Leicht (100):** Allgemeinwissen, das ohne Nachdenken sitzt.
   - **Mittel (200):** Etwas Erinnerungsarbeit; die meisten kennen es, wenn sie überlegen.
   - **Schwer (300):** Fachwissen oder unbekanntere Fakten; nur Interessierte wissen es sofort.
   - **Experten (400):** Spezialisiert; ein Team ohne Vorkenntnisse hat wenig Chance — höchstens durch Ausschluss.

3. **ABCD-Verteilung balancieren.** Bei Multiple-Choice die richtige Antwort NICHT immer an derselben Position. Bei 5 Millionär-Fragen sollten die Lösungen möglichst auf verschiedene Buchstaben verteilt sein. Ideal: **App shufflet die Antworten pro Frage beim Rendern** — dann ist die Position im Katalog egal.

4. **Keine Frage-Duplikate zwischen Runden.** Das System muss vor Verwendung einer Frage prüfen, ob sie schon einmal gestellt wurde (in irgendeiner vergangenen Runde). Duplicate-Check gegen Alt-Handbücher.

5. **Zeit-genaue Formulierung.** Bei Fakten mit Datum/Rekorden/Zahlen: Bezugsdatum in die Frage einbauen („Stand 2025", „bis 2024"), damit die Antwort durch neue Daten nicht falsch wird.

6. **Antworten mit klarer eindeutiger Lösung.** Keine „vermutlich" oder „meistens"-Antworten. Wenn eine Frage mehrere richtige Lösungen zulässt, entweder umformulieren oder als Multiple-Answer markieren.

7. **Popkultur mit Verfallsdatum kennzeichnen.** Trends wie „Brat Summer 2024" oder aktuelle Charts-Hits sind nach 2–3 Jahren nicht mehr aktuell. Diese Fragen mit Ablauf-Tag versehen.

**→ Weitere Prinzipien von Freunden ergänzen:**
- [ ] …

---

## 8. App-Features

### Muss-Features (v1)
- Wahl zwischen kuratiertem Quizabend und freiem Spiel
- Team-Setup vor Spielbeginn (Namen, Anzahl Teams, Anzahl Spieler pro Team)
- Bei Expertenrunde: Setup-Screen für Fachgebiete (jede/r Spieler:in trägt ihr/sein Fachgebiet ein)
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
- Getrennte Master- und Team-Ansicht (Master-Handy zeigt Lösung, Fernseher zeigt nur Frage)
- Handbook-Export für die geplante Runde (Markdown / PDF / DOCX)
- Post-Session-Feedback pro Frage (zu leicht / passt / zu schwer / doppeldeutig) → fließt in Frage-Qualitäts-Log

### Für später (v2+)
- Media-Support (Audio-Snippets, Bild-Fragen, Video-Ausschnitte)
- Remote-Modus mit Sync über mehrere Geräte
- Fragen-Import aus Community-Sammlungen
- Analyse-Dashboard: welche Kategorien werden am häufigsten gewählt, wo sind Kalibrierungs-Probleme

---

## 9. Technische Grob-Richtung

- Single-Page-Web-App, offline lauffähig, keine Server-Abhängigkeit
- Fragen-Katalog als JSON (versionierbar via Git)
- Frontend-Framework: **offen zur Diskussion** (Vanilla JS reicht für v1? React/Vue für v2?)
- Persistenz: LocalStorage für Session-State, Datei-Export für Runden-Historie
- Handbuch-Generierung: Script erzeugt aus JSON automatisch das Quizmaster-Dokument als Markdown und optional als PDF/DOCX

---

## 10. Nächste Schritte (Nicolas)

Reihenfolge zur Diskussion:

1. Diesen Draft mit Freunden durchgehen, offene Fragen (mit **→** markiert) entscheiden.
2. Katalog-Kategorien und Modi finalisieren.
3. Ersten schlanken Fragen-Katalog aufbauen (z. B. 50 Fragen pro Kategorie als Startbestand).
4. Neues Greenfield-Repo aufsetzen mit sauberem Setup (Schema-First, Test-Driven).
5. v1 der App bauen: Muss-Features, ohne Nice-to-have.

---

## 11. Offene Fragen für die Freundes-Runde

Sammelstelle für alles, was ich mit den Freunden ausdiskutieren will bevor's ins Repo geht:

1. **Wie viele Modi sollen als Minimum in v1 sein?** Aktuell 6 aus Bestand plus Auswahl neuer — nicht alles auf einmal umsetzen.
2. **Solo-Modus und Remote-Modus:** ja / nein / später?
3. **Einzelspiel- und Kooperativ-Modus:** sinnvoll oder Scope-Creep?
4. **Braucht die App einen „Party-Modus"** mit größerer Schrift / TV-Optimierung als Default, oder ist das Fullscreen?
5. **Fragen-Auswahl-Prozess:** Wählt der Gastgeber die Fragen manuell oder generiert die App zufällig (mit Filtern)?
6. **Frage-Qualität-Feedback:** freiwillig nach jeder Frage bewerten (zu leicht/passt/zu schwer) oder ganz weglassen?
7. **Media-Fragen** (Audio/Bild) als v1-Feature oder später? Erhöht Aufwand deutlich.

---

## 12. Notizen / Sammlung

Freie Zone. Was den Freunden noch einfällt, kommt hier rein, ohne Struktur, bis wir's einordnen können.

- [ ] …
