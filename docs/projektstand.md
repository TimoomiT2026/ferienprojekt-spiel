# 📌 Projektstand (für Claude und für uns)

Diese Seite fasst zusammen, was gebaut ist und **warum** wir etwas so entschieden haben.
Wenn ein neuer Chat mit Claude startet, liest Claude zuerst hier und in `CLAUDE.md`.

## Was es gibt (Stand: Tag 2, Etappe 2 fertig)
- **Insel** mit Bergen, Wald, Seen, Strand, Trampelpfad, Dorf mit Händler, 7 Ruderbooten, Schafen, Hasen und 4 Wildpferden
- **Spielfigur:** der Game Designer selbst (Ringelpulli, Jogginghose, orange Sohlen), mit Skelett und Animationen
- **Überleben:** einmal am Tag essen (sonst halb so schnell), spätestens jede 2. Nacht schlafen (sonst −50 Münzen)
- **Kreislauf:** graben → Schwert bauen → Holz fällen → Schnur + Angel bauen → Würmer → Tofu-Fisch → Feuerzeug → Lagerfeuer → grillen → selbst satt
- **Aufgabenbuch** 📋 führt Schritt für Schritt durch (mit Münz-Belohnungen)
- **Base** mit Menü am Schild „BASE“: Zelt → großes Zelt → Hütte mit Truhe → Hütte mit Karotten-Garten → Haus mit Fischteich; dazu Reisezelt (3 Rucksack-Plätze) und Pferdestall (ab Hütte und ab Tag 3)
- **Pferde:** mit 3 Äpfeln zähmen (langsam nähern, sonst laufen sie weg), dann reiten
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

## Als Nächstes: Etappe 3 · Das große Abenteuer
- Inselgruppe mit anderen Materialien, Dörfern und Händlern
- Hohe Klippen an den anderen Inseln → **Seilkanone** (Holz, Eisen, Seil, Widerhaken) – schwer zu schaffen
- Heißluftballon (an der Base doppelt antippen → sofort ins Dorf)
- **Das geheime Material** finden (Name erfindet der Game Designer – Hausaufgabe!)

## Bekannte Schwächen
- Auf dem iPad Air (2025) läuft es flüssig; am MacBook ruckelte es kurz am Anfang (Shader werden jetzt vorab vorbereitet)
- Pferde können nicht schwimmen; Reisezelt steht nicht auf der Karte; Truhe verschiebt immer ganze Stapel
