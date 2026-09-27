// Helpers over data/pubs.json.

export function isOpen(station) {
  return station.status !== "closed";
}

export function displayName(station) {
  return station.name ?? station.label.replace(/\n/g, " ");
}

export function openPubKeys(stations) {
  return Object.keys(stations).filter((key) => isOpen(stations[key]));
}

// Progress per line: how many of the open pubs on each line have been visited.
export function lineProgress(data, visited) {
  return data.lines.map((line) => {
    const keys = [...new Set(line.nodes.filter((n) => n.name).map((n) => n.name))].filter((key) =>
      isOpen(data.stations[key]),
    );
    const done = keys.filter((key) => visited.has(key)).length;
    return { name: line.label ?? line.name, color: line.color, done, total: keys.length };
  });
}

// Great-circle distance in metres.
export function distanceMetres(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

export function nearestPubs(stations, position, limit = 3) {
  return Object.entries(stations)
    .filter(([, s]) => isOpen(s) && s.position)
    .map(([key, s]) => ({ key, distance: distanceMetres(position, s.position) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
}
