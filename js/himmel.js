// =============================================================
//  DER HIMMEL – Sonne, Mond, Sterne, Wolken, Dunst und das Licht
// =============================================================
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { zufallMitSeed } from './rauschen.js';

const zufall = zufallMitSeed(7);

// Farben für Tag, Sonnenuntergang und Nacht (für den Dunst am Horizont)
const FARBEN = {
  tagHorizont: new THREE.Color('#b9d7ee'),
  abendHorizont: new THREE.Color('#f0a273'),
  nachtHorizont: new THREE.Color('#141f3d'),
  nachtOben: new THREE.Color('#040814'),
  // Sonnen-Dunst: so leuchtet die Luft in Richtung Sonne
  tagGlanz: new THREE.Color('#fff1d6'),
  abendGlanz: new THREE.Color('#ff7a3a'),
  // Wolken
  wolkeLicht: new THREE.Color('#ffffff'),
  wolkeAbendLicht: new THREE.Color('#ffb27a'),
  wolkeSchatten: new THREE.Color('#9aaccc'),
  wolkeAbendSchatten: new THREE.Color('#8a6a8f'),
  wolkeNacht: new THREE.Color('#1a2238'),
};

// Zahlen zum Drehen
const DUNST = {
  boden: 0.010,   // wie dicht der Dunst unten am Boden ist
  abfall: 0.09,   // wie schnell er nach oben dünner wird
  hoeheNull: 0.0, // ab welcher Höhe gemessen wird (Meeresspiegel)
  maximal: 0.55,  // nie mehr als so viel Dunst
};
const SCHATTEN_GROESSE = 45; // so viele Meter um die Figur herum gibt es Schatten

// ---------- Der Dunst (Nebel) für die ganze Welt ----------
// three.js hat schon Nebel. Wir machen ihn schöner:
//  • In Richtung Sonne leuchtet der Dunst warm
//  • Unten in Tälern und überm Meer ist mehr Dunst als oben am Berg
// Diese Werte teilen sich ALLE Materialien (darum normale Objekte statt Vektoren).
const NEBEL = {
  nebelSonne: { value: { x: 0, y: 1, z: 0 } },
  nebelGlanz: { value: { x: 0, y: 0, z: 0 } },
  nebelHoehe: { value: { x: DUNST.boden, y: DUNST.abfall, z: DUNST.hoeheNull, w: DUNST.maximal } },
};
function bauNebelEin() {
  if (THREE.ShaderChunk.fog_fragment.includes('nebelGlanz')) return;
  THREE.ShaderChunk.fog_pars_vertex = `
#ifdef USE_FOG
  varying float vFogDepth;
  varying vec3 vNebelWeg;
#endif`;
  THREE.ShaderChunk.fog_vertex = `
#ifdef USE_FOG
  vFogDepth = - mvPosition.z;
  // Weg von der Kamera zum Punkt, in Welt-Richtungen
  vNebelWeg = vec3(dot(viewMatrix[0].xyz, mvPosition.xyz), dot(viewMatrix[1].xyz, mvPosition.xyz), dot(viewMatrix[2].xyz, mvPosition.xyz));
#endif`;
  THREE.ShaderChunk.fog_pars_fragment = `
#ifdef USE_FOG
  uniform vec3 fogColor;
  varying float vFogDepth;
  varying vec3 vNebelWeg;
  uniform vec3 nebelSonne;
  uniform vec3 nebelGlanz;
  uniform vec4 nebelHoehe;
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear;
    uniform float fogFar;
  #endif
#endif`;
  THREE.ShaderChunk.fog_fragment = `
#ifdef USE_FOG
  float nebelWeit = length(vNebelWeg);
  #ifdef FOG_EXP2
    float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
  #else
    float fogFactor = smoothstep( fogNear, fogFar, nebelWeit );
  #endif
  // Höhen-Dunst: wie viel Luft liegt zwischen Kamera und Punkt?
  if ( nebelHoehe.x > 0.0 ) {
    float bh = nebelHoehe.y * vNebelWeg.y;
    float weg = abs( bh ) > 1e-3 ? ( 1.0 - exp( - bh ) ) / bh : 1.0;
    float luft = nebelHoehe.x * exp( - nebelHoehe.y * ( cameraPosition.y - nebelHoehe.z ) ) * nebelWeit * weg;
    fogFactor = max( fogFactor, ( 1.0 - exp( - luft ) ) * nebelHoehe.w );
  }
  float nebelSonnig = pow( max( dot( vNebelWeg / max( nebelWeit, 1e-3 ), nebelSonne ), 0.0 ), 5.0 );
  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor + nebelGlanz * nebelSonnig, fogFactor );
#endif`;
  // Die geteilten Werte allen eingebauten Materialien mitgeben
  for (const name of Object.keys(THREE.ShaderLib)) {
    const lib = THREE.ShaderLib[name];
    if (lib.uniforms && lib.uniforms.fogColor) Object.assign(lib.uniforms, NEBEL);
  }
}
bauNebelEin();

