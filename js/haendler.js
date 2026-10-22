// =============================================================
//  DER HÄNDLER im Dorf – kaufen und verkaufen
//  Mit Münzen kauft man Sachen. Hat man keine Münzen mehr, verkauft
//  man, was man ausgegraben, gefangen oder gebaut hat.
//  Die Preise stehen in einstellungen.js – der Game Designer bestimmt sie!
// =============================================================
import { EINSTELLUNGEN } from './einstellungen.js';
import { DINGE } from './rucksack.js';
import { knopf } from './steuerung.js';
import { muenzeKlein } from './bilder.js';

// Es kann mehrere Händler geben (Dorf, Palmendorf …). Jeder hat seinen
// eigenen Namen, seine eigene Kauf-Liste und zählt selbst, wie viel er
// heute schon gekauft hat. Ohne "art" ist es der Händler aus dem ersten Dorf.
//   art = { name, bild, fensterId, kaufPreise, kauftProTag, gruss }
export class Haendler {
  constructor(spiel, art = {}) {
    this.spiel = spiel; // { rucksack, meldung, musik, tageszeit, elternElement }
    this.art = art;
    this.seite = 'kaufen';
    this.fenster = document.createElement('div');
    this.fenster.id = art.fensterId || 'haendler-fenster';
    this.fenster.className = 'spiel-fenster haendler-fenster';
    this.fenster.innerHTML = `
      <div class="fenster-kopf"><h2>${art.bild || '🧑‍🌾'} ${art.name || 'Händler'}</h2><div class="geld"></div><button class="zu" aria-label="Schließen">✕</button></div>
      <div class="reiter">
        <button class="reiter-knopf" data-seite="kaufen">🛒 Kaufen</button>
        <button class="reiter-knopf" data-seite="verkaufen">💰 Verkaufen</button>
      </div>
      <div class="waren"></div>
      <p class="haendler-info"></p>`;
    spiel.elternElement.appendChild(this.fenster);
    this.fenster.addEventListener('touchstart', (e) => e.stopPropagation());
    knopf(this.fenster.querySelector('.zu'), () => this.schliessen());
    this.fenster.querySelectorAll('.reiter-knopf').forEach((k) =>
      knopf(k, () => {
        this.seite = k.dataset.seite;
        this.zeichnen();
      })
    );
    this.offen = false;
    this.tag = null;
    this.verkauftHeute = {};
    this.heuteGekauft = 0;
  }

  // Was verkauft DIESER Händler? (Zahlen stehen in einstellungen.js)
  get kaufPreise() {
    return this.art.kaufPreise || EINSTELLUNGEN.kaufPreise;
  }

  // Wie viele Sachen kauft DIESER Händler an einem Tag?
  get kauftProTag() {
    return this.art.kauftProTag ?? EINSTELLUNGEN.haendlerKauftProTag;
  }

  oeffnen() {
    this.offen = true;
    this.info(this.art.gruss || '„Hallo, Forscher! Was darf es heute sein?“');
    this.zeichnen();
    this.fenster.classList.add('offen');
  }

  schliessen() {
    this.offen = false;
    this.fenster.classList.remove('offen');
  }

  info(text) {
    this.fenster.querySelector('.haendler-info').innerHTML = text;
  }

  // Ein grauer Knopf wurde angetippt
  gehtNicht() {
    this.spiel.musik.gehtNicht();
    if (this.seite === 'kaufen') this.info('„Dafür hast du nicht genug Münzen. Verkauf mir doch etwas!“');
  }

