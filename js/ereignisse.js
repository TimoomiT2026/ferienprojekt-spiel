// =============================================================
//  EREIGNISSE 📝 – das Tagebuch der Insel
//  Immer wenn im Spiel etwas Spannendes passiert (Fisch gefangen,
//  Pferd gezähmt, Insel entdeckt …), schreibt das Spiel einen Zettel:
//    { typ: 'fisch', tag: 4, daten: { ding: 'tofufisch' } }
//  Die Inselzeitung liest diese Zettel und malt lustige Bilder dazu.
//
//  Ereignis-Typen (wer meldet was?):
//    'fisch'            Tofu-Fisch geangelt           { ding }
//    'muell'            Schuh, Dose oder Alge geangelt { ding }
//    'baum'             Baum / Busch gefällt           { art }
//    'grabung'          an einer Grabestelle gegraben { ding }
//    'pferd-gezaehmt'   Pferd ist jetzt deins
//    'pferd-ausgerissen' Pferd hatte Hunger und ist weg
//    'insel-entdeckt'   neue Insel gefunden            { name }
//    'muenze-gefunden'  wertvolle Münze ausgegraben    { anzahl }
//    'insadorium'       das Insadorium gefunden! 🎉
//    'zauberpilz'       Zauberpilz gegessen → geflogen
//    'ballon-flug'      mit dem Ballon gelandet        { ziel }
//    'nicht-geschlafen' eine Nacht nicht geschlafen    { strafe }
//    'hunger'           der Bauch ist leer
//    'base-ausbau'      Base ausgebaut / Stall gebaut  { stufe, name } oder { stall: true }
//    'rallye'           Zauberpilz-Rallye (rallye.js)  { platz, sieger, zeit, teilnehmer }
//    'markt-kauf'       auf dem Markt gekauft (markt.js) { ding, preis }
//    'kaffee', 'limo'   Kaffee / Nacht-Limo (markt.js)
// =============================================================
import { EINSTELLUNGEN } from './einstellungen.js';

const E = () => EINSTELLUNGEN.zeitung || {};

// Daten "sauber machen": nur Zahlen, Texte, Ja/Nein (und kurze Listen davon).
// So kommt nie aus Versehen ein ganzes 3D-Modell in den Spielstand.
function sauber(daten) {
  const raus = {};
  for (const [k, w] of Object.entries(daten || {})) {
    if (['number', 'string', 'boolean'].includes(typeof w)) raus[k] = typeof w === 'string' ? w.slice(0, 60) : w;
    else if (Array.isArray(w)) raus[k] = w.slice(0, 12).filter((x) => ['number', 'string', 'boolean'].includes(typeof x));
  }
  return raus;
}

export class Ereignisse {
  constructor(tageszeit) {
    this.tageszeit = tageszeit; // daher wissen wir, welcher Tag gerade ist
    this.liste = []; // alle Zettel, der neueste ist hinten
    this.zaehler = 0; // jeder Zettel bekommt eine Nummer (1, 2, 3 …)
    this.beiNeuem = null; // optional: wird bei jedem neuen Ereignis gerufen
  }

  // Etwas ist passiert! → einen Zettel schreiben
  melde(typ, daten = {}) {
    if (!typ) return null;
    const e = { nr: ++this.zaehler, typ: String(typ), tag: this.tageszeit?.tag ?? 1, daten: sauber(daten) };
    this.liste.push(e);
    const max = E().maxEreignisse ?? 200;
    if (this.liste.length > max) this.liste.splice(0, this.liste.length - max); // die ältesten vergessen
    this.beiNeuem?.(e);
    return e;
  }

  // Alle Zettel ab diesem Tag (der Tag zählt mit)
  seit(tag = 0) {
    return this.liste.filter((e) => e.tag >= tag);
  }

  // Alle Zettel, die NACH Zettel Nummer "nr" kamen
  nachNummer(nr = 0) {
    return this.liste.filter((e) => e.nr > nr);
  }

  // Wie oft ist das schon passiert? (ab seitTag)
  zaehle(typ, seitTag = 0) {
    let n = 0;
    for (const e of this.liste) if (e.typ === typ && e.tag >= seitTag) n++;
    return n;
  }

  // Der letzte Zettel von diesem Typ (oder null)
  letztes(typ) {
    for (let i = this.liste.length - 1; i >= 0; i--) if (this.liste[i].typ === typ) return this.liste[i];
    return null;
  }

  // ---------- Speichern & Laden ----------
  alsDaten() {
    return { zaehler: this.zaehler, liste: this.liste.map((e) => ({ ...e, daten: { ...e.daten } })) };
  }

  ladeDaten(d = {}) {
    const liste = Array.isArray(d?.liste) ? d.liste : [];
    this.liste = liste
      .filter((e) => e && typeof e.typ === 'string')
      .map((e, i) => ({ nr: Number(e.nr) || i + 1, typ: e.typ, tag: Number(e.tag) || 1, daten: sauber(e.daten) }));
    const hoechste = this.liste.reduce((m, e) => Math.max(m, e.nr), 0);
    this.zaehler = Math.max(Number(d?.zaehler) || 0, hoechste);
  }
}

