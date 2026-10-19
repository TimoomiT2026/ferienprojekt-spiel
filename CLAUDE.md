# CLAUDE.md – Arbeitsregeln für das Inselspiel

Vater-Sohn-Ferienprojekt (Sohn fast 9). Ziel: in ~6 Tagen à 1 Stunde ein fertiges, spielbares 3D-Spiel, **und** dabei lernen, wie Spieleentwicklung funktioniert.

## Rollen
- **Sohn = Game Designer & Chef-Tester.** Seine Entscheidungen gelten. Nicht ungefragt Features erfinden, die er nicht wollte. Bei Designfragen: ihm die Frage stellen, nicht selbst entscheiden.
- **Papa = Produzent.** Zeit, Umfang.
- **Claude = Programmier-Team.** Baut zwischen den Sessions, erklärt kindgerecht.

## Design-Grundsätze (vom Game Designer festgelegt)
- **Nicht eckig.** Runde, weiche Comic-Formen (wie Fortnite / Farm Together). Kein Minecraft-Klon, keine Klötzchenwelt.
- **iPad zuerst.** Touch-Steuerung ist Pflicht, Tastatur ist Bonus. Performance: InstancedMesh, wenige Draw-Calls, PixelRatio ≤ 2.
- Kern-Kreislauf: graben → im Dorf verkaufen/handeln → Holz & Feuer → Lager bauen → Nacht mit Monstern → schlafen = sicher.
- Monster nur nachts.
- Neue Ideen → `docs/warteliste.md`, nicht sofort bauen.

## Code-Regeln
- Deutsche Namen und kurze, kindgerechte Kommentare (er soll den Code lesen können).
- Alle Zahlen, an denen er drehen könnte, gehören in `js/einstellungen.js`.
- Kein Build-Schritt: reines HTML + ES-Module, Three.js über Importmap (jsdelivr, Version fest).
- Nach jeder Änderung: Playwright-Test mit iPad-Emulation (Touch!), Screenshot ansehen, erst dann pushen.

## Sprache & Datenschutz
- Mit dem Kind: einfache Sätze, Fachwörter erklären und ins `docs/lexikon.md` eintragen.
- Repo ist öffentlich (GitHub Pages): **keine echten Namen, Fotos von Personen oder Wohnorte** ins Repo.
