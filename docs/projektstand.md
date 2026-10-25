# 📌 Projektstand (für Claude und für uns)

Diese Seite fasst zusammen, was gebaut ist und **warum** wir etwas so entschieden haben.
Wenn ein neuer Chat mit Claude startet, liest Claude zuerst hier und in `CLAUDE.md`.

## Was es gibt (Stand: Tag 5, Etappe 4 fertig)
- **Insel** mit Bergen, Wald, Seen, Strand, Trampelpfad, Dorf mit Händler, 7 Ruderbooten, Schafen, Hasen und 4 Wildpferden
- **Spielfigur:** der Game Designer selbst (Ringelpulli, Jogginghose, orange Sohlen), mit Skelett und Animationen
- **Überleben:** einmal am Tag essen (sonst halb so schnell), spätestens jede 2. Nacht schlafen (sonst −50 Münzen)
- **Kreislauf:** graben → Schwert bauen → Holz fällen → Schnur + Angel bauen → Würmer → Tofu-Fisch → Feuerzeug → Lagerfeuer → grillen → selbst satt
- **Aufgabenbuch** 📋 führt Schritt für Schritt durch (mit Münz-Belohnungen)
- **Base** mit Menü am Schild „BASE“: Zelt → großes Zelt → Hütte mit Truhe → Hütte mit Karotten-Garten → Haus mit Fischteich; dazu Reisezelt (3 Rucksack-Plätze) und Pferdestall (ab Hütte und ab Tag 3)
- **Pferde:** Apfel in die Hand → Pferd wird neugierig, 3× füttern = gezähmt; Leine (Schuh + Schnur) zum Führen und am Stall Anbinden; alle 2 Tage füttern, sonst reißt es aus
- **Vor Etappe 3:** bunte Fische, Satt-Balken (Hunger läuft auch beim Schlafen weiter), Landen beim Fliegen, Händler schläft nachts, weniger Münzen am Anfang + Aufgabe „Handeln“, 3 Tagstücke + eigenes Nachtstück, Umgebungsgeräusche, Erklär-Blasen für neue Spieler (js/tutorial.js)
- **Etappe 3 · Das große Abenteuer** (Ziel des Spiels!):
  - **Klippeninsel** (Osten, hohe Felswände, oben ein See) und **Palmeninsel** (Westen, Palmendorf mit zweitem Händler) – mit dem Boot ca. 20 s
  - **Palmeninsel:** 13 Bewohner (js/bewohner.js). Wer die Taucherbrille hat, ist Zufall: der 6. bis 13. Bewohner, den man anspricht (die ersten 5 nie; `bewohner.brilleFruehestens/brilleSpaetestens`) und will dafür **3 wertvolle Münzen** (eine pro Insel). Erst ab ihrem Satz gibt es die 3 golden glitzernden Münz-Hügel (❓ auf der Karte).
  - **Seilkanone** (js/seilkanone.js): Seil + Widerhaken + Holz + Eisenerz; schießt ein Seil an hohe Wände, das Seil bleibt hängen
  - **Prolog in Düsseldorf** (js/prolog.js, js/sturmfilm.js, Kartendaten js/daten/duesseldorf.js © OpenStreetMap-Mitwirkende, ODbL): nur für ganz neue Spieler (kein Spielstand). Rheinufer mit echten Häuser-Umrissen, Rheinturm mit Lichtzeituhr, geheimes Labor in der Turmkugel (Chat „Mini Blocks“), Ruderboot im Yachthafen, Film „2 Wochen später“ im Sturm, dann „8 Wochen später“ → Tagebuch auf der Insel. Überspringbar. Im Prolog wird nichts gespeichert; „Neues Spiel“ zeigt ihn wieder
  - **Rheinturm begehbar** (js/labor.js): Glas-Aufzug fährt außen am Schaft hoch, oben ein begehbares rundes Labor (Ring um den Aufzugs-Kern, Blick durch die schrägen Fenster). Am Computer „Forschen“ → Erklärung + heiße Spur → Computer an → Login bei Mini Blocks (Forscher-Zugang) → anonymer Tipp im Chat → Reise planen → mit dem Aufzug runter → Ruderboot. Insel-Tipps (Schaufel) sind im Prolog aus; nach dem Film blitzt der Startbildschirm nicht mehr auf
  - **Düsseldorf-Grafik auf Insel-Niveau** (js/stadtbau.js): dieselben Bäume und dasselbe Gras wie auf der Insel (natur.js `baueStadtNatur`), Boden mit Fotos (Rasen, Pflaster, Asphalt, Steine am Ufer), Häuser mit Fenstern, der echte Landtag (OSM, 56 runde Teile), Rheinturm nach OSM-Maßen, Rheinkniebrücke mit Pylon, Seilen und fahrenden Autos, Laternen, Bänke, Yachthafen mit Booten, Frachtschiffe und Ausflugsschiff auf dem Rhein (Wasser im Fluss-Modus). Start an der Rheinpromenade südwestlich vom Turm (von dort ist der Turm frei sichtbar – nordöstlich steht der Landtag davor). Zahlen in einstellungen.js → prolog
  - **Kleiderschrank** (js/kleidung.js, im Base-Menü ab Stufe 3): Pulli und Hose kostenlos wechseln – Farben in `einstellungen.js` unter „kleidung“
  - **Freies Spiel** (Startbildschirm, eigener Speicherplatz `inselspiel-frei-v1`): unendlich Münzen, größter Rucksack + volle Truhe mit allem, Base Stufe 5 mit Ballon, alle Inseln entdeckt, keine Aufgaben und Sperren. Einzige Aufgabe: das Insadorium – zufällig in einem Erdloch irgendwo vergraben, von außen unsichtbar (Inhalte in `einstellungen.js` unter „Freies Spiel“)
  - **Notfallboote** an der Klippeninsel: in jeder Bucht liegt eins (fahren jeden Morgen heim in ihre Bucht)
  - **Klippenzaun** (js/klippenzaun.js): Holzzaun oben rund um die Klippe – man kann nicht mehr runterfallen; wer im tiefen Wasser feststeckt, wird gerettet (an der Klippe: nach oben aufs Plateau, sonst zum nächsten Strand)
  - **Fernrohr:** Insel in die Mitte → grüner Knopf „Insel entdecken!“ antippen (statt Ring vollhalten)
  - **Tauchen** (js/tauchen.js) mit Luft-Anzeige; im See oben auf der Klippe liegt das **Insadorium** (roter, grell leuchtender Stein) → **Finale** mit Konfetti + Dankeschön (js/finale.js), danach frei weiterspielen
  - **Heißluftballon** (js/ballon.js, gehört zu Base-Stufe 4 – kostenlos dabei; Tipp beim 3. Fußweg ins Dorf): Ziel aussuchen (Dorf, Palmendorf, Base), fliegt jeden Morgen von selbst heim
  - Wind über der Klippe (Zauberpilz bringt einen nicht hoch), neue Funde (Muscheln, Kokosnüsse; Eisen & Gold oben auf der Klippe), Angelstellen auf allen Inseln, Fernrohr sieht durch den Dunst
