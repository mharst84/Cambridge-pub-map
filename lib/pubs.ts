// Helpers over data/pubs.json.
import type { Line, Position, PubData, Station } from "./types";

export function isOpen(station: Station): boolean {
  return station.status !== "closed";
}

export function displayName(station: Station): string {
  return station.name ?? station.label.replace(/\n/g, " ");
}

export function openPubKeys(stations: Record<string, Station>): string[] {
  return Object.keys(stations).filter((key) => isOpen(stations[key]));
}

export function isKnownPub(stations: Record<string, Station>, key: string): boolean {
  return Object.hasOwn(stations, key);
}

export type LineProgress = { name: string; color: string; done: number; total: number };

// Progress per line: how many of the open pubs on each line have been visited.
export function lineProgress(data: PubData, visited: Set<string>): LineProgress[] {
  return data.lines.map((line) => {
    const keys = [...new Set(line.nodes.flatMap((n) => (n.name ? [n.name] : [])))].filter((key) =>
      isOpen(data.stations[key]),
    );
    const done = keys.filter((key) => visited.has(key)).length;
    return { name: line.label ?? line.name, color: line.color, done, total: keys.length };
  });
}

export function linesForPub(data: PubData, key: string): Line[] {
  return data.lines.filter((line) => line.nodes.some((n) => n.name === key));
}

// Great-circle distance in metres.
export function distanceMetres(a: Position, b: Position): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

export function nearestPubs(stations: Record<string, Station>, position: Position, limit = 3) {
  return Object.entries(stations)
    .flatMap(([key, s]) => (isOpen(s) && s.position ? [{ key, distance: distanceMetres(position, s.position) }] : []))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
}
