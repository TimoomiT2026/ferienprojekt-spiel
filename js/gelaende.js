// =============================================================
//  DAS GELÄNDE – Berge, Täler, Strand, Seen und der Trampelpfad
// =============================================================
import * as THREE from 'three';
import { EINSTELLUNGEN } from './einstellungen.js';
import { fbm } from './rauschen.js';
import { textur } from './texturen.js';

export const WASSER_HOEHE = 0;
const R = EINSTELLUNGEN.inselGroesse;

// Wo liegt das Dorf? (irgendwo im Nordosten der Insel)
export const DORF = { x: R * 0.55, z: -R * 0.42, radius: 24, hoehe: 4 };

// Der Trampelpfad vom Zelt zum Dorf – leicht geschlängelt
const PFAD = [];
for (let i = 0; i <= 16; i++) {
  const t = i / 16;
  const x = DORF.x * t + Math.sin(t * Math.PI * 3) * 12;
  const z = DORF.z * t + Math.sin(t * Math.PI * 2) * 15;
  PFAD.push([x, z]);
}

// Wie weit ist (x, z) vom Trampelpfad entfernt?
export function abstandZumPfad(x, z) {
  let min = Infinity;
  for (let i = 0; i < PFAD.length - 1; i++) {
    const [ax, az] = PFAD[i], [bx, bz] = PFAD[i + 1];
    const dx = bx - ax, dz = bz - az;
    const t = THREE.MathUtils.clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
    min = Math.min(min, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
  }
  return min;
}

export function abstandZumDorf(x, z) {
  return Math.hypot(x - DORF.x, z - DORF.z);
}

// Ist hier Wald? (Wald wächst in großen Flecken)
export function istWald(x, z) {
  return fbm(x * 0.008 + 50, z * 0.008 + 50, 3, 9) > 0.56;
}

// =============================================================
//  DIE INSELGRUPPE – die anderen Inseln (Zahlen in einstellungen.js)
// =============================================================
const S = THREE.MathUtils.smoothstep;
const GRAD = Math.PI / 180;
// Ab hier ist die Startinsel nur noch Meeresboden (Küste höchstens R · 1,225 + 8 m)
const START_REICHWEITE = R * 1.225 + 10;

// Kürzester Winkel-Abstand (Bogenmaß, −π … +π)
const winkelAbstand = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

// Die Inseln aus den Einstellungen, mit ein paar ausgerechneten Werten
const NEUE_INSELN = (EINSTELLUNGEN.inseln || []).map((e) => {
  const I = { ...e, seed: e.seed ?? 1 };
  if (I.klippen) {
    I.klippenHoehe ??= 21;
    I.wandBreite ??= 5;
    I.buchtTiefe ??= 22;
    I.buchtWinkel = (I.buchten || []).map((g) => g * GRAD);
    // Die Lagune liegt mitten auf dem Plateau
    I.lagune = {
      x: I.x, z: I.z,
      radius: I.laguneRadius ?? 16,
      tiefe: I.laguneTiefe ?? 4.5,
      wasserHoehe: I.klippenHoehe - 1, // Wasserspiegel: 1 m unter dem Plateau
    };
    // So weit reicht die Insel (danach nur Meeresboden)
    I.reichweite = I.radius * 1.12 + 52;
  } else {
    I.huegelHoehe ??= 8;
    if (I.dorfPlatz) I.dorf = { x: I.x + I.dorfPlatz.x, z: I.z + I.dorfPlatz.z, radius: I.dorfPlatz.radius ?? 20, hoehe: I.dorfPlatz.hoehe ?? 3 };
    I.reichweite = I.radius * 1.15 + 40;
  }
  return I;
});

// Klippeninsel: oben ein Plateau, rundherum eine fast senkrechte Felswand.
// In den Buchten liegt unten ein kleiner Strand.
// Wo ist die Felswand in dieser Richtung? (oben = Kante, fuss = unten, bucht = 0 … 1)
function klippenWand(I, dx, dz) {
  const w = Math.atan2(dz, dx);
  const s = I.seed, c = Math.cos(w), n = Math.sin(w);
  // Wie stark ist hier eine Bucht? (0 = keine, 1 = mitten in der Bucht)
  let bucht = 0;
  for (const bw of I.buchtWinkel) bucht = Math.max(bucht, Math.exp(-((winkelAbstand(w, bw) / 0.26) ** 2)));
  const kueste = I.radius * (1 + (fbm(c * 1.3 + s, n * 1.3 + s, 3, s) - 0.5) * 0.2);
  // Zacken in der Wand: Felsrippen von oben nach unten
  const zacken = (fbm(c * 7 + s, n * 7 - s, 3, s + 3) - 0.5) * 5;
  const oben = kueste - 4 - bucht * I.buchtTiefe + zacken; // Kante oben
  return { oben, fuss: oben + I.wandBreite, bucht };
}

function klippenHoehe(I, dx, dz, d) {
  const { oben, fuss, bucht } = klippenWand(I, dx, dz);
  const s = I.seed;
  const fussHoehe = THREE.MathUtils.lerp(-2.5, 1.5, bucht); // in der Bucht: Strand
  if (d > fuss) {
    // Vor der Wand: Strand (in der Bucht) und dann ab ins tiefe Meer
    const t = S(d, fuss, fuss + THREE.MathUtils.lerp(22, 45, bucht));
    return THREE.MathUtils.lerp(fussHoehe, -7, t);
  }
  const x = I.x + dx, z = I.z + dz;
  // Oben: welliges Plateau – rund um die Lagune ganz flach
  const L = I.lagune;
  const dl = Math.hypot(x - L.x, z - L.z);
  const wellig = (fbm(x * 0.02, z * 0.02, 3, s + 5) - 0.5) * 4 * S(dl, L.radius, L.radius + 25);
  let plateau = I.klippenHoehe + wellig;
  // Die Lagune: eine runde Mulde mit Wasser drin
  plateau -= L.tiefe * (1 - S(dl, L.radius * 0.35, L.radius * 1.1));
  if (d <= oben) return plateau;
  // In der Wand: weich gerundet oben und unten, steil in der Mitte (wie im Comic)
  return THREE.MathUtils.lerp(plateau, fussHoehe, S(d, oben, fuss));
}

// Flache Insel: breiter Sandstrand, Dünen und ein sanfter Hügel in der Mitte
function flacheInselHoehe(I, dx, dz, d) {
  const w = Math.atan2(dz, dx);
  const s = I.seed;
  const kueste = I.radius * (1 + (fbm(Math.cos(w) * 1.5 + s, Math.sin(w) * 1.5 + s, 3, s) - 0.5) * 0.3) + 25;
  const land = 1 - S(d, kueste - 40, kueste + 8);
  const x = I.x + dx, z = I.z + dz;
  const duenen = (fbm(x * 0.03, z * 0.03, 3, s + 1) - 0.5) * 2.4;
  const mitte = Math.pow(1 - S(d, 0, kueste * 0.75), 1.4);
  const huegel = mitte * I.huegelHoehe * (0.7 + 0.6 * fbm(x * 0.02, z * 0.02, 3, s + 2));
  let h = land * (1.9 + duenen * land + huegel) - (1 - land) * 7;
  // Der Dorfplatz ist schön flach
  if (I.dorf) h = THREE.MathUtils.lerp(I.dorf.hoehe, h, S(Math.hypot(x - I.dorf.x, z - I.dorf.z), I.dorf.radius, I.dorf.radius + 20));
  return h;
}

// Wald-Flecken auf den neuen Inseln (nur vom Ort abhängig)
function istInselWald(I, x, z) {
  return fbm(x * 0.012 + I.seed * 7, z * 0.012 - I.seed, 3, I.seed + 9) > (I.klippen ? 0.53 : 0.62);
}

// Bodenarten auf den neuen Inseln: [Sand, Wiese, Waldboden, Fels, Pfad, Schnee]
function inselGewichte(I, x, z, y, steil) {
  const wackel = (fbm(x * 0.09, z * 0.09, 3, 12) - 0.5) * 1.2;
  let fels = S(steil + wackel * 0.08, 0.2, 0.34); // steile Wände sind Fels
  let sand;
  if (I.klippen) {
    // An der Klippe ist schon ein bisschen schräg = Fels (sonst gibt es Sand-Zacken an der Wand)
    fels = Math.max(fels, S(steil, 0.08, 0.16) * S(y, 1.0, 2.2));
    // Die ganze Wand (von der Kante bis kurz vor dem Fuß) ist Fels
    const dx = x - I.x, dz = z - I.z, d = Math.hypot(dx, dz);
    const wand = klippenWand(I, dx, dz);
    if (d > wand.oben - 0.5 && d < wand.fuss + 1.5) fels = 1;
    sand = 1 - S(y + wackel * 0.5, 1.1, 2.0);
    // Ein Sandufer rund um die Lagune
    const L = I.lagune;
    sand = Math.max(sand, 1 - S(Math.hypot(x - L.x, z - L.z) + wackel * 2, L.radius * 0.95, L.radius * 1.25));
  } else {
    sand = 1 - S(y + wackel * 0.8, 2.6, 3.6);
    // Sandflecken auch weiter oben
    sand = Math.max(sand, S(fbm(x * 0.02, z * 0.02, 2, I.seed + 5) + wackel * 0.1, 0.6, 0.7) * 0.8);
  }
  let wald = istInselWald(I, x, z) && y > 2.5 ? 0.6 + fbm(x * 0.03, z * 0.03, 2, 3) * 0.4 : 0;
  fels = Math.min(fels, 1);
  sand *= 1 - fels;
  const rest = Math.max(0, 1 - sand - fels);
  wald *= rest;
  return [sand, rest - wald, wald, fels, 0, 0];
}

// Auf welcher neuen Insel liegt (x, z)? (oder null) – zählt das flache Wasser am Ufer mit
function neueInselBei(x, z) {
  for (const I of NEUE_INSELN) if (Math.hypot(x - I.x, z - I.z) < I.radius * 1.3) return I;
  return null;
}

// ---------- Hilfen für andere Teile des Spiels ----------
// Auf welcher Insel ist man? Ergibt den Namen ('Startinsel', 'Klippeninsel', …) oder null (offenes Meer)
export function aufWelcherInsel(x, z) {
  if (Math.hypot(x, z) < R * 1.25) return 'Startinsel';
  const I = neueInselBei(x, z);
  return I ? I.name : null;
}

// Wie hoch steht das Wasser an (x, z)? Meer = WASSER_HOEHE (0), in der Lagune oben auf dem Plateau höher.
export function wasserHoeheBei(x, z) {
  for (const I of NEUE_INSELN) {
    const L = I.lagune;
    if (L && Math.abs(x - L.x) < L.radius * 1.15 && Math.abs(z - L.z) < L.radius * 1.15 && Math.hypot(x - L.x, z - L.z) < L.radius * 1.15) return L.wasserHoehe;
  }
  return WASSER_HOEHE;
}

// Ist das eine Klippen-Felswand? (Da kann man nicht hochlaufen und nicht aussteigen)
export function istKlippenWand(x, z) {
  const I = neueInselBei(x, z);
  if (!I || !I.klippen) return false;
  const dx = bodenHoehe(x + 0.7, z) - bodenHoehe(x - 0.7, z);
  const dz = bodenHoehe(x, z + 0.7) - bodenHoehe(x, z - 0.7);
  return Math.hypot(dx, dz) / 1.4 > EINSTELLUNGEN.maxSteigung;
}

// Ist ein Schritt von (ax, az) nach (bx, bz) zu steil bergauf?
// (Es zählt der Boden, nicht die Füße – sonst könnte man die Klippe hochhüpfen!)
export function zuSteilBergauf(ax, az, bx, bz) {
  const I = neueInselBei(bx, bz);
  if (!I || !I.klippen) return false; // nur an den Klippen – die Startinsel bleibt, wie sie ist
  const weg = Math.max(Math.hypot(bx - ax, bz - az), 0.01);
  const hoch = bodenHoehe(bx, bz) - bodenHoehe(ax, az);
  if (hoch > weg * EINSTELLUNGEN.maxSteigung + 0.02) return true;
  // Auch nicht schräg (im Zickzack) an der Wand hoch
  return hoch > 0.005 && istKlippenWand(bx, bz);
}

// Wie weit darf man mit dem Boot aufs Meer? (um jede Insel herum ein Stück)
const MEER_RAND = 160;
export function imErlaubtenMeer(x, z) {
  if (Math.hypot(x, z) < R + MEER_RAND) return true;
  for (const I of NEUE_INSELN) if (Math.hypot(x - I.x, z - I.z) < I.radius + MEER_RAND) return true;
  return false;
}

// So groß ist die ganze Welt (ein Quadrat um alle Inseln) – für Karte und Wasser
export const WELT = (() => {
  let minX = -(R + 90), maxX = R + 90, minZ = -(R + 90), maxZ = R + 90;
  for (const I of NEUE_INSELN) {
    minX = Math.min(minX, I.x - I.reichweite); maxX = Math.max(maxX, I.x + I.reichweite);
    minZ = Math.min(minZ, I.z - I.reichweite); maxZ = Math.max(maxZ, I.z + I.reichweite);
  }
  const halb = Math.max(maxX - minX, maxZ - minZ) / 2 + 20;
  return { mitteX: (minX + maxX) / 2, mitteZ: (minZ + maxZ) / 2, halb };
})();

// Wo kann man mit dem Boot anlegen? Wir fahren von der Inselmitte nach außen,
// bis nach dem Land das erste Wasser kommt, in dem ein Boot schwimmt.
function anlegestelleSuchen(I, winkel) {
  const c = Math.cos(winkel), n = Math.sin(winkel);
  let land = null;
  for (let d = I.radius * 0.4; d < I.reichweite; d += 0.5) {
    const h = bodenHoehe(I.x + c * d, I.z + n * d);
    if (h > 0.3) land = d;
    else if (land !== null && h < -0.45) {
      // x, z = hier schwimmt das Boot (ca. 2–3 m vor dem trockenen Strand); strandX/Z = trockener Strand
      return { x: I.x + c * d, z: I.z + n * d, strandX: I.x + c * (land - 2), strandZ: I.z + n * (land - 2) };
    }
  }
  return null;
}

// Alle Inseln mit ihren wichtigen Orten – für andere Teile des Spiels
// (Seilkanone, Insadorium, zweites Dorf …)
export const INSELN = [
  { name: 'Startinsel', x: 0, z: 0, radius: R, klippen: false, dorfPlatz: { ...DORF }, anlegestellen: [] },
  ...NEUE_INSELN.map((I) => {
    const info = { name: I.name, x: I.x, z: I.z, radius: I.radius, reichweite: I.reichweite, klippen: !!I.klippen };
    if (I.klippen) {
      info.plateauHoehe = I.klippenHoehe; // ungefähr (das Plateau ist etwas wellig, ±2 m)
      const L = I.lagune;
      info.lagune = { x: L.x, z: L.z, radius: L.radius, tiefe: L.tiefe, wasserHoehe: L.wasserHoehe, grundHoehe: bodenHoehe(L.x, L.z) };
      info.anlegestellen = I.buchtWinkel.map((w) => anlegestelleSuchen(I, w)).filter(Boolean);
      info.dorfPlatz = null;
    } else {
      // Rundherum ist Strand – vier Stellen, die erste zeigt zur Startinsel
      const zurMitte = Math.atan2(-I.z, -I.x);
      info.anlegestellen = [0, 1, 2, 3].map((k) => anlegestelleSuchen(I, zurMitte + (k * Math.PI) / 2)).filter(Boolean);
      info.dorfPlatz = I.dorf ? { ...I.dorf } : null;
    }
    return info;
  }),
];

// Wie hoch ist der Boden an der Stelle (x, z)? (alle Inseln zusammen)
// Zwischen den Inseln ist überall Meeresboden (−7 m).
export function bodenHoehe(x, z) {
  // Weit draußen ist die Startinsel sowieso nur Meeresboden – das spart Rechnen
  let h = x * x + z * z > START_REICHWEITE * START_REICHWEITE ? -7 : startInselHoehe(x, z);
  for (const I of NEUE_INSELN) {
    const dx = x - I.x, dz = z - I.z;
    if (Math.abs(dx) > I.reichweite || Math.abs(dz) > I.reichweite) continue;
    const d = Math.hypot(dx, dz);
    if (d >= I.reichweite) continue;
    h = Math.max(h, I.klippen ? klippenHoehe(I, dx, dz, d) : flacheInselHoehe(I, dx, dz, d));
  }
  return h;
}

// Die Startinsel (so wie sie seit Tag 1 ist – bitte nicht ändern, sonst
// passen alte Spielstände nicht mehr: Bäume und Grabestellen würden wandern!)
function startInselHoehe(x, z) {
  const r = Math.hypot(x, z);
  const w = Math.atan2(z, x);
  // Küste: nicht kreisrund, sondern mit Buchten und Landzungen
  const kueste = R + (fbm(Math.cos(w) * 1.6 + 10, Math.sin(w) * 1.6 + 10, 3, 7) - 0.5) * R * 0.45;
  const insel = 1 - THREE.MathUtils.smoothstep(r, kueste - 45, kueste + 8);

  // Sanfte Hügel überall
  const huegel = (fbm(x * 0.012, z * 0.012, 4, 1) - 0.5) * 14;
  // Ein paar richtige Berge
  const bergMaske = THREE.MathUtils.smoothstep(fbm(x * 0.005 + 3, z * 0.005 + 3, 3, 2), 0.55, 0.72);
  const berg = bergMaske * (18 + 22 * fbm(x * 0.025, z * 0.025, 4, 4));

  // Rund ums Zelt bleibt es flach, damit man gut starten kann
  const startFlach = THREE.MathUtils.smoothstep(r, 15, 50);
  let h = insel * (2.6 + (huegel + berg) * startFlach) - (1 - insel) * 7;

  // Das Dorf steht auf einer flachen Wiese
  const dorfFlach = THREE.MathUtils.smoothstep(abstandZumDorf(x, z), DORF.radius, DORF.radius + 25);
  h = THREE.MathUtils.lerp(DORF.hoehe, h, dorfFlach);

  // Der Pfad ist immer begehbar (auch als Damm durch einen See)
  const pfad = 1 - THREE.MathUtils.smoothstep(abstandZumPfad(x, z), 2, 6);
  if (h < 2.2) h = THREE.MathUtils.lerp(h, 2.2, pfad);
  return h;
}

// Woraus besteht der Boden an dieser Stelle? Ergibt Anteile (zusammen 1):
// Sand, Wiese, Waldboden, Fels, Pfad, Schnee
function gewichteBerechnen(x, z, y, steil) {
  const S = THREE.MathUtils.smoothstep;
  const wackel = (fbm(x * 0.09, z * 0.09, 3, 12) - 0.5) * 1.2; // macht die Grenzen natürlich
  let sand = 1 - S(y + wackel * 0.5, 1.1, 2.0);
  let fels = Math.max(S(steil + wackel * 0.08, 0.2, 0.34), S(y + wackel * 3, 15, 21));
  let schnee = S(y + wackel * 3, 29, 34) * (1 - S(steil, 0.45, 0.6));
  let wald = istWald(x, z) ? 0.55 + fbm(x * 0.03, z * 0.03, 2, 3) * 0.45 : fbm(x * 0.04, z * 0.04, 2, 8) > 0.66 ? 0.35 : 0;
  const pfadNah = 1 - S(abstandZumPfad(x, z) + wackel * 0.6, 1.0, 2.4);
  const dorfNah = (1 - S(abstandZumDorf(x, z) + wackel * 2, 6, 10)) * 0.8;
  let pfad = Math.max(pfadNah, dorfNah) * (y > 0.3 ? 1 : 0);
  // Reihenfolge: Schnee > Fels > Pfad > Sand > Wald > Wiese
  fels *= 1 - schnee;
  pfad *= 1 - fels - schnee;
  sand *= 1 - fels - schnee - pfad;
  const rest = Math.max(0, 1 - sand - fels - schnee - pfad);
  wald = wald * rest;
  const wiese = rest - wald;
  return [sand, wiese, wald, fels, pfad, schnee];
}

// Für Pflanzen: Wie viel Wiese ist hier? (0 = gar keine, 1 = nur Wiese)
export function wiesenAnteil(x, z) {
  const y = bodenHoehe(x, z);
  const dx = bodenHoehe(x + 1, z) - bodenHoehe(x - 1, z);
  const dz = bodenHoehe(x, z + 1) - bodenHoehe(x, z - 1);
  const steil = 1 - 1 / Math.sqrt(1 + (dx * dx + dz * dz) / 4);
  const I = neueInselBei(x, z);
  const g = I ? inselGewichte(I, x, z, y, steil) : gewichteBerechnen(x, z, y, steil);
  return { wiese: g[1], wald: g[2], sand: g[0], fels: g[3], pfad: g[4] };
}

// Ein "Gitter" merkt sich Höhe und Bodenart an vielen Punkten.
// Die Startinsel hat eins, jede neue Insel hat ihr eigenes.
const GITTER = { n: 0, mitteX: 0, mitteZ: 0 };
const INSEL_GITTER = []; // { insel, n, groesse, mitteX, mitteZ, hoehen, gewA, gewB }

// Schnelles Nachschauen (nach baueGelaende): Höhe und Bodenart an (x, z)
export function gitterWerte(x, z) {
  let G = GITTER;
  for (const g of INSEL_GITTER) {
    if (Math.abs(x - g.mitteX) < g.groesse / 2 && Math.abs(z - g.mitteZ) < g.groesse / 2) {
      G = g;
      break;
    }
  }
  const { n, groesse } = G;
  const gx = THREE.MathUtils.clamp(((x - G.mitteX) / groesse + 0.5) * (n - 1), 0, n - 1.001);
  const gz = THREE.MathUtils.clamp(((z - G.mitteZ) / groesse + 0.5) * (n - 1), 0, n - 1.001);
  const ix = Math.floor(gx), iz = Math.floor(gz);
  const fx = gx - ix, fz = gz - iz;
  const i00 = iz * n + ix, i10 = i00 + 1, i01 = i00 + n, i11 = i01 + 1;
  const mix = (a, i) => {
    const w00 = (1 - fx) * (1 - fz), w10 = fx * (1 - fz), w01 = (1 - fx) * fz, w11 = fx * fz;
    return a(i00) * w00 + a(i10) * w10 + a(i01) * w01 + a(i11) * w11;
  };
  const h = G.hoehen;
  const A = G.gewA;
  return {
    hoehe: mix((i) => h[i]),
    sand: mix((i) => A[i * 4]),
    wiese: mix((i) => A[i * 4 + 1]),
    wald: mix((i) => A[i * 4 + 2]),
    fels: mix((i) => A[i * 4 + 3]),
    pfad: mix((i) => G.gewB[i * 2]),
    insel: G.insel ? G.insel.name : null, // null = Startinsel
  };
}

// Baut ein Stück Boden: Netz mit Höhen, Bodenarten und Farben.
// gewichte(x, z, y, steil) sagt, welche Bodenart wo ist.
function baueFeld(mitteX, mitteZ, groesse, unterteilung, gewichte, gitter) {
  const geo = new THREE.PlaneGeometry(groesse, groesse, unterteilung, unterteilung);
  geo.rotateX(-Math.PI / 2);
  if (mitteX || mitteZ) geo.translate(mitteX, 0, mitteZ);
  geo.deleteAttribute('uv');
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, bodenHoehe(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();

  // Für jede Ecke: Anteile der Bodenarten + eine leichte Farbschwankung
  const normalen = geo.attributes.normal;
  const gewA = new Float32Array(pos.count * 4);
  const gewB = new Float32Array(pos.count * 2);
  const farben = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const g = gewichte(x, z, y, 1 - normalen.getY(i));
    gewA.set([g[0], g[1], g[2], g[3]], i * 4);
    gewB.set([g[4], g[5]], i * 2);
    // Große helle und dunkle Flecken, damit die Wiese nicht wie ein Teppich aussieht
    const fleck = 0.84 + fbm(x * 0.02, z * 0.02, 3, 5) * 0.32;
    const gelb = fbm(x * 0.012 + 9, z * 0.012, 2, 6);
    farben.set([fleck * (0.96 + gelb * 0.12), fleck, fleck * (0.95 - gelb * 0.1)], i * 3);
  }
  // Merken für später: Pflanzen schauen hier schnell nach, statt alles neu zu rechnen
  gitter.n = unterteilung + 1;
  gitter.groesse = groesse;
  gitter.mitteX = mitteX;
  gitter.mitteZ = mitteZ;
  gitter.hoehen = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) gitter.hoehen[i] = pos.getY(i);
  gitter.gewA = gewA;
  gitter.gewB = gewB;

  geo.setAttribute('gewichtA', new THREE.BufferAttribute(gewA, 4));
  geo.setAttribute('gewichtB', new THREE.BufferAttribute(gewB, 2));
  geo.setAttribute('color', new THREE.BufferAttribute(farben, 3));
  return geo;
}

