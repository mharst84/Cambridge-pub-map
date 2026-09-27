import { describe, expect, it } from "vitest";

import data from "../data/pubs.json";
import { lineProgress, nearestPubs } from "../src/pubs.js";

describe("pub helpers", () => {
  it("counts only open pubs towards line progress", () => {
    const hills = lineProgress(data, new Set(["FlyingPig"])).find((l) => l.name === "Hills Road");
    expect(hills.done).toBe(0);
  });

  it("finds the nearest open pub", () => {
    const eagle = data.stations.Eagle.position;
    expect(nearestPubs(data.stations, eagle, 1)[0].key).toBe("Eagle");
  });
});
