// =============================================================
//  RAUSCHEN – der Trick, mit dem Spiele natürliche Landschaften bauen
//  Echter Zufall wäre ein wildes Durcheinander. "Rauschen" ist ein
//  weicher Zufall: Nachbarpunkte sind ähnlich hoch – wie echte Hügel.
// =============================================================

function hash(ix, iy, seed) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

// Ergibt eine Zahl zwischen 0 und 1, die sich weich verändert
export function rauschen(x, y, seed = 0) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, seed), b = hash(ix + 1, iy, seed);
  const c = hash(ix, iy + 1, seed), d = hash(ix + 1, iy + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// Mehrere Rauschen übereinander: große Hügel + kleine Buckel
export function fbm(x, y, oktaven = 4, seed = 0) {
  let summe = 0, staerke = 0.5, frequenz = 1, gesamt = 0;
  for (let i = 0; i < oktaven; i++) {
    summe += staerke * rauschen(x * frequenz, y * frequenz, seed + i * 17);
    gesamt += staerke;
    staerke *= 0.5;
    frequenz *= 2.03;
  }
  return summe / gesamt;
}

// Ein Zufall, der jedes Mal gleich ist (wie ein Minecraft-Seed)
export function zufallMitSeed(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}
