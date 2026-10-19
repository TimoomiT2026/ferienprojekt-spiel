// =============================================================
//  DIE WELT – Insel, Wasser, Bäume, Felsen und das Start-Zelt
// =============================================================
import * as THREE from 'three';
import { EINSTELLUNGEN } from './einstellungen.js';

export const WASSER_HOEHE = 0;

// Ein "Zufall", der jedes Mal gleich ist – so sieht die Insel
// bei jedem Start gleich aus (wie ein Minecraft-Seed).
function zufallMitSeed(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}
const zufall = zufallMitSeed(42);

// Wie hoch ist der Boden an der Stelle (x, z)?
// Mitte der Insel = Land, außen = Meer, dazwischen sanfte Hügel.
export function bodenHoehe(x, z) {
  const r = Math.hypot(x, z);
  const rand = EINSTELLUNGEN.inselGroesse;
  // Rand der Insel etwas unregelmäßig machen
  const winkel = Math.atan2(z, x);
  const welligerRand = rand + Math.sin(winkel * 3) * 6 + Math.sin(winkel * 7 + 1) * 3;
  const insel = 1 - THREE.MathUtils.smoothstep(r, welligerRand - 25, welligerRand + 5);
  const huegel =
    Math.sin(x * 0.05) * Math.cos(z * 0.04) * 3 +
    Math.sin(x * 0.11 + 2) * Math.sin(z * 0.09) * 1.5 +
    Math.cos((x + z) * 0.025) * 2;
  // Startplatz in der Mitte schön flach halten
  const flachInDerMitte = THREE.MathUtils.smoothstep(r, 6, 18);
  return insel * (3 + huegel * flachInDerMitte) - (1 - insel) * 4;
}

// Comic-Look: Farben werden in wenigen Stufen schattiert statt weich
function comicMaterial(farbe, extra = {}) {
  return new THREE.MeshToonMaterial({ color: farbe, gradientMap: comicVerlauf, ...extra });
}
const comicVerlauf = (() => {
  const daten = new Uint8Array([90, 170, 255]);
  const textur = new THREE.DataTexture(daten, daten.length, 1, THREE.RedFormat);
  textur.minFilter = textur.magFilter = THREE.NearestFilter;
  textur.needsUpdate = true;
  return textur;
})();

function baueBoden() {
  const groesse = 260;
  const geo = new THREE.PlaneGeometry(groesse, groesse, 180, 180);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const farben = [];
  const sand = new THREE.Color('#f2d9a0');
  const wiese = new THREE.Color('#7cc95a');
  const dunkleWiese = new THREE.Color('#5aa846');
  const unterwasser = new THREE.Color('#d9c48a');
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = bodenHoehe(x, z);
    pos.setY(i, h);
    if (h < 0.2) c.copy(unterwasser);
    else if (h < 1.2) c.copy(sand);
    else c.copy(wiese).lerp(dunkleWiese, THREE.MathUtils.clamp((h - 3) / 4, 0, 1));
    farben.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(farben, 3));
  geo.computeVertexNormals();
  const boden = new THREE.Mesh(geo, comicMaterial(0xffffff, { vertexColors: true }));
  boden.receiveShadow = true;
  return boden;
}

function baueWasser() {
  const geo = new THREE.CircleGeometry(400, 64);
  geo.rotateX(-Math.PI / 2);
  const wasser = new THREE.Mesh(
    geo,
    new THREE.MeshToonMaterial({ color: '#4fb6e8', transparent: true, opacity: 0.85, gradientMap: comicVerlauf })
  );
  wasser.position.y = WASSER_HOEHE;
  return wasser;
}

// Sucht einen zufälligen Platz auf der Wiese (nicht am Strand, nicht am Start)
function freierPlatz(minAbstandZurMitte = 10) {
  for (let versuch = 0; versuch < 200; versuch++) {
    const x = (zufall() - 0.5) * 2 * EINSTELLUNGEN.inselGroesse;
    const z = (zufall() - 0.5) * 2 * EINSTELLUNGEN.inselGroesse;
    if (Math.hypot(x, z) < minAbstandZurMitte) continue;
    const h = bodenHoehe(x, z);
    if (h > 1.6) return new THREE.Vector3(x, h, z);
  }
  return null;
}

