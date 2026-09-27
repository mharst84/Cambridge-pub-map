// Share links carry a person's visited pubs in the URL hash, so no account is needed:
//   #share?n=<name>&v=<bitset>
// Bit i of the bitset is set when the pub with numeric id i (from data/pubs.json)
// has been visited. Ids are stable, so links keep working when pubs are added.
import type { Station } from "./types";

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

export function encodeIds(ids: number[]): string {
  const max = Math.max(0, ...ids);
  const bytes = new Uint8Array(Math.ceil((max + 1) / 8));
  for (const id of ids) bytes[id >> 3] |= 1 << (id & 7);
  return toBase64Url(bytes);
}

export function decodeIds(text: string): number[] {
  const ids: number[] = [];
  fromBase64Url(text).forEach((byte, i) => {
    for (let bit = 0; bit < 8; bit++) if (byte & (1 << bit)) ids.push(i * 8 + bit);
  });
  return ids;
}

export function buildShareHash(name: string, visitedKeys: Iterable<string>, stations: Record<string, Station>): string {
  const ids = [...visitedKeys].map((key) => stations[key]?.id).filter(Number.isInteger);
  const params = new URLSearchParams();
  if (name) params.set("n", name);
  params.set("v", encodeIds(ids));
  return `#share?${params}`;
}

export type SharedMap = { name: string; visited: Set<string> };

// Returns null if the hash isn't a share link.
export function parseShareHash(hash: string, stations: Record<string, Station>): SharedMap | null {
  if (!hash.startsWith("#share?")) return null;
  const params = new URLSearchParams(hash.slice("#share?".length));
  const byId = new Map(Object.entries(stations).map(([key, s]) => [s.id, key]));
  let ids: number[];
  try {
    ids = decodeIds(params.get("v") ?? "");
  } catch {
    return null;
  }
  const visited = new Set(ids.flatMap((id) => byId.get(id) ?? []));
  return { name: (params.get("n") ?? "").slice(0, 40), visited };
}
