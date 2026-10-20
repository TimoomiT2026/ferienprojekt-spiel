// =============================================================
//  ZAUBERPILZE – selten, leuchtend und magisch!
//  Sie wachsen nur im Wald, gern direkt bei einem Baum.
//  Pflücken → in den Rucksack. Essen → eine Minute lang fliegen!
//  Oder beim Händler teuer verkaufen.
//
//  Trick für das iPad: Alle Pilze zusammen kosten nur 4 Draw Calls
//  (Stiele, Hüte, Punkte, Glitzer), weil jedes Teil ein
//  "InstancedMesh" ist: einmal gebaut, ganz oft kopiert.
// =============================================================
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EINSTELLUNGEN } from './einstellungen.js';
import { zufallMitSeed } from './rauschen.js';
import { bodenHoehe, istWald, abstandZumDorf, abstandZumPfad, DORF } from './gelaende.js';
import { holzInDerNaehe } from './natur.js';

// Eigener Zufall – damit die Pilze immer an denselben Stellen wachsen
const zufall = zufallMitSeed(7331);

const MIN_ABSTAND = 30; // so weit stehen zwei Pilze mindestens auseinander (Meter)
const GLITZER_PRO_PILZ = 7; // kleine Funken, die um jeden Pilz schweben
const NAH = 45; // nur Pilze, die näher sind, werden animiert
const HUT_FARBEN = ['#e5243b', '#9b3dff', '#e5243b', '#c22fe0']; // rot und violett

// ---------- Die Form des Pilzes (in Metern) ----------
// Ein "Drehkörper": Wir malen eine halbe Umrisslinie und drehen sie einmal rundherum.
function drehkoerper(punkte, segmente = 28) {
  return new THREE.LatheGeometry(punkte.map(([r, y]) => new THREE.Vector2(r, y)), segmente);
}

// Färbt alle Punkte einer Form in einer Farbe ein
function eingefaerbt(geo, farbe) {
  const c = new THREE.Color(farbe);
  const n = geo.attributes.position.count;
  const f = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(f, i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(f, 3));
  return geo;
}

// Stiel + Lamellen (die Rillen unter dem Hut)
function baueStielForm() {
  // (Punkte von oben nach unten, damit die Flächen nach außen zeigen)
  const stiel = drehkoerper([
    [0.0, 0.35], [0.068, 0.34], [0.071, 0.27], [0.075, 0.2], [0.083, 0.12], [0.097, 0.055], [0.102, 0.025], [0.088, 0.004], [0.0, 0.0],
  ], 20);
  // Ein kleiner Ring (Manschette) am Stiel – typisch für Fliegenpilze
  const ring = drehkoerper([[0.073, 0.255], [0.094, 0.242], [0.106, 0.22], [0.078, 0.228]], 20);
  const lamellen = drehkoerper([[0.065, 0.335], [0.15, 0.302], [0.255, 0.275], [0.27, 0.273]], 28);
  return mergeGeometries([
    eingefaerbt(stiel.toNonIndexed(), '#f4ead3'),
    eingefaerbt(ring.toNonIndexed(), '#efe2c4'),
    eingefaerbt(lamellen.toNonIndexed(), '#dcc7a0'),
  ]);
}

// Der runde Hut (von der Spitze nach außen und unten)
const HUT_PUNKTE = [
  [0.0, 0.505], [0.07, 0.501], [0.135, 0.486], [0.195, 0.458], [0.245, 0.418], [0.28, 0.37], [0.3, 0.325], [0.305, 0.295], [0.296, 0.276], [0.272, 0.27],
];
function baueHutForm() {
  return drehkoerper(HUT_PUNKTE, 36);
}