// Der Himmel wird wie in echt berechnet: Sonnenlicht wird in der Luft
// gestreut ("Rayleigh-Streuung"). Darum ist der Himmel blau und der
// Sonnenuntergang orange! Das Programm dafür kommt von three.js.
// Wir mischen unten am Horizont den Dunst dazu und nachts ein tiefes Blau.
const KUPPEL_WERTE = {
  hell: { value: 1 },
  dunstFarbe: { value: new THREE.Color() },
  nachtOben: { value: FARBEN.nachtOben.clone() },
  nacht: { value: 0 },
};
function baueAtmosphaere() {
  const himmel = new Sky();
  himmel.scale.setScalar(1000);
  const u = himmel.material.uniforms;
  u.turbidity.value = 3.2;
  u.rayleigh.value = 1.35;
  u.mieCoefficient.value = 0.0035;
  u.mieDirectionalG.value = 0.86;
  Object.assign(u, KUPPEL_WERTE, { nebelGlanz: NEBEL.nebelGlanz });
  himmel.material.fragmentShader = himmel.material.fragmentShader
    .replace('uniform vec3 up;', `uniform vec3 up;
      uniform float hell;
      uniform vec3 dunstFarbe;
      uniform vec3 nachtOben;
      uniform float nacht;
      uniform vec3 nebelGlanz;`)
    .replace('gl_FragColor = vec4( retColor, 1.0 );', `
      vec3 farbe = retColor * hell;
      // Nachts: dunkelblauer Verlauf statt Schwarz
      float oben = clamp(direction.y, 0.0, 1.0);
      farbe += mix(dunstFarbe, nachtOben, sqrt(oben)) * nacht;
      // Am Horizont geht der Himmel weich in den Dunst über
      float sonnig = pow(max(dot(direction, vSunDirection), 0.0), 5.0);
      vec3 dunst = dunstFarbe + nebelGlanz * sonnig;
      float band = 1.0 - smoothstep(-0.04, 0.22, direction.y);
      farbe = mix(farbe, dunst, band * band * (1.0 - nacht * 0.5));
      gl_FragColor = vec4( farbe, 1.0 );`);
  return himmel;
}

// ---------- Wolken ----------
// Jede Wolke besteht aus vielen weichen "Bauschen" (Puffs). Jeder Bausch
// ist ein Bild, das immer zur Kamera schaut. Der Trick: Wir tun so, als ob
// jeder Bausch eine Kugel wäre – dann hat er eine helle Sonnenseite und
// eine dunklere Schattenseite. Unten ist die Wolke grauer, oben weiß.
function bauschBild() {
  // 4 verschiedene Bausche in einem Bild (2×2)
  const n = 128;
  const leinwand = document.createElement('canvas');
  leinwand.width = leinwand.height = n * 2;
  const g = leinwand.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, n * 2, n * 2);
  g.globalCompositeOperation = 'lighter';
  for (let v = 0; v < 4; v++) {
    const ox = (v % 2) * n, oy = Math.floor(v / 2) * n;
    g.save();
    g.beginPath();
    g.rect(ox, oy, n, n);
    g.clip();
    for (let i = 0; i < 46; i++) {
      const w = zufall() * Math.PI * 2;
      const a = Math.sqrt(zufall()) * n * 0.28;
      const x = ox + n / 2 + Math.cos(w) * a, y = oy + n / 2 + Math.sin(w) * a * 0.85;
      const r = n * (0.07 + zufall() * 0.13) * (1 - a / (n * 0.5));
      const verlauf = g.createRadialGradient(x, y, 0, x, y, r);
      verlauf.addColorStop(0, 'rgba(255,255,255,0.32)');
      verlauf.addColorStop(0.6, 'rgba(255,255,255,0.16)');
      verlauf.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = verlauf;
      g.fillRect(ox, oy, n, n);
    }
    g.restore();
  }
  const t = new THREE.CanvasTexture(leinwand);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

