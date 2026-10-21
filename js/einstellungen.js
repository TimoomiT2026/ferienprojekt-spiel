// =============================================================
//  EINSTELLUNGEN – hier darfst du rumprobieren!
//  Ändere eine Zahl, speichere, lade das Spiel neu und schau,
//  was passiert. So testen echte Spieleentwickler auch.
// =============================================================

export const EINSTELLUNGEN = {
  // ---------- Die Figur ----------
  // Wie schnell läuft die Figur? (Meter pro Sekunde)
  laufTempo: 7,
  // Wie hoch springt die Figur?
  sprungKraft: 7,
  // Wie stark zieht die Schwerkraft nach unten?
  schwerkraft: 20,
  // Wie weit ist die Kamera hinter der Figur?
  kameraAbstand: 9,

  // ---------- Geld & Rucksack ----------
  // Mit wie vielen Münzen startet man? (aus der Mindmap!)
  startGeld: 30,
  // Wie viele Plätze hat der Rucksack?
  rucksackPlaetze: 12,
  // Wie viele gleiche Dinge passen auf einen Platz?
  stapelGroesse: 20,

  // ---------- Tag & Nacht ----------
  // Wie viele Minuten dauert ein Tag?
  tagMinuten: 5,
  // Wie viele Minuten dauert eine Nacht?
  nachtMinuten: 3,

  // ---------- Die Insel ----------
  // Wie groß ist die Insel? (Radius in Metern)
  inselGroesse: 220,
  // Wie viele Bäume wachsen auf der Insel?
  anzahlBaeume: 900,
  // Wie viele Felsen liegen herum?
  anzahlFelsen: 160,
  // Wie viele Grabestellen gibt es?
  anzahlGrabestellen: 30,
  // Nach wie vielen Tagen ist eine leere Grabestelle wieder voll?
  nachwachsTage: 2,

  // ---------- Graben ----------
  // Was findet man beim Graben, und wie oft?
  // Je größer die Zahl, desto häufiger. (Zusammen müssen es nicht 100 sein.)
  fundChancen: {
    stein: 50,
    kohle: 25,
    eisenerz: 15,
    koeder: 12, // Würmer!
    gold: 8,
    edelstein: 2,
  },

  // ---------- Werkbank ----------
  // Was braucht man, um etwas zu bauen? (Ding: Anzahl)
  rezepte: {
    schwert: { eisenerz: 2, stein: 3 },
    feuerzeug: { stein: 2, eisenerz: 1, kohle: 1 },
    schnur: { holz: 2 }, // dünnes Holz, zur Schnur gebunden
    angel: { holz: 2, schnur: 1 },
    fernrohr: { eisenerz: 2, gold: 1, holz: 1 },
    leine: { schuh: 1, schnur: 1 }, // Leder vom alten Schuh + Schnur = Pferde-Leine
  },

  // Wie oft kann man etwas benutzen, bevor es kaputt / leer ist?
  haltbarkeit: {
    schwert: 12, // 12 Schläge
    feuerzeug: 3, // 3 Mal Feuer machen
  },

  // ---------- Händler ----------
  // So viele Münzen bekommt man, wenn man etwas VERKAUFT
  // (Das ist der Preis für das ERSTE Stück am Tag – siehe "Angebot & Nachfrage" unten)
  verkaufsPreise: {
    stein: 2,
    kohle: 3,
    holz: 2,
    tofufisch: 5,
    gegrillterFisch: 6,
    eisenerz: 6,
    gold: 15,
    schwert: 15,
    feuerzeug: 6,
    angel: 8,
    schnur: 3,
    zauberpilz: 30,
    fernrohr: 10,
    edelstein: 40,
    karotte: 3, // aus deinem Garten
  },
  // Angebot & Nachfrage: Jedes weitere Stück vom Gleichen bringt weniger.
  // 0.8 heißt: 2. Stück = 80 %, 3. Stück = 64 %, … (am nächsten Morgen wieder voll)
  preisNachlass: 0.8,
  // Wie viele Sachen kauft der Händler höchstens an einem Tag?
  haendlerKauftProTag: 10,
  // So viele Münzen kostet es, etwas zu KAUFEN
  // (Eine Angel gibt es beim Händler nicht – die baust du selbst!)
  kaufPreise: {
    koeder: 3,
    holz: 12,
    brot: 25,
    apfel: 4, // Pferdefutter
    rucksackGross: 60, // Rucksack mit 18 Plätzen
    rucksackRiesig: 120, // Rucksack mit 24 Plätzen
  },

  // ---------- Essen & Schlafen ----------
  // Wie schnell läuft man mit Hunger? (0.5 = halb so schnell)
  hungerTempo: 0.5,
  // Satt-Balken: 100 = ganz satt. Er wird in 1 ganzen Tag (Tag + Nacht) leer.
  // Auch beim Schlafen! Wer nicht isst und einfach schläft, wacht hungrig auf.
  sattTage: 1,
  // So viel macht jedes Essen satt (100 = ein ganzer Tag)
  sattVon: { brot: 100, gegrillterFisch: 100, karotte: 40 },
  // Ab so viel Satt-Balken kommt die Warnung "Du bekommst Hunger"
  hungerWarnung: 25,
  // Wie viele Nächte darf man durchmachen, bevor es Ärger gibt?
  naechteOhneSchlaf: 2,
  // So viele Münzen verliert man dann
  schlafStrafe: 50,
  // Wie lange brennt das Lagerfeuer? (Minuten)
  feuerMinuten: 4,
  // Wie viele Schläge braucht ein Baum, bis er umfällt?
  schlaegeProBaum: 3,
  // Wie viel Holz gibt ein Baum / ein Busch?
  holzProBaum: 3,
  holzProBusch: 1,

  // ---------- Base ----------
  // Deine Base kannst du in 5 Stufen ausbauen (Stufe 1 = Zelt hast du schon).
  // Was kostet jede Stufe? Dinge aus dem Rucksack + Münzen.
  baseStufen: {
    2: { holz: 6, schnur: 2, muenzen: 20 }, // großes Zelt mit Vordach
    3: { holz: 15, stein: 6, muenzen: 40 }, // Holzhütte mit Truhe
    4: { holz: 10, kohle: 3, muenzen: 30 }, // Hütte mit Garten
    5: { holz: 20, stein: 10, eisenerz: 4, muenzen: 80 }, // Haus mit Fischteich
  },
  // Wie viele Plätze hat die Truhe in der Hütte?
  truhePlaetze: 20,
  // Wie viele Karotten wachsen im Garten an jedem neuen Tag?
  karottenProTag: 2,
  // Wie viele Karotten können höchstens im Beet warten?
  karottenMax: 4,
  // Wie viele sind schon reif, wenn der Garten fertig gebaut ist?
  karottenStart: 2,
  // Der Pferdestall (eine Erweiterung im Base-Menü)
  stallKosten: { holz: 12, stein: 4, muenzen: 30 },
  // Ab welcher Base-Stufe und ab welchem Tag darf man ihn bauen?
  stallAbStufe: 3,
  stallAbTag: 3,

  // ---------- Pferde ----------
  // Wie viele Äpfel braucht ein Wildpferd, bis es dir vertraut?
  aepfelZumZaehmen: 3,
  // Wie schnell galoppiert dein Pferd höchstens? (Meter pro Sekunde – zu Fuß: 7)
  reitTempo: 18,
  // Wie nah darf man an Wildpferde ranrennen, bevor sie weglaufen? (Meter)
  scheuAbstand: 12,
  // Ab welchem Tempo erschrecken Wildpferde? (Meter pro Sekunde – langsam gehen ist ok)
  scheuTempo: 4,
  // Wie weit bleibt dein Pferd hinter dir, wenn es dir folgt? (Meter)
  folgeAbstand: 4,
  // Wie schnell kann man beim Reiten lenken? (größer = wendiger)
  reitLenkung: 2.4,
  // So nah muss man an ein Pferd ran, damit der Knopf "Füttern" kommt (Meter)
  fuetterRadius: 4.5,
  // Mit einem Apfel in der Hand werden Wildpferde neugierig und kommen
  // langsam zu dir – ab so viel Abstand (Meter)
  neugierAbstand: 16,
  // So lang ist die Leine: so weit hinter dir läuft dein Pferd (Meter)
  leinenLaenge: 3.5,
  // Wird der Abstand größer (z. B. beim Bootfahren), rutscht die Leine aus der Hand (Meter)
  leineReisstAb: 15,
  // Nach wie vielen Tagen ohne Futter hat dein Pferd Hunger?
  pferdHungerTage: 1,
  // Nach wie vielen Tagen ohne Futter reißt es aus und wird wieder wild?
  pferdAusreissTage: 2,

  // ---------- Musik ----------
  // Wie laut ist die Musik? (0 = aus, 1 = ganz laut)
  musikLautstaerke: 0.5,

  // ---------- Zauberpilze & Fliegen ----------
  // Wie viele Zauberpilze wachsen in den Wäldern?
  anzahlPilze: 14,
  // Nach wie vielen Tagen wächst ein gepflückter Pilz wieder nach?
  pilzNachwachsTage: 3,
  // Wie lange fliegt man nach einem Zauberpilz? (Sekunden)
  flugSekunden: 60,
  // Wie schnell fliegt man vorwärts? (Meter pro Sekunde – laufen ist 7)
  flugTempo: 12,
  // Wie schnell steigt man, wenn man den Sprungknopf festhält?
  steigTempo: 6,
  // Wie schnell sinkt man, wenn man loslässt?
  sinkTempo: 2,
  // Wie hoch kann man höchstens fliegen? (Meter über dem Boden)
  maxFlugHoehe: 40,
};
