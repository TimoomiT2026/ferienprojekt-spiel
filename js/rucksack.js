// =============================================================
//  DER RUCKSACK (Inventar) – was hat man alles dabei?
//  Gleiche Dinge liegen auf einem Platz übereinander ("Stapel").
//  Antippen = auswählen. Dann kann man es benutzen, essen oder wegwerfen.
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
//   werkzeug: kann man in die Hand nehmen
//   essen:    kann man essen (zählt als Mahlzeit)
export const DINGE = {
  schaufel: { name: 'Schaufel', bild: SCHAUFEL_BILD, werkzeug: true, text: 'Damit kannst du an Grabestellen graben.' },
  schwert: { name: 'Schwert', bild: '🗡️', werkzeug: true, text: 'Damit kannst du Bäume und Büsche fällen. Nutzt sich ab!' },
  angel: { name: 'Angel', bild: '🎣', werkzeug: true, text: 'Stell dich an eine Angelstelle. Du brauchst Würmer als Köder.' },
  feuerzeug: { name: 'Feuerzeug', bild: '🔥', text: 'Damit zündest du das Lagerfeuer an. Hält 3 Mal.' },
  stein: { name: 'Stein', bild: '🪨', text: 'Ein ganz normaler Stein. Kann man im Dorf verkaufen.' },
  kohle: { name: 'Kohle', bild: '⚫', text: 'Schwarz und staubig. Brennt gut!' },
  eisenerz: { name: 'Eisenerz', bild: '🔩', text: 'Daraus kann man Eisen machen.' },
  gold: { name: 'Goldnugget', bild: '🟡', text: 'Glänzt! Das ist bestimmt viel wert.' },
  edelstein: { name: 'Edelstein', bild: '💎', text: 'Super selten! Du hast Glück gehabt.' },
  holz: { name: 'Holz', bild: '🪵', text: 'Fürs Lagerfeuer oder zum Bauen.' },
  brot: { name: 'Brot', bild: '🍞', essen: true, text: 'Eine Mahlzeit für einen Tag.' },
  koeder: { name: 'Würmer', bild: '🪱', text: 'Köder zum Angeln. Findet man beim Graben oder beim Händler.' },
  schnur: { name: 'Schnur', bild: '🧵', text: 'Aus dünnem Holz gebunden. Damit baust du eine Angel.' },
  tofufisch: { name: 'Tofu-Fisch', bild: '🐟', text: 'Roh schmeckt er nicht. Grill ihn am Lagerfeuer!' },
  gegrillterFisch: { name: 'Gegrillter Tofu-Fisch', bild: '<span class="gegrillt">🐟</span>', essen: true, text: 'Lecker! Eine Mahlzeit für einen Tag.' },
  schuh: { name: 'Alter Schuh', bild: '👞', text: 'Igitt, nass. Den willst du nicht anziehen.' },
  dose: { name: 'Alte Dose', bild: '🥫', text: 'Müll aus dem Meer. Wirf ihn lieber weg.' },
  alge: { name: 'Alge', bild: '🌿', text: 'Glitschig und grün.' },
};

const haltbarkeit = (id) => (EINSTELLUNGEN.haltbarkeit || {})[id] || 0;

export class Rucksack {
  constructor(meldung) {
    this.plaetze = new Array(EINSTELLUNGEN.rucksackPlaetze).fill(null); // { id, anzahl, rest }
    this.inDerHand = null;
    this.gewaehlt = -1;
    this.muenzen = EINSTELLUNGEN.startGeld;
    this.meldung = meldung;
    this.fenster = document.getElementById('rucksack-fenster');
    this.raster = document.getElementById('rucksack-raster');
    this.info = document.getElementById('rucksack-info');
    this.knoepfe = document.getElementById('rucksack-knoepfe');
    this.handAnzeige = document.getElementById('hand-anzeige');
    this.muenzAnzeige = document.getElementById('muenzen');
    this.offen = false;
    this.beiAenderung = () => {}; // wenn sich ändert, was man in der Hand hat
    this.beimEssen = () => {}; // wenn man etwas isst
  }

  // ---------- Münzen ----------
  aendereMuenzen(betrag) {
    this.muenzen = Math.max(0, this.muenzen + betrag);
    if (this.muenzAnzeige) {
      this.muenzAnzeige.textContent = this.muenzen;
      this.muenzAnzeige.parentElement.classList.remove('wackeln');
      void this.muenzAnzeige.offsetWidth; // Trick: Animation neu starten
      this.muenzAnzeige.parentElement.classList.add('wackeln');
    }
  }

  // Legt etwas in den Rucksack. Gibt false zurück, wenn kein Platz mehr ist.
  hinein(id, anzahl = 1) {
    // Erst schauen, ob es schon einen Stapel davon gibt
    let rest = anzahl;
    for (const p of this.plaetze) {
      if (rest <= 0) break;
      if (p && p.id === id && p.anzahl < EINSTELLUNGEN.stapelGroesse) {
        const dazu = Math.min(rest, EINSTELLUNGEN.stapelGroesse - p.anzahl);
        p.anzahl += dazu;
        rest -= dazu;
      }
    }
    while (rest > 0) {
      const frei = this.plaetze.indexOf(null);
      if (frei === -1) {
        this.zeichnen();
        return rest < anzahl; // zumindest ein Teil hat gepasst?
      }
      const dazu = Math.min(rest, EINSTELLUNGEN.stapelGroesse);
      this.plaetze[frei] = { id, anzahl: dazu, rest: haltbarkeit(id) };
      rest -= dazu;
    }
    this.zeichnen();
    return true;
  }

