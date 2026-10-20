// =============================================================
//  SPEICHERN – damit man nicht immer von vorn anfängt
//  Der Spielstand wird im Browser gespeichert (alle 10 Sekunden und
//  beim Schließen). Achtung: Er liegt nur auf DIESEM Gerät –
//  auf dem iPad und dem Mac gibt es also zwei verschiedene Spielstände.
// =============================================================
const SCHLUESSEL = 'inselspiel-spielstand-v1';

export function ladeSpielstand() {
  try {
    const text = localStorage.getItem(SCHLUESSEL);
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

export function speichereSpielstand(daten) {
  try {
    localStorage.setItem(SCHLUESSEL, JSON.stringify({ ...daten, gespeichert: Date.now() }));
    return true;
  } catch {
    return false;
  }
}

export function loescheSpielstand() {
  try {
    localStorage.removeItem(SCHLUESSEL);
  } catch {}
}
