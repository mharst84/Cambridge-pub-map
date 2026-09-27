import { stations } from "@/lib/data";
import { isKnownPub } from "@/lib/pubs";

import type { Db } from "./db";
import { UserError } from "./errors";

export type NewCheckin = { pubKey: string; checkedInAt: string };

const EARLIEST = Date.parse("2000-01-01T00:00:00Z");
const ALLOWED_CLOCK_SKEW_MS = 24 * 3600e3;

function validate({ pubKey, checkedInAt }: NewCheckin): { pubKey: string; checkedInAt: Date } {
  if (!isKnownPub(stations, pubKey)) throw new UserError(`Unknown pub: ${pubKey}`);
  const time = new Date(checkedInAt);
  if (Number.isNaN(time.getTime()) || time.getTime() < EARLIEST || time.getTime() > Date.now() + ALLOWED_CLOCK_SKEW_MS) {
    throw new UserError(`Invalid check-in time: ${checkedInAt}`);
  }
  return { pubKey, checkedInAt: time };
}

export async function listCheckins(db: Db, userId: string) {
  const rows = await db.checkin.findMany({
    where: { userId },
    select: { pubKey: true, checkedInAt: true },
    orderBy: { checkedInAt: "asc" },
  });
  return rows.map((r) => ({ pubKey: r.pubKey, checkedInAt: r.checkedInAt.toISOString() }));
}

// Adds check-ins, ignoring ones that are already stored (so syncing twice is harmless).
export async function addCheckins(db: Db, userId: string, items: NewCheckin[]) {
  const data = items.map((item) => ({ userId, ...validate(item) }));
  const { count } = await db.checkin.createMany({ data, skipDuplicates: true });
  return count;
}

export async function removeCheckin(db: Db, userId: string, item: NewCheckin) {
  const { pubKey, checkedInAt } = validate(item);
  const { count } = await db.checkin.deleteMany({ where: { userId, pubKey, checkedInAt } });
  return count;
}
