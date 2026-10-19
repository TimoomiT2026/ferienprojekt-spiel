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

// Wie hoch ist der Boden an der Stelle (x, z)?
export function bodenHoehe(x, z) {
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
  const g = gewichteBerechnen(x, z, y, steil);
  return { wiese: g[1], wald: g[2], sand: g[0], fels: g[3], pfad: g[4] };
}

const GITTER = { n: 0 };

// Schnelles Nachschauen (nach baueGelaende): Höhe und Bodenart an (x, z)
export function gitterWerte(x, z) {
  const { n, groesse } = GITTER;
  const gx = THREE.MathUtils.clamp((x / groesse + 0.5) * (n - 1), 0, n - 1.001);
  const gz = THREE.MathUtils.clamp((z / groesse + 0.5) * (n - 1), 0, n - 1.001);
  const ix = Math.floor(gx), iz = Math.floor(gz);
  const fx = gx - ix, fz = gz - iz;
  const i00 = iz * n + ix, i10 = i00 + 1, i01 = i00 + n, i11 = i01 + 1;
  const mix = (a, i) => {
    const w00 = (1 - fx) * (1 - fz), w10 = fx * (1 - fz), w01 = (1 - fx) * fz, w11 = fx * fz;
    return a(i00) * w00 + a(i10) * w10 + a(i01) * w01 + a(i11) * w11;
  };
  const h = GITTER.hoehen;
  const A = GITTER.gewA;
  return {
    hoehe: mix((i) => h[i]),
    sand: mix((i) => A[i * 4]),
    wiese: mix((i) => A[i * 4 + 1]),
    wald: mix((i) => A[i * 4 + 2]),
    fels: mix((i) => A[i * 4 + 3]),
    pfad: mix((i) => GITTER.gewB[i * 2]),
  };
}

export function baueGelaende() {
  const texturen = {
    gras: textur('gras.jpg'),
    sand: textur('sand.jpg'),
    waldboden: textur('waldboden.jpg'),
    fels: textur('fels.jpg'),
    pfad: textur('pfad.jpg'),
  };
  const groesse = (R + 90) * 2;
  const unterteilung = 288;
  const geo = new THREE.PlaneGeometry(groesse, groesse, unterteilung, unterteilung);
  geo.rotateX(-Math.PI / 2);
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
    const g = gewichteBerechnen(x, z, y, 1 - normalen.getY(i));
    gewA.set([g[0], g[1], g[2], g[3]], i * 4);
    gewB.set([g[4], g[5]], i * 2);
    // Große helle und dunkle Flecken, damit die Wiese nicht wie ein Teppich aussieht
    const fleck = 0.82 + fbm(x * 0.02, z * 0.02, 3, 5) * 0.36;
    const gelb = fbm(x * 0.012 + 9, z * 0.012, 2, 6);
    const nass = y < 0.6 ? 0.7 : 1; // nasser Sand ist dunkler
    farben.set([fleck * nass * (0.96 + gelb * 0.1), fleck * nass, fleck * nass * (0.95 - gelb * 0.08)], i * 3);
  }
  // Merken für später: Pflanzen schauen hier schnell nach, statt alles neu zu rechnen
  GITTER.n = unterteilung + 1;
  GITTER.groesse = groesse;
  GITTER.hoehen = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) GITTER.hoehen[i] = pos.getY(i);
  GITTER.gewA = gewA;
  GITTER.gewB = gewB;

  geo.setAttribute('gewichtA', new THREE.BufferAttribute(gewA, 4));
  geo.setAttribute('gewichtB', new THREE.BufferAttribute(gewB, 2));
  geo.setAttribute('color', new THREE.BufferAttribute(farben, 3));

  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      tGras: { value: texturen.gras },
      tSand: { value: texturen.sand },
      tWald: { value: texturen.waldboden },
      tFels: { value: texturen.fels },
      tPfad: { value: texturen.pfad },
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
        varying vec4 vGewichtA;
        varying vec2 vGewichtB;
        varying vec3 vWeltPos;
        varying vec3 vWeltNormale;`)
      .replace('#include <map_fragment>', `
        // Jede Bodenart ist ein Foto, das sich wie eine Tapete wiederholt.
        // Zwei Größen gemischt, damit man das Muster nicht erkennt.
        vec2 uv = vWeltPos.xz / 4.0;
        vec3 cGras = mix(texture2D(tGras, uv).rgb, texture2D(tGras, uv * 0.21 + 0.37).rgb, 0.45);
        vec3 cSand = mix(texture2D(tSand, uv * 0.7).rgb, texture2D(tSand, uv * 0.13).rgb, 0.4);
        vec3 cWald = texture2D(tWald, uv * 0.6).rgb;
        vec3 cPfad = texture2D(tPfad, uv * 0.55).rgb;
        // Fels von drei Seiten "projizieren", damit Klippen nicht verschmiert aussehen
        vec3 nb = pow(abs(normalize(vWeltNormale)), vec3(3.0));
        nb /= (nb.x + nb.y + nb.z);
        vec3 cFels = texture2D(tFels, vWeltPos.zy / 9.0).rgb * nb.x
                   + texture2D(tFels, vWeltPos.xz / 9.0).rgb * nb.y
                   + texture2D(tFels, vWeltPos.xy / 9.0).rgb * nb.z;
        vec3 cSchnee = vec3(0.86, 0.89, 0.93) * (0.9 + 0.1 * cFels.r);
        vec3 bodenFarbe = cSand * vGewichtA.x + cGras * vGewichtA.y * 1.1 + cWald * vGewichtA.z
                        + cFels * vGewichtA.w + cPfad * vGewichtB.x + cSchnee * vGewichtB.y;
        diffuseColor.rgb *= bodenFarbe;`);
  };
  material.customProgramCacheKey = () => 'gelaende';

  const boden = new THREE.Mesh(geo, material);
  boden.receiveShadow = true;
  return boden;
}