// Weiße Punkte auf dem Hut
function baueTupfenForm() {
  const z = zufallMitSeed(12);
  const teile = [];
  const auf = new THREE.Vector3(0, 1, 0);
  // [Höhe auf dem Hut (0 = Spitze, 1 = Rand), Winkel]
  const plaetze = [[0.05, 0], [0.32, 0.4], [0.35, 2.3], [0.36, 4.3], [0.6, 1.3], [0.62, 3.3], [0.6, 5.3], [0.78, 0.2], [0.8, 2.6], [0.79, 4.9]];
  for (const [t, w] of plaetze) {
    // Punkt auf der Umrisslinie suchen
    const i = t * (HUT_PUNKTE.length - 3);
    const a = HUT_PUNKTE[Math.floor(i)], b = HUT_PUNKTE[Math.min(Math.floor(i) + 1, HUT_PUNKTE.length - 1)];
    const r = THREE.MathUtils.lerp(a[0], b[0], i % 1), y = THREE.MathUtils.lerp(a[1], b[1], i % 1);
    const winkel = w + (z() - 0.5) * 0.5;
    const pos = new THREE.Vector3(Math.sin(winkel) * r, y, Math.cos(winkel) * r);
    // So steht der Hut an dieser Stelle schräg (ungefähr von der Hut-Mitte weg)
    const normale = new THREE.Vector3(pos.x, (y - 0.26) * 1.3, pos.z).normalize();
    const g = 0.03 + z() * 0.022;
    const tupfen = new THREE.SphereGeometry(1, 10, 6);
    tupfen.applyMatrix4(new THREE.Matrix4().compose(
      pos.addScaledVector(normale, 0.002),
      new THREE.Quaternion().setFromUnitVectors(auf, normale),
      new THREE.Vector3(g, g * 0.32, g)
    ));
    teile.push(tupfen);
  }
  return mergeGeometries(teile);
}

