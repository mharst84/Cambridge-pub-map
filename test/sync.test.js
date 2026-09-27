import { describe, expect, it } from "vitest";

import { reconcile, summariseFriends, timeAgo } from "../src/sync.js";

describe("reconcile", () => {
  it("uploads local-only visits and pulls server-only visits", () => {
    const local = { Eagle: ["2026-09-01T20:00:00.000Z"], Mill: ["2026-09-02T20:00:00.000Z"] };
    const rows = [
      { pub_key: "Eagle", checked_in_at: "2026-09-01T20:00:00+00:00" },
      { pub_key: "Anchor", checked_in_at: "2026-09-03T20:00:00+00:00" },
    ];
    const { toUpload, merged } = reconcile(local, rows);
    expect(toUpload).toEqual([{ pub_key: "Mill", checked_in_at: "2026-09-02T20:00:00.000Z" }]);
    expect(merged).toEqual({
      Eagle: ["2026-09-01T20:00:00.000Z"],
      Mill: ["2026-09-02T20:00:00.000Z"],
      Anchor: ["2026-09-03T20:00:00.000Z"],
    });
  });
});

describe("summariseFriends", () => {
  const people = new Map([
    ["me", "You"],
    ["sam", "Sam"],
  ]);
  const rows = [
    { user_id: "sam", pub_key: "Eagle", checked_in_at: "2026-09-05T20:00:00Z" },
    { user_id: "sam", pub_key: "Eagle", checked_in_at: "2026-09-04T20:00:00Z" },
    { user_id: "sam", pub_key: "FlyingPig", checked_in_at: "2026-09-03T20:00:00Z" },
    { user_id: "me", pub_key: "Mill", checked_in_at: "2026-09-02T20:00:00Z" },
    { user_id: "me", pub_key: "Anchor", checked_in_at: "2026-09-01T20:00:00Z" },
  ];
  const { leaderboard, feed } = summariseFriends(rows, people, "me", (key) => key !== "FlyingPig");

  it("ranks by distinct open pubs", () => {
    expect(leaderboard.map((p) => [p.name, p.pubs.size])).toEqual([
      ["You", 2],
      ["Sam", 1],
    ]);
  });

  it("lists friends' check-ins but not mine", () => {
    expect(feed.map((f) => f.pub)).toEqual(["Eagle", "Eagle", "FlyingPig"]);
  });
});

describe("timeAgo", () => {
  const now = new Date("2026-09-27T12:00:00Z");
  it("describes recent times", () => {
    expect(timeAgo("2026-09-27T11:59:30Z", now)).toBe("just now");
    expect(timeAgo("2026-09-27T09:00:00Z", now)).toBe("3 h ago");
    expect(timeAgo("2026-09-26T09:00:00Z", now)).toBe("yesterday");
  });
});
