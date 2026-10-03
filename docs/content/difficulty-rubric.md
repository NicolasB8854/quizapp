# Schwierigkeits- & Qualitäts-Rubrik

Verbindlich für jede Frage in `packages/shared/src/data/questions.json`.

## Schwierigkeit (1–5)

Maßstab: Anteil der Erwachsenen in Deutschland, die die Frage **ohne Hilfe** richtig beantworten
(bei Multiple Choice: wissen, nicht raten). Nicht relevant ist, ob die Frage „im eigenen Thema"
leicht wirkt — eine Chemie-Frage wird für ein gemischtes Publikum eingestuft.

| Stufe | Anteil Wissender | Typisch | Beispiel |
|---|---|---|---|
| 1 | > 90 % | Schulwissen Unterstufe, Alltag | Welches Element hat das Symbol O? → Sauerstoff |
| 2 | 70–90 % | Bekannt, kurzes Nachdenken | Welches Gas atmen Pflanzen bei der Photosynthese ein? → CO₂ |
| 3 | 40–70 % | Solides Allgemeinwissen / Ableitung | Welches Metall ist bei Raumtemperatur flüssig? → Quecksilber |
| 4 | 15–40 % | Interessierte / Hobby-Wissen | Welches Element hat die höchste Elektronegativität? → Fluor |
| 5 | < 15 % | Fach-/Spezialwissen | Wer synthetisierte 1828 erstmals Harnstoff? → Friedrich Wöhler |

Distraktoren beeinflussen die Stufe: sehr plausible Falschantworten heben sie, offensichtlich
falsche senken sie. Die Stufe wird **nach** Festlegung der Optionen vergeben.

## Qualitäts-Checkliste (alle Punkte Pflicht)

1. **Faktisch korrekt** und aktuell; bei Zahlen/Rekorden `timeScope` = `dated`/`expiring`.
2. **Genau eine** eindeutig richtige Antwort; keine „kommt drauf an"-Fälle.
3. **Kein Antwort-Leak**: Frage verrät die Lösung nicht (Wortstamm, Grammatik, Länge).
4. **Plausible Distraktoren** aus derselben Klasse (vier Städte, vier Jahre …), ähnliche Länge.
5. **Klar & knapp**: max. ~20 Wörter, keine doppelte Verneinung, keine Fangfragen.
6. **Thema passt** zum `topic`.
7. **Erklärung** (`explanation`) für jede Frage: 1–2 Sätze, liefert Kontext statt nur die Lösung zu wiederholen.
8. **Wahr/Falsch**: Aussage ist eindeutig wahr oder falsch, nicht „meistens".

## Verteilung

Pro Thema mindestens **4 Multiple-Choice-Fragen je Stufe** (≥ 20 pro Thema), damit
aufsteigende Modi (Fachrunde 100–500, Elimination, Punkteleiter) jede Stufe bedienen können.
Fragen, die die Checkliste nicht bestehen und sich nicht sinnvoll reparieren lassen, werden gelöscht.
