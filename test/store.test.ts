import { describe, expect, it } from "vitest";

import { checkIn, emptyState, loadState, mergeStates, saveState, undoCheckIn, visitedSet } from "@/lib/store";

function memoryStorage() {
  const items = new Map<string, string>();
  return { getItem: (k: string) => items.get(k) ?? null, setItem: (k: string, v: string) => void items.set(k, v) };
}

describe("check-in store", () => {
  it("records repeat visits and undoes the latest", () => {
    let state = checkIn(emptyState(), "Eagle", new Date("2026-01-01T20:00:00Z"));
    state = checkIn(state, "Eagle", new Date("2026-02-01T20:00:00Z"));
    expect(state.checkins.Eagle).toHaveLength(2);
    state = undoCheckIn(state, "Eagle");
    expect(state.checkins.Eagle).toEqual(["2026-01-01T20:00:00.000Z"]);
    state = undoCheckIn(state, "Eagle");
    expect(visitedSet(state).has("Eagle")).toBe(false);
  });

  it("saves and loads, and survives corrupt storage", () => {
    const storage = memoryStorage();
    const state = { ...checkIn(emptyState(), "Mill"), name: "Sam" };
    saveState(state, storage);
    expect(loadState(storage)).toEqual(state);
    storage.setItem("cambridge-pub-map:v1", "{not json");
    expect(loadState(storage)).toEqual(emptyState());
  });

  it("merges backups without duplicating visits", () => {
    const a = checkIn(emptyState(), "Mill", new Date("2026-01-01T00:00:00Z"));
    const b = checkIn(checkIn(emptyState(), "Mill", new Date("2026-01-01T00:00:00Z")), "Eagle");
    const merged = mergeStates(a, { ...b, checkins: { ...b.checkins, Bad: ["nope"] } });
    expect(merged.checkins.Mill).toHaveLength(1);
    expect(Object.keys(merged.checkins).sort()).toEqual(["Eagle", "Mill"]);
  });
});
