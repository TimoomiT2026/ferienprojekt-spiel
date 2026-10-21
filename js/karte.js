// =============================================================
//  DIE KARTE und die NAVIGATION
//  Die Karte zeigt die ganze Insel von oben – wie eine Schatzkarte.
//  Tippt man ein Ziel an (z. B. das Zelt), zeigt ein Pfeil unten
//  im Bild, in welche Richtung man laufen muss.
//  So findet man das Zelt immer wieder!
// =============================================================
import { EINSTELLUNGEN } from './einstellungen.js';
import { bodenHoehe, istWald, abstandZumPfad, abstandZumDorf, gitterWerte, WASSER_HOEHE, WELT, INSELN, aufWelcherInsel } from './gelaende.js';
import { knopf } from './steuerung.js';

// Die Karte hat zwei Ansichten:
//  • "Diese Insel": nur die Insel, auf der man ist (schön groß, wie früher)
//  • "Alle Inseln": die ganze Inselgruppe (unentdeckte Inseln sind unter Wolken)
// BEREICH = Meter von der Kartenmitte bis zum Rand, MX/MZ = Kartenmitte,
// BILD_PIXEL = Pixel im Bild (mehr = schärfer, aber langsamer),
// MESS_PUNKTE = an so vielen Punkten messen wir die Höhe (dazwischen wird gemischt)
const ANSICHTEN = {
  gruppe: { mx: WELT.mitteX, mz: WELT.mitteZ, bereich: WELT.halb, pixel: 1024, punkte: 401 },
};
INSELN.forEach((I, i) => {
  ANSICHTEN[I.name] = i === 0
    ? { mx: 0, mz: 0, bereich: EINSTELLUNGEN.inselGroesse + 70, pixel: 768, punkte: 241 } // genau wie früher
    : { mx: I.x, mz: I.z, bereich: I.reichweite + 30, pixel: 768, punkte: 241 };
});
let BEREICH, MX, MZ, BILD_PIXEL, MESS_PUNKTE;
function waehleAnsicht(a) {
  ({ bereich: BEREICH, mx: MX, mz: MZ, pixel: BILD_PIXEL, punkte: MESS_PUNKTE } = a);
}
waehleAnsicht(ANSICHTEN.Startinsel);
// Die Startinsel (bis hier gibt es Pfad und Dorf)
const START_BEREICH = EINSTELLUNGEN.inselGroesse * 1.3;
// Auf welcher Insel liegt (x, z)? 0 = Startinsel oder Meer, 1, 2, … = neue Inseln
function inselNummer(x, z) {
  for (let i = 1; i < INSELN.length; i++) if (Math.hypot(x - INSELN[i].x, z - INSELN[i].z) < INSELN[i].reichweite) return i;
  return 0;
}
// Ab wie vielen Metern ist man "angekommen"?
const ZIEL_ABSTAND = 6;

