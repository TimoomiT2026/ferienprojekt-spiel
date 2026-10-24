// =============================================================
//  DAS AUFGABENBUCH 📋 (eine "Quest-Kette")
//  Zeigt immer den nächsten Schritt. Jeder Schritt baut auf dem
//  vorigen auf – so lernt man, wie alles im Spiel zusammenhängt.
//  Für jede geschaffte Aufgabe gibt es Münzen als Belohnung.
// =============================================================
import { knopf } from './steuerung.js';
import { uiBild } from './ui-bilder.js';
import { muenzeKlein } from './bilder.js';

// tipp = was man tun muss, geschafft = wann es erledigt ist
const AUFGABEN = [
  { titel: 'Finde die Schaufel', tipp: 'Sie liegt glitzernd neben dem Zelt.', geschafft: (s) => s.rucksack.hat('schaufel'), belohnung: 2 },
  { titel: 'Nimm die Schaufel in die Hand', tipp: 'Rucksack 🎒 öffnen und die Schaufel antippen.', geschafft: (s) => s.rucksack.inDerHand === 'schaufel', belohnung: 0 },
  { titel: 'Grab 3 Steine und 2 Eisenerz', tipp: 'An den glitzernden Erdhügeln graben. Am nächsten Morgen sind sie wieder voll.', geschafft: (s) => s.rucksack.anzahl('stein') >= 3 && s.rucksack.anzahl('eisenerz') >= 2, belohnung: 3 },
  { titel: 'Kauf dir ein Brot beim Händler', tipp: 'Das Dorf 🏘️ ist auf der Karte 🗺️. Beim Händler „Handeln“ drücken, dann bei Brot „Kaufen“. (Nachts schläft er!)', geschafft: (s) => !!s.haendler?.gekauftJemals || s.rucksack.hat('brot') || s.aufgaben.brotGegessen, belohnung: 2 },
  { titel: 'Iss ein Brot', tipp: 'Rucksack 🎒 öffnen, Brot antippen, „Essen“ drücken.', geschafft: (s) => s.aufgaben.brotGegessen, belohnung: 3, danach: 'essen' },
  { titel: 'Verkauf etwas beim Händler', tipp: 'Das Dorf 🏘️ ist auf der Karte 🗺️. Beim Händler „Handeln“ drücken, dann „💰 Verkaufen“. (Nachts schläft er!)', geschafft: (s) => s.aufgaben.gehandelt || Object.keys(s.haendler?.verkauftHeute || {}).length > 0, belohnung: 5, danach: 'werkbank' },
  { titel: 'Bau ein Schwert', tipp: 'An der Werkbank 🔨 neben dem Zelt: 2 Eisenerz + 3 Steine.', geschafft: (s) => s.rucksack.hat('schwert'), belohnung: 5 },
  { titel: 'Hack 4 Holz', tipp: 'Schwert in die Hand, vor einen Baum stellen und „Fällen“ drücken.', geschafft: (s) => s.rucksack.anzahl('holz') >= 4, belohnung: 3 },
  { titel: 'Bau eine Schnur', tipp: 'An der Werkbank: 2 Holz werden zu einer dünnen Schnur.', geschafft: (s) => s.rucksack.hat('schnur') || s.rucksack.hat('angel'), belohnung: 2 },
  { titel: 'Bau eine Angel', tipp: 'An der Werkbank: 2 Holz + 1 Schnur.', geschafft: (s) => s.rucksack.hat('angel'), belohnung: 5 },
  { titel: 'Besorg Würmer', tipp: 'Würmer findet man manchmal beim Graben – oder man kauft sie im Dorf.', geschafft: (s) => s.rucksack.hat('koeder'), belohnung: 2 },
  { titel: 'Angle einen Tofu-Fisch', tipp: 'Angel in die Hand und an eine Angelstelle 🎣 (auf der Karte 🗺️).', geschafft: (s) => s.rucksack.hat('tofufisch') || s.rucksack.hat('gegrillterFisch'), belohnung: 5, danach: 'fisch' },
  { titel: 'Kauf Holz beim Händler', tipp: 'Fürs Lagerfeuer brauchst du Holz. Beim Händler im Dorf „Kaufen“ drücken – beim ersten Mal gibt es 3 für 1!', geschafft: (s) => !!s.haendler?.holzGeschenkt || s.aufgaben.holzGekauft, belohnung: 2, danach: 'holz' },
  { titel: 'Bau ein Feuerzeug', tipp: 'An der Werkbank: 2 Steine + 1 Eisenerz + 1 Kohle.', geschafft: (s) => s.rucksack.hat('feuerzeug') || s.lagerfeuer.brennt > 0, belohnung: 5 },
  { titel: 'Zünde das Lagerfeuer an', tipp: 'Am Lagerfeuer neben dem Zelt: 1 Holz + Feuerzeug.', geschafft: (s) => s.lagerfeuer.brennt > 0, belohnung: 3 },
  { titel: 'Grill den Tofu-Fisch', tipp: 'Wenn das Feuer brennt: „Fisch grillen“ drücken.', geschafft: (s) => s.rucksack.hat('gegrillterFisch') || s.aufgaben.fischGegessen, belohnung: 3 },
  { titel: 'Iss deinen selbst gefangenen Fisch', tipp: 'Rucksack öffnen, Fisch antippen, „Essen“. Jetzt versorgst du dich selbst! 🎉', geschafft: (s) => s.aufgaben.fischGegessen, belohnung: 10 },
  { titel: 'Bau das große Zelt', tipp: 'Am Schild „BASE“ neben dem Zelt das Base-Menü öffnen und ausbauen.', geschafft: (s) => (s.base?.stufe || 1) >= 2, belohnung: 10 },
  { titel: 'Bau eine Holzhütte', tipp: 'Wieder im Base-Menü. In der Hütte steht eine Truhe 📦 – dort kannst du Sachen aufbewahren, wenn dein Rucksack voll ist!', geschafft: (s) => (s.base?.stufe || 1) >= 3, belohnung: 15 },
  { titel: 'Zähme ein Wildpferd', tipp: 'Kauf Äpfel im Dorf, nimm einen in die Hand 🍎 und füttere ein Wildpferd 3 Mal. Dann kommt es neugierig zu dir!', geschafft: (s) => !!s.pferde?.eigenes, belohnung: 15 },
  { titel: 'Spar 150 Münzen', tipp: 'Verkauf, was du findest. Bald brauchst du viel Geld für das große Abenteuer …', geschafft: (s) => s.rucksack.muenzen >= 150, belohnung: 25 },
  // ---------- Etappe 3: Das große Abenteuer ----------
  { titel: 'Entdecke eine neue Insel', tipp: 'Nimm ein Boot 🚣 und fahr aufs Meer hinaus. Mit dem Fernrohr 🔭 siehst du weiter!', geschafft: (s) => (s.karte?.entdeckteInseln || []).length > 0, belohnung: 5 },
  { titel: 'Sprich mit den Bewohnern der Palmeninsel', tipp: 'Auf der Palmeninsel 🌴 leben 13 Menschen. Einer von ihnen hat eine Taucherbrille 🤿!', geschafft: (s) => !!s.bewohner?.trigger, belohnung: 5 },
  { titel: 'Finde 3 wertvolle Münzen', tipp: 'Auf jeder Insel ist eine in einem golden glitzernden Grabehügel versteckt. Schau auf die Karte ❓!', geschafft: (s) => !!s.bewohner?.abgegeben || s.rucksack.anzahl('wertvolleMuenze') >= 3, belohnung: 10 },
  { titel: 'Hol dir die Taucherbrille', tipp: 'Bring die 3 Münzen zurück zur Person mit der Taucherbrille.', geschafft: (s) => !!s.bewohner?.abgegeben || s.rucksack.hat('taucherbrille'), belohnung: 5 },
  { titel: 'Bau eine Seilkanone', tipp: 'Werkbank: erst Seil (3 Schnüre) und Widerhaken (2 Eisenerz + 1 Stein), dann die Seilkanone (4 Holz + 3 Eisenerz + Seil + Widerhaken).', geschafft: (s) => s.rucksack.hat('seilkanone') || !!s.tauchen?.gefunden, belohnung: 10 },
  { titel: 'Finde das Insadorium', tipp: 'Kletter auf die Klippeninsel und tauch in den geheimnisvollen See. Es leuchtet rot! 🔴', geschafft: (s) => !!s.tauchen?.gefunden || s.rucksack.hat('insadorium'), belohnung: 0 },
];

