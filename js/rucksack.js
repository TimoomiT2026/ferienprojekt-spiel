// =============================================================
//  DER RUCKSACK (Inventar) – was hat man alles dabei?
//  Gleiche Dinge liegen auf einem Platz übereinander ("Stapel").
//  Antippen = auswählen. Dann kann man es benutzen, essen oder wegwerfen.
// =============================================================
import { EINSTELLUNGEN } from './einstellungen.js';
import { knopf } from './steuerung.js';
import { BILDER } from './bilder.js';

// Diese drei Bilder benutzen auch andere Teile des Spiels (z. B. der Graben-Knopf)
export const SCHAUFEL_BILD = BILDER.schaufel;
export const SEILKANONE_BILD = BILDER.seilkanone;
export const WERTVOLLE_MUENZE_BILD = BILDER.wertvolleMuenze;

// Alle Dinge, die es im Spiel gibt
//   werkzeug: kann man in die Hand nehmen
//   essen:    kann man essen (zählt als Mahlzeit)
export const DINGE = {
  schaufel: { name: 'Schaufel', bild: BILDER.schaufel, werkzeug: true, text: 'Damit kannst du an Grabestellen graben.' },
  schwert: { name: 'Schwert', bild: BILDER.schwert, werkzeug: true, text: 'Damit kannst du Bäume und Büsche fällen. Nutzt sich ab!' },
  angel: { name: 'Angel', bild: BILDER.angel, werkzeug: true, text: 'Stell dich an eine Angelstelle. Du brauchst Würmer als Köder.' },
  feuerzeug: { name: 'Feuerzeug', bild: BILDER.feuerzeug, text: 'Damit zündest du das Lagerfeuer an. Hält 3 Mal.' },
  stein: { name: 'Stein', bild: BILDER.stein, text: 'Ein ganz normaler Stein. Kann man im Dorf verkaufen.' },
  kohle: { name: 'Kohle', bild: BILDER.kohle, text: 'Schwarz und staubig. Brennt gut!' },
  eisenerz: { name: 'Eisenerz', bild: BILDER.eisenerz, text: 'Daraus kann man Eisen machen.' },
  gold: { name: 'Goldnugget', bild: BILDER.gold, text: 'Glänzt! Das ist bestimmt viel wert.' },
  edelstein: { name: 'Edelstein', bild: BILDER.edelstein, text: 'Super selten! Du hast Glück gehabt.' },
  holz: { name: 'Holz', bild: BILDER.holz, text: 'Fürs Lagerfeuer oder zum Bauen.' },
  brot: { name: 'Brot', bild: BILDER.brot, essen: true, text: 'Eine Mahlzeit für einen Tag.' },
  koeder: { name: 'Würmer', bild: BILDER.koeder, text: 'Köder zum Angeln. Findet man beim Graben oder beim Händler.' },
  schnur: { name: 'Schnur', bild: BILDER.schnur, text: 'Aus dünnem Holz gebunden. Damit baust du eine Angel.' },
  tofufisch: { name: 'Tofu-Fisch', bild: BILDER.tofufisch, text: 'Roh schmeckt er nicht. Grill ihn am Lagerfeuer!' },
  gegrillterFisch: { name: 'Gegrillter Tofu-Fisch', bild: BILDER.gegrillterFisch, essen: true, text: 'Lecker! Eine Mahlzeit für einen Tag.' },
  schuh: { name: 'Alter Schuh', bild: BILDER.schuh, text: 'Igitt, nass. Den willst du nicht anziehen.' },
  dose: { name: 'Alte Dose', bild: BILDER.dose, text: 'Müll aus dem Meer. Wirf ihn lieber weg.' },
  alge: { name: 'Alge', bild: BILDER.alge, text: 'Glitschig und grün.' },
  // Funde von der Palmeninsel (Etappe 3) – nur zum Verkaufen
  muschel: { name: 'Muschel', bild: BILDER.muschel, artikel: 'eine', text: 'Eine schöne Muschel vom Strand der Palmeninsel. Kann man verkaufen.' },
  kokosnuss: { name: 'Kokosnuss', bild: BILDER.kokosnuss, artikel: 'eine', text: 'Hart wie ein Stein! Essen kann man sie nicht – aber verkaufen.' },
  karotte: { name: 'Karotte', bild: BILDER.karotte, essen: true, werkzeug: true, text: 'Aus deinem Garten! Eine Mahlzeit – oder Futter für dein Pferd (in die Hand nehmen).' },
  apfel: { name: 'Apfel', bild: BILDER.apfel, werkzeug: true, text: 'Pferde lieben Äpfel! Nimm einen in die Hand und geh zu einem Wildpferd.' },
  leine: { name: 'Leine', bild: BILDER.leine, werkzeug: true, artikel: 'eine', text: 'Aus dem Leder vom alten Schuh. In die Hand nehmen, dann kannst du dein Pferd führen und am Stall anbinden.' },
  zauberpilz: { name: 'Zauberpilz', bild: BILDER.zauberpilz, zauber: true, text: 'Selten! Essen = 1 Minute fliegen. Oder teuer verkaufen.' },
  fernrohr: { name: 'Fernrohr', bild: BILDER.fernrohr, werkzeug: true, text: 'Damit schaust du ganz weit. Vielleicht siehst du andere Inseln?' },
  seil: { name: 'Seil', bild: BILDER.seil, artikel: 'ein', text: 'Ein starkes Seil aus 3 Schnüren. Jeder Schuss mit der Seilkanone braucht eins.' },
  widerhaken: { name: 'Widerhaken', bild: BILDER.widerhaken, artikel: 'einen', text: 'Ein Haken aus Eisen, der sich überall festkrallt. Für die Seilkanone.' },
  seilkanone: { name: 'Seilkanone', bild: BILDER.seilkanone, werkzeug: true, artikel: 'eine', text: 'In die Hand nehmen, vor eine hohe Wand stellen und hochschießen! Jeder Schuss braucht 1 Seil.' },
  // wichtig: kann man nicht wegwerfen. Nicht verkaufbar (steht nicht in den verkaufsPreisen).
  wertvolleMuenze: { name: 'Wertvolle Münze', bild: BILDER.wertvolleMuenze, artikel: 'eine', wichtig: true, text: 'Eine uralte, goldene Münze! Bring 3 davon zum Inselbewohner mit der Taucherbrille auf der Palmeninsel.' },
  taucherbrille: { name: 'Taucherbrille', bild: BILDER.taucherbrille, artikel: 'eine', text: 'Damit kannst du tauchen! Geh an tiefes Wasser. Die Luft reicht aber nicht lange.' },
  insadorium: { name: 'Insadorium', bild: BILDER.insadorium, text: 'DAS INSADORIUM! Der geheime rote Stein. Er leuchtet so grell, dass man fast nicht hinschauen kann.' },
  reisezelt: { name: 'Reisezelt', bild: BILDER.reisezelt, plaetze: 3, text: 'Dein Zelt zum Mitnehmen. Stell es irgendwo auf und schlaf dort. Braucht 3 Plätze!' },
  // Diese beiden kommen nicht IN den Rucksack – sie ERSETZEN ihn
  rucksackGross: { name: 'Großer Rucksack', bild: BILDER.rucksackGross, upgradePlaetze: 18, text: '18 Plätze statt 12.' },
  rucksackRiesig: { name: 'Riesen-Rucksack', bild: BILDER.rucksackRiesig, upgradePlaetze: 24, text: '24 Plätze!' },
  // Der Ballon kommt auch nicht in den Rucksack – er steht dann an der Base (siehe ballon.js)
  ballon: { name: 'Heißluftballon', bild: BILDER.ballon, sonderKauf: true, text: 'Damit fliegst du ganz schnell ins Dorf!' },
  // Vom Wochenmarkt im Palmendorf (Etappe 4) – trinken: true = Knopf "Trinken" im Rucksack
  kaffee: { name: 'Kaffee', bild: BILDER.kaffee, trinken: true, text: 'Luxus! Trinken = eine Nacht ohne Schlaf zählt nicht. Du bleibst hellwach.' },
  nachtLimo: { name: 'Nacht-Limo', bild: BILDER.nachtLimo, trinken: true, artikel: 'eine', text: 'Luxus! Trinken = diese Nacht (oder die nächste) wird taghell – und zählt nicht als „nicht geschlafen“.' },
};