// ---------- Kleine Rechenhelfer ----------
const mische = (a, b, t) => a + (b - a) * t;
const glatt = (x, von, bis) => {
  const t = Math.min(1, Math.max(0, (x - von) / (bis - von)));
  return t * t * (3 - 2 * t);
};
const farbe = (hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
function mischeFarbe(ziel, b, t) {
  ziel[0] = mische(ziel[0], b[0], t);
  ziel[1] = mische(ziel[1], b[1], t);
  ziel[2] = mische(ziel[2], b[2], t);
}
// Ein fester "Zufall", damit die Karte jedes Mal gleich aussieht
function wuerfel(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
// Winkel immer zwischen -180° und +180° halten (in Bogenmaß)
const kurzerWinkel = (w) => Math.atan2(Math.sin(w), Math.cos(w));

// Die Farben der Karte
const F = {
  tiefesMeer: farbe('#2f6f93'),
  meer: farbe('#4f9bb8'),
  flachesMeer: farbe('#8fd3cf'),
  schaum: farbe('#e6f4ea'),
  nasserSand: farbe('#cdb27a'),
  sand: farbe('#ecd69c'),
  wiese: farbe('#79bf52'),
  wiese2: farbe('#a3cf5c'),
  wald: farbe('#3f7d34'),
  fels: farbe('#9a948a'),
  schnee: farbe('#f6f7f4'),
  erde: farbe('#9a6a35'),
  papier: farbe('#efdcb0'),
};

// ---------- Das Kartenbild malen (passiert nur einmal) ----------
function maleKarte(canvas) {
  const N = MESS_PUNKTE;
  const schritt = (BEREICH * 2) / (N - 1); // Meter zwischen zwei Messpunkten
  const hoehe = new Float32Array(N * N);
  const wald = new Float32Array(N * N);
  const pfad = new Float32Array(N * N);
  const dorf = new Float32Array(N * N);
  const insel = new Uint8Array(N * N);

  // 1) Überall die Höhe messen (wie ein Landvermesser)
  for (let j = 0; j < N; j++) {
    const z = MZ - BEREICH + j * schritt;
    for (let i = 0; i < N; i++) {
      const x = MX - BEREICH + i * schritt;
      const k = j * N + i;
      const h = bodenHoehe(x, z);
      const nr = inselNummer(x, z);
      const amStart = Math.hypot(x, z) < START_BEREICH;
      hoehe[k] = h;
      insel[k] = nr;
      // Wald: auf der Startinsel wie immer, auf den neuen Inseln aus deren Bodenarten
      wald[k] = h > 1.6 && (nr ? gitterWerte(x, z).wald > 0.35 : istWald(x, z)) ? 1 : 0;
      pfad[k] = amStart ? abstandZumPfad(x, z) : 99;
      dorf[k] = amStart ? abstandZumDorf(x, z) : 99;
    }
  }

  // 2) Schatten an Hängen ("Hillshading"): Licht kommt von oben links (Nordwesten)
  const schatten = new Float32Array(N * N);
  const steil = new Float32Array(N * N);
  const licht = [-0.55, 0.62, -0.55]; // x, y (nach oben), z
  const ll = Math.hypot(...licht);
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const k = j * N + i;
      const hL = hoehe[j * N + Math.max(0, i - 1)], hR = hoehe[j * N + Math.min(N - 1, i + 1)];
      const hO = hoehe[Math.max(0, j - 1) * N + i], hU = hoehe[Math.min(N - 1, j + 1) * N + i];
      // Normale = Richtung, in die der Hang "schaut"
      const nx = -(hR - hL) / (2 * schritt) * 1.6; // 1.6 = Berge etwas übertreiben
      const nz = -(hU - hO) / (2 * schritt) * 1.6;
      const nl = Math.hypot(nx, 1, nz);
      const hell = (nx * licht[0] + licht[1] + nz * licht[2]) / (nl * ll);
      schatten[k] = hell - licht[1] / ll; // 0 = flach, + = Sonnenseite, − = Schattenseite
      // Steilheit wie im 3D-Gelände (ohne Übertreibung)
      steil[k] = 1 - 1 / Math.hypot(nx / 1.6, 1, nz / 1.6);
    }
  }

  // 3) Für jedes Pixel die Werte der vier nächsten Messpunkte mischen
  const P = BILD_PIXEL;
  canvas.width = canvas.height = P;
  const ctx = canvas.getContext('2d');
  const bild = ctx.createImageData(P, P);
  const px = bild.data;
  const pixelHoehe = new Float32Array(P * P);
  const zufall = wuerfel(7);
  const c = [0, 0, 0];

  for (let y = 0; y < P; y++) {
    const gy = (y / (P - 1)) * (N - 1);
    const j0 = Math.min(N - 2, Math.floor(gy)), fy = gy - j0;
    for (let x = 0; x < P; x++) {
      const gx = (x / (P - 1)) * (N - 1);
      const i0 = Math.min(N - 2, Math.floor(gx)), fx = gx - i0;
      const k = j0 * N + i0;
      const lies = (feld) =>
        mische(mische(feld[k], feld[k + 1], fx), mische(feld[k + N], feld[k + N + 1], fx), fy);
      const h = lies(hoehe);
      pixelHoehe[y * P + x] = h;

      if (h < WASSER_HOEHE) {
        // Wasser: je tiefer, desto dunkler
        const tiefe = WASSER_HOEHE - h;
        c[0] = F.flachesMeer[0]; c[1] = F.flachesMeer[1]; c[2] = F.flachesMeer[2];
        mischeFarbe(c, F.meer, glatt(tiefe, 0.3, 3.5));
        mischeFarbe(c, F.tiefesMeer, glatt(tiefe, 3.5, 7));
        mischeFarbe(c, F.schaum, (1 - glatt(tiefe, 0, 0.35)) * 0.7);
      } else {
        // Land: Strand, Wiese, Wald, Fels, Schnee
        if (h < 0.5) { c[0] = F.nasserSand[0]; c[1] = F.nasserSand[1]; c[2] = F.nasserSand[2]; }
        else { c[0] = F.sand[0]; c[1] = F.sand[1]; c[2] = F.sand[2]; }
        const gras = glatt(h, 1.3, 1.9);
        const fleck = Math.sin(x * 0.05) * Math.cos(y * 0.043) * 0.5 + 0.5;
        const g = [mische(F.wiese[0], F.wiese2[0], fleck * 0.6), mische(F.wiese[1], F.wiese2[1], fleck * 0.6), mische(F.wiese[2], F.wiese2[2], fleck * 0.6)];
        mischeFarbe(c, g, gras);
        mischeFarbe(c, F.wald, lies(wald) * 0.75 * gras);
        // Fels: an steilen Hängen. Auf der Startinsel auch hoch oben am Berg
        // (das Plateau der Klippeninsel ist oben aber grün).
        const neueInsel = insel[k] > 0;
        const felsig = Math.max(glatt(lies(steil), 0.12, 0.3), neueInsel ? 0 : glatt(h, 15, 22));
        mischeFarbe(c, F.fels, felsig * gras);
        if (!neueInsel) mischeFarbe(c, F.schnee, glatt(h, 29, 35));
        // Trampelpfad und Dorfplatz
        mischeFarbe(c, F.erde, (1 - glatt(lies(pfad), 1.8, 3.2)) * 0.95);
        mischeFarbe(c, F.erde, (1 - glatt(lies(dorf), 7, 10)) * 0.6);
        // Licht und Schatten: in den Bergen kräftig, auf der Wiese nur ein bisschen
        const s = lies(schatten) * (1.2 + glatt(h, 6, 20) * 1.2);
        const faktor = Math.max(0.45, Math.min(1.35, 1 + s));
        c[0] *= faktor; c[1] *= faktor; c[2] *= faktor;
      }
      // Ein Hauch alte Papierfarbe und Körnung – wie eine echte alte Karte
      mischeFarbe(c, F.papier, h < WASSER_HOEHE ? 0.2 : 0.12);
      const korn = (zufall() - 0.5) * 10;
      const o = (y * P + x) * 4;
      px[o] = c[0] + korn;
      px[o + 1] = c[1] + korn;
      px[o + 2] = c[2] + korn * 0.8;
      px[o + 3] = 255;
    }
  }

  // 4) Höhenlinien und Küstenlinie: dort, wo die Höhe eine "Stufe" überschreitet
  const stufe = (h) => (h < 0 ? (h < -2.5 ? -2 : -1) : h < 6 ? 0 : 1 + Math.floor((h - 6) / 6));
  for (let y = 0; y < P - 1; y++) {
    for (let x = 0; x < P - 1; x++) {
      const a = pixelHoehe[y * P + x];
      const b = pixelHoehe[y * P + x + 1];
      const d = pixelHoehe[(y + 1) * P + x];
      const o = (y * P + x) * 4;
      if ((a < 0) !== (b < 0) || (a < 0) !== (d < 0)) {
        // Küste: dunkelbraune Linie
        px[o] = 92; px[o + 1] = 66; px[o + 2] = 40;
        continue;
      }
      const sa = stufe(a);
      if (sa !== stufe(b) || sa !== stufe(d)) {
        if (a < 0) {
          // Wellenlinie im Wasser: hell
          px[o] = mische(px[o], 235, 0.45); px[o + 1] = mische(px[o + 1], 245, 0.45); px[o + 2] = mische(px[o + 2], 240, 0.45);
        } else if (sa >= 1) {
          // Höhenlinie am Berg: dunkel
          px[o] *= 0.78; px[o + 1] *= 0.78; px[o + 2] *= 0.8;
        }
      }
    }
  }
  ctx.putImageData(bild, 0, 0);

  maleBaeume(ctx, wald, hoehe, N, insel);
  maleVerzierung(ctx, P);
}

