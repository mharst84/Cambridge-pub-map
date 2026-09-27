import type { CheckinRow } from "@/lib/types";

import type { Db } from "./db";
import { UserError } from "./errors";

const MAX_CHECKINS = 5000;

export async function getProfile(db: Db, userId: string) {
  return db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, email: true, name: true, friendCode: true },
  });
}

export async function setName(db: Db, userId: string, name: string) {
  await db.user.update({ where: { id: userId }, data: { name: name.trim().slice(0, 40) || null } });
}

// Only the name is revealed: enough for "Sam invited you" on the invite page.
export async function findInviter(db: Db, code: string) {
  return db.user.findUnique({ where: { friendCode: code }, select: { id: true, name: true } });
}

async function friendIds(db: Db, userId: string) {
  const rows = await db.friendship.findMany({ where: { userId }, select: { friendId: true } });
  return rows.map((r) => r.friendId);
}

// Everything the Friends panel needs: me and my friends, and our check-ins (newest first).
export async function getFriendsOverview(db: Db, userId: string) {
  const ids = [userId, ...(await friendIds(db, userId))];
  const [people, checkins] = await Promise.all([
    db.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }),
    db.checkin.findMany({
      where: { userId: { in: ids } },
      select: { userId: true, pubKey: true, checkedInAt: true },
      orderBy: { checkedInAt: "desc" },
      take: MAX_CHECKINS,
    }),
  ]);
  return {
    people: people.map((p) => ({ id: p.id, name: p.name ?? "", isMe: p.id === userId })),
    checkins: checkins.map((c): CheckinRow => ({ ...c, checkedInAt: c.checkedInAt.toISOString() })),
  };
}

// Friendships are mutual, so both directions are stored.
export async function addFriendByCode(db: Db, userId: string, code: string) {
  const them = await findInviter(db, code);
  if (!them) throw new UserError("That invite link isn't valid. Ask your friend to send it again.", 404);
  if (them.id === userId) throw new UserError("That's your own invite link. Send it to a friend instead.");
  await db.friendship.createMany({
    data: [
      { userId, friendId: them.id },
      { userId: them.id, friendId: userId },
    ],
    skipDuplicates: true,
  });
  return them;
}

export async function removeFriend(db: Db, userId: string, friendId: string) {
  await db.friendship.deleteMany({
    where: {
      OR: [
        { userId, friendId },
        { userId: friendId, friendId: userId },
      ],
    },
  });
}
