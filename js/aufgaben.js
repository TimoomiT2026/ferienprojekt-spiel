// =============================================================
//  DAS AUFGABENBUCH 📋 (eine "Quest-Kette")
//  Zeigt immer den nächsten Schritt. Jeder Schritt baut auf dem
//  vorigen auf – so lernt man, wie alles im Spiel zusammenhängt.
//  Für jede geschaffte Aufgabe gibt es Münzen als Belohnung.
// =============================================================
import { knopf } from './steuerung.js';

// tipp = was man tun muss, geschafft = wann es erledigt ist
const AUFGABEN = [
  { titel: 'Finde die Schaufel', tipp: 'Sie liegt glitzernd neben dem Zelt.', geschafft: (s) => s.rucksack.hat('schaufel'), belohnung: 5 },
  { titel: 'Nimm die Schaufel in die Hand', tipp: 'Rucksack 🎒 öffnen und die Schaufel antippen.', geschafft: (s) => s.rucksack.inDerHand === 'schaufel', belohnung: 0 },
  { titel: 'Grab 3 Steine und 2 Eisenerz', tipp: 'An den glitzernden Erdhügeln graben. Am nächsten Morgen sind sie wieder voll.', geschafft: (s) => s.rucksack.anzahl('stein') >= 3 && s.rucksack.anzahl('eisenerz') >= 2, belohnung: 10 },
  { titel: 'Bau ein Schwert', tipp: 'An der Werkbank 🔨 neben dem Zelt: 2 Eisenerz + 3 Steine.', geschafft: (s) => s.rucksack.hat('schwert'), belohnung: 10 },
  { titel: 'Hack 4 Holz', tipp: 'Schwert in die Hand, vor einen Baum stellen und „Fällen“ drücken.', geschafft: (s) => s.rucksack.anzahl('holz') >= 4, belohnung: 10 },
  { titel: 'Bau eine Schnur', tipp: 'An der Werkbank: 2 Holz werden zu einer dünnen Schnur.', geschafft: (s) => s.rucksack.hat('schnur') || s.rucksack.hat('angel'), belohnung: 5 },
  { titel: 'Bau eine Angel', tipp: 'An der Werkbank: 2 Holz + 1 Schnur.', geschafft: (s) => s.rucksack.hat('angel'), belohnung: 10 },
  { titel: 'Besorg Würmer', tipp: 'Würmer findet man manchmal beim Graben – oder man kauft sie im Dorf.', geschafft: (s) => s.rucksack.hat('koeder'), belohnung: 5 },
  { titel: 'Angle einen Tofu-Fisch', tipp: 'Angel in die Hand und an eine Angelstelle 🎣 (auf der Karte 🗺️).', geschafft: (s) => s.rucksack.hat('tofufisch') || s.rucksack.hat('gegrillterFisch'), belohnung: 10 },
  { titel: 'Bau ein Feuerzeug', tipp: 'An der Werkbank: 2 Steine + 1 Eisenerz + 1 Kohle.', geschafft: (s) => s.rucksack.hat('feuerzeug') || s.lagerfeuer.brennt > 0, belohnung: 10 },
  { titel: 'Zünde das Lagerfeuer an', tipp: 'Am Lagerfeuer neben dem Zelt: 1 Holz + Feuerzeug.', geschafft: (s) => s.lagerfeuer.brennt > 0, belohnung: 5 },
  { titel: 'Grill den Tofu-Fisch', tipp: 'Wenn das Feuer brennt: „Fisch grillen“ drücken.', geschafft: (s) => s.rucksack.hat('gegrillterFisch') || s.aufgaben.fischGegessen, belohnung: 5 },
  { titel: 'Iss deinen selbst gefangenen Fisch', tipp: 'Rucksack öffnen, Fisch antippen, „Essen“. Jetzt versorgst du dich selbst! 🎉', geschafft: (s) => s.aufgaben.fischGegessen, belohnung: 20 },
  { titel: 'Spar 150 Münzen', tipp: 'Verkauf, was du findest. Bald brauchst du viel Geld für das große Abenteuer …', geschafft: (s) => s.rucksack.muenzen >= 150, belohnung: 25 },
];

export class Aufgaben {
  constructor(spiel) {
    this.spiel = spiel; // { rucksack, lagerfeuer, meldung, musik, elternElement }
    this.spiel.aufgaben = this;
    this.nummer = 0;
    this.fischGegessen = false;
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
    this.zeichnen();
  }

  // Für Ereignisse, die man nicht im Rucksack sieht
  gegessen(id) {
    if (id === 'gegrillterFisch') this.fischGegessen = true;
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
  }

  zeichnen() {
    const jetzt = AUFGABEN[this.nummer];
    this.anzeige.textContent = jetzt ? `📋 ${jetzt.titel}` : '🏆 Alle Aufgaben geschafft!';
    const liste = this.fenster.querySelector('.aufgaben-liste');
    liste.innerHTML = AUFGABEN.map((a, i) => {
      const zustand = i < this.nummer ? 'fertig' : i === this.nummer ? 'jetzt' : 'spaeter';
      const zeichen = zustand === 'fertig' ? '✅' : zustand === 'jetzt' ? '👉' : '🔒';
      const tipp = zustand === 'jetzt' ? `<div class="aufgabe-tipp">${a.tipp}</div>` : '';
      const belohnung = a.belohnung ? `<span class="aufgabe-lohn">+${a.belohnung} 🪙</span>` : '';
      const titel = zustand === 'spaeter' ? '???' : a.titel;
      return `<li class="aufgabe ${zustand}"><span class="aufgabe-zeichen">${zeichen}</span><div><b>${titel}</b>${tipp}</div>${belohnung}</li>`;
    }).join('');
  }

  alsDaten() {
    return { nummer: this.nummer, fischGegessen: this.fischGegessen };
  }

  ladeDaten(d) {
    this.nummer = Math.min(d.nummer || 0, AUFGABEN.length);
    this.fischGegessen = !!d.fischGegessen;
    this.zeichnen();
  }
}
