// Check-ins are kept in the browser (localStorage) so the app works without an
// account. When signed in they are also synced to the server (see lib/sync.ts).
import type { Checkins } from "./types";

const STORAGE_KEY = "cambridge-pub-map:v1";

export type LocalState = {
  version: 1;
  name: string;
  checkins: Checkins;
  // Which account these check-ins were last synced with.
  syncedUserId?: string;
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function emptyState(): LocalState {
  return { version: 1, name: "", checkins: {} };
}

export function loadState(storage: StorageLike | undefined = globalThis.localStorage): LocalState {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    return raw ? normaliseState(JSON.parse(raw)) : emptyState();
  } catch {
    return emptyState();
  }
}

export function saveState(state: LocalState, storage: StorageLike | undefined = globalThis.localStorage): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private browsing or storage full: the app still works for this visit.
  }
}

export function normaliseState(input: unknown): LocalState {
  const state = emptyState();
  if (!input || typeof input !== "object") return state;
  const obj = input as Record<string, unknown>;
  if (typeof obj.name === "string") state.name = obj.name.slice(0, 40);
  if (typeof obj.syncedUserId === "string") state.syncedUserId = obj.syncedUserId;
  const checkins = obj.checkins && typeof obj.checkins === "object" ? (obj.checkins as Record<string, unknown>) : {};
  for (const [pub, visits] of Object.entries(checkins)) {
    if (!Array.isArray(visits)) continue;
    const valid = visits.filter((t): t is string => typeof t === "string" && !Number.isNaN(Date.parse(t)));
    if (valid.length) state.checkins[pub] = valid.sort();
  }
  return state;
}

export function checkIn(state: LocalState, pub: string, when = new Date()): LocalState {
  const visits = [...(state.checkins[pub] ?? []), when.toISOString()];
  return { ...state, checkins: { ...state.checkins, [pub]: visits } };
}

// Removes the most recent visit, so an accidental tap can be undone.
export function undoCheckIn(state: LocalState, pub: string): LocalState {
  const visits = (state.checkins[pub] ?? []).slice(0, -1);
  const checkins = { ...state.checkins };
  if (visits.length) checkins[pub] = visits;
  else delete checkins[pub];
  return { ...state, checkins };
}

export function visitedSet(state: LocalState): Set<string> {
  return new Set(Object.keys(state.checkins));
}

// Merges an imported backup into the current state without losing visits.
export function mergeStates(current: LocalState, imported: unknown): LocalState {
  const incoming = normaliseState(imported);
  const checkins = { ...current.checkins };
  for (const [pub, visits] of Object.entries(incoming.checkins)) {
    checkins[pub] = [...new Set([...(checkins[pub] ?? []), ...visits])].sort();
  }
  return { ...current, name: current.name || incoming.name, checkins };
}
