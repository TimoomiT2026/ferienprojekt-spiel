// =============================================================
//  TAG & NACHT – die Uhr des Spiels
//  Ein ganzer Tag im Spiel = Tag-Minuten + Nacht-Minuten
//  (steht in einstellungen.js)
// =============================================================
import { EINSTELLUNGEN } from './einstellungen.js';

export class Tageszeit {
  constructor() {
    this.zeit = 0; // Sekunden seit Sonnenaufgang
    this.tag = 1;
  }

  get tagSekunden() {
    return EINSTELLUNGEN.tagMinuten * 60;
  }

  get nachtSekunden() {
    return EINSTELLUNGEN.nachtMinuten * 60;
  }

  aktualisiere(dt) {
    this.zeit += dt;
    if (this.zeit >= this.tagSekunden + this.nachtSekunden) {
      this.zeit = 0;
      this.tag++;
    }
  }

  istNacht() {
    return this.zeit >= this.tagSekunden;
  }

  // Wie viele Sekunden noch, bis es wechselt?
  restSekunden() {
    return this.istNacht() ? this.tagSekunden + this.nachtSekunden - this.zeit : this.tagSekunden - this.zeit;
  }

  // Schlafen: direkt zum nächsten Morgen
  schlafen() {
    this.zeit = 0;
    this.tag++;
  }

  // Wo steht die Sonne? Winkel in Bogenmaß: 0 = Osten, PI/2 = ganz oben, PI = Westen
  sonnenWinkel() {
    if (!this.istNacht()) {
      return 0.06 * Math.PI + (this.zeit / this.tagSekunden) * 0.88 * Math.PI;
    }
    const nacht = (this.zeit - this.tagSekunden) / this.nachtSekunden;
    return 0.94 * Math.PI + nacht * 1.12 * Math.PI;
  }
}