// Dreiecke ganz unten im tiefen Meer braucht man nicht (spart Arbeit beim Malen)
function tiefenWegschneiden(geo) {
  const y = geo.attributes.position;
  const alt = geo.index.array;
  const neu = [];
  for (let i = 0; i < alt.length; i += 3) {
    const a = alt[i], b = alt[i + 1], c = alt[i + 2];
    if (Math.max(y.getY(a), y.getY(b), y.getY(c)) > -6.95) neu.push(a, b, c);
  }
  geo.setIndex(neu);
  return geo;
}

// Die neuen Inseln werden nur gemalt, wenn man nah genug dran ist
// (weiter weg ist eh alles im Dunst). Das hält das iPad schnell.
const INSEL_SICHTWEITE = 360; // Meter hinter der Küste
const inselTeile = []; // { insel, gruppe }
export function aktualisiereInseln(pos) {
  for (const t of inselTeile) {
    t.gruppe.visible = Math.hypot(pos.x - t.insel.x, pos.z - t.insel.z) < t.insel.reichweite + INSEL_SICHTWEITE;
  }
}

// Wasser für die Lagune oben auf dem Plateau (liegt höher als das Meer)
function baueLagune(L) {
  const geo = new THREE.CircleGeometry(L.radius * 1.15, 48);
  geo.rotateX(-Math.PI / 2);
  const material = new THREE.MeshStandardMaterial({
    color: '#2fb3b0', roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.72,
  });
  const wasser = new THREE.Mesh(geo, material);
  wasser.position.set(L.x, L.wasserHoehe, L.z);
  wasser.receiveShadow = true;
  return wasser;
}

