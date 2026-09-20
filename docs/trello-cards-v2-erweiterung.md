# Trello-Karten – Erweiterung aus Konzept v2

Ergänzung zu `trello-cards-startbestand.md`. Enthält die neuen Karten aus dem v2-Brainstorming (personalisierter Auto-Abend, 5 soziale Modi, erweiterte Frage-Prinzipien, konkretere App-Features).

**Empfehlung beim Anlegen:**
1. Karten aus „💡 Ideen" und „🗣 Diskussion offen" direkt anlegen — sind noch nicht beschlossen.
2. Karten aus „👍 Beschlossen" nur anlegen, wenn eure Runde die Punkte explizit abgesegnet hat. Das Konzept v2 formuliert sie als Muss-Features, aber die finale Freigabe liegt bei euch.

---

## Spalte: 💡 Ideen

### Personalisierte / soziale Modi (neu in v2)

**Modus: Player Spotlight / „Heimspiel"**

Ein Spieler bekommt eine Kategorie aus seinem eigenen Interessensprofil. Er antwortet zuerst ohne Multiple Choice; die anderen dürfen bei Fehler/Pass stealen. Ideal als kurzer persönlicher Moment innerhalb eines ansonsten fairen Abends.
Aufwand: mittel (braucht Interessen-Setup als Vorbedingung).
Offene Fragen: Wie oft pro Abend? Wie stellen wir sicher, dass es fair rotiert?

---

**Modus: Rivalry / Head-to-Head**

Erkennt die App ein gemeinsames starkes Interesse bei zwei Spielern, kann sie ein kurzes 1:1-Duell starten. Die übrigen Spieler tippen vorher auf den Ausgang und können Bonuspunkte sammeln.
Aufwand: mittel-hoch.
Offene Fragen: Braucht Interessen-Vergleichs-Logik. Sollen die Zuschauer separat werten oder nur mitraten?

---

**Modus: Common Ground**

Wenn mehrere Spieler dasselbe Interesse gewählt haben, entsteht daraus eine gemeinsame, etwas anspruchsvollere Kategorie oder Mini-Runde.
Aufwand: mittel.
Offene Fragen: Wie viele Spieler müssen ein Interesse teilen, damit es zum Common-Ground wird? Ab 2? Ab 3?

---

**Modus: Out of Your Element**

Bewusster Gegenpol zur Personalisierung: Spieler bekommen Fragen außerhalb ihrer üblichen Interessensgebiete. Verhindert, dass der Abend nur aus Komfortzonen besteht.
Aufwand: gering (nutzt Interessen-Liste als Ausschluss-Filter).
Offene Fragen: Als eigener Modus oder eher als Streuung innerhalb anderer Modi?

---

**Modus: Who Said That? / Wer war das?**

Vor oder während des Setups beantworten Spieler kurze persönliche Fragen („Welche Serie könntest du 20-mal schauen?", „Was war dein schlimmster Urlaub?"). Später muss die Gruppe erraten, von wem die Antwort stammt. Party-Game-Element, geht über reines Trivia hinaus.
Aufwand: mittel (braucht neuen Setup-Flow für persönliche Antworten).
Offene Fragen: Wie viele Fragen im Setup? Wie umgehen mit Neulingen in Runden mit vertrauten Spielern?

---

### Weitere Ideen aus v2

**Auto-Abend-Wizard: Dauer × Stimmung**

Vor dem Start wählt der Host nur zwei Regler: Dauer (30 / 60 / 90 Min / ganzer Abend) und Stimmung („Locker & lustig", „Quiz Night", „Competitive", „Party"). Die App baut daraus automatisch die Modus-Kette.
Aufwand: mittel (Mapping-Regeln definieren).
Offene Fragen: Welche Modi passen zu welcher Stimmung? Sollte der Host das Ergebnis noch anpassen können, oder nur „Neu würfeln"?

---

**Magic Moment nach dem Interessen-Setup**

Animation: Interessen erscheinen → werden zu Kategorien verdichtet → „Euer Mix für heute" wird präsentiert. Macht die Personalisierung emotional sichtbar.
Aufwand: mittel (mehr UX als Logik).
Offene Fragen: Wie lang darf die Animation sein, bevor sie nervt? Skippable?

---

**„Für euch"-Startscreen**

Home-Screen zeigt auf Basis der anwesenden Spieler direkt einen passenden Game-Night-Mix als Vorschlag. Quick Play und freie Spielauswahl bleiben daneben verfügbar.
Aufwand: mittel-hoch (setzt Spielerprofile und Quiz Director voraus).
Offene Fragen: Nur bei erneutem Besuch mit bekannten Spielern, oder auch für neue Runden?

---

**Post-Session-Statistiken**

Nach dem Abend: Punkte, stärkste Kategorien, knappste Duelle, „MVP"-Momente, lustige Auswertungen. Kurz und knackig, keine Endlos-Screens.
Aufwand: mittel.
Offene Fragen: Als Bildschirm oder als exportierbares Bild für WhatsApp?

---

**Wiederkehrende Spielerprofile (optional)**

