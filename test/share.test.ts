import { describe, expect, it } from "vitest";

import { pubData as data } from "@/lib/data";
import { buildShareHash, decodeIds, encodeIds, parseShareHash } from "@/lib/share";

describe("share links", () => {
  it("round-trips ids through the bitset", () => {
    const ids = [1, 7, 8, 9, 64, 79];
    expect(decodeIds(encodeIds(ids))).toEqual(ids);
    expect(decodeIds(encodeIds([]))).toEqual([]);
  });

  it("round-trips a name and visited pubs", () => {
    const visited = new Set(["Eagle", "Mill", "CambridgeBlue"]);
    const hash = buildShareHash("Sam & Jo", visited, data.stations);
    expect(parseShareHash(hash, data.stations)).toEqual({ name: "Sam & Jo", visited });
  });

  it("ignores hashes that aren't share links or are malformed", () => {
    expect(parseShareHash("", data.stations)).toBeNull();
    expect(parseShareHash("#other", data.stations)).toBeNull();
    expect(parseShareHash("#share?v=%%%", data.stations)).toBeNull();
  });

  it("drops ids that don't match a pub", () => {
    const result = parseShareHash(`#share?v=${encodeIds([500])}`, data.stations);
    expect(result?.visited.size).toBe(0);
  });
});
