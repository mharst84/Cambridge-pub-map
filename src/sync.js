// Pure helpers for syncing local check-ins with the server and summarising
// friends' check-ins. Kept free of network code so they are easy to test.

// Postgres returns "2026-09-01T20:00:00+00:00"; the browser stores
// "2026-09-01T20:00:00.000Z". Normalise so they compare equal.
export function normaliseTime(time) {
  return new Date(time).toISOString();
}

// rows: [{ pub_key, checked_in_at }] from the server, for the signed-in user.
// Returns what to upload and the merged local check-ins.
export function reconcile(localCheckins, rows) {
  const remote = new Set(rows.map((r) => `${r.pub_key}|${normaliseTime(r.checked_in_at)}`));
  const toUpload = [];
  for (const [pub, visits] of Object.entries(localCheckins)) {
    for (const t of visits) {
      if (!remote.has(`${pub}|${normaliseTime(t)}`)) toUpload.push({ pub_key: pub, checked_in_at: normaliseTime(t) });
    }
  }
  const merged = {};
  for (const [pub, visits] of Object.entries(localCheckins)) merged[pub] = visits.map(normaliseTime);
  for (const r of rows) {
    const t = normaliseTime(r.checked_in_at);
    merged[r.pub_key] = [...new Set([...(merged[r.pub_key] ?? []), t])];
  }
  for (const pub of Object.keys(merged)) merged[pub].sort();
  return { toUpload, merged };
}

// rows: [{ user_id, pub_key, checked_in_at }] for me and my friends, newest first.
// people: Map of user id -> display name. isOpenPub(key) says whether a pub counts.
export function summariseFriends(rows, people, meId, isOpenPub) {
  const byUser = new Map();
  for (const [id, name] of people) byUser.set(id, { id, name, isMe: id === meId, pubs: new Set(), last: null });
  for (const row of rows) {
    const person = byUser.get(row.user_id);
    if (!person) continue;
    if (isOpenPub(row.pub_key)) person.pubs.add(row.pub_key);
    const t = normaliseTime(row.checked_in_at);
    if (!person.last || t > person.last) person.last = t;
  }
  const leaderboard = [...byUser.values()].sort(
    (a, b) => b.pubs.size - a.pubs.size || (b.last ?? "").localeCompare(a.last ?? "") || a.name.localeCompare(b.name),
  );
  const feed = rows
    .filter((row) => row.user_id !== meId && byUser.has(row.user_id))
    .slice(0, 30)
    .map((row) => ({ userId: row.user_id, name: byUser.get(row.user_id).name, pub: row.pub_key, time: normaliseTime(row.checked_in_at) }));
  return { leaderboard, feed };
}

export function timeAgo(iso, now = new Date()) {
  const seconds = Math.max(0, (now - new Date(iso)) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return days === 1 ? "yesterday" : `${days} days ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
