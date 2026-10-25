// =============================================================
//  STEUERUNG – Touch (iPad) und Tastatur (Mac)
//  iPad: linke Bildschirmhälfte = Joystick, rechte Hälfte wischen = Kamera drehen
//  Mac:  WASD oder Pfeiltasten = laufen, Leertaste = springen, Maus ziehen = Kamera
//        (Beim Fliegen: Sprungknopf / Leertaste FESTHALTEN = höher fliegen)
//        E = Aktion (aufheben, graben, schlafen), I = Rucksack
// =============================================================

// Macht aus einem Element einen Knopf, der auf dem iPad sofort reagiert
// Liegt der Finger in einem Fenster (Werkbank, Händler, Rucksack …)?
// Dort soll man wischen und scrollen können, statt die Kamera zu drehen.
function imFenster(e) {
  return !!e.target?.closest?.('.spiel-fenster, [id$="-fenster"], #prolog-karte');
}

export function knopf(element, wasPassiert) {
  let letzterTouch = 0;
  let start = null; // wo der Finger aufgesetzt hat (nur bei Knöpfen in Fenstern)
  element.addEventListener('touchstart', (e) => {
    e.stopPropagation();
    // In Fenstern (Rucksack, Werkbank …) erst beim LOSLASSEN drücken –
    // sonst könnte man dort nie scrollen, weil überall Knöpfe sind.
    if (element.closest('.spiel-fenster, [id$="-fenster"], #prolog-karte')) {
      const t = e.changedTouches[0];
      start = { x: t.clientX, y: t.clientY };
      return;
    }
    e.preventDefault();
    letzterTouch = performance.now();
    wasPassiert();
  }, { passive: false });
  element.addEventListener('touchmove', (e) => {
    if (!start) return;
    const t = e.changedTouches[0];
    if (Math.hypot(t.clientX - start.x, t.clientY - start.y) > 10) start = null; // gewischt = kein Tippen
  });
  element.addEventListener('touchend', (e) => {
    if (!start) return;
    start = null;
    e.preventDefault(); // kein extra "Klick" hinterher
    e.stopPropagation();
    letzterTouch = performance.now();
    wasPassiert();
  }, { passive: false });
  element.addEventListener('touchcancel', () => (start = null));
  element.addEventListener('click', (e) => {
    e.stopPropagation();
    // Manche Geräte schicken nach dem Tippen noch einen "Klick" hinterher – nicht doppelt zählen
    if (performance.now() - letzterTouch < 800) return;
    wasPassiert();
  });
  element.addEventListener('mousedown', (e) => e.stopPropagation());
}

