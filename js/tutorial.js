// =============================================================
//  DAS TUTORIAL 💬 – Sprechblasen, die neue Spieler anleiten
//  1) Erklärungen: Wenn man etwas zum ERSTEN Mal sieht oder bekommt,
//     erklärt eine kleine Sprechblase, was es ist. Jede nur einmal!
//  2) Tipps: Bis Tag 2 kommen höchstens 5 Tipps, wenn sie gerade
//     passen (z. B. „Bald wird es Nacht!“). Ab Tag 3 gibt es keine
//     Tipps mehr – nur noch Erklärungen für neue Dinge.
//
//  Gemerkt wird, was man schon gesehen hat, im Browser-Speicher
//  ("localStorage"). Bei „Neues Spiel“ wird das gelöscht.
// =============================================================
import { knopf } from './steuerung.js';

// Zahlen zum Drehen (können später nach einstellungen.js umziehen)
export const TUTORIAL_EINSTELLUNGEN = {
  anzeigeSekunden: 8, // so lange bleibt eine Sprechblase, wenn man sie nicht antippt
  maxTipps: 5, // höchstens so viele allgemeine Tipps pro Spiel
  tippsBisTag: 2, // Tipps gibt es nur bis zu diesem Tag (ab Tag 3 nicht mehr)
  tippPause: 35, // so viele Sekunden mindestens zwischen zwei Tipps
  schaufelTippNach: 20, // Sekunden ohne Schaufel, bis der Schaufel-Tipp kommt
  aufgabenTippNach: 50, // Sekunden Spielzeit, bis der Aufgabenbuch-Tipp kommt
  dorfTippNach: 150, // Sekunden ohne Händler-Besuch, bis der Dorf-Tipp kommt
  abendTippVorNacht: 45, // so viele Sekunden vor der Nacht kommt der Zelt-Tipp
  wenigGeld: 10, // unter so vielen Münzen gilt man als „pleite“
};

// Der Speicher-Schlüssel im Browser
const SPEICHER_SCHLUESSEL = 'inselspiel-tutorial-v1';

// ---------- Alle Erklärungen (kurz, mit Emoji vorne) ----------
export const ERKLAERUNGEN = {
  start: '👋 Links Finger hinlegen und schieben = laufen. Rechts wischen = umschauen!',
  rucksack: '🎒 Dein Rucksack! Tipp ein Ding an: in die Hand nehmen, essen oder wegwerfen.',
  schaufel: '✨ Die Schaufel! Öffne den Rucksack 🎒 und tipp sie an, dann hast du sie in der Hand.',
  grabestelle: '⛏️ Eine Grabestelle! Schaufel in die Hand und „Graben“ drücken.',
  werkbank: '🔨 Die Werkbank! Hier baust du neue Dinge, zum Beispiel ein Schwert oder eine Angel.',
  haendler: '🧑‍🌾 Der Händler! Hier kaufst und verkaufst du. Das Gleiche oft verkaufen bringt weniger.',
  haendlerSchlaeft: '💤 Nachts schläft der Händler. Komm morgen früh wieder!',
  lagerfeuer: '🔥 Das Lagerfeuer! Mit 1 Holz und einem Feuerzeug anzünden, dann Fische grillen.',
  angelstelle: '🎣 Eine Angelstelle! Hier kräuselt sich das Wasser. Mit Angel und Würmern angeln.',
  angel: '🎣 Deine Angel! In die Hand nehmen und an eine Angelstelle stellen. Würmer nicht vergessen!',
  fisch: '🐟 Ein Tofu-Fisch! Roh schmeckt er nicht. Grill ihn am Lagerfeuer!',
  muell: '👞 Igitt, Müll! Nicht wegwerfen: Aus manchem Müll kann man was bauen – aus dem Schuh eine Leine.',
  hunger: '🍞 Du hast Hunger! Iss einmal am Tag, sonst läufst du nur halb so schnell.',
  essen: '😋 Lecker! Einmal am Tag essen reicht. Oben links siehst du, wie satt du bist.',
  nacht: '🌙 Es ist Nacht! Lauf zu deinem Zelt und schlaf. Spätestens jede 2. Nacht!',
  schlafen: '😴 Gut geschlafen! Im Schlaf geht die Nacht ganz schnell vorbei.',
  base: '🏠 Deine Base! Am Schild baust du sie aus: großes Zelt, Hütte, Garten, Haus.',
  karte: '🗺️ Die Karte! Tipp einen Ort an, dann zeigt dir ein Pfeil den Weg.',
  boot: '🚣 Ein Boot! Einsteigen und mit dem Joystick rudern. An Land wieder aussteigen.',
  pferd: '🐴 Ein Wildpferd! Nimm einen Apfel in die Hand – dann kommt es neugierig. 3 Mal füttern!',
  leine: '🪢 Eine Leine! Damit kannst du dein Pferd anbinden.',
  zauberpilz: '🍄 Ein Zauberpilz! Im Rucksack essen, dann kannst du 1 Minute fliegen.',
  fliegen: '🕊️ Du fliegst! Sprungknopf festhalten = höher. „🛬 Landen“ = wieder runter.',
  fernrohr: '🔭 Ein Fernrohr! In die Hand und „Durchschauen“. Von einem Hügel siehst du weiter.',
  schwert: '🗡️ Ein Schwert! In die Hand nehmen, vor einen Baum stellen und „Fällen“ drücken.',
  baum: '🌳 Ein Baum! Mit dem Schwert in der Hand kannst du ihn fällen. Das gibt Holz.',
  truhe: '📦 Deine Truhe! Hier kannst du Sachen aufbewahren, damit dein Rucksack nicht voll wird. 20 Plätze!',
  insel: '🏝️ Eine neue Insel! Auf der Karte 🗺️ kannst du jetzt „Alle Inseln“ anschauen.',
  bewohner: '💬 Ein Inselbewohner! Sprich ihn an – vielleicht weiß er etwas über das Insadorium.',
  wertvolleMuenze: '🏅 Eine wertvolle Münze! Die kann man nicht verkaufen. Bring alle 3 zur Person mit der Taucherbrille.',
  taucherbrille: '🤿 Die Taucherbrille! Geh an tiefes Wasser und drück „Tauchen“. Pass auf deine Luft auf!',
  seilkanone: '🪝 Die Seilkanone! In die Hand nehmen, vor eine hohe Felswand stellen und „Hochschießen“.',
  ballon: '🎈 Dein Heißluftballon! Antippen und ein Ziel aussuchen. Zweimal schnell tippen = sofort los.',
  aufgabenbuch: '📋 Das Aufgabenbuch! Hier steht, was du als Nächstes machen kannst. Dafür gibt es Münzen.',
};