// ---------- Die großen Erklärungen (kommen einmal, nach bestimmten Aufgaben) ----------
const ERKLAERUNG = {
  graben: {
    bild: '⛏️',
    titel: 'Dein erster Fund!',
    text: `<p>In den <b>Grabehügeln</b> findest du <b>Steine, Kohle, Eisenerz</b> – manchmal sogar <b>Gold</b> oder einen <b>Edelstein</b>. Und manchmal Würmer! 🪱</p>
      <p>Ein leerer Hügel <b>wächst in 2 Tagen nach</b>. Es gibt viele davon auf der Insel – schau auf die Karte 🗺️.</p>
      <p>Deine Funde kannst du beim <b>Händler verkaufen</b> (dann hast du Münzen) oder an der <b>Werkbank verbauen</b>.</p>`,
  },
  haendler: {
    bild: '🧑‍🌾',
    titel: 'Der Händler',
    text: `<p><b>🛒 Kaufen:</b> Hier gibt es Brot, Holz, Würmer, Äpfel und größere Rucksäcke.</p>
      <p><b>💰 Verkaufen:</b> Alles, was du ausgräbst oder angelst, kauft er dir ab. So kommst du an <b>Münzen</b>!</p>
      <p>Aber Achtung: Je öfter du <b>dasselbe</b> verkaufst, desto weniger zahlt er. Und pro Tag kauft er höchstens 10 Sachen.</p>
      <p>Nachts schläft er 💤 – dann musst du bis morgen warten.</p>`,
  },
  werkbank: {
    bild: '🔨',
    titel: 'Selbst bauen an der Werkbank',
    text: `<p>Neben deinem Zelt steht die <b>Werkbank</b>. Dort baust du aus deinen Funden eigene Werkzeuge.</p>
      <p>Zuerst ein <b>Schwert</b> (2 Eisenerz + 3 Steine). Damit fällst du Bäume und bekommst <b>Holz</b> – gratis!</p>
      <p>Aus Holz baust du eine <b>Schnur</b> und eine <b>Angel</b>. Grün markiert = du hast genug dafür.</p>`,
  },
  base: {
    bild: '🏠',
    titel: 'Deine Base',
    text: `<p>Hier ist dein Zuhause. Nachts schläfst du hier – dann bist du sicher und verlierst keine Münzen. 😴</p>
      <p>Du kannst deine Base <b>in 5 Stufen ausbauen</b>: Zelt → großes Zelt → Hütte mit <b>Truhe</b> 📦 → Garten mit <b>Karotten</b> 🥕 → Haus mit <b>Fischteich</b> 🎣. Ab der Hütte gibt es auch einen <b>Pferdestall</b>.</p>
      <p><b>Ab Stufe 2</b> wird dein altes Zelt zum <b>Reisezelt</b> ⛺. Das packst du in den Rucksack und stellst es <b>überall</b> auf – auch auf anderen Inseln! Dann musst du zum Schlafen nicht zurückkommen.</p>`,
  },
  holz: {
    bild: '🪵',
    titel: 'Holz kaufen – oder selbst fällen?',
    text: `<p>Beim Händler kostet Holz <b>12 Münzen</b>. Diesmal hat er dir 2 geschenkt!</p>
      <p>Mit deinem <b>eigenen Schwert</b> bekommst du Holz <b>gratis</b>: vor einen Baum stellen, „Fällen“ drücken. Ein Baum gibt 3 Holz.</p>
      <p>Aber Achtung: Das Schwert nutzt sich ab. Ein neues baust du an der Werkbank.</p>`,
  },
  essen: {
    bild: '🍞',
    titel: 'So funktioniert Essen',
    text: `<p>Oben links siehst du deinen <b>Satt-Balken</b>. Er wird in einem ganzen Tag leer – <b>auch wenn du schläfst</b>.</p>
      <p>Ist er leer, hast du <b>Hunger</b> und läufst nur noch <b>halb so schnell</b>. 😫</p>
      <p>Ein <b>Brot</b> oder ein <b>gegrillter Fisch</b> macht dich wieder ganz satt. Eine Karotte ein bisschen.</p>
      <p>Du hast noch 2 Brote – die reichen für 2 Tage. Bis dahin lernst du, dich <b>selbst</b> zu versorgen!</p>`,
  },
  fisch: {
    bild: '🐟',
    titel: 'Selbst versorgen spart Geld!',
    text: `<p>Ein Brot kostet beim Händler <b>25 Münzen</b> – und du brauchst jeden Tag eins.</p>
      <p>Einen Fisch fängst du <b>gratis</b>! Grill ihn am <b>Lagerfeuer</b>, dann macht er dich genauso satt wie ein Brot.</p>
      <p>Wer selbst angelt, spart seine Münzen für die Base, den Ballon und das große Abenteuer. 🎉</p>
      <p><b>Als Nächstes:</b> Fürs Lagerfeuer brauchst du Holz und ein Feuerzeug. Dann grillst du deinen Fisch.</p>`,
  },
};

