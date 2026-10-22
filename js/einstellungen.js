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

  // ---------- Die Inselgruppe (Etappe 3) ----------
  // Die Startinsel liegt in der Mitte (bei x = 0, z = 0) und ist oben eingestellt.
  // Hier stehen die ANDEREN Inseln. Man erreicht sie mit dem Ruderboot.
  //   x, z     = wo die Mitte der Insel liegt (Meter; x+ = Osten, z+ = Süden, z− = Norden)
  //   radius   = wie weit die Küste ungefähr von der Mitte weg ist (Meter)
  //   seed     = Zufallszahl für die Form (andere Zahl = andere Küste)
  // Tipp: Zwischen zwei Küsten sollen 120–200 m Meer sein (Boot: ca. 15–25 Sekunden).
  // Nicht zu nah an die Startinsel schieben (Mitte mindestens ca. 450 m weg)!
  inseln: [
    {
      name: 'Klippeninsel',
      x: 460, z: 110, radius: 90, seed: 7,
      klippen: true,
      klippenHoehe: 21, // so hoch ist das Plateau oben (Meter)
      wandBreite: 5, // wie breit die Felswand ist (klein = steiler)
      buchten: [195, 330], // Strand-Buchten: Richtung in Grad (0 = Osten, 90 = Süden, 180 = Westen, 270 = Norden)
      buchtTiefe: 22, // wie weit die Buchten in die Insel hineingehen (Meter)
      laguneRadius: 16, // der kleine See oben in der Mitte
      laguneTiefe: 4.5, // so tief ist er (Meter)
      baeume: 70, buesche: 60, gras: 16000,
    },
    {
      name: 'Palmeninsel',
      x: -465, z: 85, radius: 100, seed: 11,
      huegelHoehe: 8, // ein sanfter Hügel in der Mitte (Meter)
      dorfPlatz: { x: 28, z: -12, radius: 20, hoehe: 3 }, // flacher Platz fürs zweite Dorf (x, z von der Inselmitte aus)
      palmen: 70, baeume: 18, buesche: 45, gras: 9000,
    },
  ],
  // So nah (Meter vor der Küste) muss man kommen, damit eine neue Insel auf der Karte erscheint
  inselEntdeckenAbstand: 110,
  // Wie steil darf man bergauf laufen? (1 = 45 Grad). An den Klippen geht es nicht weiter.
  maxSteigung: 1.4,

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
  // Die neuen Inseln haben eigene Grabehügel – mit anderen Funden!
  // (Die Startinsel benutzt weiter die "fundChancen" oben.)
  //   anzahl = wie viele Grabehügel es auf der Insel gibt
  //   funde  = was man dort findet (größere Zahl = häufiger)
  inselFunde: {
    Palmeninsel: {
      anzahl: 8,
      funde: { muschel: 45, kokosnuss: 35, stein: 20 },
    },
    // Oben auf dem Klippen-Plateau (nur mit der Seilkanone!) gibt es mehr Eisen und Gold
    Klippeninsel: {
      anzahl: 6,
      funde: { eisenerz: 40, gold: 25, stein: 20, kohle: 12, edelstein: 3 },
    },
  },
  // So viele Angelstellen gibt es auf jeder neuen Insel
  inselAngelstellen: 2,

  // ---------- Werkbank ----------
  // Was braucht man, um etwas zu bauen? (Ding: Anzahl)
  rezepte: {
    schwert: { eisenerz: 2, stein: 3 },
    feuerzeug: { stein: 2, eisenerz: 1, kohle: 1 },
    schnur: { holz: 2 }, // dünnes Holz, zur Schnur gebunden
    angel: { holz: 2, schnur: 1 },
    fernrohr: { eisenerz: 2, gold: 1, holz: 1 },
    leine: { schuh: 1, schnur: 1 }, // Leder vom alten Schuh + Schnur = Pferde-Leine
    // Seilkanone (schwer zu schaffen!): erst Seil und Widerhaken bauen, dann die Kanone
    seil: { schnur: 3 }, // 3 Schnüre zusammengedreht = ein starkes Seil
    widerhaken: { eisenerz: 2, stein: 1 },
    seilkanone: { holz: 4, eisenerz: 3, seil: 1, widerhaken: 1 },
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
    muschel: 4, // vom Strand der Palmeninsel
    kokosnuss: 5, // von der Palmeninsel (nicht zum Essen, nur zum Verkaufen)
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
    ballon: 150, // Heißluftballon – steht dann an der Base (nur einmal zu kaufen)
    // (Die Taucherbrille gibt es NICHT mehr beim Händler! Entscheidung des Game Designers:
    //  Man bekommt sie von einem Inselbewohner auf der Palmeninsel – siehe "Inselbewohner" unten.)
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
  // Wie wackelt und fällt ein Baum? (Sekunden und Winkel)
  baumFallen: {
    wackelWinkel: 0.1, // so weit neigt sich der Baum bei einem Treffer
    wackelDauer: 1.1, // so lange schwingt er nach
    fallDauer: 1.6, // so lange kippt er um (wird dabei immer schneller)
    liegenDauer: 0.7, // so lange liegt er am Boden
    weg: 0.5, // dann versinkt er und wird zu Holz
    splitter: 6, // Holzsplitter pro Treffer
    blaetter: 8, // fallende Blätter pro Treffer
  },
  // Bewegungen der Spielfigur (Sekunden)
  // Graben: ansetzen → reintreten → hebeln → Erde auswerfen → zurück.
  // (Der Fund erscheint nach 0,9 s – genau beim Auswerfen.)
  grabDauer: 1.4,
  schwungDauer: 0.45, // ein Schwert-Schlag: ausholen → durchziehen → zurück

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
  // Nach wie vielen Minuten kommt tagsüber das nächste Klavierstück? (es gibt 3)
  musikStueckMinuten: 3,
  // Wie viele Sekunden dauert das weiche Überblenden zum nächsten Stück?
  musikUeberblendSekunden: 4,

  // ---------- Geräusche ----------
  // Geräusche bleiben an, auch wenn die Musik aus ist.
  // Wie laut sind alle Geräusche zusammen? (0 = aus, 1 = ganz laut)
  geraeuscheLautstaerke: 0.5,
  // Meeresrauschen, wenn man am Wasser ist
  meerLautstaerke: 0.35,
  // Rascheln in Büschen und im Gras
  raschelnLautstaerke: 0.2,
  // Platschen ins Wasser
  wasserLautstaerke: 0.6,
  // Angel-Geräusche (Surren, Blubb, Jubel)
  angelLautstaerke: 1,
  // Münzen und Kasse beim Händler
  muenzenLautstaerke: 1,

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
  // Klippen-Wind 🌬️ (Entscheidung des Game Designers): Über der Klippeninsel weht
  // ein starker Wind. Mit dem Zauberpilz kommt man NICHT aufs Plateau – nur mit der Seilkanone!
  klippenWind: {
    // So weit (Meter) hinter der Küste fängt der Wind schon an
    rand: 10,
    // Ab so viel Metern UNTER dem Plateau bläst er (Plateau ist ca. 21 m hoch → ab ca. 17 m)
    unterPlateau: 4,
    // So schnell drückt er dich nach außen (Meter pro Sekunde – Fliegen ist 12, also stärker!)
    tempo: 16,
    // So schnell drückt er dich nach unten (Meter pro Sekunde)
    runter: 5,
    // Wie viele Windstreifen sieht man? (0 = keine)
    streifen: 24,
  },

  // ---------- Fernrohr 🔭 ----------
  fernrohr: {
    // So viel weiter sieht man durchs Fernrohr, bevor alles im Dunst verschwindet.
    // Bei wenig Zoom "weitMin"-mal so weit, bei viel Zoom "weitMax"-mal so weit.
    nebelWeitMin: 2.5,
    nebelWeitMax: 4,
    // So viel vom Boden-Dunst bleibt übrig (1 = alles, 0 = gar keiner)
    dunstRest: 0.15,
    // Bis so weit weg (Meter hinter der Küste) werden die anderen Inseln gemalt
    inselSichtweite: 900,
  },

  // ---------- Heißluftballon 🎈 ----------
  ballon: {
    // Wie lange dauert das Aufsteigen und das Landen? (Sekunden)
    steigSekunden: 5,
    sinkSekunden: 4.5,
    // So hoch fliegt der Ballon über dem höchsten Berg auf dem Weg (Meter)
    flugHoehe: 26,
    // Wie schnell gleitet er? (Meter pro Sekunde – laufen ist 7)
    tempo: 24,
    // Das Gleiten dauert mindestens / höchstens so lange (Sekunden)
    minGleitSekunden: 4,
    maxGleitSekunden: 16,
    // So schnell muss man zweimal tippen, damit es sofort losgeht (Sekunden)
    doppelTippSekunden: 0.6,
    // Hier steht der Ballon an der Base (Meter)
    basePlatz: { x: 17, z: -2 },
    // Wie laut faucht der Brenner? (0 = aus, 1 = laut)
    brennerLautstaerke: 0.7,
  },

  // ---------- Tauchen & das Insadorium ----------
  // Mit der Taucherbrille im Rucksack kann man an tiefem Wasser tauchen.
  // Wie lange reicht die Luft? (Sekunden)
  tauchLuft: 30,
  // Ab so wenig Luft kommt die Warnung (Sekunden)
  tauchLuftWarnung: 8,
  // Wie schnell schwimmt man unter Wasser? (Meter pro Sekunde – laufen ist 7)
  tauchTempo: 4.5,
  // Sprungknopf festhalten = so schnell nach oben …
  tauchSteigTempo: 3,
  // … loslassen = so schnell langsam nach unten
  tauchSinkTempo: 1.2,
  // So tief muss das Wasser mindestens sein, damit man tauchen kann (Meter)
  tauchMinTiefe: 1.5,
  // Wie grell leuchtet das Insadorium? (größer = greller)
  insadoriumLeuchten: 7,
  // Wie dicht ist das Wasser? So weit (Meter) kann man unter Wasser sehen
  tauchSichtweite: 30,

  // ---------- Inselbewohner & die wertvollen Münzen (Palmeninsel) ----------
  // Auf der Palmeninsel wohnen 13 Menschen. EINER hat die Taucherbrille.
  // Er leiht sie dir für 3 wertvolle Münzen – eine von jeder Insel.
  bewohner: {
    // Wo stehen sie? Richtung in Grad (0 = Osten, 90 = Süden, 180 = Westen, 270 = Norden)
    // und Abstand von der Inselmitte (Meter). Steht da ein Baum, sucht er sich daneben Platz.
    plaetze: [
      [0, 60], [300, 55], [40, 80], [90, 45], [120, 20],
      [200, 30], [270, 75], [220, 85], [130, 82], [175, 72],
      [330, 82], [250, 50], [20, 30],
    ],
    // Wer hat die Taucherbrille? Das entscheidet der Zufall in jedem neuen Spiel:
    // Es ist der 6. bis 13. Bewohner, den man anspricht. Die ersten 5 haben sie NIE.
    brilleFruehestens: 6,
    brilleSpaetestens: 13,
    // So viele wertvolle Münzen will er haben
    muenzenNoetig: 3,
    // So nah muss man ran, damit "💬 Ansprechen" kommt (Meter)
    ansprechRadius: 3.2,
    // Ab so nah schauen sie zu dir (Meter)
    anschauWeite: 10,
    // Weiter weg als das werden sie nicht gemalt (Meter) – spart Rechenkraft
    sichtWeite: 130,
    // Bis so weit weg bewegen sie sich ein bisschen (Meter)
    animierWeite: 50,
  },
  // Die 3 goldenen Grabehügel mit den wertvollen Münzen. Sie erscheinen erst,
  // wenn der Bewohner mit der Taucherbrille dir davon erzählt hat!
  //   x, z = wo (Meter, wie auf der Karte). Steht da ein Baum, rutscht der Hügel ein Stück.
  schatzHuegel: [
    { insel: 'Startinsel', x: -103, z: 38 }, // im Wald auf dem Berg, westlich der Base
    { insel: 'Palmeninsel', richtung: 250, abstand: 65 }, // am anderen Ende der Insel (Nordwesten)
    { insel: 'Klippeninsel', richtung: 60, abstand: 76 }, // oben am Rand des Plateaus – Seilkanone!
  ],
  // Zeigt die Karte ungefähr, wo eine Münze liegt? (ein "❓" – nicht ganz genau)
  schatzAufKarte: true,
  // So ungenau ist das "❓" auf der Karte (Meter)
  schatzKarteUngenau: 18,

  // ---------- Palmendorf (das zweite Dorf auf der Palmeninsel) ----------
  palmendorf: {
    // Das verkauft der Palmen-Händler (Münzen). Ballon und Rucksack gibt es nur im ersten Dorf!
    kaufPreise: {
      brot: 25,
      apfel: 4, // Pferdefutter
      koeder: 3, // Würmer
      holz: 12,
    },
    // So viele Sachen kauft er dir höchstens an einem Tag ab (er zählt selbst, nicht zusammen mit dem ersten Händler)
    kauftProTag: 10,
    // Wie viele Strandhütten auf Stelzen stehen im Dorf?
    huetten: 4,
    // Wie viele Fackeln leuchten nachts rund um den Platz?
    fackeln: 6,
    // Wie hell leuchten die Fackeln nachts? (0 = aus)
    fackelLeuchten: 3.5,
    // Ab so viel Metern Abstand wird das Dorf nicht mehr gemalt (spart Arbeit fürs iPad)
    sichtweite: 320,
  },

  // ---------- Seilkanone ----------
  // Kanone in die Hand, vor eine hohe Wand stellen, Hochschießen!
  // Jeder Schuss braucht 1 Seil aus dem Rucksack, die Kanone bleibt.
  seilkanone: {
    // So viele Seile können höchstens gleichzeitig hängen
    maxSeile: 3,
    // So hoch muss die Wand mindestens sein (Meter) – sonst läuft man einfach hoch
    wandMinHoehe: 6,
    // So weit vor dir darf die Wand anfangen (Meter)
    suchWeite: 25,
    // Ab so viel Steigung zählt es als Wand (1 = 45 Grad)
    wandSteil: 0.9,
    // So breit darf die Wand höchstens sein (Meter, von unten bis zur Kante)
    wandMaxBreite: 22,
    // Unter so viel Steigung ist es oben wieder flach (die Kante)
    kanteFlach: 0.35,
    // Wie schnell fliegt der Haken? (Meter pro Sekunde)
    hakenTempo: 28,
    // Wie schnell klettert man am Seil? (Meter pro Sekunde)
    kletterTempo: 2.6,
    // Wie laut sind Plopp, Klonk und Knarzen? (0 = aus, 1 = laut)
    lautstaerke: 0.8,
  },

  // ---------- Etappe 4: Wochenmarkt ----------
  // Alle wie viele Spieltage ist Markt im Palmendorf? (3 = Tag 3, 6, 9 …)
  markt: { alleTage: 3 },
};