// ---------- Die Tipps (nur bis Tag 2) ----------
// wann = passt der Tipp gerade? (z = zustand, t = Tutorial)
const E = TUTORIAL_EINSTELLUNGEN;
const TIPPS = [
  {
    id: 'schaufelSuchen',
    text: '✨ Tipp: Die Schaufel liegt glitzernd beim Zelt!',
    wann: (z, t) => !z.hatSchaufel && t.spielZeit > E.schaufelTippNach,
  },
  {
    id: 'aufgabenbuch',
    text: '📋 Tipp: Oben links im Aufgabenbuch steht, was du als Nächstes tun kannst!',
    wann: (z, t) => t.spielZeit > E.aufgabenTippNach,
  },
  {
    id: 'rucksackVoll',
    text: '🎒 Tipp: Dein Rucksack ist voll! Verkauf etwas beim Händler im Dorf.',
    wann: (z) => z.rucksackVoll,
  },
  {
    id: 'abend',
    text: '🌇 Tipp: Bald wird es dunkel! Lauf zurück zu deinem Zelt ⛺.',
    wann: (z, t) => !t.tageszeit.istNacht() && t.tageszeit.restSekunden() < E.abendTippVorNacht,
  },
  {
    id: 'keinGeld',
    text: '🪙 Tipp: Wenig Geld? Grab Sachen aus und verkauf sie beim Händler im Dorf.',
    wann: (z) => z.hatSchaufel && z.muenzen < E.wenigGeld,
  },
  {
    id: 'zumDorf',
    text: '🏘️ Tipp: Folge dem Trampelpfad, dann findest du das Dorf mit dem Händler!',
    wann: (z, t) => z.hatSchaufel && !z.warBeimHaendler && t.spielZeit > E.dorfTippNach,
  },
];