export class Aufgaben {
  constructor(spiel) {
    this.spiel = spiel; // { rucksack, lagerfeuer, meldung, musik, elternElement }
    this.spiel.aufgaben = this;
    this.nummer = 0;
    this.fischGegessen = false;
    this.gehandelt = false; // schon einmal beim Händler verkauft?
    this.pruefZeit = 0;

    // Die kleine Anzeige oben links
    this.anzeige = document.createElement('button');
    this.anzeige.id = 'aufgabe-anzeige';
    document.getElementById('oben-links').appendChild(this.anzeige);
    knopf(this.anzeige, () => (this.offen ? this.schliessen() : this.oeffnen()));

    // Das Fenster mit allen Aufgaben
    this.fenster = document.createElement('div');
    this.fenster.id = 'aufgaben-fenster';
    this.fenster.className = 'spiel-fenster';
    this.fenster.innerHTML = `<div class="fenster-kopf"><h2>📋 Aufgabenbuch</h2><button class="zu" aria-label="Schließen">✕</button></div><ol class="aufgaben-liste"></ol>`;
    spiel.elternElement.appendChild(this.fenster);
    this.fenster.addEventListener('touchstart', (e) => e.stopPropagation());
    knopf(this.fenster.querySelector('.zu'), () => this.schliessen());
    this.offen = false;
    this.brotGegessen = false;
    this.erklaert = []; // welche großen Erklärungen schon kamen

    // Das große Erklär-Fenster
    this.erklaerFenster = document.createElement('div');
    this.erklaerFenster.id = 'erklaer-fenster';
    this.erklaerFenster.className = 'spiel-fenster';
    this.erklaerFenster.innerHTML = `<div class="erklaer-bild"></div><h2></h2><div class="erklaer-text"></div>
      <div class="knopf-reihe"><button class="fenster-knopf gruen erklaer-ok">Alles klar! 👍</button></div>`;
    spiel.elternElement.appendChild(this.erklaerFenster);
    this.erklaerFenster.addEventListener('touchstart', (e) => e.stopPropagation());
    this.erklaerOffen = false;
    this.erklaerWarte = [];
    knopf(this.erklaerFenster.querySelector('.erklaer-ok'), () => {
      this.erklaerOffen = false;
      this.erklaerFenster.classList.remove('offen');
      const naechste = this.erklaerWarte.shift();
      if (naechste) setTimeout(() => this.zeigeErklaerung(naechste), 400);
    });
    this.zeichnen();
  }