Interessen zwischen Abenden merken, freiwillig via localStorage/Cookie. Kein Account nötig, aber wer will kann sich wiedererkennen lassen.
Aufwand: mittel.
Offene Fragen: Auf Host-Gerät gespeichert oder auf Spieler-Handy? Wie umgehen mit gemischten Runden?

---

## Spalte: 🗣 Diskussion offen

### Neue / geschärfte offene Fragen aus v2

**Braucht es zwingend einen menschlichen Quizmaster?**

Option A: Person als Quizmaster (bisheriger Fall). Option B: Alle spielen mit, App übernimmt die Master-Rolle komplett — Fragen zeigen, Timer setzen, Punkte vergeben, Lösung präsentieren. Was ist der bevorzugte Modus?

---

**Interessen-Setup: bei jedem Abend neu oder speicherbar?**

Fresh-jedes-Mal (Cookie-frei, aber lästig für Stamm-Runden) vs. wiedererkennbare Profile (bequem, aber braucht Storage). Beides parallel oder eine klare Default-Wahl?

---

**Fairness-Engine: wie hart soll sie greifen?**

Wenn Person X einen deutlichen Wissensvorsprung in Kategorie Y hat: bekommt die Person die Kategorie öfter (Belohnung Expertise) oder seltener (Fairness für die Runde)? Der „Quiz Director" muss hier eine klare Regel bekommen.

---

**Selbsteinschätzung: dreistufig, fünfstufig, oder gar nicht?**

v2 schlägt „bisschen / gut / Nerd" vor. Reicht das? Oder braucht es „Anfänger / mittel / gut / Experte / Nerd"? Oder ganz weglassen und rein aus Trefferquote lernen?

---

**Handy als Buzzer/Controller: v1 oder erst später?**

Die Multi-Device-Aussicht ist der große Sprung. Bis das kommt: reicht ein Master-Handy und ein TV? Oder bleibt die App-Erfahrung ohne Handy-Rollen zu flach?

---

**„Out of Your Element"-Anteil: fester Prozentsatz oder verhandelbar?**

Wenn die Runde 100 % Komfortzone will (Chill-Abend), sollte die App das erlauben? Oder ist ein Mindest-Anteil an Überraschungen dogmatisch gesetzt?

---

**Personalisierungs-Verteilung: 30/30/25/15 fest oder Regler?**

Konzept schlägt als Startpunkt vor: 30 % Allgemein, 30 % gemeinsame Interessen, 25 % individuelle Interessen, 15 % Wildcards. Nur Startwert oder soll der Host das für den Abend einstellen können?

---

## Spalte: 👍 Beschlossen (aus v2)

Diese Karten formuliert v2 als **Muss-Features (v1)**. Vor dem Anlegen kurz in der Runde bestätigen, ob ihr das mittragt.

**Antwort-Shuffle bei Multiple Choice**

App shufflet A/B/C/D pro Frage beim Rendern (deterministisch pro Frage-ID, damit die Position innerhalb einer Runde stabil ist). Löst das ABCD-Balance-Problem systematisch. Für v1 gesetzt.

---

**Duplicate-Check gegen Runden-Historie**

Vor Verwendung einer Frage prüfen: schon einmal gestellt (in dieser Session bzw. später über alle Abende hinweg)? Wenn ja, überspringen. Für v1 gesetzt.

---

**Auflösungs-Erklärung pro Frage**

Nach Auflösung optional ein kurzer interessanter Zusatztext („Erklärung statt nur Lösung"). Gerade bei Kuriositäten Teil des Unterhaltungseffekts. Feld im Fragen-Schema, Anzeige im GamePage.

---

**Frage-Metadaten deutlich erweitern**

Pro Frage: `difficulty` (leicht/mittel/schwer/experten), `zeitbezug` (`validAsOf`, `validUntil`), `personalizationFit` (Allgemeinwissen / gemeinsam / Experte / Wildcard), `source`+`verifiedAt`. Schema-Erweiterung in `src/types/question.ts`.

---

**Lobby mit Raum-Code**

Spieler treten übers eigene Smartphone bei. Ohne Account-Pflicht für spontane Runden. Muss-Feature laut v2, aber technisch abhängig von Realtime-Layer-Entscheidung (siehe Ideen-Karte).

---

**Spieler-Onboarding mit Interessen**

Name / Avatar sowie 3–6 Interessen, optional Selbsteinschätzung. Basis für Personalisierung. Auch ohne Multi-Device sinnvoll (Interessen können lokal am Host-Gerät gesammelt werden).

---

**Automatische Abend-Zusammenstellung**

Aus Interessen + Dauer + Gruppengröße + Stimmung baut die App den Abend. Startpunkt: Regelbasiert mit 30/30/25/15-Verteilung, später datengetrieben nachkalibrieren.

---

**Fairness-Engine**

Verhindert, dass eine Person durch ihr Spezialgebiet unverhältnismäßig oft im Spotlight steht. Bewusst so gebaut, dass persönliche Expertenfragen als besondere Momente wirken, nicht als Standard-Muster.

---

## Karten-Vorlage für zukünftige Ideen

(unverändert aus Startbestand — siehe `trello-cards-startbestand.md`)