  zeichnen() {
    const { rucksack } = this.spiel;
    this.fenster.querySelector('.geld').innerHTML = `${muenzeKlein()} ${rucksack.muenzen}`;
    this.fenster.querySelectorAll('.reiter-knopf').forEach((k) => k.classList.toggle('aktiv', k.dataset.seite === this.seite));
    const liste = this.fenster.querySelector('.waren');
    liste.innerHTML = '';
    const zeile = (id, preisText, knoepfe) => {
      const ding = DINGE[id];
      const z = document.createElement('div');
      z.className = 'ware';
      z.innerHTML = `<div class="ware-bild">${ding.bild}</div><div class="ware-mitte"><b>${ding.name}</b><div class="ware-preis">${preisText}</div></div><div class="ware-knoepfe"></div>`;
      for (const [text, aktiv, wasPassiert] of knoepfe) {
        const k = document.createElement('button');
        k.className = 'fenster-knopf gelb';
        k.innerHTML = text; // innerHTML, damit die Münze als Bild erscheint
        // Nicht "disabled": Dann hört man beim Antippen den "Geht nicht"-Ton
        k.classList.toggle('gesperrt', !aktiv);
        if (!aktiv) k.style.background = '#cbbfae';
        knopf(k, () => (aktiv ? wasPassiert() : this.gehtNicht()));
        z.querySelector('.ware-knoepfe').appendChild(k);
      }
      liste.appendChild(z);
    };

    this.neuerTagPruefen();
    if (this.seite === 'kaufen') {
      for (const [id, preis] of Object.entries(this.kaufPreise)) {
        const ding = DINGE[id];
        // Rucksack-Upgrades nur zeigen, wenn sie noch etwas bringen
        if (ding.upgradePlaetze && rucksack.plaetze.length >= ding.upgradePlaetze) continue;
        // Sonder-Käufe (z. B. der Ballon): nur zeigen, wenn es sie gibt und man sie noch nicht hat
        if (ding.sonderKauf && (!this.sonderKauf?.[id] || this.sonderKauf[id].gekauft())) continue;
        zeile(id, `${preis} ${muenzeKlein()}`, [['Kaufen', rucksack.muenzen >= preis, () => this.kaufen(id, preis)]]);
      }
    } else {
      const rest = this.kauftProTag - this.heuteGekauft;
      const kopf = document.createElement('p');
      kopf.className = 'haendler-hinweis';
      kopf.textContent = rest > 0
        ? `Heute kaufe ich noch ${rest} Sachen. Je mehr du mir vom Gleichen bringst, desto weniger zahle ich.`
        : 'Für heute habe ich genug gekauft! Komm morgen wieder.';
      liste.appendChild(kopf);
      // Nur Dinge zeigen, die man hat und die der Händler annimmt
      const gezeigt = new Set();
      for (const p of rucksack.plaetze) {
        if (!p || !p.id || gezeigt.has(p.id)) continue;
        if (EINSTELLUNGEN.verkaufsPreise[p.id] === undefined) continue;
        gezeigt.add(p.id);
        const anzahl = rucksack.anzahl(p.id);
        const jetzt = this.preis(p.id);
        const maxStueck = Math.min(anzahl, rest);
        const summe = this.summe(p.id, maxStueck);
        zeile(p.id, `jetzt ${jetzt} ${muenzeKlein()} · du hast ${anzahl}`, [
          ['1 verkaufen', rest > 0, () => this.verkaufen(p.id, 1)],
          [`${maxStueck}× (${summe} ${muenzeKlein()})`, maxStueck > 1, () => this.verkaufen(p.id, maxStueck)],
        ]);
      }
      if (gezeigt.size === 0) {
        liste.insertAdjacentHTML('beforeend', '<p class="leer">Du hast nichts, was ich kaufen würde. Geh graben, angeln oder Holz hacken!</p>');
      }
    }
  }

  // ---------- Angebot & Nachfrage ----------
  // Jeden Morgen hat der Händler wieder Lust auf alles
  neuerTagPruefen() {
    const tag = this.spiel.tageszeit.tag;
    if (this.tag === tag) return;
    this.tag = tag;
    this.verkauftHeute = {};
    this.heuteGekauft = 0;
  }

