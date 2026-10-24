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
  - **Tauchen** (js/tauchen.js) mit Luft-Anzeige; im See oben auf der Klippe liegt das **Insadorium** (roter, grell leuchtender Stein) → **Finale** mit Konfetti + Dankeschön (js/finale.js), danach frei weiterspielen
  - **Heißluftballon** (js/ballon.js, 150 Münzen): Ziel aussuchen (Dorf, Palmendorf, Base), fliegt jeden Morgen von selbst heim
  - Wind über der Klippe (Zauberpilz bringt einen nicht hoch), neue Funde (Muscheln, Kokosnüsse; Eisen & Gold oben auf der Klippe), Angelstellen auf allen Inseln, Fernrohr sieht durch den Dunst
- **Etappe 4 · Wochenmarkt & Inselzeitung** (alle 3 Spieltage = Markttag, js/markttag.js):
  - **Wochenmarkt** im Palmendorf (js/markt.js): Obst & Gemüse (billiger), Kaffee ☕ 35 (eine Nacht ohne Schlaf zählt nicht), Nacht-Limo 🍋 40 (die Nacht wird taghell, zählt nicht als wach), Steine & Erze
  - **Zauberpilz-Rallye** (js/rallye.js): 10 Münzen Startgeld, Bootsrennen gegen 4 KI-Gegner, Pilze = Turbo, zu schnell in der Kurve = rausrutschen; Sieg = 50 Münzen (einmal pro Markttag)
  - **Briefkasten & Inselzeitung** (js/zeitung.js, js/ereignisse.js): am Morgen jedes Markttags; gezeichnete Bilder von Dingen, die wirklich passiert sind, Marktpreise, Rallye-Ergebnis
- **Geführter Einstieg** (Wunsch nach einer Testrunde): graben → verpflegen → selbst herstellen
  - Aufgaben „Kauf dir ein Brot“ (beim ersten Brot schenkt der Händler 2 dazu) und „Iss ein Brot“ vor dem Verkaufen; nach dem Angeln „Kauf Holz beim Händler“ (erstes Holz: 3 für 1)
  - Große Erklär-Fenster über den ganzen Bildschirm (js/aufgaben.js, `ERKLAERUNG`): erster Fund, erster Händler-Besuch, Essen, Werkbank, erster Fisch („Selbst versorgen spart Geld!“), Holz, erstes Öffnen der Base
  - Nur noch 2 Angelstellen auf der Startinsel (`angelstellenStartinsel`)
  - Jede der ersten 6 Aufgaben wird beim Start einmal groß erklärt (`start:` in AUFGABEN): Aufgabenbuch (die Anzeige oben links blinkt danach), Schaufel in die Hand, Hügel suchen, „Grab weiter bis 3 Steine + 2 Eisenerz“, ab ins Dorf, Brot essen, verkaufen
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
- Pferde können nicht schwimmen; Reisezelt steht nicht auf der Karte; Truhe verschiebt immer ganze Stapel
