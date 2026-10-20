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
    // "Normal Maps" = Beulen-Bilder: sie sagen dem Licht, wo kleine Hügelchen,
    // Steinchen und Halme sind. Dann wirft der Boden winzige Schatten.
    grasBeulen: textur('gras_normal.jpg', { farbe: false }),
    sandBeulen: textur('sand_normal.jpg', { farbe: false }),
    waldBeulen: textur('waldboden_normal.jpg', { farbe: false }),
    pfadBeulen: textur('pfad_normal.jpg', { farbe: false }),
    felsBeulen: textur('fels_normal.jpg', { farbe: false }),
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
    const fleck = 0.84 + fbm(x * 0.02, z * 0.02, 3, 5) * 0.32;
    const gelb = fbm(x * 0.012 + 9, z * 0.012, 2, 6);
    farben.set([fleck * (0.96 + gelb * 0.12), fleck, fleck * (0.95 - gelb * 0.1)], i * 3);
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
  return boden;
}
