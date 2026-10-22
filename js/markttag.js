// =============================================================
//  MARKTTAG 🛒 – wann ist Wochenmarkt im Palmendorf?
//  Der Game Designer hat entschieden: alle 3 Spieltage.
//  An diesem Tag gibt es den Markt, die Zauberpilz-Rallye
//  und morgens die Inselzeitung im Briefkasten.
// =============================================================
import { EINSTELLUNGEN } from './einstellungen.js';

// Ist an diesem Tag Markt? (Tag 3, 6, 9 … bei "alle 3 Tage")
export function istMarkttag(tag) {
  const alle = EINSTELLUNGEN.markt?.alleTage ?? 3;
  return tag > 0 && tag % alle === 0;
}

// Wann ist der nächste Markt? (heute zählt mit)
export function naechsterMarkttag(tag) {
  const alle = EINSTELLUNGEN.markt?.alleTage ?? 3;
  return Math.ceil(Math.max(1, tag) / alle) * alle;
}
