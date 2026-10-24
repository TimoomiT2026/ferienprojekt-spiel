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
    // Wochenmarkt: Kaffee ☕ = eine Nacht ohne Schlaf zählt nicht (wartet, bis man sie braucht)
    this.kaffee = 0;
    // Nacht-Limo 🍋 = die helle Nacht zählt nicht als "nicht geschlafen" (nur diese eine Nacht)
    this.limo = false;
    this.letzterTag = spiel.tageszeit.tag;
    this.letzteZeit = this.spielZeit();
    this.anzeige = document.getElementById('hunger-anzeige');
    // Kleines Schild unter der Uhr: Kaffee-Bonus ☕ oder Nacht-Limo 🍋
    this.bonusFeld = document.createElement('div');
    this.bonusFeld.id = 'bonus-anzeige';
    document.getElementById('uhr')?.after(this.bonusFeld);
    this.bonusText = null;
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
    this.hungerZeit = 0;
    this.gewarnt = this.satt <= EINSTELLUNGEN.hungerWarnung;
    this.spiel.meldung(warHungrig ? '😋 Mmh! Der Hunger ist weg, du bist wieder schnell.' : '😋 Mmh, lecker!', 4);
    this.zeichnen();
  }

  // Nach der Ohnmacht: wieder halb satt, und der Zeitsprung zählt nicht zum Hungern
  nachOhnmacht() {
    this.satt = 50;
    this.hungerZeit = 0;
    this.letzteZeit = this.spielZeit();
    this.gewarnt = false;
    this.zeichnen();
  }

  // Wird beim Schlafen aufgerufen, BEVOR der neue Tag beginnt
  schlaeftJetzt() {
    this.geschlafen = true;
  }

  // Kaffee getrunken. Gibt false zurück, wenn man schon genug Kaffee intus hat.
  kaffeeGetrunken() {
    if (this.kaffee >= (EINSTELLUNGEN.markt?.kaffeeHoechstens ?? 1)) return false;
    this.kaffee++;
    return true;
  }

  // Nacht-Limo getrunken: Die nächste Nacht zählt nicht als "nicht geschlafen"
  limoGetrunken() {
    this.limo = true;
  }

  // Jedes Bild: Satt-Balken leeren und prüfen, ob ein neuer Tag angefangen hat
  aktualisiere() {
    const { tageszeit, rucksack, meldung, spieler } = this.spiel;
    const t = tageszeit;

    // Essen: der Balken wird langsam leer
    const jetzt = this.spielZeit();
    let vergangen = Math.max(0, jetzt - this.letzteZeit);
    this.letzteZeit = jetzt;
    if (vergangen > 0) {
      // Gerade geschlafen (die Nacht ist vorbeigesprungen)? Im großen Zelt wird man langsamer hungrig
      if (vergangen > 5 && this.geschlafen && this.schlafFaktor) vergangen *= this.schlafFaktor();
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
      // Zu lange nichts gegessen? Dann wird man ohnmächtig (main.js bringt einen heim)
      if (this.hungrig) {
        this.hungerZeit = (this.hungerZeit || 0) + vergangen;
        if (this.hungerZeit >= tagLaenge * EINSTELLUNGEN.ohnmachtNachTagen && this.beiOhnmacht?.()) this.hungerZeit = 0;
      } else this.hungerZeit = 0;
    }

    if (t.tag !== this.letzterTag) {
      this.letzterTag = t.tag;
      // Schlafen
      // Wach geblieben, aber mit Nacht-Limo oder Kaffee? Dann zählt die Nacht nicht.
      let zaehltNicht = false;
      if (!this.geschlafen && this.limo) {
        zaehltNicht = true;
        setTimeout(() => meldung('🍋 Was für eine helle Nacht! Du bist gar nicht müde.', 6), 4500);
      } else if (!this.geschlafen && this.kaffee > 0) {
        zaehltNicht = true;
        this.kaffee--;
        setTimeout(() => meldung('☕ Dank Kaffee warst du die ganze Nacht wach – und bist gar nicht müde!', 6), 4500);
      }
      this.limo = false; // die Limo wirkt nur eine Nacht
      if (this.geschlafen) this.naechteWach = 0;
      else if (!zaehltNicht) this.naechteWach++;
      this.geschlafen = false;
      if (zaehltNicht) {
        // nichts passiert – keine Müdigkeit
      } else if (this.naechteWach >= EINSTELLUNGEN.naechteOhneSchlaf) {
        const verlust = Math.min(rucksack.muenzen, EINSTELLUNGEN.schlafStrafe);
        rucksack.aendereMuenzen(-verlust);
        this.naechteWach = 0;
        setTimeout(() => meldung(`🥱 Du hast ${EINSTELLUNGEN.naechteOhneSchlaf} Nächte nicht geschlafen und vor Müdigkeit ${verlust} Münzen verloren!`, 6), 4500);
      } else if (this.naechteWach === EINSTELLUNGEN.naechteOhneSchlaf - 1) {
        setTimeout(() => meldung('🥱 Du hast heute Nacht nicht geschlafen. Schlaf nächste Nacht, sonst verlierst du Münzen!', 6), 4500);
      }
    }
    spieler.tempoFaktor = this.hungrig ? EINSTELLUNGEN.hungerTempo : 1;
    this.zeigeBonus();
  }

  // Kaffee oder Limo getrunken? Dann sieht man es unter der Uhr – nachts mit Restzeit
  zeigeBonus() {
    const t = this.spiel.tageszeit;
    const rest = Math.ceil(t.restSekunden());
    const uhr = `${Math.floor(rest / 60)}:${String(rest % 60).padStart(2, '0')}`;
    let text = '';
    if (this.limo) text = t.istNacht() ? `🍋 Helle Nacht – noch ${uhr}` : '🍋 Limo: Die nächste Nacht wird hell';
    else if (this.kaffee > 0) text = t.istNacht() && !this.geschlafen ? `☕ Kaffee wirkt – du bleibst wach, noch ${uhr}` : `☕ Kaffee-Bonus: 1 Nacht ohne Schlaf`;
    if (text === this.bonusText || !this.bonusFeld) return;
    this.bonusText = text;
    this.bonusFeld.textContent = text;
    this.bonusFeld.classList.toggle('sichtbar', !!text);
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
    return { satt: this.satt, naechteWach: this.naechteWach, kaffee: this.kaffee, limo: this.limo, hungerZeit: this.hungerZeit || 0 };
  }

  ladeDaten(d) {
    // Alte Spielstände kannten nur "hungrig" und "gegessenHeute"
    if (typeof d.satt === 'number') this.satt = d.satt;
    else this.satt = d.hungrig ? 0 : d.gegessenHeute ? 100 : 50;
    this.naechteWach = d.naechteWach || 0;
    this.kaffee = d.kaffee || 0; // alte Spielstände: kein Kaffee
    this.limo = !!d.limo;
    this.hungerZeit = d.hungerZeit || 0;
    this.gewarnt = this.satt <= EINSTELLUNGEN.hungerWarnung;
    this.letzterTag = this.spiel.tageszeit.tag;
    this.letzteZeit = this.spielZeit();
    this.zeichnen();
  }
}