// Kleine Bäumchen-Symbole im Wald – wie auf einer gemalten Karte
function maleBaeume(ctx, wald, hoehe, N, insel) {
  const P = BILD_PIXEL;
  const zufall = wuerfel(42);
  const abstand = 11;
  for (let y = abstand / 2; y < P; y += abstand) {
    for (let x = abstand / 2; x < P; x += abstand) {
      const bx = x + (zufall() - 0.5) * abstand * 0.9;
      const by = y + (zufall() - 0.5) * abstand * 0.9;
      const i = Math.round((bx / (P - 1)) * (N - 1));
      const j = Math.round((by / (P - 1)) * (N - 1));
      if (i < 0 || j < 0 || i >= N || j >= N) continue;
      const k = j * N + i;
      if (wald[k] < 1 || (hoehe[k] > 16 && !insel[k]) || zufall() < 0.25) continue;
      const r = 2.6 + zufall() * 1.6;
      ctx.fillStyle = 'rgba(30, 55, 25, 0.35)'; // Schatten
      ctx.beginPath();
      ctx.arc(bx + 1.2, by + 1.2, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = zufall() < 0.5 ? '#3b7a33' : '#47893b';
      ctx.beginPath();
      ctx.arc(bx, by, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(190, 230, 140, 0.45)'; // Lichtpunkt oben links
      ctx.beginPath();
      ctx.arc(bx - r * 0.35, by - r * 0.35, r * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// Kompass-Rose, Maßstab, Gitter, Wellen und verbrannter Papierrand
function maleVerzierung(ctx, P) {
  const proMeter = P / (BEREICH * 2);

  // Feines Gitter alle 50 Meter (bei allen Inseln: 100 m) – wie Längen- und Breitengrade
  ctx.strokeStyle = 'rgba(90, 60, 30, 0.13)';
  ctx.lineWidth = 1;
  const gross = BEREICH > 400;
  const gitter = gross ? 100 : 50;
  for (let m = -Math.ceil((BEREICH + Math.abs(MX) + Math.abs(MZ)) / gitter) * gitter; m <= BEREICH + Math.abs(MX) + Math.abs(MZ); m += gitter) {
    const px = (m - MX + BEREICH) * proMeter, pz = (m - MZ + BEREICH) * proMeter;
    ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, P); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, pz); ctx.lineTo(P, pz); ctx.stroke();
  }

  // Kleine Wellen im tiefen Meer (nur in den Ecken, dort ist sicher Wasser)
  const zufall = wuerfel(3);
  ctx.strokeStyle = 'rgba(230, 245, 245, 0.55)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (let n = 0; n < (gross ? 120 : 40); n++) {
    const x = zufall() * P, y = zufall() * P;
    const mx = x / proMeter - BEREICH + MX, mz = y / proMeter - BEREICH + MZ;
    if (bodenHoehe(mx, mz) > -5 || bodenHoehe(mx + 10, mz) > -5) continue;
    ctx.beginPath();
    ctx.moveTo(x - 9, y);
    ctx.quadraticCurveTo(x - 4.5, y - 5, x, y);
    ctx.quadraticCurveTo(x + 4.5, y - 5, x + 9, y);
    ctx.stroke();
  }

  // Kompass-Rose oben rechts
  const kx = P - 78, ky = 82, r = 52;
  ctx.save();
  ctx.translate(kx, ky);
  ctx.fillStyle = 'rgba(245, 232, 200, 0.85)';
  ctx.strokeStyle = '#6b4a2b';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, r * 0.62, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2); ctx.stroke();
  // Spitzen: erst die kleinen schrägen, dann die großen (N, O, S, W)
  for (const [laenge, breite, start] of [[r * 0.6, 7, Math.PI / 4], [r, 11, 0]]) {
    for (let n = 0; n < 4; n++) {
      ctx.save();
      ctx.rotate(start + (n * Math.PI) / 2);
      ctx.fillStyle = n === 0 && start === 0 ? '#c0392b' : '#6b4a2b';
      ctx.beginPath(); ctx.moveTo(0, -laenge); ctx.lineTo(breite, 0); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = n === 0 && start === 0 ? '#e8705f' : '#c9a877';
      ctx.beginPath(); ctx.moveTo(0, -laenge); ctx.lineTo(-breite, 0); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }
  ctx.fillStyle = '#6b4a2b';
  ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.font = 'bold 22px Georgia, "Times New Roman", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#7a2a1f';
  ctx.strokeStyle = 'rgba(245, 232, 200, 0.95)';
  ctx.lineWidth = 4;
  ctx.strokeText('N', 0, -r - 14);
  ctx.fillText('N', 0, -r - 14);
  ctx.font = 'bold 13px Georgia, serif';
  ctx.fillStyle = '#6b4a2b';
  for (const [t, x, y] of [['O', r + 10, 0], ['S', 0, r + 10], ['W', -r - 10, 0]]) {
    ctx.strokeText(t, x, y);
    ctx.fillText(t, x, y);
  }
  ctx.restore();

  // Maßstab unten links: 50 Meter (bei allen Inseln: 100 m)
  const lang = gitter * proMeter;
  const mx = 26, my = P - 30;
  ctx.fillStyle = 'rgba(245, 232, 200, 0.85)';
  ctx.fillRect(mx - 8, my - 24, lang + 16, 38);
  ctx.fillStyle = '#6b4a2b';
  ctx.fillRect(mx, my, lang / 2, 6);
  ctx.strokeStyle = '#6b4a2b';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(mx, my, lang, 6);
  ctx.font = 'bold 14px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(`${gitter} m`, mx + lang / 2, my - 7);

  // Verbrannter, dunkler Papierrand
  const rand = ctx.createRadialGradient(P / 2, P / 2, P * 0.42, P / 2, P / 2, P * 0.74);
  rand.addColorStop(0, 'rgba(90, 55, 20, 0)');
  rand.addColorStop(0.75, 'rgba(90, 55, 20, 0.22)');
  rand.addColorStop(1, 'rgba(60, 35, 10, 0.6)');
  ctx.fillStyle = rand;
  ctx.fillRect(0, 0, P, P);
}

// Unentdeckte Inseln verstecken wir unter Wolken mit einem "?".
// Entdeckte Inseln bekommen ihren Namen auf die Karte.
function maleNebel(canvas, entdeckt) {
  const P = 512;
  canvas.width = canvas.height = P;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, P, P);
  const proMeter = P / (BEREICH * 2);
  const ort = (x, z) => [(x - MX + BEREICH) * proMeter, (z - MZ + BEREICH) * proMeter];
  INSELN.slice(1).forEach((I, nr) => {
    const [cx, cy] = ort(I.x, I.z);
    const r = I.reichweite * proMeter;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (!entdeckt.has(I.name)) {
      // Dicke, weiche Wolken (immer gleich, damit sie nicht zappeln)
      const zufall = wuerfel(99 + nr);
      for (let k = 0; k < 26; k++) {
        const w = zufall() * Math.PI * 2, d = Math.sqrt(zufall()) * r * 0.75;
        const x = cx + Math.cos(w) * d, y = cy + Math.sin(w) * d;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r * (0.35 + zufall() * 0.25));
        g.addColorStop(0, 'rgba(244, 236, 214, 1)');
        g.addColorStop(0.6, 'rgba(240, 230, 205, 0.95)');
        g.addColorStop(1, 'rgba(240, 230, 205, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.font = `bold ${Math.round(r * 0.55)}px Georgia, serif`;
      ctx.fillStyle = 'rgba(107, 74, 43, 0.75)';
      ctx.fillText('?', cx, cy);
    } else {
      ctx.font = 'bold 15px Georgia, serif';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(245, 232, 200, 0.95)';
      ctx.fillStyle = '#6b4a2b';
      const y = cy - r * 0.78;
      ctx.strokeText(I.name, cx, y);
      ctx.fillText(I.name, cx, y);
    }
  });
}

// Der Pfeil als SVG-Bild (zeigt nach oben)
const PFEIL_SVG = `<svg viewBox="0 0 100 100" aria-hidden="true">
  <path d="M50 6 L86 74 Q88 80 82 79 L56 70 Q50 68 44 70 L18 79 Q12 80 14 74 Z"
        fill="#ffb02e" stroke="#fff" stroke-width="7" stroke-linejoin="round"/>
</svg>`;
const ICH_SVG = `<svg viewBox="0 0 100 100" aria-hidden="true">
  <path d="M50 8 L84 86 L50 68 L16 86 Z" fill="#3d7bff" stroke="#fff" stroke-width="9" stroke-linejoin="round"/>
</svg>`;

// =============================================================
export class Karte {
  constructor(elternElement) {
    this.punkte = new Map(); // id → { name, bild, x, z, sichtbar, knopf }
    this.ziel = null; // id des Navigationsziels (oder null)
    this._offen = false;
    this._beiZielErreicht = null;
    this.pfeilWinkel = 0;
    this.erreichtZeit = 0; // wie lange "Ziel erreicht!" noch angezeigt wird
    this.spieler = { x: 0, z: 0, winkel: 0 };
    this.entdeckt = new Set(); // Namen der neuen Inseln, die man schon gesehen hat
    this.beiInselEntdeckt = null; // optional: wird aufgerufen, wenn man eine neue Insel findet

    const hud = elternElement.querySelector('#hud') || elternElement;

    // ---------- Der Karten-Knopf 🗺️ (unter dem Rucksack) ----------
    this.knopfElement = document.createElement('button');
    this.knopfElement.id = 'karte-knopf';
    this.knopfElement.className = 'rund-knopf';
    this.knopfElement.setAttribute('aria-label', 'Karte öffnen');
    this.knopfElement.textContent = '🗺️';
    const obenLinks = elternElement.querySelector('#oben-links');
    if (obenLinks) obenLinks.appendChild(this.knopfElement);
    else {
      this.knopfElement.classList.add('allein');
      hud.appendChild(this.knopfElement);
    }
    knopf(this.knopfElement, () => this.umschalten());

    // ---------- Das Kartenfenster ----------
    this.fenster = document.createElement('div');
    this.fenster.id = 'karte-fenster';
    this.fenster.innerHTML = `
      <div class="fenster-kopf">
        <h2>🗺️ Inselkarte</h2>
        <button id="karte-ansicht" style="margin-left:auto;margin-right:10px;padding:8px 14px;border:none;border-radius:14px;background:#c9a877;color:#4a2c10;font:bold 15px inherit;white-space:nowrap;box-shadow:0 3px 0 #8a6a40">🌍 Alle Inseln</button>
        <button id="karte-zu" aria-label="Karte schließen">✕</button>
      </div>
      <div id="karte-blatt">
        <canvas id="karte-bild" data-ansicht="Startinsel"></canvas>
        <canvas id="karte-nebel" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none"></canvas>
        <svg id="karte-linie" viewBox="0 0 1000 1000" preserveAspectRatio="none">
          <line x1="0" y1="0" x2="0" y2="0" />
        </svg>
        <div id="karte-punkte"></div>
        <div id="karte-ich">${ICH_SVG}</div>
      </div>
      <div class="karte-fuss">
        <p id="karte-tipp">Tippe auf ein Ziel – dann zeigt dir ein Pfeil den Weg!</p>
        <button id="karte-navi-aus">✖ Navigation aus</button>
      </div>`;
    elternElement.appendChild(this.fenster);
    this.blatt = this.fenster.querySelector('#karte-blatt');
    this.nebel = this.fenster.querySelector('#karte-nebel');
    this.bilder = { Startinsel: this.fenster.querySelector('#karte-bild') }; // ein gemaltes Bild pro Ansicht
    this.ansicht = 'Startinsel';
    this.ansichtKnopf = this.fenster.querySelector('#karte-ansicht');
    knopf(this.ansichtKnopf, () => this.zeigeAnsicht(this.ansicht === 'gruppe' ? this.inselHier() || 'Startinsel' : 'gruppe'));
    this.nebel.style.display = 'none';
    this.punkteEbene = this.fenster.querySelector('#karte-punkte');
    this.ichElement = this.fenster.querySelector('#karte-ich');
    this.linie = this.fenster.querySelector('#karte-linie line');
    this.tipp = this.fenster.querySelector('#karte-tipp');
    this.naviAusKnopf = this.fenster.querySelector('#karte-navi-aus');
    knopf(this.fenster.querySelector('#karte-zu'), () => this.schliessen());
    knopf(this.naviAusKnopf, () => this.navigationAus());
    // Tippen auf der Karte soll nicht den Joystick oder die Kamera bewegen
    for (const art of ['touchstart', 'touchmove', 'mousedown']) {
      this.fenster.addEventListener(art, (e) => e.stopPropagation());
    }

    // ---------- Der Navi-Pfeil unten in der Mitte ----------
    this.navi = document.createElement('div');
    this.navi.id = 'navi';
    this.navi.innerHTML = `<div id="navi-pfeil">${PFEIL_SVG}</div><div id="navi-text"></div>`;
    hud.appendChild(this.navi);
    this.naviPfeil = this.navi.querySelector('#navi-pfeil');
    this.naviText = this.navi.querySelector('#navi-text');

    // ---------- Tastatur: M = Karte, Escape = Karte zu ----------
    // "capture: true" heißt: wir hören die Taste als Erste, noch vor der Steuerung
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (e.code === 'KeyM') {
        const hudDa = document.getElementById('hud');
        if (hudDa && !hudDa.classList.contains('sichtbar')) return; // Spiel läuft noch nicht
        this.umschalten();
      } else if (e.code === 'Escape' && this._offen) {
        e.stopPropagation(); // sonst würde auch noch der Rucksack aufgehen
        this.schliessen();
      }
    }, { capture: true });

    // ---------- Die Insel einmal malen ----------
    // Das dauert fast eine halbe Sekunde. Darum malen wir kurz nach dem Laden
    // (dann ist noch der Startbildschirm da) – oder spätestens beim ersten Öffnen.
    this.gemalt = new Set();
    setTimeout(() => this.maleEinmal(), 300);
  }

  // Jede Ansicht wird nur einmal gemalt (beim ersten Anschauen)
  maleEinmal(name = this.ansicht) {
    if (this.gemalt.has(name)) return;
    this.gemalt.add(name);
    let bild = this.bilder[name];
    if (!bild) {
      bild = this.bilder[name] = document.createElement('canvas');
      bild.style.cssText = 'width:100%;height:100%;display:none';
      this.bilder.Startinsel.after(bild);
    }
    const start = performance.now();
    waehleAnsicht(ANSICHTEN[name]);
    maleKarte(bild);
    waehleAnsicht(ANSICHTEN[this.ansicht]);
    this.malDauer = Math.round(performance.now() - start); // für Tests: wie lange hat's gedauert?
  }

  // Auf welcher Insel ist man gerade? (Name oder null = auf dem Meer)
  inselHier() {
    return aufWelcherInsel(this.spieler.x, this.spieler.z);
  }

  // Zwischen "Diese Insel" und "Alle Inseln" umschalten
  zeigeAnsicht(name) {
    if (!ANSICHTEN[name]) return;
    this.ansicht = name;
    this.maleEinmal(name);
    waehleAnsicht(ANSICHTEN[name]);
    for (const [n, bild] of Object.entries(this.bilder)) bild.style.display = n === name ? 'block' : 'none';
    const gruppe = name === 'gruppe';
    this.nebel.style.display = gruppe ? 'block' : 'none';
    if (gruppe) maleNebel(this.nebel, this.entdeckt);
    this.ansichtKnopf.textContent = gruppe ? '🏝️ Diese Insel' : '🌍 Alle Inseln';
    this.fenster.querySelector('h2').textContent = gruppe ? '🗺️ Alle Inseln' : `🗺️ ${name === 'Startinsel' ? 'Inselkarte' : name}`;
    // Alle Punkte neu hinsetzen
    for (const [id, p] of this.punkte) this.punkt(id, p);
    this.zeichneSpieler();
  }

  // Welt-Meter → Prozent auf der Karte (Norden = oben)
  aufKarte(x, z) {
    const klemme = (v) => Math.min(98, Math.max(2, v));
    return { links: klemme(((x - MX + BEREICH) / (BEREICH * 2)) * 100), oben: klemme(((z - MZ + BEREICH) / (BEREICH * 2)) * 100) };
  }

  // ---------- Neue Inseln entdecken ----------
  // Eine Insel zeigt sich auf der Karte, wenn man nah genug dran war
  entdeckeInsel(name) {
    if (this.entdeckt.has(name) || !INSELN.some((I) => I.name === name)) return false;
    this.entdeckt.add(name);
    if (this.ansicht === 'gruppe') maleNebel(this.nebel, this.entdeckt);
    if (this.beiInselEntdeckt) this.beiInselEntdeckt(name);
    return true;
  }

  // Für den Spielstand
  get entdeckteInseln() {
    return [...this.entdeckt];
  }

  ladeEntdeckteInseln(liste) {
    this.entdeckt = new Set((liste || []).filter((n) => INSELN.some((I) => I.name === n)));
    if (this.ansicht === 'gruppe') maleNebel(this.nebel, this.entdeckt);
  }

  // Einen Punkt auf die Karte setzen (oder ändern)
  punkt(id, { name, bild, x, z, sichtbar = true }) {
    let p = this.punkte.get(id);
    if (!p) {
      const el = document.createElement('button');
      el.className = 'karte-punkt';
      el.innerHTML = '<span class="punkt-bild"></span><span class="punkt-name"></span>';
      knopf(el, () => this.punktAngetippt(id));
      this.punkteEbene.appendChild(el);
      p = { knopf: el };
      this.punkte.set(id, p);
    }
    Object.assign(p, { name, bild, x, z, sichtbar });
    p.knopf.querySelector('.punkt-bild').textContent = bild;
    p.knopf.querySelector('.punkt-name').textContent = name;
    p.knopf.setAttribute('aria-label', `Navigation zu: ${name}`);
    const ort = this.aufKarte(x, z);
    p.knopf.style.left = `${ort.links}%`;
    p.knopf.style.top = `${ort.oben}%`;
    p.knopf.hidden = !sichtbar || !this.gehoertZurAnsicht(id, x, z);
    // Wird das Ziel unsichtbar, hört die Navigation auf
    if (!sichtbar && this.ziel === id) this.navigationAus();
    this.zeichneZiel();
  }

  // Zeigen wir diesen Punkt in der aktuellen Ansicht?
  // "Diese Insel": nur Punkte auf dieser Insel. "Alle Inseln": die Startinsel ist dann
  // so klein, dass dort nur die Base gezeigt wird. Das Navigationsziel sieht man immer.
  gehoertZurAnsicht(id, x, z) {
    if (!this.ansicht || id === this.ziel) return true;
    const insel = aufWelcherInsel(x, z);
    if (this.ansicht === 'gruppe') return insel !== 'Startinsel' || id === 'zelt';
    return insel === this.ansicht || (insel === null && Math.hypot(x - ANSICHTEN[this.ansicht].mx, z - ANSICHTEN[this.ansicht].mz) < ANSICHTEN[this.ansicht].bereich);
  }

  punktAngetippt(id) {
    if (this.ziel === id) {
      this.navigationAus();
      return;
    }
    this.ziel = id;
    this.erreichtZeit = 0;
    this.navi.classList.remove('erreicht');
    this.zeichneZiel();
    this.schliessen();
  }

  navigationAus() {
    this.ziel = null;
    this.zeichneZiel();
  }

  // Hebt das aktuelle Ziel auf der Karte hervor
  zeichneZiel() {
    for (const [id, p] of this.punkte) p.knopf.classList.toggle('ziel', id === this.ziel);
    this.naviAusKnopf.classList.toggle('sichtbar', this.ziel !== null);
    const p = this.ziel && this.punkte.get(this.ziel);
    this.tipp.textContent = p
      ? `Unterwegs zu: ${p.bild} ${p.name}`
      : 'Tippe auf ein Ziel – dann zeigt dir ein Pfeil den Weg!';
  }

  oeffnen() {
    // Die Karte zeigt die Insel, auf der man gerade ist – auf dem Meer alle Inseln
    const hier = this.inselHier();
    this.zeigeAnsicht(hier && (hier === 'Startinsel' || this.entdeckt.has(hier)) ? hier : 'gruppe');
    this._offen = true;
    this.zeichneSpieler();
    this.fenster.classList.add('offen');
    this.knopfElement.classList.add('aktiv');
  }

  schliessen() {
    this._offen = false;
    this.fenster.classList.remove('offen');
    this.knopfElement.classList.remove('aktiv');
  }

  umschalten() {
    this._offen ? this.schliessen() : this.oeffnen();
  }

  get offen() {
    return this._offen;
  }

  set beiZielErreicht(fn) {
    this._beiZielErreicht = fn;
  }

  // Spieler-Pfeil und Ziel-Linie auf der Karte
  zeichneSpieler() {
    const { x, z, winkel } = this.spieler;
    const ort = this.aufKarte(x, z);
    // Figur schaut in Richtung (sin φ, cos φ). Auf der Karte ist +z unten.
    const grad = (Math.atan2(Math.sin(winkel), -Math.cos(winkel)) * 180) / Math.PI;
    this.ichElement.style.left = `${ort.links}%`;
    this.ichElement.style.top = `${ort.oben}%`;
    this.ichElement.style.transform = `translate(-50%, -50%) rotate(${grad}deg)`;
    const p = this.ziel && this.punkte.get(this.ziel);
    if (p) {
      const zo = this.aufKarte(p.x, p.z);
      this.linie.setAttribute('x1', ort.links * 10);
      this.linie.setAttribute('y1', ort.oben * 10);
      this.linie.setAttribute('x2', zo.links * 10);
      this.linie.setAttribute('y2', zo.oben * 10);
    }
    this.linie.style.display = p ? '' : 'none';
  }

  // Wird jedes Bild aufgerufen
  aktualisiere(dt, spielerPos, kameraWinkel, figurWinkel) {
    if (!spielerPos) return;
    this.spieler.x = spielerPos.x;
    this.spieler.z = spielerPos.z;
    this.spieler.winkel = figurWinkel || 0;
    if (this._offen) this.zeichneSpieler();

    // Ist eine neue Insel nah? Dann erscheint sie auf der Karte
    for (let i = 1; i < INSELN.length; i++) {
      const I = INSELN[i];
      if (!this.entdeckt.has(I.name) && Math.hypot(spielerPos.x - I.x, spielerPos.z - I.z) < I.radius + EINSTELLUNGEN.inselEntdeckenAbstand) this.entdeckeInsel(I.name);
    }

    // "Ziel erreicht!" noch kurz stehen lassen, dann ausblenden
    if (this.erreichtZeit > 0) {
      this.erreichtZeit -= dt;
      if (this.erreichtZeit <= 0) this.navi.classList.remove('sichtbar', 'erreicht');
      return;
    }

    const p = this.ziel && this.punkte.get(this.ziel);
    this.navi.classList.toggle('sichtbar', !!p && !this._offen);
    if (!p) return;

    const dx = p.x - spielerPos.x;
    const dz = p.z - spielerPos.z;
    const entfernung = Math.hypot(dx, dz);

    if (entfernung < ZIEL_ABSTAND) {
      this.naviText.textContent = `${p.bild} Ziel erreicht! 🎉`;
      this.navi.classList.add('sichtbar', 'erreicht');
      this.erreichtZeit = 3;
      const erreicht = { id: this.ziel, name: p.name, bild: p.bild };
      this.navigationAus();
      if (this._beiZielErreicht) this._beiZielErreicht(erreicht);
      return;
    }

    // Wohin schaut die Kamera? "Vorne" = (−sin θ, −cos θ), "rechts" = (cos θ, −sin θ)
    const s = Math.sin(kameraWinkel), c = Math.cos(kameraWinkel);
    const vorne = -dx * s - dz * c;
    const rechts = dx * c - dz * s;
    const sollWinkel = Math.atan2(rechts, vorne); // 0 = geradeaus, + = nach rechts drehen
    // Weich nachdrehen, damit der Pfeil nicht zappelt
    this.pfeilWinkel += kurzerWinkel(sollWinkel - this.pfeilWinkel) * Math.min(1, dt * 10);
    this.naviPfeil.style.transform = `rotate(${(this.pfeilWinkel * 180) / Math.PI}deg)`;
    this.naviText.textContent = `${p.bild} ${p.name} · ${Math.round(entfernung)} m`;
    this.letzterSollWinkel = sollWinkel; // für Tests
  }
}
