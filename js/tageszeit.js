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
    // Nacht-Limo 🍋 (Wochenmarkt): Ist sie getrunken, wird DIESE (oder die nächste) Nacht taghell.
    this.helleNacht = false;
    this.helleNachtWert = 0; // 0 = normale Nacht, 1 = ganz hell (wird weich überblendet, himmel.js liest das)
  }

  // Nacht-Limo getrunken: Die Nacht wird hell (bis zum Morgen)
  starteHelleNacht() {
    this.helleNacht = true;
  }

  // Wo steht die Zaubersonne in der hellen Nacht? (wie sonnenWinkel)
  zauberSonnenWinkel() {
    return (EINSTELLUNGEN.markt?.limo?.sonnenHoehe ?? 0.42) * Math.PI;
  }

  // Weich hell werden – und kurz vor Sonnenaufgang langsam wieder normal
  helleNachtBlenden(dt) {
    const L = EINSTELLUNGEN.markt?.limo || {};
    let ziel = this.helleNacht && this.istNacht() ? 1 : 0;
    if (ziel) ziel = Math.min(1, this.restSekunden() / (L.auslaufSekunden ?? 20));
    const schritt = dt / (L.uebergangSekunden ?? 4);
    this.helleNachtWert += Math.max(-schritt, Math.min(schritt, ziel - this.helleNachtWert));
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
      this.helleNacht = false; // am Morgen ist die Limo-Wirkung vorbei
    }
    this.helleNachtBlenden(dt);
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
    this.helleNacht = false;
    this.helleNachtWert = 0;
  }

  // Für den Spielstand (alte Spielstände kennen "helleNacht" noch nicht)
  alsDaten() {
    return { zeit: this.zeit, tag: this.tag, helleNacht: this.helleNacht };
  }

  ladeDaten(d = {}) {
    this.zeit = d.zeit ?? 0;
    this.tag = d.tag ?? 1;
    this.helleNacht = !!d.helleNacht;
    this.helleNachtWert = this.helleNacht && this.istNacht() ? 1 : 0;
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