  // Passt das noch rein?
  passt(id, anzahl = 1) {
    let frei = 0;
    for (const p of this.plaetze) {
      if (!p) frei += EINSTELLUNGEN.stapelGroesse;
      else if (p.id === id) frei += EINSTELLUNGEN.stapelGroesse - p.anzahl;
    }
    return frei >= anzahl;
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
    if (this.inDerHand && !this.hat(this.inDerHand)) {
      this.inDerHand = null;
      this.beiAenderung();
    }
    this.zeichnen();
  }

  // Einmal benutzen (Schwert, Feuerzeug). Gibt true zurück, wenn eins kaputt/leer ging.
  verbrauche(id) {
    const p = this.plaetze.find((pl) => pl && pl.id === id);
    if (!p || !haltbarkeit(id)) return false;
    p.rest--;
    if (p.rest > 0) {
      this.zeichnen();
      return false;
    }
    p.rest = haltbarkeit(id);
    this.nehmen(id, 1);
    return true;
  }

  hat(id) {
    return this.plaetze.some((p) => p && p.id === id);
  }

  istVoll() {
    return !this.plaetze.includes(null);
  }

  oeffnen() {
    this.offen = true;
    this.gewaehlt = -1;
    this.zeichnen();
    this.fenster.classList.add('offen');
  }

  schliessen() {
    this.offen = false;
    this.fenster.classList.remove('offen');
  }

  // Ein Platz wurde angetippt: auswählen (Werkzeuge kommen gleich in die Hand)
  antippen(index) {
    this.gewaehlt = index;
    const platz = this.plaetze[index];
    if (platz && DINGE[platz.id].werkzeug) this.handUmschalten(platz.id);
    this.zeichnen();
  }

  handUmschalten(id) {
    this.inDerHand = this.inDerHand === id ? null : id;
    this.beiAenderung();
    this.zeichnen();
  }

  essen(id) {
    this.nehmen(id, 1);
    this.beimEssen(id);
    this.zeichnen();
  }

  wegwerfen(index, alle) {
    const p = this.plaetze[index];
    if (!p) return;
    const ding = DINGE[p.id];
    this.nehmen(p.id, alle ? p.anzahl : 1);
    this.meldung(`${ding.bild} ${alle ? 'Alles' : 'Eins'} weggeworfen.`, 2);
  }

  zeichnen() {
    this.raster.innerHTML = '';
    this.plaetze.forEach((platz, i) => {
      const feld = document.createElement('button');
      feld.className = 'platz';
      if (platz) {
        const ding = DINGE[platz.id];
        const h = haltbarkeit(platz.id);
        feld.innerHTML = `<span class="bild">${ding.bild}</span>` +
          (platz.anzahl > 1 ? `<span class="anzahl">${platz.anzahl}</span>` : '') +
          (this.inDerHand === platz.id ? '<span class="hand">✋</span>' : '') +
          (h ? `<span class="haltbar"><span style="width:${(platz.rest / h) * 100}%"></span></span>` : '');
        if (this.inDerHand === platz.id) feld.classList.add('gewaehlt');
      }
      if (i === this.gewaehlt) feld.classList.add('ausgewaehlt');
      knopf(feld, () => this.antippen(i));
      this.raster.appendChild(feld);
    });
    this.zeichneInfo();
    const hand = this.inDerHand ? DINGE[this.inDerHand] : null;
    this.handAnzeige.innerHTML = hand ? hand.bild : '';
    this.handAnzeige.classList.toggle('sichtbar', !!hand);
  }

  // Unten im Fenster: was ist ausgewählt, und was kann man damit machen?
  zeichneInfo() {
    if (!this.info) return;
    this.knoepfe.innerHTML = '';
    const platz = this.plaetze[this.gewaehlt];
    if (!platz) {
      this.info.textContent = this.gewaehlt >= 0 ? 'Dieser Platz ist noch leer.' : 'Tippe etwas an!';
      return;
    }
    const ding = DINGE[platz.id];
    const h = haltbarkeit(platz.id);
    this.info.innerHTML = `${ding.bild} <b>${ding.name}</b> (${platz.anzahl}×)${h ? ` · noch ${platz.rest}× benutzbar` : ''}: ${ding.text}`;
    const neuerKnopf = (text, klasse, wasPassiert) => {
      const k = document.createElement('button');
      k.className = `fenster-knopf ${klasse}`;
      k.innerHTML = text;
      knopf(k, wasPassiert);
      this.knoepfe.appendChild(k);
    };
    if (ding.werkzeug) {
      neuerKnopf(this.inDerHand === platz.id ? '✋ Einpacken' : '✋ In die Hand', 'gelb', () => this.handUmschalten(platz.id));
    }
    if (ding.essen) neuerKnopf('😋 Essen', 'gruen', () => this.essen(platz.id));
    neuerKnopf('🗑️ 1 wegwerfen', 'rot', () => this.wegwerfen(this.gewaehlt, false));
    if (platz.anzahl > 1) neuerKnopf('🗑️ Alle', 'rot', () => this.wegwerfen(this.gewaehlt, true));
  }

  // ---------- Speichern & Laden ----------
  alsDaten() {
    return { plaetze: this.plaetze, inDerHand: this.inDerHand, muenzen: this.muenzen };
  }

  ladeDaten(d) {
    this.plaetze = new Array(EINSTELLUNGEN.rucksackPlaetze).fill(null);
    (d.plaetze || []).forEach((p, i) => {
      if (p && DINGE[p.id] && i < this.plaetze.length) this.plaetze[i] = p;
    });
    this.inDerHand = d.inDerHand && this.hat(d.inDerHand) ? d.inDerHand : null;
    this.muenzen = d.muenzen ?? EINSTELLUNGEN.startGeld;
    if (this.muenzAnzeige) this.muenzAnzeige.textContent = this.muenzen;
    this.beiAenderung();
    this.zeichnen();
  }
}
