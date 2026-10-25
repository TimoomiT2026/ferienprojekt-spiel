// =============================================================
//  SPEICHERN – damit man nicht immer von vorn anfängt
//  Der Spielstand wird im Browser gespeichert (alle 10 Sekunden und
//  beim Schließen). Achtung: Er liegt nur auf DIESEM Gerät –
//  auf dem iPad und dem Mac gibt es also zwei verschiedene Spielstände.
// =============================================================
// Zwei Speicherplätze: das Abenteuer und das Freie Spiel – so überschreibt das eine nie das andere
const ABENTEUER = 'inselspiel-spielstand-v1';
const FREI = 'inselspiel-frei-v1';
let SCHLUESSEL = ABENTEUER;

// Ab jetzt in den Speicherplatz vom Freien Spiel (true) oder vom Abenteuer (false) speichern
export function setzeSpeicherplatz(frei) {
  SCHLUESSEL = frei ? FREI : ABENTEUER;
}

// Gibt es schon ein Freies Spiel? (für den Startbildschirm)
export function ladeFreiesSpiel() {
  try {
    const text = localStorage.getItem(FREI);
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

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
