import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { addCheckins, listCheckins, removeCheckin } from "@/lib/server/checkins";
import { createDb } from "@/lib/server/db";
import { UserError } from "@/lib/server/errors";
import { addFriendByCode, getFriendsOverview, getProfile, removeFriend, setName } from "@/lib/server/friends";

const db = createDb();

async function makeUser(email: string, name: string) {
  return db.user.create({ data: { email, name } });
}

beforeEach(async () => {
  await db.friendship.deleteMany();
  await db.checkin.deleteMany();
  await db.user.deleteMany();
});

afterAll(() => db.$disconnect());

describe("check-ins", () => {
  it("adds, lists and removes check-ins, ignoring duplicates", async () => {
    const alice = await makeUser("alice@example.com", "Alice");
    const visit = { pubKey: "Eagle", checkedInAt: "2026-09-01T20:00:00.000Z" };
    expect(await addCheckins(db, alice.id, [visit, { pubKey: "Mill", checkedInAt: "2026-09-02T20:00:00.000Z" }])).toBe(2);
    expect(await addCheckins(db, alice.id, [visit])).toBe(0);
    expect(await listCheckins(db, alice.id)).toEqual([visit, { pubKey: "Mill", checkedInAt: "2026-09-02T20:00:00.000Z" }]);
    expect(await removeCheckin(db, alice.id, visit)).toBe(1);
    expect((await listCheckins(db, alice.id)).map((c) => c.pubKey)).toEqual(["Mill"]);
  });

  it("rejects unknown pubs and impossible times", async () => {
    const alice = await makeUser("alice@example.com", "Alice");
    await expect(addCheckins(db, alice.id, [{ pubKey: "Nope", checkedInAt: "2026-09-01T20:00:00Z" }])).rejects.toThrow(UserError);
    await expect(addCheckins(db, alice.id, [{ pubKey: "Eagle", checkedInAt: "3000-01-01T00:00:00Z" }])).rejects.toThrow(UserError);
    await expect(addCheckins(db, alice.id, [{ pubKey: "toString", checkedInAt: "2026-09-01T20:00:00Z" }])).rejects.toThrow(UserError);
  });

  it("can't remove someone else's check-in", async () => {
    const alice = await makeUser("alice@example.com", "Alice");
    const bob = await makeUser("bob@example.com", "Bob");
    const visit = { pubKey: "Eagle", checkedInAt: "2026-09-01T20:00:00.000Z" };
    await addCheckins(db, bob.id, [visit]);
    expect(await removeCheckin(db, alice.id, visit)).toBe(0);
    expect(await listCheckins(db, bob.id)).toHaveLength(1);
  });
});

describe("friends", () => {
  it("only shows check-ins of people you're friends with, both ways", async () => {
    const alice = await makeUser("alice@example.com", "Alice");
    const bob = await makeUser("bob@example.com", "Bob");
    const carol = await makeUser("carol@example.com", "Carol");
    await addCheckins(db, alice.id, [{ pubKey: "Eagle", checkedInAt: "2026-09-01T20:00:00Z" }]);
    await addCheckins(db, bob.id, [{ pubKey: "Mill", checkedInAt: "2026-09-02T20:00:00Z" }]);
    await addCheckins(db, carol.id, [{ pubKey: "Anchor", checkedInAt: "2026-09-03T20:00:00Z" }]);

    expect((await getFriendsOverview(db, bob.id)).checkins.map((c) => c.pubKey)).toEqual(["Mill"]);

    const added = await addFriendByCode(db, bob.id, alice.friendCode);
    expect(added.name).toBe("Alice");
    await addFriendByCode(db, bob.id, alice.friendCode); // twice is harmless

    const bobView = await getFriendsOverview(db, bob.id);
    expect(bobView.checkins.map((c) => c.pubKey)).toEqual(["Mill", "Eagle"]);
    expect(bobView.people.map((p) => p.name).sort()).toEqual(["Alice", "Bob"]);

    const aliceView = await getFriendsOverview(db, alice.id);
    expect(aliceView.checkins.map((c) => c.pubKey)).toEqual(["Mill", "Eagle"]);
    expect(aliceView.checkins.some((c) => c.pubKey === "Anchor")).toBe(false);

    await removeFriend(db, alice.id, bob.id);
    expect((await getFriendsOverview(db, bob.id)).checkins.map((c) => c.pubKey)).toEqual(["Mill"]);
    expect((await getFriendsOverview(db, alice.id)).checkins.map((c) => c.pubKey)).toEqual(["Eagle"]);
  });

  it("rejects bad and self invite codes", async () => {
    const alice = await makeUser("alice@example.com", "Alice");
    await expect(addFriendByCode(db, alice.id, "nope")).rejects.toThrow("isn't valid");
    await expect(addFriendByCode(db, alice.id, alice.friendCode)).rejects.toThrow("your own invite link");
  });

  it("gives every user a friend code and lets them change their name", async () => {
    const alice = await makeUser("alice@example.com", "Alice");
    expect(alice.friendCode).toMatch(/^[0-9a-f]{12}$/);
    await setName(db, alice.id, "  Ally  ");
    expect((await getProfile(db, alice.id)).name).toBe("Ally");
  });
});
