// Check-ins are kept in the browser (localStorage), keyed by the pub's station key
// (e.g. "Eagle"). Each pub maps to a list of ISO timestamps, one per visit.

const STORAGE_KEY = "cambridge-pub-map:v1";

export function emptyState() {
  return { version: 1, name: "", checkins: {} };
}

export function loadState(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    return normaliseState(JSON.parse(raw));
  } catch {
    return emptyState();
  }
}

export function saveState(state, storage = globalThis.localStorage) {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private browsing or storage full: the app still works for this visit.
  }
}

export function normaliseState(input) {
  const state = emptyState();
  if (!input || typeof input !== "object") return state;
  if (typeof input.name === "string") state.name = input.name.slice(0, 40);
  const checkins = input.checkins && typeof input.checkins === "object" ? input.checkins : {};
  for (const [pub, visits] of Object.entries(checkins)) {
    if (!Array.isArray(visits)) continue;
    const valid = visits.filter((t) => typeof t === "string" && !Number.isNaN(Date.parse(t)));
    if (valid.length) state.checkins[pub] = valid.sort();
  }
  return state;
}

export function checkIn(state, pub, when = new Date()) {
  const visits = [...(state.checkins[pub] ?? []), when.toISOString()];
  return { ...state, checkins: { ...state.checkins, [pub]: visits } };
}

// Removes the most recent visit, so an accidental tap can be undone.
export function undoCheckIn(state, pub) {
  const visits = (state.checkins[pub] ?? []).slice(0, -1);
  const checkins = { ...state.checkins };
  if (visits.length) checkins[pub] = visits;
  else delete checkins[pub];
  return { ...state, checkins };
}

export function visitedSet(state) {
  return new Set(Object.keys(state.checkins));
}

// Merges an imported backup into the current state without losing visits.
export function mergeStates(current, imported) {
  const incoming = normaliseState(imported);
  const checkins = { ...current.checkins };
  for (const [pub, visits] of Object.entries(incoming.checkins)) {
    checkins[pub] = [...new Set([...(checkins[pub] ?? []), ...visits])].sort();
  }
  return { ...current, name: current.name || incoming.name, checkins };
}