const haltbarkeit = (id) => (EINSTELLUNGEN.haltbarkeit || {})[id] || 0;
// Wie viele Plätze braucht ein Ding? (Fast alles 1, das Reisezelt 3)
const groesse = (id) => DINGE[id].plaetze || 1;

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
    this.beimBenutzen = () => {}; // wenn man ein Zauberding benutzt (z. B. Zauberpilz)
    // wenn man etwas trinkt (Kaffee, Nacht-Limo). Gibt er false zurück, bleibt das Getränk im Rucksack.
    this.beimTrinken = () => true;
    // Andere Teile des Spiels können eigene Knöpfe anbieten, z. B. "Reisezelt aufstellen"
    // Rückgabe: Liste von [Text, Funktion]
    this.extraKnoepfe = () => [];
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
    // Große Dinge (z. B. das Reisezelt) brauchen mehrere freie Plätze und stapeln nicht
    if (groesse(id) > 1) {
      for (let n = 0; n < anzahl; n++) {
        const frei = this.plaetze.map((p, i) => (p ? -1 : i)).filter((i) => i >= 0);
        if (frei.length < groesse(id)) {
          this.zeichnen();
          return n > 0;
        }
        this.plaetze[frei[0]] = { id, anzahl: 1, rest: haltbarkeit(id) };
        for (let k = 1; k < groesse(id); k++) this.plaetze[frei[k]] = { block: id };
      }
      this.zeichnen();
      return true;
    }
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
    if (groesse(id) > 1) return this.plaetze.filter((p) => !p).length >= groesse(id) * anzahl;
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
      if (p.anzahl === 0) {
        this.plaetze[i] = null;
        // Bei großen Dingen auch die mitbelegten Plätze frei machen
        for (let k = 1; k < groesse(id); k++) {
          const b = this.plaetze.findIndex((pl) => pl && pl.block === id);
          if (b >= 0) this.plaetze[b] = null;
        }
      }
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

  // Größerer Rucksack: mehr Plätze, alles darin bleibt
  vergroessern(plaetze) {
    while (this.plaetze.length < plaetze) this.plaetze.push(null);
    this.zeichnen();
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
    // Mitbelegter Platz (z. B. vom Reisezelt)? Dann das Ding selbst auswählen
    const block = this.plaetze[index] && this.plaetze[index].block;
    if (block) index = this.plaetze.findIndex((p) => p && p.id === block);
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

  // Zauberdinge (Pilz): nicht satt, aber etwas Besonderes passiert
  benutzen(id) {
    this.nehmen(id, 1);
    this.beimBenutzen(id);
    this.schliessen();
  }

  // Trinken (Kaffee, Nacht-Limo): erst fragen, ob es gerade geht – dann ist es weg
  trinken(id) {
    if (this.beimTrinken(id) === false) return;
    this.nehmen(id, 1);
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
    if (ding.wichtig) {
      this.meldung(`${ding.bild} Die ist viel zu wertvoll zum Wegwerfen!`, 3);
      return;
    }
    this.nehmen(p.id, alle ? p.anzahl : 1);
    this.meldung(`${ding.bild} ${alle ? 'Alles' : 'Eins'} weggeworfen.`, 2);
  }

  zeichnen() {
    this.raster.innerHTML = '';
    this.plaetze.forEach((platz, i) => {
      const feld = document.createElement('button');
      feld.className = 'platz';
      if (platz && platz.block) {
        feld.innerHTML = `<span class="bild blass">${DINGE[platz.block].bild}</span>`;
        feld.classList.add('mitbelegt');
      } else if (platz) {
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
    if (ding.zauber) neuerKnopf('✨ Essen', 'blau', () => this.benutzen(platz.id));
    if (ding.trinken) neuerKnopf('🥤 Trinken', 'gruen', () => this.trinken(platz.id));
    for (const [text, wasPassiert] of this.extraKnoepfe(platz.id)) neuerKnopf(text, 'blau', wasPassiert);
    if (ding.wichtig) return; // Wichtige Dinge kann man nicht wegwerfen
    neuerKnopf('🗑️ 1 wegwerfen', 'rot', () => this.wegwerfen(this.gewaehlt, false));
    if (platz.anzahl > 1) neuerKnopf('🗑️ Alle', 'rot', () => this.wegwerfen(this.gewaehlt, true));
  }

  // ---------- Speichern & Laden ----------
  alsDaten() {
    return { plaetze: this.plaetze, inDerHand: this.inDerHand, muenzen: this.muenzen };
  }

  ladeDaten(d) {
    const anzahl = Math.max(EINSTELLUNGEN.rucksackPlaetze, (d.plaetze || []).length);
    this.plaetze = new Array(anzahl).fill(null);
    (d.plaetze || []).forEach((p, i) => {
      if (p && (DINGE[p.id] || (p.block && DINGE[p.block]))) this.plaetze[i] = p;
    });
    this.inDerHand = d.inDerHand && this.hat(d.inDerHand) ? d.inDerHand : null;
    this.muenzen = d.muenzen ?? EINSTELLUNGEN.startGeld;
    if (this.muenzAnzeige) this.muenzAnzeige.textContent = this.muenzen;
    this.beiAenderung();
    this.zeichnen();
  }
}
