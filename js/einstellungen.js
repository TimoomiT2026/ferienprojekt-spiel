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
  startGeld: 100,
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
  anzahlGrabestellen: 60,

  // ---------- Graben ----------
  // Was findet man beim Graben, und wie oft?
  // Je größer die Zahl, desto häufiger. (Zusammen müssen es nicht 100 sein.)
  fundChancen: {
    stein: 50,
    kohle: 25,
    eisenerz: 15,
    gold: 8,
    edelstein: 2,
  },

  // ---------- Werkbank ----------
  // Was braucht man, um etwas zu bauen? (Ding: Anzahl)
  rezepte: {
    schwert: { eisenerz: 2, stein: 3 },
    feuerzeug: { stein: 2, eisenerz: 1, kohle: 1 },
    angel: { holz: 3 },
  },

  // Wie oft kann man etwas benutzen, bevor es kaputt / leer ist?
  haltbarkeit: {
    schwert: 12, // 12 Schläge
    feuerzeug: 3, // 3 Mal Feuer machen
  },

  // ---------- Händler ----------
  // So viele Münzen bekommt man, wenn man etwas VERKAUFT
  verkaufsPreise: {
    stein: 2,
    kohle: 4,
    holz: 3,
    tofufisch: 6,
    gegrillterFisch: 8,
    eisenerz: 8,
    gold: 20,
    schwert: 25,
    feuerzeug: 10,
    angel: 12,
    edelstein: 60,
  },
  // So viele Münzen kostet es, etwas zu KAUFEN
  kaufPreise: {
    koeder: 3,
    holz: 6,
    brot: 10,
    angel: 30,
  },

  // ---------- Essen & Schlafen ----------
  // Wie schnell läuft man mit Hunger? (0.5 = halb so schnell)
  hungerTempo: 0.5,
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

  // ---------- Musik ----------
  // Wie laut ist die Musik? (0 = aus, 1 = ganz laut)
  musikLautstaerke: 0.5,
};
