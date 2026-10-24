// =============================================================
//  HINDERNISSE – Dinge, durch die man nicht durchlaufen kann
//  Damit das Spiel nicht bei jedem Schritt alle 1000 Bäume prüfen muss,
//  wird die Insel in Kästchen eingeteilt. Geprüft wird nur das Kästchen
//  um die Figur herum. Das nennt man "räumliches Gitter".
// =============================================================

const KAESTCHEN = 8;

export class Hindernisse {
  constructor() {
    this.gitter = new Map();
  }

  schluessel(kx, kz) {
    return kx * 100000 + kz;
  }

  // fels = { unten, hoehe, r }: Über einen Felsen kann man drüberklettern (er ist ein „Buckel“, keine Wand)
  hinzufuegen(x, z, radius, fels = null) {
    const k = this.schluessel(Math.floor(x / KAESTCHEN), Math.floor(z / KAESTCHEN));
    if (!this.gitter.has(k)) this.gitter.set(k, []);
    const h = { x, z, radius, k, fels };
    this.gitter.get(k).push(h);
    return h;
  }

  // Ein Hindernis wieder wegnehmen (z. B. wenn ein Baum gefällt wurde)
  entfernen(h) {
    const liste = h && this.gitter.get(h.k);
    if (!liste) return;
    const i = liste.indexOf(h);
    if (i >= 0) liste.splice(i, 1);
  }

  // Stößt etwas mit diesem Radius an der Stelle (x, z) irgendwo an?
  // ohneFelsen = true: Felsen zählen nicht (beim Laufen und Reiten klettert man drüber)
  trifft(x, z, eigenerRadius = 0.4, ohneFelsen = false) {
    const kx = Math.floor(x / KAESTCHEN), kz = Math.floor(z / KAESTCHEN);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const liste = this.gitter.get(this.schluessel(kx + dx, kz + dz));
        if (!liste) continue;
        for (const h of liste) {
          if (ohneFelsen && h.fels) continue;
          if (Math.hypot(x - h.x, z - h.z) < h.radius + eigenerRadius) return true;
        }
      }
    }
    return false;
  }

  // Wie hoch ist hier ein Felsen? (oben auf dem Felsen steht man – sonst -Infinity)
  // Die Form ist ein weicher Buckel: am Rand ganz flach, in der Mitte am höchsten.
  felsHoehe(x, z) {
    const kx = Math.floor(x / KAESTCHEN), kz = Math.floor(z / KAESTCHEN);
    let hoechste = -Infinity;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const liste = this.gitter.get(this.schluessel(kx + dx, kz + dz));
        if (!liste) continue;
        for (const h of liste) {
          if (!h.fels) continue;
          const d = Math.hypot(x - h.x, z - h.z);
          if (d >= h.fels.r) continue;
          hoechste = Math.max(hoechste, h.fels.unten + h.fels.hoehe * (0.5 + 0.5 * Math.cos((Math.PI * d) / h.fels.r)));
        }
      }
    }
    return hoechste;
  }
}
