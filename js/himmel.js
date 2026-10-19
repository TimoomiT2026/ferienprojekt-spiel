// =============================================================
//  DER HIMMEL – Sonne, Mond, Sterne, Wolken und das Licht
// =============================================================
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { zufallMitSeed } from './rauschen.js';

const zufall = zufallMitSeed(7);

// Farben für Tag, Sonnenuntergang und Nacht
const FARBEN = {
  tagOben: new THREE.Color('#3f8fe0'),
  tagHorizont: new THREE.Color('#bfe3ff'),
  abendHorizont: new THREE.Color('#ff9e5e'),
  abendOben: new THREE.Color('#5a6fb8'),
  nachtOben: new THREE.Color('#050a1f'),
  nachtHorizont: new THREE.Color('#16244a'),
};

// Der Himmel wird wie in echt berechnet: Sonnenlicht wird in der Luft
// gestreut ("Rayleigh-Streuung"). Darum ist der Himmel blau und der
// Sonnenuntergang orange! Das Programm dafür kommt von three.js.
function baueAtmosphaere() {
  const himmel = new Sky();
  himmel.scale.setScalar(1000);
  const u = himmel.material.uniforms;
  u.turbidity.value = 4.5;
  u.rayleigh.value = 1.6;
  u.mieCoefficient.value = 0.004;
  u.mieDirectionalG.value = 0.85;
  u.hell = { value: 1 };
  himmel.material.fragmentShader = himmel.material.fragmentShader
    .replace('uniform vec3 up;', 'uniform vec3 up;\nuniform float hell;')
    .replace('gl_FragColor = vec4( retColor, 1.0 );', 'gl_FragColor = vec4( retColor * hell, 1.0 );');
  return himmel;
}

