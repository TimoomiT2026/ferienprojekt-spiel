// =============================================================
//  ÜBERLEBEN – Essen und Schlafen
//  • Einmal am Tag muss man essen. Sonst hat man am nächsten Tag
//    Hunger und läuft nur noch halb so schnell, bis man etwas isst.
//  • Spätestens jede zweite Nacht muss man schlafen. Sonst ist man
//    so müde, dass man 50 Münzen verliert (verschlafen, verloren …).
// =============================================================
import { EINSTELLUNGEN } from './einstellungen.js';

export class Ueberleben {
  constructor(spiel) {
    this.spiel = spiel; // { rucksack, spieler, meldung, tageszeit }
    this.gegessenHeute = false;
    this.hungrig = false;
    this.naechteWach = 0;
    this.geschlafen = false;
    this.letzterTag = spiel.tageszeit.tag;
    this.anzeige = document.getElementById('hunger-anzeige');
    this.zeichnen();
  }

  gegessen() {
    this.gegessenHeute = true;
    const warHungrig = this.hungrig;
    this.hungrig = false;
    this.spiel.meldung(warHungrig ? '😋 Mmh! Der Hunger ist weg, du bist wieder schnell.' : '😋 Mmh, lecker! Für heute bist du satt.', 4);
    this.zeichnen();
  }

  // Wird beim Schlafen aufgerufen, BEVOR der neue Tag beginnt
  schlaeftJetzt() {
    this.geschlafen = true;
  }

  // Jedes Bild: Hat ein neuer Tag angefangen?
  aktualisiere() {
    const { tageszeit, rucksack, meldung, spieler } = this.spiel;
    if (tageszeit.tag !== this.letzterTag) {
      this.letzterTag = tageszeit.tag;
      // Essen: Wer gestern nichts gegessen hat, hat jetzt Hunger
      if (!this.gegessenHeute) this.hungrig = true;
      this.gegessenHeute = false;
      // Schlafen
      if (this.geschlafen) this.naechteWach = 0;
      else this.naechteWach++;
      this.geschlafen = false;
      if (this.naechteWach >= EINSTELLUNGEN.naechteOhneSchlaf) {
        const verlust = Math.min(rucksack.muenzen, EINSTELLUNGEN.schlafStrafe);
        rucksack.aendereMuenzen(-verlust);
        this.naechteWach = 0;
        setTimeout(() => meldung(`🥱 Du hast ${EINSTELLUNGEN.naechteOhneSchlaf} Nächte nicht geschlafen und vor Müdigkeit ${verlust} Münzen verloren!`, 6), 4500);
      } else if (this.naechteWach === EINSTELLUNGEN.naechteOhneSchlaf - 1) {
        setTimeout(() => meldung('🥱 Du hast heute Nacht nicht geschlafen. Schlaf nächste Nacht, sonst verlierst du Münzen!', 6), 4500);
      }
      if (this.hungrig) setTimeout(() => meldung('😫 Du hast Hunger! Iss Brot oder einen gegrillten Tofu-Fisch.', 6), 9000);
      this.zeichnen();
    }
    spieler.tempoFaktor = this.hungrig ? EINSTELLUNGEN.hungerTempo : 1;
  }

  zeichnen() {
    if (!this.anzeige) return;
    this.anzeige.classList.toggle('hunger', this.hungrig);
    this.anzeige.textContent = this.hungrig ? '😫 Hunger!' : this.gegessenHeute ? '🍞 satt' : '🍽️ heute noch nichts gegessen';
  }

  alsDaten() {
    return { gegessenHeute: this.gegessenHeute, hungrig: this.hungrig, naechteWach: this.naechteWach };
  }

  ladeDaten(d) {
    Object.assign(this, { gegessenHeute: !!d.gegessenHeute, hungrig: !!d.hungrig, naechteWach: d.naechteWach || 0 });
    this.letzterTag = this.spiel.tageszeit.tag;
    this.zeichnen();
  }
}
