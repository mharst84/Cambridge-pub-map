// Pure helpers for syncing local check-ins with the server and summarising
// friends' check-ins. Kept free of network code so they are easy to test.
import type { CheckinRow, Checkins } from "./types";

export function normaliseTime(time: string | Date): string {
  return new Date(time).toISOString();
}

// rows: the signed-in user's check-ins on the server.
// Returns what to upload and the merged local check-ins.
export function reconcile(local: Checkins, rows: Pick<CheckinRow, "pubKey" | "checkedInAt">[]) {
  const remote = new Set(rows.map((r) => `${r.pubKey}|${normaliseTime(r.checkedInAt)}`));
  const toUpload: { pubKey: string; checkedInAt: string }[] = [];
  const merged: Checkins = {};
  for (const [pub, visits] of Object.entries(local)) {
    merged[pub] = visits.map(normaliseTime);
    for (const t of merged[pub]) if (!remote.has(`${pub}|${t}`)) toUpload.push({ pubKey: pub, checkedInAt: t });
  }
  for (const r of rows) {
    merged[r.pubKey] = [...new Set([...(merged[r.pubKey] ?? []), normaliseTime(r.checkedInAt)])];
  }
  for (const pub of Object.keys(merged)) merged[pub].sort();
  return { toUpload, merged };
}

export type Person = { id: string; name: string; isMe: boolean; pubs: Set<string>; last: string | null };
export type FeedItem = { userId: string; name: string; pub: string; time: string };

// rows: check-ins for me and my friends, newest first. people: user id -> name.
export function summariseFriends(
  rows: CheckinRow[],
  people: Map<string, string>,
  meId: string,
  isOpenPub: (key: string) => boolean,
): { leaderboard: Person[]; feed: FeedItem[]; visitedBy: Map<string, Set<string>> } {
  const byUser = new Map<string, Person>();
  for (const [id, name] of people) byUser.set(id, { id, name, isMe: id === meId, pubs: new Set(), last: null });
  const visitedBy = new Map<string, Set<string>>();
  for (const row of rows) {
    const person = byUser.get(row.userId);
    if (!person) continue;
    if (!visitedBy.has(row.userId)) visitedBy.set(row.userId, new Set());
    visitedBy.get(row.userId)!.add(row.pubKey);
    if (isOpenPub(row.pubKey)) person.pubs.add(row.pubKey);
    const t = normaliseTime(row.checkedInAt);
    if (!person.last || t > person.last) person.last = t;
  }
  const leaderboard = [...byUser.values()].sort(
    (a, b) => b.pubs.size - a.pubs.size || (b.last ?? "").localeCompare(a.last ?? "") || a.name.localeCompare(b.name),
  );
  const feed = rows
    .filter((row) => row.userId !== meId && byUser.has(row.userId))
    .slice(0, 30)
    .map((row) => ({ userId: row.userId, name: byUser.get(row.userId)!.name, pub: row.pubKey, time: normaliseTime(row.checkedInAt) }));
  return { leaderboard, feed, visitedBy };
}

export function timeAgo(iso: string, now = new Date()): string {
  const seconds = Math.max(0, (now.getTime() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return days === 1 ? "yesterday" : `${days} days ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// All visits from both sets of check-ins.
export function unionCheckins(a: Checkins, b: Checkins): Checkins {
  const out: Checkins = {};
  for (const source of [a, b]) {
    for (const [pub, visits] of Object.entries(source)) {
      out[pub] = [...new Set([...(out[pub] ?? []), ...visits.map(normaliseTime)])].sort();
    }
  }
  return out;
}
