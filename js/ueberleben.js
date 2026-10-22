// =============================================================
//  ÜBERLEBEN – Essen und Schlafen
//  • Der Satt-Balken (0 bis 100) wird mit der Zeit leer – in einem
//    ganzen Tag. Auch beim Schlafen läuft er weiter! Ist er leer,
//    hat man Hunger und läuft nur noch halb so schnell.
//  • Spätestens jede zweite Nacht muss man schlafen. Sonst ist man
//    so müde, dass man 50 Münzen verliert (verschlafen, verloren …).
// =============================================================
import { EINSTELLUNGEN } from './einstellungen.js';
import { uiBild } from './ui-bilder.js';

export class Ueberleben {
  constructor(spiel) {
    this.spiel = spiel; // { rucksack, spieler, meldung, tageszeit }
    this.satt = 100; // am Anfang hat man gerade gefrühstückt
    this.gewarnt = false;
    this.naechteWach = 0;
    this.geschlafen = false;
    this.letzterTag = spiel.tageszeit.tag;
    this.letzteZeit = this.spielZeit();
    this.anzeige = document.getElementById('hunger-anzeige');
    this.zeichnen();
  }

  get hungrig() {
    return this.satt <= 0;
  }

  // Wie viele Sekunden sind seit Spielbeginn vergangen? (Schlafen springt nach vorn)
  spielZeit() {
    const t = this.spiel.tageszeit;
    return (t.tag - 1) * (t.tagSekunden + t.nachtSekunden) + t.zeit;
  }

  gegessen(id) {
    const warHungrig = this.hungrig;
    this.satt = Math.min(100, this.satt + (EINSTELLUNGEN.sattVon[id] ?? 50));
    this.gewarnt = this.satt <= EINSTELLUNGEN.hungerWarnung;
    this.spiel.meldung(warHungrig ? '😋 Mmh! Der Hunger ist weg, du bist wieder schnell.' : '😋 Mmh, lecker!', 4);
    this.zeichnen();
  }

  // Wird beim Schlafen aufgerufen, BEVOR der neue Tag beginnt
  schlaeftJetzt() {
    this.geschlafen = true;
  }

  // Jedes Bild: Satt-Balken leeren und prüfen, ob ein neuer Tag angefangen hat
  aktualisiere() {
    const { tageszeit, rucksack, meldung, spieler } = this.spiel;
    const t = tageszeit;

    // Essen: der Balken wird langsam leer
    const jetzt = this.spielZeit();
    const vergangen = Math.max(0, jetzt - this.letzteZeit);
    this.letzteZeit = jetzt;
    if (vergangen > 0) {
      const warHungrig = this.hungrig;
      const tagLaenge = (t.tagSekunden + t.nachtSekunden) * EINSTELLUNGEN.sattTage;
      const alt = Math.ceil(this.satt);
      this.satt = Math.max(0, this.satt - (vergangen / tagLaenge) * 100);
      if (!warHungrig && this.hungrig) {
        setTimeout(() => meldung('😫 Du hast Hunger! Iss Brot oder einen gegrillten Tofu-Fisch.', 6), vergangen > 5 ? 9000 : 0);
      } else if (!this.gewarnt && this.satt <= EINSTELLUNGEN.hungerWarnung && this.satt > 0) {
        this.gewarnt = true;
        meldung('🍽️ Dein Bauch knurrt. Iss bald etwas!', 5);
      }
      if (Math.ceil(this.satt) !== alt) this.zeichnen();
    }

    if (t.tag !== this.letzterTag) {
      this.letzterTag = t.tag;
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
    }
    spieler.tempoFaktor = this.hungrig ? EINSTELLUNGEN.hungerTempo : 1;
  }

  zeichnen() {
    if (!this.anzeige) return;
    const wert = Math.ceil(this.satt);
    this.anzeige.classList.toggle('hunger', this.hungrig);
    this.anzeige.classList.toggle('knurrt', !this.hungrig && wert <= EINSTELLUNGEN.hungerWarnung);
    // Brot-Bild aus ui-bilder.js; bei wenig Essen färbt sich der Balken orange (Klasse "knurrt")
    this.anzeige.innerHTML = this.hungrig
      ? `${uiBild('brot')} Hunger!`
      : `${uiBild('brot')} <span class="satt-balken"><span style="width:${wert}%"></span></span>`;
  }

  alsDaten() {
    return { satt: this.satt, naechteWach: this.naechteWach };
  }

  ladeDaten(d) {
    // Alte Spielstände kannten nur "hungrig" und "gegessenHeute"
    if (typeof d.satt === 'number') this.satt = d.satt;
    else this.satt = d.hungrig ? 0 : d.gegessenHeute ? 100 : 50;
    this.naechteWach = d.naechteWach || 0;
    this.gewarnt = this.satt <= EINSTELLUNGEN.hungerWarnung;
    this.letzterTag = this.spiel.tageszeit.tag;
    this.letzteZeit = this.spielZeit();
    this.zeichnen();
  }
}