export function baueGelaende() {
  const texturen = {
    gras: textur('gras.jpg'),
    sand: textur('sand.jpg'),
    waldboden: textur('waldboden.jpg'),
    fels: textur('fels.jpg'),
    pfad: textur('pfad.jpg'),
    // "Normal Maps" = Beulen-Bilder: sie sagen dem Licht, wo kleine Hügelchen,
    // Steinchen und Halme sind. Dann wirft der Boden winzige Schatten.
    grasBeulen: textur('gras_normal.jpg', { farbe: false }),
    sandBeulen: textur('sand_normal.jpg', { farbe: false }),
    waldBeulen: textur('waldboden_normal.jpg', { farbe: false }),
    pfadBeulen: textur('pfad_normal.jpg', { farbe: false }),
    felsBeulen: textur('fels_normal.jpg', { farbe: false }),
  };
  // Die Startinsel – genau wie früher
  const geo = baueFeld(0, 0, (R + 90) * 2, 288, gewichteBerechnen, GITTER);

  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      tGras: { value: texturen.gras },
      tSand: { value: texturen.sand },
      tWald: { value: texturen.waldboden },
      tFels: { value: texturen.fels },
      tPfad: { value: texturen.pfad },
      tGrasN: { value: texturen.grasBeulen },
      tSandN: { value: texturen.sandBeulen },
      tWaldN: { value: texturen.waldBeulen },
      tPfadN: { value: texturen.pfadBeulen },
      tFelsN: { value: texturen.felsBeulen },
    });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec4 gewichtA;
        attribute vec2 gewichtB;
        varying vec4 vGewichtA;
        varying vec2 vGewichtB;
        varying vec3 vWeltPos;
        varying vec3 vWeltNormale;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vGewichtA = gewichtA;
        vGewichtB = gewichtB;
        vWeltPos = (modelMatrix * vec4(position, 1.0)).xyz;
        vWeltNormale = normalize(mat3(modelMatrix) * normal);`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D tGras, tSand, tWald, tFels, tPfad;
        uniform sampler2D tGrasN, tSandN, tWaldN, tPfadN, tFelsN;
        varying vec4 vGewichtA;
        varying vec2 vGewichtB;
        varying vec3 vWeltPos;
        varying vec3 vWeltNormale;
        float helligkeitVon(vec3 c) { return dot(c, vec3(0.3, 0.5, 0.2)); }
        // Beulen-Bild lesen: ergibt die Neigung (x, y) – 0 = ganz flach
        vec2 beule(sampler2D t, vec2 uv) { return texture2D(t, uv).xy * 2.0 - 1.0; }`)
      .replace('#include <map_fragment>', `
        // ---- Welche Bodenarten gibt es hier? (kommt aus gelaende.js) ----
        vec3 nGeo = normalize(vWeltNormale);
        float wSand = vGewichtA.x, wGras = vGewichtA.y, wWald = vGewichtA.z;
        float wFels = vGewichtA.w, wPfad = vGewichtB.x, wSchnee = vGewichtB.y;
        // Wie weit weg? Weit weg zeigen wir die Fotos größer, damit man
        // das Tapeten-Muster nicht sieht.
        float fern = smoothstep(18.0, 90.0, distance(vWeltPos, cameraPosition));
        float nah = 1.0 - fern;
        vec2 uv = vWeltPos.xz / 4.0;
        // Große, weiche Flecken (aus dem Felsfoto, ganz groß gezogen)
        float makro = texture2D(tFels, vWeltPos.xz / 190.0 + 0.3).g;

        vec3 cSand = vec3(0.0), cGras = vec3(0.0), cWald = vec3(0.0), cPfad = vec3(0.0), cFels = vec3(0.0);
        vec2 nSand = vec2(0.0), nGras = vec2(0.0), nWald = vec2(0.0), nPfad = vec2(0.0);
        vec3 nFels = nGeo;
        // Nur die Fotos lesen, die hier wirklich gebraucht werden (spart Arbeit!)
        if (wGras > 0.002) {
          cGras = mix(texture2D(tGras, uv).rgb, texture2D(tGras, uv * 0.21 + 0.37).rgb, 0.3 + 0.45 * fern);
          cGras *= 0.88 + 0.3 * makro;
          nGras = beule(tGrasN, uv) * nah;
        }
        if (wSand > 0.002) {
          cSand = mix(texture2D(tSand, uv * 0.7).rgb, texture2D(tSand, uv * 0.13).rgb, 0.35 + 0.4 * fern);
          nSand = beule(tSandN, uv * 0.7) * nah;
        }
        if (wWald > 0.002) {
          cWald = mix(texture2D(tWald, uv * 0.6).rgb, texture2D(tWald, uv * 0.17 + 0.5).rgb, 0.5 * fern);
          cWald *= 0.9 + 0.25 * makro;
          nWald = beule(tWaldN, uv * 0.6) * nah;
        }
        if (wPfad > 0.002) {
          cPfad = texture2D(tPfad, uv * 0.55).rgb;
          nPfad = beule(tPfadN, uv * 0.55) * nah;
        }
        if (wFels + wSchnee > 0.002) {
          // Fels von drei Seiten "projizieren", damit Klippen nicht verschmiert aussehen
          vec3 nb = pow(abs(nGeo), vec3(4.0));
          nb /= (nb.x + nb.y + nb.z);
          vec2 uvX = vWeltPos.zy / 9.0, uvY = vWeltPos.xz / 9.0, uvZ = vWeltPos.xy / 9.0;
          vec3 tx = vec3(0.0, 0.0, 1.0), ty = tx, tz = tx;
          if (nb.x > 0.01) { cFels += texture2D(tFels, uvX).rgb * nb.x; tx = texture2D(tFelsN, uvX).xyz * 2.0 - 1.0; }
          if (nb.y > 0.01) { cFels += texture2D(tFels, uvY).rgb * nb.y; ty = texture2D(tFelsN, uvY).xyz * 2.0 - 1.0; }
          if (nb.z > 0.01) { cFels += texture2D(tFels, uvZ).rgb * nb.z; tz = texture2D(tFelsN, uvZ).xyz * 2.0 - 1.0; }
          cFels /= max(nb.x * step(0.01, nb.x) + nb.y * step(0.01, nb.y) + nb.z * step(0.01, nb.z), 1e-3);
          // Beulen von drei Seiten zusammenmischen ("Whiteout"-Trick)
          tx = vec3(tx.xy * 0.6 + nGeo.zy, abs(tx.z) * nGeo.x);
          ty = vec3(ty.xy * 0.6 + nGeo.xz, abs(ty.z) * nGeo.y);
          tz = vec3(tz.xy * 0.6 + nGeo.xy, abs(tz.z) * nGeo.z);
          nFels = normalize(mix(nGeo, normalize(tx.zyx * nb.x + ty.xzy * nb.y + tz.xyz * nb.z), 0.3 + 0.5 * nah));
        }
        vec3 cSchnee = vec3(0.86, 0.89, 0.93) * (0.9 + 0.1 * cFels.r);

        // ---- Weiche, natürliche Übergänge ----
        // Helle Steinchen im Foto sind "höher": An der Grenze gewinnt, was
        // höher ist. So wächst Gras zwischen den Steinen, nicht als glatte Linie.
        vec3 wA = vec3(wSand, wGras * 1.1, wWald);
        vec3 wB = vec3(wFels, wPfad, wSchnee);
        vec3 hA = wA + vec3(helligkeitVon(cSand), helligkeitVon(cGras) * 1.2, helligkeitVon(cWald)) * 0.45 * step(0.002, wA);
        vec3 hB = wB + vec3(helligkeitVon(cFels) * 1.4, helligkeitVon(cPfad), 0.5) * 0.45 * step(0.002, wB);
        float hoechste = max(max(max(hA.x, hA.y), hA.z), max(max(hB.x, hB.y), hB.z)) - 0.22;
        wA = max(hA - hoechste, 0.0) * step(0.002, wA);
        wB = max(hB - hoechste, 0.0) * step(0.002, wB);
        float summe = max(wA.x + wA.y + wA.z + wB.x + wB.y + wB.z, 1e-4);
        wA /= summe; wB /= summe;

        vec3 bodenFarbe = cSand * wA.x + cGras * wA.y * 1.1 + cWald * wA.z
                        + cFels * wB.x + cPfad * wB.y + cSchnee * wB.z;
        vec2 beulen = nSand * wA.x * 0.25 + nGras * wA.y * 1.1 + nWald * wA.z + nPfad * wB.y * 1.2;
        vec3 bodenNormale = normalize(nGeo + vec3(beulen.x, 0.0, beulen.y) * 0.9);
        bodenNormale = normalize(mix(bodenNormale, nFels, wB.x + wB.z * 0.5));
        float bodenRauheit = dot(wA, vec3(0.88, 0.93, 0.96)) + dot(wB, vec3(0.78, 0.95, 0.55));

        // ---- Nasser Sand an der Wasserkante: dunkler und etwas glänzend ----
        float nass = 1.0 - smoothstep(0.15, 0.85, vWeltPos.y + (makro - 0.5) * 0.4);
        nass *= 1.0 - wB.x;
        bodenFarbe *= mix(vec3(1.0), vec3(0.55, 0.56, 0.6), nass);
        bodenRauheit = mix(bodenRauheit, 0.32, nass);
        bodenNormale = normalize(mix(bodenNormale, nGeo, nass * 0.6));
        diffuseColor.rgb *= bodenFarbe;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = bodenRauheit;`)
      .replace('#include <normal_fragment_maps>', `
        // Die Beulen-Richtung fürs Licht in "Kamera-Richtungen" umrechnen
        normal = normalize((viewMatrix * vec4(bodenNormale, 0.0)).xyz);`);
  };
  material.customProgramCacheKey = () => 'gelaende2';

  const boden = new THREE.Mesh(geo, material);
  boden.receiveShadow = true;
  const welt = new THREE.Group();
  welt.add(boden);

  // Die neuen Inseln: jede bekommt ihr eigenes Netz (gleiches Material = kein neues Grafik-Programm)
  for (const I of NEUE_INSELN) {
    const groesse = I.reichweite * 2;
    // Klippen brauchen feinere Maschen, sonst sieht die Wand verwaschen aus
    const masche = I.klippen ? 1.4 : 2.0;
    const gitter = { insel: I };
    const inselGeo = tiefenWegschneiden(baueFeld(I.x, I.z, groesse, Math.round(groesse / masche), (x, z, y, steil) => inselGewichte(I, x, z, y, steil), gitter));
    INSEL_GITTER.push(gitter);
    const gruppe = new THREE.Group();
    const netz = new THREE.Mesh(inselGeo, material);
    netz.receiveShadow = true;
    gruppe.add(netz);
    if (I.lagune) gruppe.add(baueLagune(I.lagune));
    gruppe.visible = false;
    inselTeile.push({ insel: I, gruppe });
    welt.add(gruppe);
  }
  return welt;
}