export class Steuerung {
  constructor(element) {
    this.richtung = { x: 0, y: 0 }; // x = rechts/links, y = vor/zurück
    this.kameraDrehung = 0; // wie weit die Kamera seit dem letzten Bild gedreht wurde
    this.kameraNeigung = 0;
    this.springen = false;
    this.sprungGehalten = false; // wird der Sprungknopf gerade festgehalten? (fürs Fliegen)
    this.aktion = false;
    this.rucksack = false;
    this.tasten = new Set();

    this.joystickFinger = null;
    this.kameraFinger = null;
    this.joystickStart = { x: 0, y: 0 };
    this.joystickRadius = 60;

    this.joystickBasis = document.getElementById('joystick');
    this.joystickKnopf = document.getElementById('joystick-knopf');
    const sprungKnopf = document.getElementById('sprung-knopf');

    element.addEventListener('touchstart', (e) => this.fingerRunter(e), { passive: false });
    element.addEventListener('touchmove', (e) => this.fingerBewegt(e), { passive: false });
    element.addEventListener('touchend', (e) => this.fingerHoch(e));
    element.addEventListener('touchcancel', (e) => this.fingerHoch(e));

    knopf(sprungKnopf, () => (this.springen = true));
    // Festhalten merken: Finger drauf = gehalten, Finger weg = losgelassen
    sprungKnopf.addEventListener('touchstart', () => (this.sprungGehalten = true));
    sprungKnopf.addEventListener('touchend', () => (this.sprungGehalten = false));
    sprungKnopf.addEventListener('touchcancel', () => (this.sprungGehalten = false));
    sprungKnopf.addEventListener('mousedown', () => (this.sprungGehalten = true));
    window.addEventListener('mouseup', () => (this.sprungGehalten = false));
    // Wechselt man das Fenster, gilt alles als losgelassen
    window.addEventListener('blur', () => {
      this.sprungGehalten = false;
      this.tasten.clear();
    });
    knopf(document.getElementById('aktion-knopf'), () => (this.aktion = true));
    knopf(document.getElementById('rucksack-knopf'), () => (this.rucksack = true));

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.tasten.add(e.code);
      if (e.code === 'Space') this.springen = true;
      if (e.code === 'KeyE' || e.code === 'Enter') this.aktion = true;
      if (e.code === 'KeyI' || e.code === 'KeyR' || e.code === 'Escape') this.rucksack = true;
    });
    window.addEventListener('keyup', (e) => this.tasten.delete(e.code));

    // Maus ziehen = Kamera drehen
    let mausGedrueckt = false;
    element.addEventListener('mousedown', () => (mausGedrueckt = true));
    window.addEventListener('mouseup', () => (mausGedrueckt = false));
    window.addEventListener('mousemove', (e) => {
      if (!mausGedrueckt) return;
      this.kameraDrehung -= e.movementX * 0.005;
      this.kameraNeigung += e.movementY * 0.003;
    });
  }

  fingerRunter(e) {
    if (imFenster(e)) return; // in Fenstern (Werkbank, Händler …) darf man scrollen
    e.preventDefault();
    for (const t of e.changedTouches) {
      const linkeSeite = t.clientX < window.innerWidth / 2;
      if (linkeSeite && this.joystickFinger === null) {
        this.joystickFinger = t.identifier;
        this.joystickStart = { x: t.clientX, y: t.clientY };
        this.joystickBasis.style.left = `${t.clientX}px`;
        this.joystickBasis.style.top = `${t.clientY}px`;
        this.joystickBasis.classList.add('sichtbar');
        this.setzeKnopf(0, 0);
      } else if (!linkeSeite && this.kameraFinger === null) {
        this.kameraFinger = t.identifier;
        this.kameraLetzte = { x: t.clientX, y: t.clientY };
      }
    }
  }

  fingerBewegt(e) {
    if (imFenster(e)) return; // nicht blockieren – sonst kann man die Liste nicht scrollen
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === this.joystickFinger) {
        let dx = t.clientX - this.joystickStart.x;
        let dy = t.clientY - this.joystickStart.y;
        const laenge = Math.hypot(dx, dy);
        if (laenge > this.joystickRadius) {
          dx = (dx / laenge) * this.joystickRadius;
          dy = (dy / laenge) * this.joystickRadius;
        }
        this.setzeKnopf(dx, dy);
        this.richtung.x = dx / this.joystickRadius;
        this.richtung.y = -dy / this.joystickRadius;
      } else if (t.identifier === this.kameraFinger) {
        this.kameraDrehung -= (t.clientX - this.kameraLetzte.x) * 0.008;
        this.kameraNeigung += (t.clientY - this.kameraLetzte.y) * 0.004;
        this.kameraLetzte = { x: t.clientX, y: t.clientY };
      }
    }
  }

  fingerHoch(e) {
    for (const t of e.changedTouches) {
      if (t.identifier === this.joystickFinger) {
        this.joystickFinger = null;
        this.richtung.x = this.richtung.y = 0;
        this.joystickBasis.classList.remove('sichtbar');
      } else if (t.identifier === this.kameraFinger) {
        this.kameraFinger = null;
      }
    }
  }

  setzeKnopf(dx, dy) {
    this.joystickKnopf.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }

  // Liefert die Eingaben für dieses Bild und setzt Einmal-Aktionen zurück
  lies() {
    let { x, y } = this.richtung;
    if (this.joystickFinger === null) {
      x = y = 0;
      const t = this.tasten;
      if (t.has('KeyW') || t.has('ArrowUp')) y += 1;
      if (t.has('KeyS') || t.has('ArrowDown')) y -= 1;
      if (t.has('KeyD') || t.has('ArrowRight')) x += 1;
      if (t.has('KeyA') || t.has('ArrowLeft')) x -= 1;
    }
    const eingabe = {
      richtung: { x, y },
      springen: this.springen,
      springenGehalten: this.sprungGehalten || this.tasten.has('Space'),
      aktion: this.aktion,
      rucksack: this.rucksack,
      kameraDrehung: this.kameraDrehung,
      kameraNeigung: this.kameraNeigung,
    };
    this.springen = false;
    this.aktion = false;
    this.rucksack = false;
    this.kameraDrehung = 0;
    this.kameraNeigung = 0;
    return eingabe;
  }
}