- **Etappe 4 · Wochenmarkt & Inselzeitung** (alle 3 Spieltage = Markttag, js/markttag.js):
  - **Wochenmarkt** im Palmendorf (js/markt.js): Obst & Gemüse (billiger), Kaffee ☕ 35 (eine Nacht ohne Schlaf zählt nicht), Nacht-Limo 🍋 40 (die Nacht wird taghell, zählt nicht als wach), Steine & Erze
  - **Zauberpilz-Rallye** (js/rallye.js): jeden Tag (außer nachts), 50 Münzen Startgeld, am Markttag nur 10; Bootsrennen gegen 4 KI-Gegner, Pilze = Turbo, zu schnell in der Kurve = rausrutschen; der erste Sieg bringt den Widerhaken; nach 3 Niederlagen hintereinander fahren die Gegner 10 % langsamer (`hilfeNachNiederlagen`, `hilfeTempo`)
  - **Briefkasten & Inselzeitung** (js/zeitung.js, js/ereignisse.js): am Morgen jedes Markttags; gezeichnete Bilder von Dingen, die wirklich passiert sind, Marktpreise, Rallye-Ergebnis
- **Geführter Einstieg** (Wunsch nach einer Testrunde): graben → verpflegen → selbst herstellen
  - Aufgaben „Kauf dir ein Brot“ (beim ersten Brot schenkt der Händler 2 dazu) und „Iss ein Brot“ vor dem Verkaufen; nach dem Angeln „Kauf Holz beim Händler“ (erstes Holz: 3 für 1)
  - Große Erklär-Fenster über den ganzen Bildschirm (js/aufgaben.js, `ERKLAERUNG`): erster Fund, erster Händler-Besuch, Essen, Werkbank, erster Fisch („Selbst versorgen spart Geld!“), Holz, erstes Öffnen der Base
  - Nur noch 2 Angelstellen auf der Startinsel (`angelstellenStartinsel`)
  - Jede der ersten 6 Aufgaben wird beim Start einmal groß erklärt (`start:` in AUFGABEN): Aufgabenbuch (die Anzeige oben links blinkt danach), Schaufel in die Hand, Hügel suchen, „Grab weiter bis 3 Steine + 2 Eisenerz“, ab ins Dorf, Brot essen, verkaufen