// =============================================================
//  verbindeEreignisse – hängt sich an die anderen Module an,
//  damit main.js fast nichts selbst melden muss.
//  Trick: Wir "wickeln" bestehende Funktionen ein. Die alte Funktion
//  läuft ganz normal weiter, und danach schreiben wir den Zettel.
//  WICHTIG: erst aufrufen, wenn main.js alle bei…-Funktionen gesetzt hat!
//  Nicht dabei (muss main.js selbst melden): 'baum' (in schwertSchlag).
// =============================================================
export function verbindeEreignisse(ereignisse, s = {}) {
  const melde = (typ, daten) => ereignisse.melde(typ, daten);
  // Eine "bei…"-Funktion erweitern, ohne die alte zu verlieren
  const dazu = (obj, name, wasNoch) => {
    if (!obj) return;
    const alt = obj[name];
    obj[name] = function (...a) {
      const r = typeof alt === 'function' ? alt.apply(this, a) : undefined;
      try { wasNoch(...a); } catch (f) { console.warn('Ereignis', name, f); }
      return r;
    };
  };

  // 🎣 Angeln: was hängt am Haken?
  const { angeln, rucksack } = s;
  if (angeln?.wurfFertig && rucksack) {
    const alt = angeln.wurfFertig;
    angeln.wurfFertig = function (...a) {
      const fund = this.wurf?.fund;
      const vorher = fund ? rucksack.anzahl(fund) : 0;
      const r = alt.apply(this, a);
      if (fund && rucksack.anzahl(fund) > vorher) melde(fund === 'tofufisch' ? 'fisch' : 'muell', { ding: fund });
      return r;
    };
  }

  // ⛏️ Graben: was wurde gefunden?
  const { objekte } = s;
  if (objekte?.graben && objekte.zufallsFund) {
    let letzterFund = null;
    const altFund = objekte.zufallsFund;
    objekte.zufallsFund = function (...a) {
      letzterFund = altFund.apply(this, a);
      return letzterFund;
    };
    const altGraben = objekte.graben;
    objekte.graben = function (stelle, ...rest) {
      letzterFund = null;
      const r = altGraben.call(this, stelle, ...rest);
      const fund = letzterFund;
      // Die Schaufel braucht kurz – danach ist die Stelle leer
      if (fund && this.beschaeftigt) setTimeout(() => stelle && !stelle.da && melde('grabung', { ding: fund }), 1000);
      return r;
    };
  }

  // 🐴 Pferde
  dazu(s.pferde, 'beiGezaehmt', () => melde('pferd-gezaehmt'));
  dazu(s.pferde, 'beiAusgerissen', () => melde('pferd-ausgerissen'));
  // 🏝️ Inseln, 🏅 Münzen, 🔴 Insadorium, 🎈 Ballon
  dazu(s.karte, 'beiInselEntdeckt', (name) => melde('insel-entdeckt', { name }));
  dazu(s.bewohner, 'beiMuenze', (n) => melde('muenze-gefunden', { anzahl: n }));
  dazu(s.tauchen, 'beimGefunden', () => melde('insadorium'));
  dazu(s.ballon, 'beiAnkunft', (ziel) => melde('ballon-flug', { ziel: ziel?.name || '' }));
  // 🍄 Zauberpilz: nur wenn man danach wirklich fliegt
  dazu(s.rucksack, 'beimBenutzen', (id) => id === 'zauberpilz' && s.spieler?.fliegt && melde('zauberpilz'));

  // 🏠 Base ausbauen und Pferdestall bauen
  const { base } = s;
  if (base?.ausbauen) {
    const alt = base.ausbauen;
    base.ausbauen = function (...a) {
      const vorher = this.stufe;
      const r = alt.apply(this, a);
      if (this.stufe > vorher) melde('base-ausbau', { stufe: this.stufe });
      return r;
    };
  }
  dazu(base, 'beiStallGebaut', (info) => !info?.geladen && melde('base-ausbau', { stall: true }));

  // 😫 Hunger und 🥱 nicht geschlafen (das merkt ueberleben.js jedes Bild)
  const { ueberleben } = s;
  if (ueberleben?.aktualisiere) {
    const alt = ueberleben.aktualisiere;
    ueberleben.aktualisiere = function (...a) {
      const warHungrig = this.hungrig;
      const tag = this.letzterTag, geschlafen = this.geschlafen;
      const geld = s.rucksack?.muenzen ?? 0;
      const r = alt.apply(this, a);
      if (!warHungrig && this.hungrig) melde('hunger');
      // Genau ein Tag weiter und NICHT geschlafen → eine wache Nacht
      if (this.letzterTag === tag + 1 && !geschlafen) melde('nicht-geschlafen', { strafe: Math.max(0, geld - (s.rucksack?.muenzen ?? geld)) });
      return r;
    };
  }
}