// Der Hut leuchtet von innen in seiner eigenen Farbe – und pulsiert ganz leicht.
// (Dafür ändern wir das Programm der Grafikkarte, den "Shader", ein bisschen.)
function mitGlimmen(material, glimmen, zeit) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uGlimmen = glimmen;
    shader.uniforms.uZeit = zeit;
    shader.vertexShader = 'varying float vPhase;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vPhase = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.23;`
    );
    shader.fragmentShader = 'uniform float uGlimmen;\nuniform float uZeit;\nvarying float vPhase;\n' + shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      totalEmissiveRadiance += vColor.rgb * uGlimmen * (0.72 + 0.28 * sin(uZeit * 2.1 + vPhase));`
    );
  };
  material.customProgramCacheKey = () => 'pilz-glimmen';
  return material;
}

export class Pilze {
  constructor(szene, spiel) {
    this.spiel = spiel; // { rucksack, meldung, musik, tageszeit } (+ optional hindernisse)
    this.zeit = 0;
    this.nacht = 0; // 0 = Tag, 1 = Nacht (weich überblendet)
    this.spielerY = 0;
    this.letzterTag = spiel.tageszeit?.tag ?? 1;
    this.stellen = this.sucheStellen(spiel.hindernisse);

    // ---------- Die 4 Teile (4 Draw Calls für ALLE Pilze) ----------
    const n = this.stellen.length;
    this.uZeit = { value: 0 };
    this.uGlimmen = { value: 0.4 };
    this.stiele = new THREE.InstancedMesh(
      baueStielForm(),
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, emissive: '#fff0c8', emissiveIntensity: 0.12 }),
      n
    );
    this.huete = new THREE.InstancedMesh(
      baueHutForm(),
      mitGlimmen(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.38, metalness: 0 }), this.uGlimmen, this.uZeit),
      n
    );
    this.tupfen = new THREE.InstancedMesh(
      baueTupfenForm(),
      new THREE.MeshStandardMaterial({ color: '#fffaf0', roughness: 0.6, emissive: '#fff4dc', emissiveIntensity: 0.25 }),
      n
    );
    this.glitzer = new THREE.InstancedMesh(
      new THREE.OctahedronGeometry(0.05, 0),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
      n * GLITZER_PRO_PILZ
    );
    const glitzerFarben = ['#ffe27a', '#ff9ad5', '#c9a2ff', '#ffffff'].map((f) => new THREE.Color(f));
    this.stellen.forEach((s, i) => {
      this.huete.setColorAt(i, new THREE.Color(HUT_FARBEN[i % HUT_FARBEN.length]));
      for (let k = 0; k < GLITZER_PRO_PILZ; k++) this.glitzer.setColorAt(i * GLITZER_PRO_PILZ + k, glitzerFarben[(i + k) % glitzerFarben.length]);
    });
    for (const teil of [this.stiele, this.huete, this.tupfen, this.glitzer]) {
      teil.frustumCulled = false; // die Pilze sind über die ganze Insel verteilt
      szene.add(teil);
    }
    this.stiele.receiveShadow = this.huete.receiveShadow = true;
    this.zeigePilze();

    // ---------- Für den Aktions-Knopf ----------
    this.interaktionen = this.stellen.map((stelle) => ({
      pos: stelle.pos,
      radius: 2.3,
      bild: '🍄',
      text: 'Pflücken',
      // nur wenn der Pilz da ist – und man nicht hoch oben drüber fliegt
      aktiv: () => stelle.da && Math.abs(this.spielerY - stelle.pos.y) < 3,
      ausfuehren: () => this.pfluecken(stelle),
    }));
  }

  // ---------- Wo wachsen die Pilze? ----------
  sucheStellen(hindernisse) {
    const anzahl = EINSTELLUNGEN.anzahlPilze;
    const R = EINSTELLUNGEN.inselGroesse;
    const stellen = [];
    const passt = (x, z, mitBaum) => {
      if (!istWald(x, z)) return false;
      const h = bodenHoehe(x, z);
      if (h < 2 || h > 18) return false;
      if (Math.hypot(x, z) < 25) return false; // nicht direkt am Zelt
      if (abstandZumDorf(x, z) < DORF.radius + 12 || abstandZumPfad(x, z) < 2) return false;
      // nicht am steilen Hang
      const steil = Math.abs(bodenHoehe(x + 1, z) - bodenHoehe(x - 1, z)) + Math.abs(bodenHoehe(x, z + 1) - bodenHoehe(x, z - 1));
      if (steil > 1.4) return false;
      if (hindernisse && hindernisse.trifft(x, z, 0.3)) return false; // nicht IN einem Baum oder Felsen
      if (stellen.some((s) => Math.hypot(s.pos.x - x, s.pos.z - z) < MIN_ABSTAND)) return false;
      if (mitBaum) {
        // gern direkt bei einem Baum (aber nicht im Stamm)
        const baum = holzInDerNaehe(x, z);
        if (!baum || baum.art !== 'baum' || Math.hypot(baum.x - x, baum.z - z) < 1.1) return false;
      }
      return true;
    };
    // Erst Plätze bei Bäumen suchen, dann (falls es nicht reicht) irgendwo im Wald
    for (const mitBaum of [true, false]) {
      for (let versuch = 0; versuch < 30000 && stellen.length < anzahl; versuch++) {
        const x = (zufall() - 0.5) * 2 * R * 0.95;
        const z = (zufall() - 0.5) * 2 * R * 0.95;
        if (!passt(x, z, mitBaum)) continue;
        stellen.push({
          pos: new THREE.Vector3(x, bodenHoehe(x, z), z),
          winkel: zufall() * Math.PI * 2,
          groesse: 0.9 + zufall() * 0.35,
          schief: (zufall() - 0.5) * 0.25,
          da: true,
          leerSeit: 0,
          puff: 0, // Glitzer-Explosion beim Pflücken (1 → 0)
          nah: true,
        });
      }
    }
    return stellen;
  }

  // Alle Pilze an ihren Platz setzen (gepflückte werden unsichtbar = Größe 0)
  zeigePilze() {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3();
    this.stellen.forEach((st, i) => {
      const g = st.da ? st.groesse : 0;
      q.setFromEuler(e.set(st.schief, st.winkel, st.schief * 0.6));
      m.compose(st.pos, q, s.setScalar(g));
      this.stiele.setMatrixAt(i, m);
      this.huete.setMatrixAt(i, m);
      this.tupfen.setMatrixAt(i, m);
    });
    this.stiele.instanceMatrix.needsUpdate = true;
    this.huete.instanceMatrix.needsUpdate = true;
    this.tupfen.instanceMatrix.needsUpdate = true;
  }

  // ---------- Pflücken ----------
  pfluecken(stelle) {
    const { rucksack, meldung, musik } = this.spiel;
    if (!stelle.da) return;
    if (!rucksack.passt('zauberpilz')) {
      meldung('Dein Rucksack ist voll! 🎒 Mach erst Platz für den Zauberpilz.', 4);
      return;
    }
    rucksack.hinein('zauberpilz');
    stelle.da = false;
    stelle.leerSeit = this.spiel.tageszeit?.tag ?? 1;
    stelle.puff = 1;
    this.zeigePilze();
    musik?.pling?.();
    meldung('🍄✨ Ein Zauberpilz! Im Rucksack kannst du ihn essen und eine Minute lang FLIEGEN. Oder du verkaufst ihn teuer im Dorf.', 7);
  }

  // Ein neuer Tag: lange genug gepflückte Pilze wachsen nach
  neuerTag() {
    const heute = this.spiel.tageszeit?.tag ?? 1;
    let geaendert = false;
    for (const s of this.stellen) {
      if (!s.da && heute - s.leerSeit >= EINSTELLUNGEN.pilzNachwachsTage) {
        s.da = true;
        geaendert = true;
      }
    }
    if (geaendert) this.zeigePilze();
  }

  // ---------- Jedes Bild ----------
  aktualisiere(dt, spielerPos) {
    this.zeit += dt;
    this.uZeit.value = this.zeit;
    this.spielerY = spielerPos.y;
    const tag = this.spiel.tageszeit?.tag ?? 1;
    if (tag !== this.letzterTag) {
      this.letzterTag = tag;
      this.neuerTag();
    }
    // Nachts leuchten die Pilze viel stärker
    const istNacht = this.spiel.tageszeit?.istNacht?.() ? 1 : 0;
    this.nacht += (istNacht - this.nacht) * Math.min(1, dt * 0.5);
    this.uGlimmen.value = 0.38 + this.nacht * 1.3;
    this.stiele.material.emissiveIntensity = 0.1 + this.nacht * 0.45;
    this.tupfen.material.emissiveIntensity = 0.22 + this.nacht * 0.9;

    // Glitzer: kleine Funken schweben langsam um den Pilz nach oben
    const m = this.m || (this.m = new THREE.Matrix4());
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(), achse = new THREE.Vector3(0, 1, 0);
    const funkenGroesse = 0.75 + this.nacht * 0.7;
    let geaendert = false;
    this.stellen.forEach((st, i) => {
      const nah = Math.hypot(st.pos.x - spielerPos.x, st.pos.z - spielerPos.z) < NAH;
      if (st.puff > 0) st.puff = Math.max(0, st.puff - dt * 0.8);
      const sichtbar = nah && (st.da || st.puff > 0);
      if (!sichtbar && !st.nah) return; // weit weg und schon versteckt: nichts zu tun
      st.nah = sichtbar;
      geaendert = true;
      for (let k = 0; k < GLITZER_PRO_PILZ; k++) {
        let groesse = 0;
        if (sichtbar && st.da) {
          // langsam aufsteigen, dabei kreisen und funkeln
          const t = (this.zeit * 0.22 + k / GLITZER_PRO_PILZ + i * 0.13) % 1;
          const w = k * 2.4 + this.zeit * 0.6 + i;
          const r = (0.32 + 0.25 * Math.sin(k * 1.7)) * st.groesse;
          p.set(st.pos.x + Math.cos(w) * r, st.pos.y + 0.15 + t * 1.3, st.pos.z + Math.sin(w) * r);
          groesse = Math.sin(t * Math.PI) * (0.65 + 0.35 * Math.sin(this.zeit * 7 + k * 3)) * funkenGroesse;
        } else if (sichtbar) {
          // Puff! Beim Pflücken fliegen die Funken nach außen und verglühen
          const w = (k / GLITZER_PRO_PILZ) * Math.PI * 2;
          const weg = (1 - st.puff) * 1.6;
          p.set(st.pos.x + Math.cos(w) * weg, st.pos.y + 0.4 + weg * 0.5, st.pos.z + Math.sin(w) * weg);
          groesse = st.puff * 1.6;
        }
        q.setFromAxisAngle(achse, this.zeit * 3 + k);
        m.compose(p, q, s.setScalar(groesse));
        this.glitzer.setMatrixAt(i * GLITZER_PRO_PILZ + k, m);
      }
    });
    if (geaendert) this.glitzer.instanceMatrix.needsUpdate = true;
  }

  // ---------- Spielstand ----------
  // Für jede Stelle: -1 = Pilz ist da, sonst der Tag, an dem er gepflückt wurde
  alsDaten() {
    return { stellen: this.stellen.map((s) => (s.da ? -1 : s.leerSeit)) };
  }

  ladeDaten(d) {
    (d?.stellen || []).forEach((wert, i) => {
      const s = this.stellen[i];
      if (!s) return;
      s.da = wert < 0;
      s.leerSeit = wert < 0 ? 0 : wert;
    });
    this.zeigePilze();
  }
}