- **Fortschritt in Stufen** (Wunsch des Produzenten nach dem Testen):
  - **Nebel** 🌫️ um Palmen- und Klippeninsel (js/nebel.js): Boot und Zauberpilz drehen um. Erst wer die Insel mit dem **Fernrohr** entdeckt, kommt durch.
  - **Fernrohr** an der Werkbank erst, wenn seine Aufgabe dran ist (vorher: Ballon kaufen), man sich selbst versorgt (Fisch gegessen + großes Zelt) und ab **Tag 3** (`fernrohrAbTag`, `fernrohrNachAufgaben`)
  - Neue Aufgaben „Bau ein Fernrohr“, „Sammle alles für die Seilkanone“ (danach: „Achtung, dir fehlt der Widerhaken!“) und „Gewinne die Zauberpilz-Rallye“ – der **erste Rallye-Sieg bringt den Widerhaken** (nicht baubar, nicht kaufbar)
  - **Großes Ziel** steht oben im Aufgabenbuch; Erklär-Fenster bei Selbstversorgung, Insel entdeckt, erste Ankunft auf Palmen- und Klippeninsel
  - **Geschichte auf der Palmeninsel**: Man fragt jeden Bewohner nach dem Insadorium. Der erste verrät: „unter Wasser suchen – jemand hier hat eine Taucherbrille“ → Aufgaben „Frag die Bewohner nach dem Insadorium“ und „Finde die Person mit der Taucherbrille“. Danach: Seilkanone (Teile → Widerhaken-Warnung → Rallye → bauen) → 3 Münzen → Taucherbrille → Insadorium. Die Klippeninsel lässt das Boot erst nach dem Gespräch an Land (`klippeSperrAbstand`).
  - **Ohnmacht**: 1 Tag mit leerem Satt-Balken → man wacht am Zelt auf, −20 Münzen und die Hälfte der Steine, Erze, Gold und Edelsteine ist weg (`ohnmachtVerlustAnteil`) (`ohnmachtNachTagen`, `ohnmachtKosten`)
  - Schwert hält 24 statt 12 Schläge; Kaffee-/Limo-Bonus wird unter der Uhr angezeigt
- **Zauberpilze** im Wald: 1 Minute fliegen (Sprungknopf halten = höher)
- **Fernrohr:** zoomen, Boote entdecken (später andere Inseln). Durch Berge sieht man nicht.
- **Karte & Navigation**, Tag/Nacht (5 + 3 Minuten), Wellen, Musik, automatisches Speichern

## Wichtige Entscheidungen und warum
| Entscheidung | Warum |
|---|---|
| Nicht eckig, Comic-realistisch | Wunsch des Game Designers: kein Minecraft-Klon |
| Browser-Spiel statt App | Claude kann es selbst testen; läuft auf iPad + Mac; Wechsel zu Godot evtl. nach der Woche |
| Startgeld 30, Angel nur selbst bauen | Sonst kauft man alles sofort und es gibt keine Herausforderung |
| **Angebot & Nachfrage** beim Händler (jedes weitere gleiche Stück −20 %, max. 10 Sachen pro Tag), Brot 25, 30 Grabestellen, die erst nach 2 Tagen nachwachsen | Feedback Tag 2: „Nach 5 Minuten hat man unendlich Geld.“ Ziel: Mit Graben verdient man ca. 1–2 Brote am Tag, Selbstversorgung (Fisch, Karotten) ist besser. |
| Base-Upgrades im **Base-Menü**, nicht beim Händler | Idee vom Papa: Die Base ist der Ort, an dem man sie ausbaut |
| Pferdestall ab Base-Stufe 3 **und** ab Tag 3 | Man soll ihn sich „verdienen“ (Fortschritt + Zeit) |
| Fernrohr sieht nicht durch Berge | Man muss auf einen Hügel steigen – macht Entdecken spannender |
| Fliegen mit Joystick + Sprungknopf halten | Entscheidung des Game Designers (am einfachsten auf dem iPad) |
| Echte Namen/Fotos nicht ins Repo | Das Repo ist öffentlich |
| Taucherbrille nur gegen 3 Münzen (eine pro Insel), Münzen erst nach dem Satz der Person mit der Brille | Game Designer: Sonst wären die anderen Inseln sinnlos, und eine Münze ohne Ziel versteht man nicht |
| Kein Zauberpilz-Flug aufs Klippen-Plateau (Wind) | Game Designer: Man soll sich die Seilkanone erarbeiten |
| Einstieg mit Brot kaufen + Erklär-Fenstern, Holz-Kauf als Abkürzung | Neue Spieler sollen am Anfang geführt werden: erst verpflegen, dann lernen, dass Selbermachen günstiger ist |
| Die 30 alten Grabestellen, Bäume, Pilze bleiben exakt gleich, Neues wird hinten angehängt | Damit alte Spielstände weiter funktionieren |

## Als Nächstes
Was der Game Designer als Nächstes will – Ideen stehen in `docs/warteliste.md` (z. B. Farmen, Monster in der Nacht, Höhlen).

## Bekannte Schwächen
- Auf dem iPad Air (2025) läuft es flüssig; am MacBook ruckelte es kurz am Anfang (Shader werden jetzt vorab vorbereitet)
- Pferde können nicht schwimmen; Truhe verschiebt immer ganze Stapel