  // Für Ereignisse, die man nicht im Rucksack sieht
  gegessen(id) {
    if (id === 'gegrillterFisch') this.fischGegessen = true;
    if (id === 'brot') this.brotGegessen = true;
  }

  oeffnen() {
    this.offen = true;
    this.zeichnen();
    this.fenster.classList.add('offen');
  }

  schliessen() {
    this.offen = false;
    this.fenster.classList.remove('offen');
  }

  aktualisiere(dt) {
    this.pruefZeit -= dt;
    if (this.pruefZeit > 0 || this.nummer >= AUFGABEN.length) return;
    this.pruefZeit = 0.5;
    const a = AUFGABEN[this.nummer];
    if (Object.keys(this.spiel.haendler?.verkauftHeute || {}).length > 0) this.gehandelt = true;
    if (this.spiel.haendler?.holzGeschenkt) this.holzGekauft = true;
    // Erklärungen beim ersten Mal: erster Fund beim Graben, erster Besuch beim Händler
    if (!this.erklaert.includes('graben') && this.nummer <= 2 && ['stein', 'kohle', 'eisenerz', 'gold', 'edelstein'].some((id) => this.spiel.rucksack.hat(id))) this.erklaere('graben');
    if (!this.erklaert.includes('haendler') && this.spiel.haendler?.offen) this.erklaere('haendler');
    if (!this.erklaert.includes('base') && this.spiel.base?.offen) this.erklaere('base');
    if (!a.geschafft(this.spiel)) return;
    this.nummer++;
    if (a.belohnung) this.spiel.rucksack.aendereMuenzen(a.belohnung);
    this.spiel.musik.pling();
    const naechste = AUFGABEN[this.nummer];
    this.spiel.meldung(
      `✅ Geschafft: ${a.titel}!${a.belohnung ? ` +${a.belohnung} 🪙` : ''}` +
        (naechste ? `  Nächste Aufgabe: ${naechste.titel}` : '  🏆 Alle Aufgaben geschafft!'),
      6
    );
    this.zeichnen();
    // Manche Aufgaben haben danach eine große Erklärung über den ganzen Bildschirm
    if (a.danach && ERKLAERUNG[a.danach]) setTimeout(() => this.erklaere(a.danach), 1200);
  }

