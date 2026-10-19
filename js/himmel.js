// =============================================================
//  DER HIMMEL – Sonne, Mond, Sterne, Wolken und das Licht
// =============================================================
import * as THREE from 'three';
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

function baueHimmelsKuppel() {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      oben: { value: new THREE.Color() },
      horizont: { value: new THREE.Color() },
      sonnenRichtung: { value: new THREE.Vector3(0, 1, 0) },
      sonnenFarbe: { value: new THREE.Color('#fff2c8') },
      sonnenStaerke: { value: 1 },
    },
    vertexShader: `
      varying vec3 vRichtung;
      void main() {
        vRichtung = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 oben, horizont, sonnenRichtung, sonnenFarbe;
      uniform float sonnenStaerke;
      varying vec3 vRichtung;
      void main() {
        float h = max(vRichtung.y, 0.0);
        vec3 farbe = mix(horizont, oben, pow(h, 0.55));
        float s = max(dot(vRichtung, sonnenRichtung), 0.0);
        farbe += sonnenFarbe * (pow(s, 900.0) * 4.0 + pow(s, 12.0) * 0.35) * sonnenStaerke;
        gl_FragColor = vec4(farbe, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), material);
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
  const gruppe = new THREE.Group();
  const kugel = new THREE.SphereGeometry(1, 16, 12);
  const material = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, fog: false, transparent: true, opacity: 0.95 });
  for (let i = 0; i < 32; i++) {
    const wolke = new THREE.Group();
    const teile = 5 + Math.floor(zufall() * 5);
    for (let k = 0; k < teile; k++) {
      const teil = new THREE.Mesh(kugel, material);
      const r = 8 + zufall() * 10;
      teil.scale.set(r * 1.4, r * 0.7, r);
      teil.position.set((k - teile / 2) * 9 + zufall() * 6, zufall() * 5, zufall() * 10 - 5);
      wolke.add(teil);
    }
    wolke.position.set((zufall() - 0.5) * 900, 140 + zufall() * 50, (zufall() - 0.5) * 900);
    gruppe.add(wolke);
  }
  gruppe.userData.material = material;
  return gruppe;
}

export class Himmel {
  constructor(szene, renderer) {
    this.szene = szene;
    this.kuppel = baueHimmelsKuppel();
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
    this.spiegelKuppel = baueHimmelsKuppel();
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
    u.oben.value.copy(FARBEN.nachtOben).lerp(FARBEN.tagOben, hell).lerp(FARBEN.abendOben, abend * 0.4);
    u.horizont.value.copy(FARBEN.nachtHorizont).lerp(FARBEN.tagHorizont, hell).lerp(FARBEN.abendHorizont, abend * 0.75);
    u.sonnenRichtung.value.copy(richtung);
    u.sonnenFarbe.value.set('#fff2c8').lerp(new THREE.Color('#ff7a3a'), abend);
    u.sonnenStaerke.value = THREE.MathUtils.smoothstep(hoehe, -0.08, 0.02);
    this.szene.fog.color.copy(u.horizont.value);

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
    for (const wolke of this.wolken.children) {
      wolke.position.x += dt * 2.5;
      if (wolke.position.x > 450) wolke.position.x -= 900;
    }
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
      su.oben.value.copy(u.oben.value);
      su.horizont.value.copy(u.horizont.value);
      su.sonnenRichtung.value.copy(u.sonnenRichtung.value);
      su.sonnenFarbe.value.copy(u.sonnenFarbe.value);
      su.sonnenStaerke.value = u.sonnenStaerke.value;
      if (this.szene.environment) this.szene.environment.dispose();
      this.szene.environment = this.pmrem.fromScene(this.spiegelSzene, 0, 1, 1000).texture;
      this.letzteSpiegelHelligkeit = hell;
    }
  }
}
