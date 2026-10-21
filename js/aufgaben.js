// =============================================================
//  DAS AUFGABENBUCH 📋 (eine "Quest-Kette")
//  Zeigt immer den nächsten Schritt. Jeder Schritt baut auf dem
//  vorigen auf – so lernt man, wie alles im Spiel zusammenhängt.
//  Für jede geschaffte Aufgabe gibt es Münzen als Belohnung.
// =============================================================
import { knopf } from './steuerung.js';

// tipp = was man tun muss, geschafft = wann es erledigt ist
const AUFGABEN = [
  { titel: 'Finde die Schaufel', tipp: 'Sie liegt glitzernd neben dem Zelt.', geschafft: (s) => s.rucksack.hat('schaufel'), belohnung: 2 },
  { titel: 'Nimm die Schaufel in die Hand', tipp: 'Rucksack 🎒 öffnen und die Schaufel antippen.', geschafft: (s) => s.rucksack.inDerHand === 'schaufel', belohnung: 0 },
  { titel: 'Grab 3 Steine und 2 Eisenerz', tipp: 'An den glitzernden Erdhügeln graben. Am nächsten Morgen sind sie wieder voll.', geschafft: (s) => s.rucksack.anzahl('stein') >= 3 && s.rucksack.anzahl('eisenerz') >= 2, belohnung: 3 },
  { titel: 'Verkauf etwas beim Händler', tipp: 'Das Dorf 🏘️ ist auf der Karte 🗺️. Beim Händler „Handeln“ drücken, dann „💰 Verkaufen“. (Nachts schläft er!)', geschafft: (s) => s.aufgaben.gehandelt || Object.keys(s.haendler?.verkauftHeute || {}).length > 0, belohnung: 5 },
  { titel: 'Bau ein Schwert', tipp: 'An der Werkbank 🔨 neben dem Zelt: 2 Eisenerz + 3 Steine.', geschafft: (s) => s.rucksack.hat('schwert'), belohnung: 5 },
  { titel: 'Hack 4 Holz', tipp: 'Schwert in die Hand, vor einen Baum stellen und „Fällen“ drücken.', geschafft: (s) => s.rucksack.anzahl('holz') >= 4, belohnung: 3 },
  { titel: 'Bau eine Schnur', tipp: 'An der Werkbank: 2 Holz werden zu einer dünnen Schnur.', geschafft: (s) => s.rucksack.hat('schnur') || s.rucksack.hat('angel'), belohnung: 2 },
  { titel: 'Bau eine Angel', tipp: 'An der Werkbank: 2 Holz + 1 Schnur.', geschafft: (s) => s.rucksack.hat('angel'), belohnung: 5 },
  { titel: 'Besorg Würmer', tipp: 'Würmer findet man manchmal beim Graben – oder man kauft sie im Dorf.', geschafft: (s) => s.rucksack.hat('koeder'), belohnung: 2 },
  { titel: 'Angle einen Tofu-Fisch', tipp: 'Angel in die Hand und an eine Angelstelle 🎣 (auf der Karte 🗺️).', geschafft: (s) => s.rucksack.hat('tofufisch') || s.rucksack.hat('gegrillterFisch'), belohnung: 5 },
  { titel: 'Bau ein Feuerzeug', tipp: 'An der Werkbank: 2 Steine + 1 Eisenerz + 1 Kohle.', geschafft: (s) => s.rucksack.hat('feuerzeug') || s.lagerfeuer.brennt > 0, belohnung: 5 },
  { titel: 'Zünde das Lagerfeuer an', tipp: 'Am Lagerfeuer neben dem Zelt: 1 Holz + Feuerzeug.', geschafft: (s) => s.lagerfeuer.brennt > 0, belohnung: 3 },
  { titel: 'Grill den Tofu-Fisch', tipp: 'Wenn das Feuer brennt: „Fisch grillen“ drücken.', geschafft: (s) => s.rucksack.hat('gegrillterFisch') || s.aufgaben.fischGegessen, belohnung: 3 },
  { titel: 'Iss deinen selbst gefangenen Fisch', tipp: 'Rucksack öffnen, Fisch antippen, „Essen“. Jetzt versorgst du dich selbst! 🎉', geschafft: (s) => s.aufgaben.fischGegessen, belohnung: 10 },
  { titel: 'Bau das große Zelt', tipp: 'Am Schild „BASE“ neben dem Zelt das Base-Menü öffnen und ausbauen.', geschafft: (s) => (s.base?.stufe || 1) >= 2, belohnung: 10 },
  { titel: 'Bau eine Holzhütte', tipp: 'Wieder im Base-Menü. Die Hütte hat eine Truhe für deine Schätze!', geschafft: (s) => (s.base?.stufe || 1) >= 3, belohnung: 15 },
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
    if (Object.keys(this.spiel.haendler?.verkauftHeute || {}).length > 0) this.gehandelt = true;
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
    return { nummer: this.nummer, fischGegessen: this.fischGegessen, gehandelt: this.gehandelt, version: 2 };
  }

  ladeDaten(d) {
    let nummer = d.nummer || 0;
    // Alte Spielstände kannten die Händler-Aufgabe (Nummer 4) noch nicht
    if (!d.version && nummer >= 3) nummer++;
    this.nummer = Math.min(nummer, AUFGABEN.length);
    this.fischGegessen = !!d.fischGegessen;
    this.gehandelt = !!d.gehandelt || (!d.version && nummer > 3);
    this.zeichnen();
  }
}