  // ---------- Große Erklärung (über den ganzen Bildschirm) ----------
  erklaere(welche) {
    const e = ERKLAERUNG[welche];
    if (!e || this.erklaert.includes(welche)) return;
    this.erklaert.push(welche);
    // Ist gerade schon eine Erklärung offen? Dann kommt diese danach dran
    if (this.erklaerOffen) { this.erklaerWarte.push(welche); return; }
    this.zeigeErklaerung(welche);
  }

  zeigeErklaerung(welche) {
    const e = ERKLAERUNG[welche];
    this.erklaerFenster.querySelector('.erklaer-bild').innerHTML = e.bild;
    this.erklaerFenster.querySelector('h2').textContent = e.titel;
    this.erklaerFenster.querySelector('.erklaer-text').innerHTML = e.text;
    this.erklaerOffen = true;
    this.erklaerFenster.classList.add('offen');
  }

  zeichnen() {
    const jetzt = AUFGABEN[this.nummer];
    // Das Buch-Bild kommt aus ui-bilder.js, der Text steht daneben
    this.anzeige.innerHTML = `${uiBild('buch')}<span>${jetzt ? jetzt.titel : '🏆 Alle Aufgaben geschafft!'}</span>`;
    const liste = this.fenster.querySelector('.aufgaben-liste');
    liste.innerHTML = AUFGABEN.map((a, i) => {
      const zustand = i < this.nummer ? 'fertig' : i === this.nummer ? 'jetzt' : 'spaeter';
      const zeichen = uiBild(zustand === 'fertig' ? 'haken' : zustand === 'jetzt' ? 'pfeil' : 'schloss');
      const tipp = zustand === 'jetzt' ? `<div class="aufgabe-tipp">${a.tipp}</div>` : '';
      const belohnung = a.belohnung ? `<span class="aufgabe-lohn">+${a.belohnung} ${muenzeKlein()}</span>` : '';
      const titel = zustand === 'spaeter' ? '???' : a.titel;
      return `<li class="aufgabe ${zustand}"><span class="aufgabe-zeichen">${zeichen}</span><div><b>${titel}</b>${tipp}</div>${belohnung}</li>`;
    }).join('');
  }

  alsDaten() {
    return { nummer: this.nummer, fischGegessen: this.fischGegessen, brotGegessen: this.brotGegessen, gehandelt: this.gehandelt, holzGekauft: this.holzGekauft, erklaert: this.erklaert, version: 4 };
  }

  ladeDaten(d) {
    let nummer = d.nummer || 0;
    // Alte Spielstände kannten die Händler-Aufgabe (Nummer 4) noch nicht
    if (!d.version && nummer >= 3) nummer++;
    // Version 2 kannte die zwei Brot-Aufgaben (Nummer 4 und 5) noch nicht – wer weiter war, hat sie übersprungen
    if ((d.version || 1) < 3 && nummer >= 3) nummer += 2;
    // Version 3 kannte „Kauf Holz beim Händler“ (Nummer 12) noch nicht
    if ((d.version || 1) < 4 && nummer >= 12) nummer += 1;
    this.holzGekauft = !!d.holzGekauft || nummer > 12;
    this.brotGegessen = !!d.brotGegessen || nummer > 4;
    this.erklaert = Array.isArray(d.erklaert) ? d.erklaert : nummer > 4 ? ['essen'] : [];
    if (nummer > 11 && !this.erklaert.includes('fisch')) this.erklaert.push('fisch');
    // Wer schon weiter ist, braucht die Anfangs-Erklärungen nicht mehr
    for (const [id, ab] of [['graben', 2], ['haendler', 3], ['werkbank', 5], ['holz', 12]]) if (nummer > ab && !this.erklaert.includes(id)) this.erklaert.push(id);
    this.nummer = Math.min(nummer, AUFGABEN.length);
    this.fischGegessen = !!d.fischGegessen;
    this.gehandelt = !!d.gehandelt || (!d.version && nummer > 3);
    this.zeichnen();
  }
}