  // Was zahlt der Händler JETZT für das nächste Stück?
  preis(id, schonVerkauft = this.verkauftHeute[id] || 0) {
    const grund = EINSTELLUNGEN.verkaufsPreise[id];
    return Math.max(1, Math.round(grund * Math.pow(EINSTELLUNGEN.preisNachlass, schonVerkauft)));
  }

  summe(id, anzahl) {
    let s = 0;
    const schon = this.verkauftHeute[id] || 0;
    for (let i = 0; i < anzahl; i++) s += this.preis(id, schon + i);
    return s;
  }

  kaufen(id, preis = this.kaufPreise[id]) {
    const { rucksack, musik } = this.spiel;
    if (this.kaufPreise[id] === undefined) return; // das verkauft dieser Händler nicht
    preis = this.kaufPreise[id];
    if (rucksack.muenzen < preis) {
      musik.gehtNicht();
      this.info('„Dafür hast du nicht genug Münzen. Verkauf mir doch etwas!“');
      return;
    }
    // Ein größerer Rucksack kommt nicht IN den Rucksack – er ERSETZT ihn
    // Sonder-Kauf (z. B. der Ballon): kommt nicht in den Rucksack, ein anderer Teil des Spiels kümmert sich
    const sonder = DINGE[id].sonderKauf && this.sonderKauf?.[id];
    if (DINGE[id].sonderKauf) {
      if (!sonder || sonder.gekauft()) return;
      rucksack.aendereMuenzen(-preis);
      musik.muenzen(Math.ceil(preis / 10));
      musik.kasse();
      this.info(sonder.kaufen());
      this.zeichnen();
      return;
    }
    const upgrade = DINGE[id].upgradePlaetze;
    if (upgrade) {
      rucksack.aendereMuenzen(-preis);
      rucksack.vergroessern(upgrade);
      musik.muenzen(Math.ceil(preis / 10)); // Münzen auf den Tisch legen …
      musik.kasse(); // … Ka-tsching!
      this.info(`„Bitte schön! Dein neuer Rucksack hat ${upgrade} Plätze.“`);
      this.zeichnen();
      return;
    }
    if (!rucksack.passt(id)) {
      musik.gehtNicht();
      this.info('„Dein Rucksack ist voll! Wirf etwas weg oder verkauf mir was.“');
      return;
    }
    rucksack.aendereMuenzen(-preis);
    rucksack.hinein(id);
    musik.muenzen(Math.ceil(preis / 10)); // Münzen auf den Tisch legen …
    musik.kasse(); // … Ka-tsching!
    this.info(`„Bitte schön: ${DINGE[id].bild} ${DINGE[id].name}!“`);
    this.zeichnen();
  }

  verkaufen(id, anzahl) {
    const { rucksack, musik } = this.spiel;
    this.neuerTagPruefen();
    anzahl = Math.min(anzahl, rucksack.anzahl(id), this.kauftProTag - this.heuteGekauft);
    if (anzahl <= 0) {
      musik.gehtNicht();
      this.info('„Für heute habe ich genug gekauft! Komm morgen wieder.“');
      return;
    }
    const betrag = this.summe(id, anzahl);
    rucksack.nehmen(id, anzahl);
    rucksack.aendereMuenzen(betrag);
    this.verkauftHeute[id] = (this.verkauftHeute[id] || 0) + anzahl;
    this.heuteGekauft += anzahl;
    musik.kasse(); // Ka-tsching …
    setTimeout(() => musik.muenzen(Math.ceil(betrag / 5)), 250); // … und die Münzen klimpern zu dir
    this.info(`„Danke! Hier sind ${betrag} Münzen.“`);
    this.zeichnen();
  }

  alsDaten() {
    return { tag: this.tag, verkauftHeute: this.verkauftHeute, heuteGekauft: this.heuteGekauft };
  }

  ladeDaten(d) {
    this.tag = d.tag;
    this.verkauftHeute = d.verkauftHeute || {};
    this.heuteGekauft = d.heuteGekauft || 0;
  }
}
