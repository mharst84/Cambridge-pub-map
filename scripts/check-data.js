// Sanity checks for data/pubs.json. Run with `npm run check-data`.
import { readFileSync } from "node:fs";

const data = JSON.parse(readFileSync(new URL("../data/pubs.json", import.meta.url), "utf8"));
const problems = [];
const ids = new Map();

for (const [key, pub] of Object.entries(data.stations)) {
  if (!Number.isInteger(pub.id) || pub.id < 1) problems.push(`${key}: id must be a positive integer`);
  if (ids.has(pub.id)) problems.push(`${key}: id ${pub.id} is already used by ${ids.get(pub.id)}`);
  ids.set(pub.id, key);
  if (!pub.label) problems.push(`${key}: missing label`);
  if (!["open", "closed"].includes(pub.status)) problems.push(`${key}: status must be "open" or "closed"`);
  if (pub.status === "open" && !pub.position) problems.push(`${key}: open pubs need a position for "Check in nearby"`);
}

const onMap = new Set();
for (const line of data.lines) {
  for (const node of line.nodes) {
    if (!node.name) continue;
    if (!data.stations[node.name]) problems.push(`line ${line.name}: unknown station "${node.name}"`);
    onMap.add(node.name);
  }
}
for (const key of Object.keys(data.stations)) {
  if (!onMap.has(key)) problems.push(`${key}: not on any line, so it won't be drawn`);
}

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`pubs.json OK: ${ids.size} pubs on ${data.lines.length} lines`);