const WOLKEN_FELD = 900; // so groß ist das Wolken-Feld (es wiederholt sich um die Kamera)

function baueWolken() {
  const mitten = [], groessen = [], hoehen = [], arten = [], richtungen = [];
  for (let i = 0; i < 30; i++) {
    const mx = (zufall() - 0.5) * WOLKEN_FELD, my = 135 + zufall() * 55, mz = (zufall() - 0.5) * WOLKEN_FELD;
    const laenge = 34 + zufall() * 56;
    const dicke = 10 + zufall() * 10;
    const anzahl = 9 + Math.floor(zufall() * 7);
    for (let k = 0; k < anzahl; k++) {
      const dx = (zufall() - 0.5) * laenge, dz = (zufall() - 0.5) * laenge * 0.55;
      // Mitte höher (Haufenwolke), Rand flacher
      const rand = Math.min(1, Math.hypot(dx / (laenge * 0.5), dz / (laenge * 0.3)));
      const dy = (zufall() * 0.9 + 0.1) * dicke * (1 - rand * 0.7);
      mitten.push(mx + dx, my + dy, mz + dz);
      groessen.push((26 + zufall() * 26) * (1.1 - rand * 0.4));
      hoehen.push(THREE.MathUtils.clamp(dy / dicke, 0, 1));
      arten.push(Math.floor(zufall() * 4));
      // Richtung vom Wolken-Inneren zum Bausch: so weiß man, wo die "Sonnenseite" ist
      const r = new THREE.Vector3(dx / laenge, (dy - dicke * 0.2) / dicke, dz / (laenge * 0.55)).normalize();
      richtungen.push(r.x, r.y, r.z);
    }
  }
  const anzahl = groessen.length;
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  // Diese Werte werden fürs Sortieren (hinten zuerst) umgestellt
  const aMitte = new THREE.InstancedBufferAttribute(new Float32Array(anzahl * 3), 3);
  const aDaten = new THREE.InstancedBufferAttribute(new Float32Array(anzahl * 4), 4); // Größe, Höhe, Art, -
  const aRichtung = new THREE.InstancedBufferAttribute(new Float32Array(anzahl * 3), 3);
  aMitte.setUsage(THREE.DynamicDrawUsage);
  aDaten.setUsage(THREE.DynamicDrawUsage);
  aRichtung.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aMitte', aMitte);
  geo.setAttribute('aDaten', aDaten);
  geo.setAttribute('aRichtung', aRichtung);
  geo.instanceCount = anzahl;

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    uniforms: {
      tBausch: { value: bauschBild() },
      verschiebung: { value: new THREE.Vector2() },
      feld: { value: WOLKEN_FELD },
      sonne: { value: new THREE.Vector3(0, 1, 0) },
      lichtFarbe: { value: new THREE.Color() },
      schattenFarbe: { value: new THREE.Color() },
      dunstFarbe: KUPPEL_WERTE.dunstFarbe,
      deckkraft: { value: 0.95 },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aMitte;
      attribute vec4 aDaten;
      attribute vec3 aRichtung;
      uniform vec2 verschiebung;
      uniform float feld;
      varying vec2 vUv;
      varying vec3 vNormaleWolke;
      varying vec3 vRechts, vOben, vZurKamera;
      varying float vHoehe, vFerne;
      void main() {
        // Wolken wiederholen sich rund um die Kamera, damit sie nie ausgehen
        vec3 m = aMitte;
        m.xz = cameraPosition.xz + mod(m.xz + verschiebung - cameraPosition.xz + feld * 0.5, feld) - feld * 0.5;
        // Bausch immer zur Kamera drehen ("Billboard")
        vRechts = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vOben = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        vZurKamera = vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);
        float groesse = aDaten.x;
        vec3 welt = m + (vRechts * position.x + vOben * position.y) * groesse;
        gl_Position = projectionMatrix * viewMatrix * vec4(welt, 1.0);
        float art = aDaten.z;
        vUv = (position.xy * 0.5 + 0.5) * 0.5 + vec2(mod(art, 2.0), floor(art / 2.0)) * 0.5;
        vHoehe = aDaten.y;
        vNormaleWolke = aRichtung;
        float weit = length(m.xz - cameraPosition.xz);
        vFerne = smoothstep(feld * 0.28, feld * 0.48, weit);
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tBausch;
      uniform vec3 sonne, lichtFarbe, schattenFarbe, dunstFarbe;
      uniform float deckkraft;
      varying vec2 vUv;
      varying vec3 vNormaleWolke;
      varying vec3 vRechts, vOben, vZurKamera;
      varying float vHoehe, vFerne;
      void main() {
        float dichte = texture2D(tBausch, vUv).r;
        float a = smoothstep(0.08, 0.55, dichte);
        if (a < 0.01) discard;
        // So tun, als wäre der Bausch eine Kugel
        vec2 p = (fract(vUv * 2.0) - 0.5) * 2.0;
        float z = sqrt(max(0.0, 1.0 - dot(p, p)));
        vec3 n = normalize(vRechts * p.x + vOben * p.y + vZurKamera * z);
        n = normalize(n * 0.55 + vNormaleWolke * 0.75);
        float licht = clamp(dot(n, sonne) * 0.5 + 0.5, 0.0, 1.0);
        licht *= mix(0.55, 1.0, vHoehe);          // unten grauer
        licht = mix(licht, 1.0, (1.0 - a) * 0.35); // dünne Ränder lassen Licht durch
        // Silberrand: steht die Sonne hinter der Wolke, leuchten die Ränder
        float gegenlicht = pow(max(dot(-vZurKamera, sonne), 0.0), 6.0) * (1.0 - a) * 1.2;
        vec3 farbe = mix(schattenFarbe, lichtFarbe, licht) + lichtFarbe * gegenlicht;
        // In der Ferne verschwinden Wolken im Dunst
        farbe = mix(farbe, dunstFarbe, vFerne * 0.7);
        gl_FragColor = vec4(farbe, a * deckkraft * (1.0 - vFerne));
      }`,
  });
  const wolken = new THREE.Mesh(geo, material);
  wolken.frustumCulled = false;
  wolken.renderOrder = -1; // vor allem anderen Durchsichtigen malen
  wolken.userData = {
    material, anzahl, aMitte, aDaten, aRichtung,
    mitten: new Float32Array(mitten), daten: { groessen, hoehen, arten }, richtungen: new Float32Array(richtungen),
    reihenfolge: [...Array(anzahl).keys()], abstand: new Float32Array(anzahl),
  };
  return wolken;
}

// Wolken nach Abstand sortieren: die hinteren zuerst malen, sonst sieht es falsch aus
function sortiereWolken(wolken, kamera) {
  const d = wolken.userData;
  const v = d.material.uniforms.verschiebung.value;
  const kx = kamera.position.x, ky = kamera.position.y, kz = kamera.position.z;
  const F = WOLKEN_FELD;
  for (let i = 0; i < d.anzahl; i++) {
    const wx = ((((d.mitten[i * 3] + v.x - kx + F / 2) % F) + F) % F) - F / 2;
    const wz = ((((d.mitten[i * 3 + 2] + v.y - kz + F / 2) % F) + F) % F) - F / 2;
    const wy = d.mitten[i * 3 + 1] - ky;
    d.abstand[i] = wx * wx + wy * wy + wz * wz;
  }
  d.reihenfolge.sort((a, b) => d.abstand[b] - d.abstand[a]);
  const m = d.aMitte.array, da = d.aDaten.array, r = d.aRichtung.array;
  d.reihenfolge.forEach((q, i) => {
    m[i * 3] = d.mitten[q * 3]; m[i * 3 + 1] = d.mitten[q * 3 + 1]; m[i * 3 + 2] = d.mitten[q * 3 + 2];
    da[i * 4] = d.daten.groessen[q]; da[i * 4 + 1] = d.daten.hoehen[q]; da[i * 4 + 2] = d.daten.arten[q];
    r[i * 3] = d.richtungen[q * 3]; r[i * 3 + 1] = d.richtungen[q * 3 + 1]; r[i * 3 + 2] = d.richtungen[q * 3 + 2];
  });
  d.aMitte.needsUpdate = d.aDaten.needsUpdate = d.aRichtung.needsUpdate = true;
}

// ---------- Sterne ----------
function baueSterne() {
  const anzahl = 1600;
  const pos = new Float32Array(anzahl * 3);
  const farben = new Float32Array(anzahl * 3);
  const tonne = [new THREE.Color('#cfdcff'), new THREE.Color('#ffffff'), new THREE.Color('#fff0d0')];
  for (let i = 0; i < anzahl; i++) {
    const v = new THREE.Vector3(zufall() * 2 - 1, zufall() * 0.9 + 0.05, zufall() * 2 - 1).normalize().multiplyScalar(850);
    pos.set([v.x, v.y, v.z], i * 3);
    // Manche Sterne sind hell, die meisten schwach
    const hell = 0.25 + Math.pow(zufall(), 4) * 1.6;
    const c = tonne[Math.floor(zufall() * 3)];
    farben.set([c.r * hell, c.g * hell, c.b * hell], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(farben, 3));
  const material = new THREE.PointsMaterial({ size: 2, sizeAttenuation: false, vertexColors: true, transparent: true, fog: false, depthWrite: false });
  return new THREE.Points(geo, material);
}

// ---------- Mond mit Kratern und Schein ----------
function mondBild() {
  const n = 128;
  const leinwand = document.createElement('canvas');
  leinwand.width = leinwand.height = n;
  const g = leinwand.getContext('2d');
  g.fillStyle = '#e9e6d8';
  g.fillRect(0, 0, n, n);
  for (let i = 0; i < 26; i++) {
    const x = zufall() * n, y = zufall() * n, r = 3 + zufall() * 16;
    const verlauf = g.createRadialGradient(x, y, 0, x, y, r);
    verlauf.addColorStop(0, 'rgba(150,150,145,0.55)');
    verlauf.addColorStop(1, 'rgba(150,150,145,0)');
    g.fillStyle = verlauf;
    g.fillRect(0, 0, n, n);
  }
  const t = new THREE.CanvasTexture(leinwand);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function scheinBild() {
  const n = 128;
  const leinwand = document.createElement('canvas');
  leinwand.width = leinwand.height = n;
  const g = leinwand.getContext('2d');
  const verlauf = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  verlauf.addColorStop(0, 'rgba(255,255,255,1)');
  verlauf.addColorStop(0.2, 'rgba(255,255,255,0.35)');
  verlauf.addColorStop(0.5, 'rgba(255,255,255,0.08)');
  verlauf.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = verlauf;
  g.fillRect(0, 0, n, n);
  return new THREE.CanvasTexture(leinwand);
}

const hilfsFarbe = new THREE.Color();

export class Himmel {
  constructor(szene, renderer) {
    this.szene = szene;
    this.kuppel = baueAtmosphaere();
    this.sterne = baueSterne();
    this.wolken = baueWolken();
    this.mond = new THREE.Mesh(
      new THREE.SphereGeometry(22, 24, 16),
      new THREE.MeshBasicMaterial({ map: mondBild(), color: new THREE.Color(1.6, 1.6, 1.55), fog: false })
    );
    // Der weiche Schein um den Mond
    this.mondSchein = new THREE.Sprite(new THREE.SpriteMaterial({
      map: scheinBild(), color: '#9fb4ff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.5,
    }));
    this.mondSchein.scale.setScalar(260);
    szene.add(this.kuppel, this.sterne, this.wolken, this.mond, this.mondSchein);

    // Licht von oben (Himmel) und unten (Wiese)
    this.himmelsLicht = new THREE.HemisphereLight('#cfe8ff', '#5a7d3a', 1);
    // Sonne (nachts: Mondlicht) – macht die Schatten
    this.sonne = new THREE.DirectionalLight('#ffffff', 3);
    this.sonne.castShadow = true;
    this.sonne.shadow.mapSize.set(2048, 2048);
    const sc = this.sonne.shadow.camera;
    sc.left = sc.bottom = -SCHATTEN_GROESSE;
    sc.right = sc.top = SCHATTEN_GROESSE;
    sc.near = 1;
    sc.far = 260;
    this.sonne.shadow.bias = -0.0005;
    this.sonne.shadow.normalBias = 0.04;
    szene.add(this.himmelsLicht, this.sonne, this.sonne.target);

    szene.fog = new THREE.Fog('#bfe3ff', 70, 330);

    // Spiegelungen (fürs Wasser): der Himmel wird einmal "fotografiert"
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.spiegelSzene = new THREE.Scene();
    this.spiegelKuppel = baueAtmosphaere();
    this.spiegelSzene.add(this.spiegelKuppel);
    this.letzteSpiegelHelligkeit = -1;
    this.letzterSpiegelAbend = -1;
    this.helligkeit = 1;
    this.sonnenRichtung = new THREE.Vector3();
    this.mondRichtung = new THREE.Vector3();
    this.horizont = new THREE.Color();
    this.sortierZeit = 1;
    // Für das Schatten-Raster
    this._rechts = new THREE.Vector3();
    this._oben = new THREE.Vector3();
    this._mitte = new THREE.Vector3();
  }

  aktualisiere(dt, tageszeit, kamera, spielerPos) {
    const S = THREE.MathUtils.smoothstep;
    const winkel = tageszeit.sonnenWinkel();
    const richtung = this.sonnenRichtung.set(Math.cos(winkel), Math.sin(winkel), 0.35).normalize();
    const hoehe = richtung.y;
    const hell = S(hoehe, -0.12, 0.22);
    // "abend" = wie golden das Licht ist (kurz vor/nach Sonnenauf- und -untergang)
    const abend = 1 - S(Math.abs(hoehe - 0.04), 0, 0.24);
    const nacht = 1 - S(hoehe, -0.2, 0.02);
    this.helligkeit = hell;

    const u = this.kuppel.material.uniforms;
    u.sunPosition.value.copy(richtung);
    u.hell.value = 0.62 * S(hoehe, -0.25, 0.1);
    KUPPEL_WERTE.nacht.value = nacht;

    // Dunst-Farbe am Horizont: Tag → Abendrot → Nacht
    this.horizont.copy(FARBEN.nachtHorizont).lerp(FARBEN.tagHorizont, hell).lerp(FARBEN.abendHorizont, abend * 0.55 * S(hoehe, -0.15, 0.0));
    this.szene.fog.color.copy(this.horizont);
    KUPPEL_WERTE.dunstFarbe.value.copy(this.horizont);
    // Leuchtender Dunst in Sonnenrichtung (nachts aus)
    hilfsFarbe.copy(FARBEN.tagGlanz).lerp(FARBEN.abendGlanz, abend).multiplyScalar(0.55 * S(hoehe, -0.1, 0.05) * (0.35 + abend * 0.9));
    Object.assign(NEBEL.nebelGlanz.value, { x: hilfsFarbe.r, y: hilfsFarbe.g, z: hilfsFarbe.b });
    Object.assign(NEBEL.nebelSonne.value, { x: richtung.x, y: richtung.y, z: richtung.z });
    // Nachts weniger Bodendunst (sonst wird alles grau)
    NEBEL.nebelHoehe.value.x = DUNST.boden * (0.35 + 0.65 * hell);

    // Kuppel, Sterne und Mond wandern mit der Kamera mit (sie sind "unendlich" weit weg)
    this.kuppel.position.copy(kamera.position);
    this.sterne.position.copy(kamera.position);
    this.sterne.material.opacity = 1 - S(hell, 0, 0.45);
    this.sterne.visible = this.sterne.material.opacity > 0.01;
    this.sterne.rotation.y += dt * 0.003;
    const mondRichtung = this.mondRichtung.copy(richtung).negate();
    mondRichtung.y = Math.abs(mondRichtung.y) * 0.8 + 0.25;
    mondRichtung.normalize();
    this.mond.position.copy(kamera.position).addScaledVector(mondRichtung, 780);
    this.mond.lookAt(kamera.position);
    const mondSichtbar = 1 - S(hell, 0.2, 0.6);
    this.mond.visible = mondSichtbar > 0.01;
    this.mondSchein.position.copy(kamera.position).addScaledVector(mondRichtung, 770);
    this.mondSchein.material.opacity = 0.55 * mondSichtbar;
    this.mondSchein.visible = this.mond.visible;

    // Wolken ziehen langsam weiter und bekommen Licht von der Sonne
    const wu = this.wolken.userData.material.uniforms;
    wu.verschiebung.value.x = (wu.verschiebung.value.x + dt * 2.5) % WOLKEN_FELD;
    wu.verschiebung.value.y = (wu.verschiebung.value.y + dt * 0.8) % WOLKEN_FELD;
    const tagLicht = S(hoehe, -0.08, 0.1);
    wu.sonne.value.copy(hoehe > -0.04 ? richtung : mondRichtung);
    wu.lichtFarbe.value.copy(FARBEN.wolkeNacht).lerp(hilfsFarbe.copy(FARBEN.wolkeLicht).lerp(FARBEN.wolkeAbendLicht, abend * 0.85), tagLicht);
    wu.lichtFarbe.value.multiplyScalar(0.35 + 0.75 * tagLicht);
    wu.schattenFarbe.value.copy(FARBEN.wolkeNacht).multiplyScalar(0.6)
      .lerp(hilfsFarbe.copy(FARBEN.wolkeSchatten).lerp(FARBEN.wolkeAbendSchatten, abend * 0.7), tagLicht);
    wu.schattenFarbe.value.multiplyScalar(0.3 + 0.55 * tagLicht);
    this.sortierZeit += dt;
    if (this.sortierZeit > 0.5) {
      this.sortierZeit = 0;
      sortiereWolken(this.wolken, kamera);
    }

    // Licht: tagsüber Sonne, nachts bläuliches Mondlicht
    const tag = hoehe > -0.02;
    const lichtRichtung = tag ? richtung : mondRichtung;
    this.setzeSchatten(spielerPos, lichtRichtung);
    if (tag) {
      this.sonne.color.set('#fff3dd').lerp(hilfsFarbe.set('#ff8a45'), abend * 0.9);
      this.sonne.intensity = 3.2 * S(hoehe, -0.02, 0.15);
    } else {
      this.sonne.color.set('#9fb8ff');
      this.sonne.intensity = 0.75 * S(-hoehe, 0.02, 0.2);
    }
    this.himmelsLicht.intensity = 0.4 + 0.8 * hell;
    this.himmelsLicht.color.set('#3a4f8a').lerp(hilfsFarbe.set('#cfe8ff'), hell).lerp(hilfsFarbe.set('#ffc6a0'), abend * 0.3 * hell);
    this.himmelsLicht.groundColor.set('#1a2433').lerp(hilfsFarbe.set('#5a7d3a'), hell);

    // Spiegelbild des Himmels nur neu machen, wenn es sich sichtbar geändert hat
    if (Math.abs(hell - this.letzteSpiegelHelligkeit) > 0.08 || Math.abs(abend - this.letzterSpiegelAbend) > 0.15) {
      const su = this.spiegelKuppel.material.uniforms;
      su.sunPosition.value.copy(u.sunPosition.value);
      if (this.szene.environment) this.szene.environment.dispose();
      this.szene.environment = this.pmrem.fromScene(this.spiegelSzene, 0, 1, 1000).texture;
      this.letzteSpiegelHelligkeit = hell;
      this.letzterSpiegelAbend = abend;
    }
  }

  // Die Schatten-Kamera folgt der Figur – aber nur in ganzen "Schatten-Pixeln".
  // Sonst flimmern die Schattenkanten beim Laufen.
  setzeSchatten(spielerPos, lichtRichtung) {
    const pixel = (SCHATTEN_GROESSE * 2) / this.sonne.shadow.mapSize.x;
    const rechts = this._rechts.crossVectors(THREE.Object3D.DEFAULT_UP, lichtRichtung).normalize();
    const oben = this._oben.crossVectors(lichtRichtung, rechts);
    const mitte = this._mitte.copy(spielerPos);
    const a = mitte.dot(rechts), b = mitte.dot(oben);
    mitte.addScaledVector(rechts, Math.round(a / pixel) * pixel - a);
    mitte.addScaledVector(oben, Math.round(b / pixel) * pixel - b);
    this.sonne.position.copy(mitte).addScaledVector(lichtRichtung, 120);
    this.sonne.target.position.copy(mitte);
  }
}