// Runde Bäume (nicht eckig!) – Stamm + drei Kugeln als Krone.
// "InstancedMesh" heißt: ein Baum wird einmal gebaut und ganz oft kopiert.
// Das ist viel schneller – wichtig fürs iPad.
function baueBaeume(hindernisse) {
  const anzahl = EINSTELLUNGEN.anzahlBaeume;
  const stammGeo = new THREE.CylinderGeometry(0.25, 0.35, 2, 10);
  stammGeo.translate(0, 1, 0);
  const kroneGeo = new THREE.SphereGeometry(1, 16, 12);
  const staemme = new THREE.InstancedMesh(stammGeo, comicMaterial('#8a5a3b'), anzahl);
  const kronen = new THREE.InstancedMesh(kroneGeo, comicMaterial('#ffffff'), anzahl * 3);
  const kroneFarben = ['#4caf50', '#66bb48', '#3f9e45', '#7cc243'].map((f) => new THREE.Color(f));
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  let k = 0;
  for (let i = 0; i < anzahl; i++) {
    const platz = freierPlatz(14);
    if (!platz) continue;
    const s = 0.8 + zufall() * 0.7;
    m.compose(platz, q, new THREE.Vector3(s, s, s));
    staemme.setMatrixAt(i, m);
    const farbe = kroneFarben[Math.floor(zufall() * kroneFarben.length)];
    const teile = [
      [0, 2.6, 0, 1.3],
      [0.6, 2.1, 0.3, 0.9],
      [-0.5, 2.2, -0.4, 0.95],
    ];
    for (const [dx, dy, dz, r] of teile) {
      m.compose(
        new THREE.Vector3(platz.x + dx * s, platz.y + dy * s, platz.z + dz * s),
        q,
        new THREE.Vector3(r * s, r * s, r * s)
      );
      kronen.setMatrixAt(k, m);
      kronen.setColorAt(k, farbe);
      k++;
    }
    hindernisse.push({ x: platz.x, z: platz.z, radius: 0.5 * s });
  }
  staemme.castShadow = kronen.castShadow = true;
  const gruppe = new THREE.Group();
  gruppe.add(staemme, kronen);
  return gruppe;
}

function baueFelsen(hindernisse) {
  const gruppe = new THREE.Group();
  const geo = new THREE.IcosahedronGeometry(1, 2);
  const mat = comicMaterial('#a7a9b0');
  for (let i = 0; i < EINSTELLUNGEN.anzahlFelsen; i++) {
    const platz = freierPlatz(12);
    if (!platz) continue;
    const fels = new THREE.Mesh(geo, mat);
    const s = 0.6 + zufall() * 1.2;
    fels.scale.set(s * 1.3, s * 0.8, s);
    fels.rotation.y = zufall() * Math.PI;
    fels.position.copy(platz).add(new THREE.Vector3(0, s * 0.3, 0));
    fels.castShadow = fels.receiveShadow = true;
    gruppe.add(fels);
    hindernisse.push({ x: platz.x, z: platz.z, radius: s * 1.1 });
  }
  return gruppe;
}

// Blumen als bunte Tupfer im Gras
function baueBlumen() {
  const anzahl = 160;
  const geo = new THREE.SphereGeometry(0.15, 8, 6);
  const blumen = new THREE.InstancedMesh(geo, comicMaterial('#ffffff'), anzahl);
  const farben = ['#ff6b8b', '#ffd93d', '#ffffff', '#b28dff'].map((f) => new THREE.Color(f));
  const m = new THREE.Matrix4();
  for (let i = 0; i < anzahl; i++) {
    const platz = freierPlatz(4) || new THREE.Vector3();
    m.makeTranslation(platz.x, platz.y + 0.15, platz.z);
    blumen.setMatrixAt(i, m);
    blumen.setColorAt(i, farben[i % farben.length]);
  }
  return blumen;
}

// Das Zelt – laut Mindmap hat man am Anfang nur ein Zelt
function baueZelt(hindernisse) {
  const gruppe = new THREE.Group();
  const plane = new THREE.Mesh(new THREE.ConeGeometry(1.8, 2.2, 4, 1), comicMaterial('#ff8a3d'));
  plane.rotation.y = Math.PI / 4;
  plane.position.y = 1.1;
  plane.castShadow = true;
  const eingang = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.2, 3, 1), comicMaterial('#5a3420'));
  eingang.position.set(0, 0.6, 1.05);
  eingang.rotation.y = Math.PI;
  gruppe.add(plane, eingang);
  const x = 4, z = -3;
  gruppe.position.set(x, bodenHoehe(x, z), z);
  gruppe.rotation.y = -0.5;
  hindernisse.push({ x, z, radius: 1.6 });
  return gruppe;
}

export function baueWelt(szene) {
  // Himmel und Nebel in der Ferne
  szene.background = new THREE.Color('#9fdcff');
  szene.fog = new THREE.Fog('#9fdcff', 80, 220);

  // Licht: Sonne + helles Umgebungslicht
  const himmelLicht = new THREE.HemisphereLight('#ffffff', '#7cc95a', 1.2);
  szene.add(himmelLicht);
  const sonne = new THREE.DirectionalLight('#fff4d6', 2.2);
  sonne.position.set(40, 60, 25);
  sonne.castShadow = true;
  sonne.shadow.mapSize.set(1024, 1024);
  const sc = sonne.shadow.camera;
  sc.left = sc.bottom = -30;
  sc.right = sc.top = 30;
  sc.near = 1;
  sc.far = 150;
  szene.add(sonne, sonne.target);

  // Hindernisse: Dinge, durch die man nicht durchlaufen kann
  const hindernisse = [];
  szene.add(baueBoden(), baueWasser(), baueBaeume(hindernisse), baueFelsen(hindernisse), baueBlumen(), baueZelt(hindernisse));

  return { sonne, hindernisse };
}