export class Tutorial {
  // elternElement = #spielfeld, tageszeit = die Spieluhr (für Tag und Nacht)
  constructor({ elternElement, tageszeit }) {
    this.tageszeit = tageszeit;
    this.gesehen = new Set(); // ids, die schon gezeigt wurden (Tipps mit "tipp:" davor)
    this.schlange = []; // Warteschlange: Texte, die noch drankommen
    this.jetzt = null; // die Sprechblase, die gerade zu sehen ist
    this.restZeit = 0; // wie lange sie noch bleibt
    this.spielZeit = 0; // Sekunden gespielt (ohne offene Fenster)
    this.seitLetztemTipp = Infinity;
    this.ladeAusSpeicher();

    // Die Sprechblase selbst
    this.blase = document.createElement('div');
    this.blase.id = 'tutorial-blase';
    this.blase.innerHTML = '<p class="tutorial-text"></p><button class="tutorial-ok">OK 👍</button>';
    elternElement.appendChild(this.blase);
    this.textFeld = this.blase.querySelector('.tutorial-text');
    // Antippen (irgendwo auf der Blase) = schließen.
    // knopf() stoppt das Weiterreichen – so startet kein Joystick und keine Kamera.
    knopf(this.blase, () => this.schliessen());
    this.blase.addEventListener('touchmove', (e) => e.stopPropagation());
    this.blase.addEventListener('touchend', (e) => e.stopPropagation());
  }

  // ---------- Etwas Neues! (beim ersten Mal kommt die Erklärung) ----------
  neu(id) {
    if (this.gesehen.has(id) || !ERKLAERUNGEN[id]) return false;
    this.gesehen.add(id);
    this.speichern();
    this.schlange.push(ERKLAERUNGEN[id]);
    return true;
  }

  // Hat man das schon gesehen?
  schonGesehen(id) {
    return this.gesehen.has(id);
  }

  // ---------- Einmal pro Bild aufrufen ----------
  // zustand = { hatSchaufel, rucksackVoll, muenzen, fensterOffen, warBeimHaendler }
  aktualisiere(dt, zustand = {}) {
    // Während ein Fenster offen ist: Blase verstecken und warten
    const warten = !!zustand.fensterOffen;
    this.blase.classList.toggle('versteckt', warten);
    if (warten) return;

    this.spielZeit += dt;
    this.seitLetztemTipp += dt;

    if (this.jetzt) {
      this.restZeit -= dt;
      if (this.restZeit <= 0) this.schliessen();
      return;
    }
    if (this.schlange.length === 0) this.sucheTipp(zustand);
    if (this.schlange.length > 0) this.zeige(this.schlange.shift());
  }

  // Passt gerade ein Tipp? (nur bis Tag 2 und höchstens 5 Stück)
  sucheTipp(zustand) {
    if ((this.tageszeit?.tag ?? 1) > E.tippsBisTag) return;
    if (this.anzahlTipps() >= E.maxTipps || this.seitLetztemTipp < E.tippPause) return;
    for (const tipp of TIPPS) {
      const id = 'tipp:' + tipp.id;
      if (this.gesehen.has(id)) continue;
      if (!tipp.wann(zustand, this)) continue;
      this.gesehen.add(id);
      this.speichern();
      this.seitLetztemTipp = 0;
      this.schlange.push(tipp.text);
      return;
    }
  }

  anzahlTipps() {
    let n = 0;
    for (const id of this.gesehen) if (id.startsWith('tipp:')) n++;
    return n;
  }

  zeige(text) {
    this.jetzt = text;
    this.restZeit = E.anzeigeSekunden;
    this.textFeld.textContent = text;
    // Neu einblenden, damit die Blase „aufploppt“
    this.blase.classList.remove('sichtbar');
    void this.blase.offsetWidth;
    this.blase.classList.add('sichtbar');
  }

  schliessen() {
    if (!this.jetzt) return;
    this.jetzt = null;
    this.blase.classList.remove('sichtbar');
  }

  // ---------- Speichern ----------
  ladeAusSpeicher() {
    try {
      const daten = JSON.parse(localStorage.getItem(SPEICHER_SCHLUESSEL) || '[]');
      if (Array.isArray(daten)) daten.forEach((id) => this.gesehen.add(id));
    } catch {
      // Kein Speicher erlaubt (z. B. privates Fenster) – dann eben ohne
    }
  }

  speichern() {
    try {
      localStorage.setItem(SPEICHER_SCHLUESSEL, JSON.stringify([...this.gesehen]));
    } catch {}
  }

  // Für den Spielstand (falls man es dort mitspeichern will)
  alsDaten() {
    return { gesehen: [...this.gesehen] };
  }

  ladeDaten(d) {
    (d?.gesehen || []).forEach((id) => this.gesehen.add(id));
    this.speichern();
  }

  // „Neues Spiel“: alles vergessen, alles wird wieder erklärt
  zuruecksetzen() {
    this.gesehen.clear();
    this.schlange = [];
    this.schliessen();
    this.spielZeit = 0;
    this.seitLetztemTipp = Infinity;
    try {
      localStorage.removeItem(SPEICHER_SCHLUESSEL);
    } catch {}
  }
}
