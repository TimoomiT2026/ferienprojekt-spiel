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
  // So viele Stück gibt es pro Fund in einem Grabehügel (2 = immer doppelt)
  fundMenge: 2,
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
  // So viele Angelstellen gibt es auf der Startinsel (1 = nur bei der Base, 2 = Base + Dorf, 0 = alte Verteilung mit 10)
  angelstellenStartinsel: 2,
  inselAngelstellen: 2,

  // ---------- Werkbank ----------
  // Was braucht man, um etwas zu bauen? (Ding: Anzahl)
  rezepte: {
    schwert: { eisenerz: 2, stein: 3 },
    feuerzeug: { stein: 2, eisenerz: 1, kohle: 1 },
    schnur: { holz: 2 }, // dünnes Holz, zur Schnur gebunden
    angel: { holz: 2, schnur: 1 },
    fernrohr: { eisenerz: 2, gold: 1, holz: 1 },
    // Seilkanone (schwer zu schaffen!): erst Seil bauen, dann die Kanone
    seil: { schnur: 3 }, // 3 Schnüre zusammengedreht = ein starkes Seil
    // (Den Widerhaken kann man nicht bauen – den gibt es als Preis bei der Zauberpilz-Rallye! 🏁)
    seilkanone: { holz: 4, eisenerz: 3, seil: 1, widerhaken: 1 },
    leine: { schuh: 1, schnur: 1 }, // Leder vom alten Schuh + Schnur = Pferdeleine (nicht für die Seilkanone!)
  },

  // Wie oft kann man etwas benutzen, bevor es kaputt / leer ist?
  haltbarkeit: {
    schwert: 24, // 24 Schläge
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
  // ---------- Leitplanken für neue Spieler (Aufgabenbuch) ----------
  // Nach so vielen Sekunden ohne Fortschritt erinnert ein großes Fenster an die Aufgabe
  erinnerungNachSekunden: 90,
  // So oft höchstens pro Aufgabe erinnern
  erinnerungenProAufgabe: 2,
  // Bis zu dieser Aufgaben-Nummer wird erinnert (danach kennt man das Spiel)
  erinnerungBisAufgabe: 17,
  // Am ersten Tag: so viele Sekunden vor der Nacht kommt die Schlaf-Erklärung
  nachtErklaerungSekunden: 120,
  // So viele Sekunden vor der Nacht piept es und die Uhr wird rot
  tagWarnungSekunden: 45,

  // Wie viele Sachen kauft der Händler höchstens an einem Tag?
  haendlerKauftProTag: 10,
  // So viele Münzen kostet es, etwas zu KAUFEN
  // (Eine Angel gibt es beim Händler nicht – die baust du selbst!)
  // Beim allerersten Brot (und beim ersten Holz) schenkt der Händler im Dorf so viele dazu
  brotGeschenk: 2,

  // Manches gibt es beim Händler nur als Packung: so viele Stück bekommt man für EINEN Preis
  kaufMenge: {
    koeder: 10, // eine Schachtel mit 10 Würmern 🪱
    apfel: 3, // ein 3er-Pack – genau richtig, um ein Wildpferd zu zähmen 🐴
  },
  kaufPreise: {
    koeder: 10, // für die ganze 10er-Schachtel
    stein: 6, // Notfall: 3× so teuer wie beim Verkaufen
    eisenerz: 18, // Notfall: 3× so teuer wie beim Verkaufen
    holz: 12,
    brot: 25,
    apfel: 12, // Pferdefutter – für den 3er-Pack (siehe kaufMenge)
    rucksackGross: 60, // Rucksack mit 18 Plätzen
    rucksackRiesig: 120, // Rucksack mit 24 Plätzen
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
  // Ab dieser Base-Stufe wird man im Schlaf langsamer hungrig (0.5 = halb so schnell)
  schlafHungerAbStufe: 2,
  schlafHungerFaktor: 0.5,
  // Vorratskammer: Ab dieser Base-Stufe liegt alle paar Tage morgens ein Brot in der Truhe
  vorratAbStufe: 3,
  vorratAlleTage: 2,
  // Heimfahrt mit dem Fischer vom Palmendorf (Notausgang, wenn man kein Boot dort hat)
  heimfahrtKosten: 15,
  // Wer so viele Tage lang Hunger hat (leerer Balken), wird ohnmächtig und wacht am Zelt auf
  ohnmachtNachTagen: 1,
  // … und das kostet so viele Münzen (der Dorfbewohner, der dich gefunden hat, will Geld fürs Essen)
  ohnmachtKosten: 20,
  // … und diese Funde fallen dir aus dem Rucksack (alle davon!)
  ohnmachtVerliert: ['stein', 'eisenerz', 'gold', 'edelstein'],
  // Wie viel davon ist weg? 0.5 = die Hälfte (abgerundet – wer nur 1 hat, behält es). 1 = alles. (Game Designer: die Hälfte)
  ohnmachtVerlustAnteil: 0.5,
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
  // ---------- Nebel um die anderen Inseln 🌫️ ----------
  // Erst wer eine Insel mit dem Fernrohr 🔭 entdeckt, kommt durch den Nebel.
  nebel: {
    an: true, // false = kein Nebel, alle Inseln gleich offen
    abstand: 60, // so weit vor der Küste fängt der Nebel an (Meter)
    hoehe: 45, // so hoch ist die Nebelwand (Meter)
    deckkraft: 0.6, // 0 = unsichtbar, 1 = ganz dicht
  },
  // So weit vor der Küste der Klippeninsel dreht das Boot um, solange man noch nicht mit den Bewohnern gesprochen hat
  klippeSperrAbstand: 25,
  // Ab wann kann man das Fernrohr an der Werkbank bauen?
  fernrohrAbTag: 3,
  // … und erst, wenn diese Aufgaben geschafft sind (man versorgt sich selbst):
  fernrohrNachAufgaben: ['Iss deinen selbst gefangenen Fisch', 'Bau eine Holzhütte'],
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

  // Im tiefen Wasser festgesteckt? Nach so vielen Sekunden schwimmt man zum nächsten Strand
  rettungNachSekunden: 2,
  // Festgeklemmt? Wer so viele Sekunden in 3 Richtungen schiebt und nicht vom Fleck kommt, wird gerettet
  klemmSekunden: 4,

  // ---------- Kleiderschrank 👕 (ab Base-Stufe 3) ----------
  // Die erste Zeile ist immer das, was man am Anfang anhat. shirt2 = zweite Streifen-Farbe (gleich = ohne Streifen)
  kleidungAbStufe: 3,
  kleidung: {
    pullis: [
      { name: 'Ringelpulli', shirt: '#b3202a', shirt2: '#1a1f33' },
      { name: 'Blauer Ringel', shirt: '#2f78c8', shirt2: '#f2f2f2' },
      { name: 'Grüner Ringel', shirt: '#3a9a4a', shirt2: '#f6d64a' },
      { name: 'Lila Pulli', shirt: '#7a4ec2', shirt2: '#7a4ec2' },
      { name: 'Oranger Pulli', shirt: '#ec7d22', shirt2: '#ec7d22' },
      { name: 'Schwarzer Pulli', shirt: '#22252b', shirt2: '#22252b' },
      { name: 'Pirat', shirt: '#f2f2f2', shirt2: '#1a1f33' },
      { name: 'Insadorium-Rot', shirt: '#e0281c', shirt2: '#ff8a3c' },
    ],
    hosen: [
      { name: 'Jogginghose', hose: '#1c1d22', hosenStreifen: '#dfe8f2', hosenStreifen2: '#8fb3d9' },
      { name: 'Jeans', hose: '#3d5a8a' },
      { name: 'Grüne Hose', hose: '#4a6b3a' },
      { name: 'Sand-Hose', hose: '#c9a877' },
      { name: 'Rote Sporthose', hose: '#a3242c', hosenStreifen: '#f2f2f2', hosenStreifen2: '#f2f2f2' },
      { name: 'Graue Hose', hose: '#6b707a' },
    ],
  },

  // ---------- Prolog in Düsseldorf 🏙️ (nur für ganz neue Spieler) ----------
  prolog: {
    start: [-196, -24], // wo man anfängt: an der Rheinpromenade (Meter ab dem Rheinturm: x = Osten, z = Süden)
    sichtweite: 1000, // so weit sieht man in Düsseldorf (Meter)
    baeume: 420, // so viele Bäume stehen in der Stadt
    gras: 26000, // so viele Gras-Büschel wachsen auf den Wiesen
    // Schiffe auf dem Rhein: art = container / schuett / ausflug,
    // spur = Abstand zum Ufer (Meter), tempo = Meter pro Sekunde,
    // richtung = 1 flussabwärts (nach Nordosten) oder -1 flussaufwärts, start = wo es losfährt (0 bis 1)
    schiffe: [
      { art: 'container', spur: 70, tempo: 4.5, richtung: 1, start: 0.5 },
      { art: 'ausflug', spur: 150, tempo: 3.6, richtung: -1, start: 0.72 },
      { art: 'schuett', spur: 110, tempo: 3.2, richtung: -1, start: 0.93 },
    ],
    boot: [-110, 30], // ungefähr hier liegt das Ruderboot im Yachthafen
    hausFarben: ['#f3d9b1', '#e8b9a0', '#cfe0c3', '#bcd4e6', '#f2e3a0', '#e6c7d9', '#d9d2c4', '#f0c8a0'],
    chatTempo: 1700, // so viele Millisekunden zwischen zwei Chat-Nachrichten
    chat: [
      '<b>❓ Unbekannt:</b> Pssst … Forscher?',
      '<b>❓ Unbekannt:</b> Ich weiß, wonach du suchst. Das Insadorium gibt es wirklich!',
      '<b>❓ Unbekannt:</b> Es liegt auf einer unbekannten Inselgruppe, weit draußen im Meer. Kaum jemand war je dort.',
      '<b>❓ Unbekannt:</b> Hier sind die Koordinaten: <b>47°11′ S · 31°08′ W</b> 🗺️',
      '<b>❓ Unbekannt:</b> Erzähl niemandem davon. Viel Glück!',
      '— Unbekannt hat den Chat verlassen —',
    ],
    reiseplan: ['🗺️ Koordinaten in die Seekarte eintragen', '🎒 Rucksack packen', '⛺ Zelt einpacken', '🍞 Proviant für viele Wochen', '🚣 Ruderboot im Yachthafen bereitmachen'],
  },
  // Der Sturm-Film („2 Wochen später …“)
  sturmfilm: {
    dauer: 17, // Sekunden
    wellen: 1.0, // wie hoch die Wellen sind (1 = normal, 2 = riesig)
    regenTropfen: 2500,
  },

  // ---------- Freies Spiel 🌴 ----------
  // So viele Münzen hat man im Freien Spiel – und es werden nie weniger (Anzeige: ∞)
  freiesSpielMuenzen: 999999,
  // Was liegt am Anfang im Rucksack (24 Plätze) und in der Truhe? (Ding: Anzahl)
  freiesSpielRucksack: { schaufel: 1, schwert: 1, angel: 1, feuerzeug: 1, fernrohr: 1, seilkanone: 1, taucherbrille: 1, leine: 1, koeder: 10, brot: 10, apfel: 10, gegrillterFisch: 5, zauberpilz: 5, kaffee: 3, nachtLimo: 3, holz: 20, karotte: 5 },
  freiesSpielTruhe: { stein: 20, kohle: 20, eisenerz: 20, gold: 20, edelstein: 10, schnur: 10, seil: 5, widerhaken: 1, tofufisch: 5, schuh: 2, dose: 1, alge: 1, muschel: 10, kokosnuss: 10, reisezelt: 1 },

  // ---------- Heißluftballon 🎈 ----------
  // Beim wievielten Weg ins Dorf (noch ohne Ballon) kommt der Tipp: „Es gibt einen Ballon!“
  ballonTippNachDorfBesuchen: 3,
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
      apfel: 12, // Pferdefutter (3er-Pack, siehe kaufMenge)
      koeder: 10, // Würmer (10er-Schachtel, siehe kaufMenge)
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
  // Das Seil geht nie leer – die Kanone hat ihr eigenes Seil.
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

  // ---------- Etappe 4: Inselzeitung 📬 (js/zeitung.js) ----------
  // Am Morgen von jedem Markttag liegt "Der Inselbote" im Briefkasten an der Base.
  zeitung: {
    // Wo steht der Briefkasten? (von der Base aus: x = nach rechts, z = nach vorne zur Tür)
    briefkastenX: 3.6,
    briefkastenZ: 1.3,
    // So nah muss man ran, damit "📬 Briefkasten" erscheint (Meter)
    radius: 2.0,
    // So viele "Fotos" kommen in jede Zeitung
    fotos: 3,
    // So viele Ereignisse merkt sich das Spiel höchstens (ältere werden vergessen)
    maxEreignisse: 200,
    // So viele alte Zeitungen kann man noch lesen
    maxAusgaben: 30,
    // So viele Sekunden nach Sonnenaufgang kommt die Meldung "Die Inselzeitung ist da!"
    meldungNachSekunden: 7,
    // So stark wackelt der Briefkasten, wenn eine neue Zeitung drin ist
    wackeln: 0.08,
  },

  // ---------- Etappe 4: Wochenmarkt ----------
  // Alle wie viele Spieltage ist Markt im Palmendorf? (3 = Tag 3, 6, 9 …)
  markt: {
    alleTage: 3,
    // Die drei Marktstände (Entscheidungen des Game Designers). Sie verkaufen NUR – ankaufen tut weiter der Händler.
    // 🍎 Obst & Gemüse: günstiger als beim normalen Händler (dort: Brot 25, Apfel 4)
    obstPreise: { brot: 18, apfel: 2, karotte: 4 },
    // ☕ Kaffee (Luxus!) und 🍋 Nacht-Limo (Luxus!) – Preise vom Game Designer
    kaffeePreise: { kaffee: 35 },
    limoPreise: { nachtLimo: 40 },
    // 💎 Steine, Metall & Edelsteine: etwas teurer, als man beim Verkaufen bekommt
    //    (Verkaufen bringt: Kohle 3, Eisenerz 6, Gold 15, Edelstein 40)
    steinPreise: { kohle: 6, eisenerz: 12, gold: 30, edelstein: 75 },
    // Wie viele Kaffees wirken höchstens gleichzeitig? (1 = erst wieder, wenn der alte "verbraucht" ist)
    kaffeeHoechstens: 1,
    // Die Nacht-Limo: so hell wird die Nacht
    limo: {
      // So viele Sekunden dauert es, bis es hell wird (und abends wieder)
      uebergangSekunden: 4,
      // So viele Sekunden vor Sonnenaufgang wird es langsam wieder normal
      auslaufSekunden: 20,
      // Wo steht die Zaubersonne? (0 = Osten am Horizont, 0.5 = ganz oben, 1 = Westen)
      sonnenHoehe: 0.42,
    },
    // So viele Sekunden nach Sonnenaufgang kommt die Meldung "Heute ist Wochenmarkt!"
    meldungNachSekunden: 7,
    // Ab so viel Metern Abstand werden die Stände nicht gemalt (wie das Palmendorf)
    sichtweite: 320,
    // So nah muss man an einen Stand, damit der Knopf "Handeln" kommt (Meter)
    handelRadius: 3.5,
  },

  // ---------- Etappe 4: Zauberpilz-Rallye 🍄🚣 (js/rallye.js) ----------
  rallye: {
    teilnahme: 10, // so viel kostet das Mitmachen am Markttag (Game Designer)
    teilnahmeSonst: 50, // an allen anderen Tagen kann man auch fahren – aber teurer (Wunsch eines Testers)
    gewinn: 50, // so viel bekommt der Sieger – aber nur 1× pro Tag
    runden: 1, // wie viele Runden ein Rennen hat
    // Hilfe beim Verlieren (Game Designer): Nach so vielen Niederlagen hintereinander werden die Gegner langsamer …
    hilfeNachNiederlagen: 3,
    // … und zwar so viel (0.9 = 10 % langsamer). Wer gewinnt, fährt danach wieder gegen die normalen Gegner.
    hilfeTempo: 0.9,
    // Die Strecke: Punkte auf dem Meer vor der Palmeninsel (x, z). Eine weiche Kurve geht durch alle durch.
    // Der erste Punkt ist die Start- und Ziellinie. (Reihenfolge = Fahrtrichtung)
    punkte: [
      [-335, 40], [-335, 120], [-322, 180], [-290, 212], [-248, 212], [-225, 180], // runter und die große Kurve
      [-232, 140], [-262, 115], [-262, 80], [-232, 50], // die S-Kurve
      [-225, 0], [-230, -36], [-243, -52], [-258, -50], [-266, -32], // die enge Haarnadel 📌
      [-282, -2], [-315, 12], // zurück zum Ziel
    ],
    breite: 17, // so breit ist die Bahn (Meter) – breit genug zum Überholen
    bojenAbstand: 9, // alle so viele Meter schwimmt links und rechts eine Boje
    bojenFarben: { links: ['#ff4d4d', '#ffffff'], rechts: ['#ffd23a', '#2f8fe0'] },
    // Der Stand am Strand vor dem Palmendorf und der Steg zur Startlinie
    stand: { x: -392, z: 48 },
    steg: { von: [-386, 48], bis: [-351, 48] },
    standRadius: 4, // so nah muss man an den Stand für den Knopf
    startAbstand: 8, // so viele Meter vor der Linie stehen die Boote beim Start
    countdown: 3, // 3 – 2 – 1 – LOS!

    // ---- Wie fahren die Rennboote? (für dich und die KI gleich!) ----
    maxTempo: 10.5, // Höchsttempo (Meter pro Sekunde; ein normales Ruderboot schafft 9)
    beschleunigung: 4.5, // so schnell kommt das Boot in Fahrt
    bremsen: 5, // so schnell wird es langsamer (Wasser bremst)
    drehTempo: 2.2, // so schnell dreht sich das Boot
    griff: 5, // so fest hält das Wasser das Boot in der Kurve. Kleiner = man rutscht früher raus
    rutschBremse: 0.5, // wie viel Tempo das Rutschen kostet
    rutschGriff: 0.5, // wenn das Boot einmal rutscht, hält das Wasser nur noch halb so gut (wie auf Eis!)
    rutschAb: 2.5, // ab so viel seitlichem Tempo (m/s) rutscht das Boot
    ausserhalbTempo: 0.45, // außerhalb der Bahn gibt es nicht mal mehr die Hälfte vom Tempo
    zurueckAbstand: 30, // so weit weg von der Bahn → zurück auf die Strecke
    bootAbstand: 2.6, // so nah kommen sich zwei Boote, dann stoßen sie sich sanft ab

    // ---- Zauberpilze = Turbo ----
    // [wo auf der Strecke (0 = Start, 0.5 = Hälfte), wie weit rechts (+) oder links (−) in Metern]
    pilze: [[0.07, 0], [0.2, -4], [0.36, 4], [0.47, 0], [0.62, -4], [0.8, 3], [0.93, -2]],
    pilzFarben: ['#e5243b', '#9b3dff'],
    pilzRadius: 2.6, // so nah muss man durchfahren
    pilzGroesse: 1,
    turboDauer: 2, // Sekunden
    turboTempo: 1.5, // so viel schneller (1.5 = anderthalb mal so schnell)
    turboSchub: 12, // so schnell kommt der Turbo
    turboGriff: 3, // im Turbo hält das Wasser das Boot so viel besser in der Spur (größer = man fliegt nicht so leicht raus)

    // ---- Die KI-Gegner ----
    //  koennen    = wie nah sie an die Kurven-Grenze gehen (1 = perfekt)
    //  tempo      = Höchsttempo im Vergleich zu dir (1 = gleich schnell)
    //  fehler     = wie oft sie zu schnell in eine Kurve fahren (0.2 = jede 5. Kurve)
    //  pilzChance = wie oft sie einen Zauberpilz erwischen
    //  spur       = wo sie am liebsten fahren (− links, + rechts)
    gegner: [
      { name: 'Kapitän Kokosnuss', farbe: '#e5243b', fahne: '#ffffff', koennen: 0.96, tempo: 0.97, fehler: 0.12, pilzChance: 0.6, spur: -2.5,
        figur: { shirt: '#e5243b', hose: '#efe2c0', haare: '#2a1d14', haut: '#b97a4e', hut: '#e8cf8a' } },
      { name: 'Flitze-Möwe', farbe: '#ffb02e', fahne: '#2f8fe0', koennen: 0.94, tempo: 0.97, fehler: 0.2, pilzChance: 0.45, spur: 2.5,
        figur: { shirt: '#ffffff', hose: '#2f8fe0', haare: '#c8a060', haut: '#f0c8a0', bart: false } },
      { name: 'Käpt\'n Krabbe', farbe: '#4caf50', fahne: '#ff7ac8', koennen: 0.9, tempo: 0.95, fehler: 0.25, pilzChance: 0.35, spur: 0,
        figur: { shirt: '#4caf50', hose: '#5a4632', haare: '#8a8a8a', haut: '#d9a77c', hut: '#7a5236' } },
      { name: 'Paddel-Panda', farbe: '#9b3dff', fahne: '#ffe14d', koennen: 0.86, tempo: 0.93, fehler: 0.3, pilzChance: 0.25, spur: 4,
        figur: { shirt: '#222222', hose: '#ffffff', haare: '#111111', haut: '#f4ead3', bart: false } },
    ],
    spielerBoot: { farbe: '#2f8fe0', fahne: '#ffd23a' },
    fehlerStaerke: 0.5, // so viel zu schnell ist die KI bei einem Fehler (0.5 = 50 % mehr Kurven-Schwung)
    kurveAbRadius: 45, // ab so einer engen Kurve (Radius in Metern) zählt es als "Kurve"

    // ---- Sonstiges ----
    kameraFaktor: 1.3, // beim Rennen ist die Kamera etwas weiter weg
    kameraFolgen: 2.5, // so schnell dreht die Kamera hinter das Boot
    zielWarten: 12, // so viele Sekunden nach deinem Ziel geht es zurück zum Steg
    wartenNachKI: 45, // wenn alle KI im Ziel sind und du nach so vielen Sekunden noch nicht: Rennen vorbei
    konfetti: 90, // so viele Konfetti-Schnipsel beim Sieg
    sichtweite: 350, // ab so viel Metern Abstand werden Bojen & Co. nicht gemalt
  },
};
