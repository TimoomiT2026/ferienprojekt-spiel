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

  // ---------- Musik ----------
  // Wie laut ist die Musik? (0 = aus, 1 = ganz laut)
  musikLautstaerke: 0.5,
};
