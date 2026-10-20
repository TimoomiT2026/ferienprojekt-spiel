# 🏝️ Inselspiel – unser Ferienprojekt

Ein Vater-Sohn-Projekt: In einer Woche bauen wir zusammen mit KI ein eigenes 3D-Spiel.
Survival auf einer Insel, im Comic-Look, spielbar auf dem iPad.

**Spielen:** https://timoomit2026.github.io/ferienprojekt-spiel/
(Auf dem iPad in Safari öffnen → Teilen → „Zum Home-Bildschirm“, dann läuft es wie eine App im Vollbild.)

## Wer macht was?

| Rolle | Wer | Aufgabe |
|---|---|---|
| 🎨 Game Designer & Chef-Tester | Sohn | entscheidet, was ins Spiel kommt, testet, schreibt Fehler auf |
| 🎬 Produzent | Papa | achtet auf die Zeit und darauf, dass wir nichts zu Großes anfangen |
| 💻 Programmier-Team | Claude (KI) | baut das Spiel und erklärt jeden Schritt |

## Wo steht was?

- [📌 Projektstand](docs/projektstand.md) – was gebaut ist und warum
- [So spielt man](docs/steuerung.md) – Steuerung & erste Schritte
- [Die Spielidee](docs/spielidee.md) – was wir bauen (aus der Mindmap)
- [Wochenplan & Aufgaben](docs/wochenplan.md) – was wann passiert
- [Warteliste](docs/warteliste.md) – coole Ideen für später
- [Fehlerliste](docs/fehlerliste.md) – hier schreibt der Chef-Tester Fehler rein
- [Lexikon](docs/lexikon.md) – Wörter, die wir gelernt haben
- [Filmabend: KI & Ressourcen](docs/film-ki-und-ressourcen.md)
- [Hausaufgaben](docs/hausaufgaben/) – jeden Tag eine kleine Aufgabe
- [Die Mindmap](docs/mindmap.jpg) – wo alles angefangen hat

## Selber was ändern

In [`js/einstellungen.js`](js/einstellungen.js) stehen Zahlen wie Lauftempo, Startgeld, Inselgröße,
wie lange Tag und Nacht dauern oder wie oft man beim Graben einen Edelstein findet.
Ändern, speichern, neu laden und schauen, was passiert!

## Technik

Three.js (3D im Browser), kein Build-Schritt. Lokal starten: `python3 -m http.server` im Ordner, dann http://localhost:8000 öffnen.