// Eine weiche Wolken-Flocke, mit dem Computer gemalt
function wolkenBild() {
  const n = 128;
  const leinwand = document.createElement('canvas');
  leinwand.width = leinwand.height = n;
  const g = leinwand.getContext('2d');
  for (let i = 0; i < 18; i++) {
    const x = n / 2 + (zufall() - 0.5) * n * 0.45, y = n / 2 + (zufall() - 0.5) * n * 0.3;
    const r = n * (0.15 + zufall() * 0.2);
    const verlauf = g.createRadialGradient(x, y, 0, x, y, r);
    verlauf.addColorStop(0, 'rgba(255,255,255,0.35)');
    verlauf.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = verlauf;
    g.fillRect(0, 0, n, n);
  }
  const t = new THREE.CanvasTexture(leinwand);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function baueSterne() {
  const anzahl = 1500;
  const pos = new Float32Array(anzahl * 3);
  for (let i = 0; i < anzahl; i++) {
    const v = new THREE.Vector3(zufall() * 2 - 1, zufall() * 0.9 + 0.05, zufall() * 2 - 1).normalize().multiplyScalar(850);
    pos.set([v.x, v.y, v.z], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const material = new THREE.PointsMaterial({ color: '#ffffff', size: 2, sizeAttenuation: false, transparent: true, fog: false, depthWrite: false });
  return new THREE.Points(geo, material);
}

function baueWolken() {
  // Jede Wolke besteht aus vielen weichen Flocken (Punkte mit Bild)
  const pos = [];
  for (let i = 0; i < 34; i++) {
    const mx = (zufall() - 0.5) * 900, my = 130 + zufall() * 60, mz = (zufall() - 0.5) * 900;
    const laenge = 30 + zufall() * 50;
    for (let k = 0; k < 16; k++) {
      pos.push(mx + (zufall() - 0.5) * laenge, my + (zufall() - 0.3) * 8, mz + (zufall() - 0.5) * laenge * 0.5);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const material = new THREE.PointsMaterial({
    map: wolkenBild(), size: 70, sizeAttenuation: true, transparent: true, depthWrite: false, fog: false, color: '#ffffff',
  });
  const wolken = new THREE.Points(geo, material);
  wolken.userData.material = material;
  return wolken;
}

export class Himmel {
  constructor(szene, renderer) {
    this.szene = szene;
    this.kuppel = baueAtmosphaere();
    this.sterne = baueSterne();
    this.wolken = baueWolken();
    this.mond = new THREE.Mesh(
      new THREE.SphereGeometry(22, 24, 16),
      new THREE.MeshBasicMaterial({ color: '#f3f1e2', fog: false })
    );
    szene.add(this.kuppel, this.sterne, this.wolken, this.mond);

    // Licht von oben (Himmel) und unten (Wiese)
    this.himmelsLicht = new THREE.HemisphereLight('#cfe8ff', '#5a7d3a', 1);
    // Sonne (nachts: Mondlicht) – macht die Schatten
    this.sonne = new THREE.DirectionalLight('#ffffff', 3);
    this.sonne.castShadow = true;
    this.sonne.shadow.mapSize.set(2048, 2048);
    const sc = this.sonne.shadow.camera;
    sc.left = sc.bottom = -45;
    sc.right = sc.top = 45;
    sc.near = 1;
    sc.far = 260;
    this.sonne.shadow.bias = -0.0005;
    this.sonne.shadow.normalBias = 0.04;
    szene.add(this.himmelsLicht, this.sonne, this.sonne.target);

    szene.fog = new THREE.Fog('#bfe3ff', 60, 260);

    // Spiegelungen (fürs Wasser): der Himmel wird einmal "fotografiert"
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.spiegelSzene = new THREE.Scene();
    this.spiegelKuppel = baueAtmosphaere();
    this.spiegelSzene.add(this.spiegelKuppel);
    this.letzteSpiegelHelligkeit = -1;
    this.helligkeit = 1;
    this.sonnenRichtung = new THREE.Vector3();
  }

  aktualisiere(dt, tageszeit, kamera, spielerPos) {
    const winkel = tageszeit.sonnenWinkel();
    const richtung = this.sonnenRichtung.set(Math.cos(winkel), Math.sin(winkel), 0.35).normalize();
    const hoehe = richtung.y;
    const hell = THREE.MathUtils.smoothstep(hoehe, -0.12, 0.22);
    const abend = 1 - THREE.MathUtils.smoothstep(Math.abs(hoehe - 0.04), 0, 0.22);
    this.helligkeit = hell;

    const u = this.kuppel.material.uniforms;
    u.sunPosition.value.copy(richtung);
    u.hell.value = 0.5 * THREE.MathUtils.smoothstep(hoehe, -0.25, 0.1);
    // Nebel in der Ferne hat die Farbe des Horizonts
    this.horizont = this.horizont || new THREE.Color();
    this.horizont.copy(FARBEN.nachtHorizont).lerp(FARBEN.tagHorizont, hell).lerp(FARBEN.abendHorizont, abend * 0.6);
    this.szene.fog.color.copy(this.horizont);

    // Kuppel, Sterne und Mond wandern mit der Kamera mit (sie sind "unendlich" weit weg)
    this.kuppel.position.copy(kamera.position);
    this.sterne.position.copy(kamera.position);
    this.sterne.material.opacity = 1 - THREE.MathUtils.smoothstep(hell, 0, 0.5);
    this.sterne.rotation.y += dt * 0.003;
    const mondRichtung = richtung.clone().negate();
    mondRichtung.y = Math.abs(mondRichtung.y) * 0.8 + 0.25;
    mondRichtung.normalize();
    this.mond.position.copy(kamera.position).addScaledVector(mondRichtung, 780);
    this.mond.visible = hell < 0.6;

    // Wolken ziehen langsam weiter und werden nachts dunkel
    this.wolken.position.x += dt * 2.5;
    if (this.wolken.position.x > 450) this.wolken.position.x -= 900;
    this.wolken.userData.material.color.setRGB(0.15, 0.17, 0.25).lerp(new THREE.Color(1, 1, 1), hell).lerp(new THREE.Color('#ffc59a'), abend * 0.6);

    // Licht: tagsüber Sonne, nachts bläuliches Mondlicht
    const tag = hoehe > -0.02;
    const lichtRichtung = tag ? richtung : mondRichtung;
    this.sonne.position.copy(spielerPos).addScaledVector(lichtRichtung, 120);
    this.sonne.target.position.copy(spielerPos);
    if (tag) {
      this.sonne.color.set('#fff3dd').lerp(new THREE.Color('#ff9a55'), abend);
      this.sonne.intensity = 3.2 * THREE.MathUtils.smoothstep(hoehe, -0.02, 0.15);
    } else {
      this.sonne.color.set('#9fb8ff');
      this.sonne.intensity = 0.7 * THREE.MathUtils.smoothstep(-hoehe, 0.02, 0.2);
    }
    this.himmelsLicht.intensity = 0.35 + 0.85 * hell;
    this.himmelsLicht.color.set('#3a4f8a').lerp(new THREE.Color('#cfe8ff'), hell);
    this.himmelsLicht.groundColor.set('#1a2433').lerp(new THREE.Color('#5a7d3a'), hell);

    // Spiegelbild des Himmels nur neu machen, wenn es sich sichtbar geändert hat
    if (Math.abs(hell - this.letzteSpiegelHelligkeit) > 0.08) {
      const su = this.spiegelKuppel.material.uniforms;
      su.sunPosition.value.copy(u.sunPosition.value);
      su.hell.value = u.hell.value;
      if (this.szene.environment) this.szene.environment.dispose();
      this.szene.environment = this.pmrem.fromScene(this.spiegelSzene, 0, 1, 1000).texture;
      this.letzteSpiegelHelligkeit = hell;
    }
  }
}
