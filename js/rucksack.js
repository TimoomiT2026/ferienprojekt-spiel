// =============================================================
//  DER RUCKSACK (Inventar) – was hat man alles dabei?
// =============================================================
import { EINSTELLUNGEN } from './einstellungen.js';
import { knopf } from './steuerung.js';

// Die Schaufel malen wir selbst (das Schaufel-Emoji kennen nicht alle Geräte)
export const SCHAUFEL_BILD = `<svg class="svg-bild" viewBox="0 0 64 64" aria-hidden="true">
  <rect x="29" y="6" width="6" height="34" rx="3" fill="#a0703c"/>
  <rect x="22" y="3" width="20" height="7" rx="3.5" fill="#333"/>
  <path d="M20 38 h24 v8 a12 12 0 0 1 -24 0 z" fill="#b9c2cc" stroke="#7d8894" stroke-width="2"/>
</svg>`;

// Alle Dinge, die es im Spiel gibt
export const DINGE = {
  schaufel: { name: 'Schaufel', bild: SCHAUFEL_BILD, werkzeug: true, text: 'Damit kannst du an Grabestellen graben.' },
  stein: { name: 'Stein', bild: '🪨', text: 'Ein ganz normaler Stein. Kann man im Dorf verkaufen.' },
  kohle: { name: 'Kohle', bild: '⚫', text: 'Schwarz und staubig. Brennt gut!' },
  eisenerz: { name: 'Eisenerz', bild: '🔩', text: 'Daraus kann man Eisen machen.' },
  gold: { name: 'Goldnugget', bild: '🟡', text: 'Glänzt! Das ist bestimmt viel wert.' },
  edelstein: { name: 'Edelstein', bild: '💎', text: 'Super selten! Du hast Glück gehabt.' },
  schwert: { name: 'Schwert', bild: '🗡️', werkzeug: true, text: 'Selbst gebaut! Damit bist du nachts nicht wehrlos.' },
};

export class Rucksack {
  constructor(meldung) {
    this.plaetze = new Array(EINSTELLUNGEN.rucksackPlaetze).fill(null); // { id, anzahl }
    this.inDerHand = null;
    this.meldung = meldung;
    this.fenster = document.getElementById('rucksack-fenster');
    this.raster = document.getElementById('rucksack-raster');
    this.info = document.getElementById('rucksack-info');
    this.handAnzeige = document.getElementById('hand-anzeige');
    this.offen = false;
    this.beiAenderung = () => {};
  }

  // Legt etwas in den Rucksack. Gibt false zurück, wenn kein Platz mehr ist.
  hinein(id, anzahl = 1) {
    const ding = DINGE[id];
    if (!ding.werkzeug) {
      const stapel = this.plaetze.find((p) => p && p.id === id && p.anzahl < EINSTELLUNGEN.stapelGroesse);
      if (stapel) {
        stapel.anzahl += anzahl;
        this.zeichnen();
        return true;
      }
    }
    const frei = this.plaetze.indexOf(null);
    if (frei === -1) return false;
    this.plaetze[frei] = { id, anzahl };
    this.zeichnen();
    return true;
  }

  // Wie viele hat man davon?
  anzahl(id) {
    return this.plaetze.reduce((summe, p) => summe + (p && p.id === id ? p.anzahl : 0), 0);
  }

  // Nimmt Dinge aus dem Rucksack heraus
  nehmen(id, anzahl) {
    for (let i = this.plaetze.length - 1; i >= 0 && anzahl > 0; i--) {
      const p = this.plaetze[i];
      if (!p || p.id !== id) continue;
      const weg = Math.min(p.anzahl, anzahl);
      p.anzahl -= weg;
      anzahl -= weg;
      if (p.anzahl === 0) this.plaetze[i] = null;
    }
    this.zeichnen();
  }

  hat(id) {
    return this.plaetze.some((p) => p && p.id === id);
  }

  istVoll() {
    return !this.plaetze.includes(null);
  }

  oeffnen() {
    this.offen = true;
    this.info.textContent = 'Tippe etwas an!';
    this.zeichnen();
    this.fenster.classList.add('offen');
  }

  schliessen() {
    this.offen = false;
    this.fenster.classList.remove('offen');
  }

  // Ein Platz wurde angetippt
  antippen(index) {
    const platz = this.plaetze[index];
    if (!platz) {
      this.info.textContent = 'Dieser Platz ist noch leer.';
      return;
    }
    const ding = DINGE[platz.id];
    if (ding.werkzeug) {
      if (this.inDerHand === platz.id) {
        this.inDerHand = null;
        this.info.innerHTML = `${ding.bild} ${ding.name} wieder eingepackt.`;
      } else {
        this.inDerHand = platz.id;
        this.info.innerHTML = `${ding.bild} ${ding.name} ist jetzt in deiner Hand! ${ding.text}`;
      }
      this.beiAenderung();
    } else {
      this.info.innerHTML = `${ding.bild} ${ding.name} (${platz.anzahl}×): ${ding.text}`;
    }
    this.zeichnen();
  }

  zeichnen() {
    this.raster.innerHTML = '';
    this.plaetze.forEach((platz, i) => {
      const feld = document.createElement('button');
      feld.className = 'platz';
      if (platz) {
        const ding = DINGE[platz.id];
        feld.innerHTML = `<span class="bild">${ding.bild}</span>` +
          (platz.anzahl > 1 ? `<span class="anzahl">${platz.anzahl}</span>` : '') +
          (this.inDerHand === platz.id ? '<span class="hand">✋</span>' : '');
        if (this.inDerHand === platz.id) feld.classList.add('gewaehlt');
      }
      knopf(feld, () => this.antippen(i));
      this.raster.appendChild(feld);
    });
    const hand = this.inDerHand ? DINGE[this.inDerHand] : null;
    this.handAnzeige.innerHTML = hand ? hand.bild : '';
    this.handAnzeige.classList.toggle('sichtbar', !!hand);
  }
}
