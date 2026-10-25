// =============================================================
//  DER KLEIDERSCHRANK 👕 – Pulli und Hose kostenlos wechseln
//  Gibt es ab Base-Stufe 3 (Holzhütte) im Base-Menü.
//  Welche Farben es gibt, steht in einstellungen.js unter "kleidung".
// =============================================================
import { EINSTELLUNGEN } from './einstellungen.js';
import { kleidungAnziehen } from './junge.js';
import { knopf } from './steuerung.js';

const K = () => EINSTELLUNGEN.kleidung;

export class Kleidung {
  constructor(spiel) {
    this.spiel = spiel; // { spieler, meldung, musik, elternElement }
    this.pulli = 0; // Nummer in der Liste
    this.hose = 0;
    this.offen = false;
    this.fenster = document.createElement('div');
    this.fenster.id = 'kleidung-fenster';
    this.fenster.className = 'spiel-fenster';
    this.fenster.innerHTML = `
      <div class="fenster-kopf"><h2>👕 Kleiderschrank</h2><button class="zu" aria-label="Schließen">✕</button></div>
      <p class="kleidung-info">Tipp an, was du anziehen willst – kostet nichts!</p>
      <h3 class="base-ueberschrift">Pulli</h3><div class="kleidung-reihe pullis"></div>
      <h3 class="base-ueberschrift">Hose</h3><div class="kleidung-reihe hosen"></div>`;
    spiel.elternElement.appendChild(this.fenster);
    this.fenster.addEventListener('touchstart', (e) => e.stopPropagation());
    knopf(this.fenster.querySelector('.zu'), () => this.schliessen());
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

  // Jede Auswahl ist ein kleines Stoff-Muster zum Antippen
  zeichnen() {
    const reihe = (klasse, liste, aktuell, muster, waehle) => {
      const r = this.fenster.querySelector(klasse);
      r.innerHTML = '';
      liste.forEach((k, i) => {
        const b = document.createElement('button');
        b.className = 'kleidung-wahl' + (i === aktuell ? ' gewaehlt' : '');
        b.innerHTML = `<span class="kleidung-muster" style="background:${muster(k)}"></span><span class="kleidung-name">${k.name}</span>`;
        knopf(b, () => waehle(i));
        r.appendChild(b);
      });
    };
    reihe('.pullis', K().pullis, this.pulli,
      (k) => `repeating-linear-gradient(0deg, ${k.shirt} 0 8px, ${k.shirt2 || k.shirt} 8px 16px)`,
      (i) => this.anziehen({ pulli: i }));
    reihe('.hosen', K().hosen, this.hose,
      (k) => k.hosenStreifen ? `linear-gradient(90deg, ${k.hose} 0 42%, ${k.hosenStreifen} 42% 50%, ${k.hosenStreifen2 || k.hosenStreifen} 50% 58%, ${k.hose} 58%)` : k.hose,
      (i) => this.anziehen({ hose: i }));
  }

  // Neue Sachen anziehen (und gleich auf der Figur zeigen)
  anziehen({ pulli = this.pulli, hose = this.hose } = {}, leise = false) {
    this.pulli = Math.min(pulli, K().pullis.length - 1);
    this.hose = Math.min(hose, K().hosen.length - 1);
    const p = K().pullis[this.pulli], h = K().hosen[this.hose];
    kleidungAnziehen(this.spiel.spieler.materialien, {
      shirt: p.shirt, shirt2: p.shirt2 ?? null,
      hose: h.hose, hosenStreifen: h.hosenStreifen ?? null, hosenStreifen2: h.hosenStreifen2 ?? null,
    });
    if (leise) return;
    this.spiel.musik?.pling?.();
    this.spiel.meldung?.(`👕 Schick! ${p.name} und ${h.name}.`, 3);
    if (this.offen) this.zeichnen();
  }

  alsDaten() {
    return { pulli: this.pulli, hose: this.hose };
  }

  ladeDaten(d = {}) {
    this.anziehen({ pulli: d.pulli ?? 0, hose: d.hose ?? 0 }, true);
  }
}

