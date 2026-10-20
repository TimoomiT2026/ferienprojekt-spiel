// =============================================================
//  DER HÄNDLER im Dorf – kaufen und verkaufen
//  Mit Münzen kauft man Sachen. Hat man keine Münzen mehr, verkauft
//  man, was man ausgegraben, gefangen oder gebaut hat.
//  Die Preise stehen in einstellungen.js – der Game Designer bestimmt sie!
// =============================================================
import { EINSTELLUNGEN } from './einstellungen.js';
import { DINGE } from './rucksack.js';
import { knopf } from './steuerung.js';

export class Haendler {
  constructor(spiel) {
    this.spiel = spiel; // { rucksack, meldung, musik, elternElement }
    this.seite = 'kaufen';
    this.fenster = document.createElement('div');
    this.fenster.id = 'haendler-fenster';
    this.fenster.className = 'spiel-fenster';
    this.fenster.innerHTML = `
      <div class="fenster-kopf"><h2>🧑‍🌾 Händler</h2><div class="geld"></div><button class="zu" aria-label="Schließen">✕</button></div>
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
  }

  oeffnen() {
    this.offen = true;
    this.info('„Hallo, Forscher! Was darf es heute sein?“');
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

  zeichnen() {
    const { rucksack } = this.spiel;
    this.fenster.querySelector('.geld').textContent = `🪙 ${rucksack.muenzen}`;
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
        k.textContent = text;
        k.disabled = !aktiv;
        knopf(k, () => aktiv && wasPassiert());
        z.querySelector('.ware-knoepfe').appendChild(k);
      }
      liste.appendChild(z);
    };

    if (this.seite === 'kaufen') {
      for (const [id, preis] of Object.entries(EINSTELLUNGEN.kaufPreise)) {
        zeile(id, `${preis} 🪙`, [['Kaufen', rucksack.muenzen >= preis, () => this.kaufen(id, preis)]]);
      }
    } else {
      // Nur Dinge zeigen, die man hat und die der Händler annimmt
      const gezeigt = new Set();
      for (const p of rucksack.plaetze) {
        if (!p || gezeigt.has(p.id)) continue;
        const preis = EINSTELLUNGEN.verkaufsPreise[p.id];
        if (preis === undefined) continue;
        gezeigt.add(p.id);
        const anzahl = rucksack.anzahl(p.id);
        zeile(p.id, `${preis} 🪙 pro Stück · du hast ${anzahl}`, [
          ['1 verkaufen', true, () => this.verkaufen(p.id, 1, preis)],
          [`Alle (${anzahl * preis} 🪙)`, anzahl > 1, () => this.verkaufen(p.id, anzahl, preis)],
        ]);
      }
      if (gezeigt.size === 0) {
        liste.innerHTML = '<p class="leer">Du hast nichts, was ich kaufen würde. Geh graben, angeln oder Holz hacken!</p>';
      }
    }
  }

  kaufen(id, preis) {
    const { rucksack, musik } = this.spiel;
    if (rucksack.muenzen < preis) {
      this.info('„Dafür hast du nicht genug Münzen. Verkauf mir doch etwas!“');
      return;
    }
    if (!rucksack.passt(id)) {
      this.info('„Dein Rucksack ist voll! Wirf etwas weg oder verkauf mir was.“');
      return;
    }
    rucksack.aendereMuenzen(-preis);
    rucksack.hinein(id);
    musik.pling();
    this.info(`„Bitte schön: ${DINGE[id].bild} ${DINGE[id].name}!“`);
    this.zeichnen();
  }

  verkaufen(id, anzahl, preis) {
    const { rucksack, musik } = this.spiel;
    rucksack.nehmen(id, anzahl);
    rucksack.aendereMuenzen(anzahl * preis);
    musik.pling();
    this.info(`„Danke! Hier sind ${anzahl * preis} Münzen.“`);
    this.zeichnen();
  }
}
