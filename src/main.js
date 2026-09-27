import data from "../data/pubs.json";
import { displayName, isOpen, lineProgress, nearestPubs, openPubKeys } from "./pubs.js";
import { buildShareHash, parseShareHash } from "./share.js";
import { checkIn, loadState, mergeStates, saveState, undoCheckIn, visitedSet } from "./store.js";
import { setupFriends } from "./friends.js";
import { createTubeMap } from "./tubemap.js";

const REPO_URL = "https://github.com/mharst84/Cambridge-pub-map";
const NEARBY_RADIUS_METRES = 250;

const $ = (id) => document.getElementById(id);
const stations = data.stations;
const openKeys = openPubKeys(stations);

let state = loadState();
let shared = parseShareHash(location.hash, stations);
let selectedPub = null;

// Which lines each pub sits on, for the pub sheet.
const linesByPub = new Map();
for (const line of data.lines) {
  for (const node of line.nodes) {
    if (!node.name) continue;
    const list = linesByPub.get(node.name) ?? [];
    if (!list.some((l) => l.name === line.name)) list.push(line);
    linesByPub.set(node.name, list);
  }
}

const tube = createTubeMap($("map"), data, { onSelect: openPub });

// ---------- rendering ----------

function countOpen(visited) {
  return openKeys.filter((key) => visited.has(key)).length;
}

function render() {
  const mine = visitedSet(state);
  const compare = $("share-compare").checked;

  if (shared) {
    tube.setVisited(compare ? mine : null, shared.visited);
    $("share-banner").hidden = false;
    $("share-name").textContent = shared.name || "A friend";
    $("share-count").textContent = `${countOpen(shared.visited)} of ${openKeys.length} pubs`;
    $("legend-friend").textContent = shared.name || "Friend";
  } else {
    tube.setVisited(mine, null);
    $("share-banner").hidden = true;
  }
  document.body.classList.toggle("share-mode", Boolean(shared));

  $("progress-count").textContent = `${countOpen(mine)} / ${openKeys.length}`;
  if (selectedPub) renderPubSheet(selectedPub);
  if (!$("progress-drawer").hidden) renderDrawer();
}

function openPub(key) {
  if (!stations[key]) return;
  selectedPub = key;
  tube.setSelected(key);
  closeSheets("pub-sheet");
  renderPubSheet(key);
  $("pub-sheet").hidden = false;
}

function renderPubSheet(key) {
  const pub = stations[key];
  const visits = state.checkins[key] ?? [];
  const open = isOpen(pub);

  $("pub-name").textContent = displayName(pub);
  $("pub-formerly").hidden = !pub.formerly?.length;
  $("pub-formerly").textContent = pub.formerly?.length ? `Formerly ${pub.formerly.join(", ")}` : "";

  const lines = $("pub-lines");
  lines.replaceChildren(
    ...(linesByPub.get(key) ?? []).map((line) => {
      const chip = document.createElement("span");
      chip.className = "line-chip";
      chip.style.setProperty("--line", line.color);
      chip.textContent = line.label ?? line.name;
      return chip;
    }),
  );

  $("pub-address").textContent = pub.address ?? "";
  const noteParts = [];
  if (!open) noteParts.push("This pub has closed.");
  if (pub.note) noteParts.push(pub.note);
  if (pub.needsCheck) noteParts.push("We're not sure this is up to date.");
  $("pub-note").hidden = noteParts.length === 0;
  $("pub-note").textContent = noteParts.join(" ");
  $("pub-note").classList.toggle("warning", !open || Boolean(pub.needsCheck));

  if (visits.length) {
    const last = new Date(visits.at(-1));
    const times = visits.length === 1 ? "once" : `${visits.length} times`;
    $("pub-visits").textContent = `You've been here ${times}. Last check-in: ${formatDate(last)}.`;
  } else {
    $("pub-visits").textContent = open ? "You haven't checked in here yet." : "";
  }
  if (shared?.visited.has(key)) {
    $("pub-visits").textContent += ` ${shared.name || "Your friend"} has been here.`;
  }

  $("pub-checkin").hidden = !open;
  $("pub-checkin").textContent = visits.length ? "Check in again" : "Check in";
  $("pub-undo").hidden = visits.length === 0;

  const { lat, lon } = pub.position ?? {};
  $("pub-directions").hidden = lat === undefined;
  $("pub-directions").href = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
  $("pub-website").hidden = !pub.website || !open;
  if (pub.website) $("pub-website").href = pub.website;
}

function renderDrawer() {
  const mine = visitedSet(state);
  $("my-name").value = state.name;
  $("drawer-count").textContent = `${countOpen(mine)} of ${openKeys.length} pubs visited`;

  $("line-progress").replaceChildren(
    ...lineProgress(data, mine).map(({ name, color, done, total }) => {
      const li = document.createElement("li");
      li.style.setProperty("--line", color);
      li.style.setProperty("--pct", `${total ? (done / total) * 100 : 0}%`);
      const complete = done === total && total > 0;
      li.innerHTML = `<span class="line-name"></span><span class="bar"><span></span></span><span class="count"></span>`;
      li.querySelector(".line-name").textContent = complete ? `${name} ✓` : name;
      li.querySelector(".count").textContent = `${done}/${total}`;
      return li;
    }),
  );

  const recent = Object.entries(state.checkins)
    .flatMap(([key, visits]) => visits.map((t) => ({ key, t })))
    .sort((a, b) => b.t.localeCompare(a.t))
    .slice(0, 15);
  $("recent-list").replaceChildren(
    ...recent.map(({ key, t }) => {
      const li = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "link";
      button.textContent = stations[key] ? displayName(stations[key]) : key;
      button.addEventListener("click", () => {
        closeSheets();
        openPub(key);
        tube.focus(key);
      });
      const when = document.createElement("time");
      when.dateTime = t;
      when.textContent = formatDate(new Date(t));
      li.append(button, when);
      return li;
    }),
  );
  if (!recent.length) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "No check-ins yet. Tap a pub on the map to start.";
    $("recent-list").append(li);
  }
}

function formatDate(date) {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function closeSheets(except) {
  for (const id of ["pub-sheet", "nearby-sheet", "progress-drawer", "friends-drawer"]) {
    if (id !== except) $(id).hidden = true;
  }
  if (except !== "pub-sheet") {
    selectedPub = null;
    tube.setSelected(null);
  }
}

let toastTimer;
function toast(message) {
  $("toast").textContent = message;
  $("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("toast").hidden = true), 3000);
}

function update(next) {
  state = next;
  saveState(state);
  render();
}

function doCheckIn(key) {
  const before = visitedSet(state);
  update(checkIn(state, key));
  friends.checkedIn(key, state.checkins[key].at(-1));
  const pub = displayName(stations[key]);
  if (before.has(key)) {
    toast(`Checked in at ${pub} again`);
    return;
  }
  const finished = lineProgress(data, visitedSet(state)).find(
    (line, i) => line.done === line.total && lineProgress(data, before)[i].done !== line.total,
  );
  toast(finished ? `Checked in at ${pub}. You've completed the ${finished.name} line!` : `Checked in at ${pub}`);
}

// ---------- events ----------

$("pub-checkin").addEventListener("click", () => selectedPub && doCheckIn(selectedPub));
$("pub-undo").addEventListener("click", () => {
  if (!selectedPub) return;
  const removed = state.checkins[selectedPub]?.at(-1);
  update(undoCheckIn(state, selectedPub));
  if (removed) friends.undone(selectedPub, removed);
  toast("Last check-in removed");
});

for (const button of document.querySelectorAll("[data-close]")) {
  button.addEventListener("click", () => closeSheets());
}
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeSheets();
});

$("progress-open").addEventListener("click", () => {
  closeSheets("progress-drawer");
  renderDrawer();
  $("progress-drawer").hidden = false;
});

$("my-name").addEventListener("change", (event) => {
  update({ ...state, name: event.target.value.trim().slice(0, 40) });
  friends.nameChanged(state.name);
});

$("zoom-in").addEventListener("click", () => tube.zoomBy(1.5));
$("zoom-out").addEventListener("click", () => tube.zoomBy(1 / 1.5));
$("zoom-reset").addEventListener("click", () => tube.resetView());

// Search
const searchIndex = Object.entries(stations).map(([key, s]) => ({
  key,
  text: [displayName(s), ...(s.formerly ?? []), s.address ?? ""].join(" ").toLowerCase(),
}));

$("search-input").addEventListener("input", (event) => {
  const query = event.target.value.trim().toLowerCase();
  const results = $("search-results");
  if (!query) {
    results.hidden = true;
    return;
  }
  const matches = searchIndex.filter((entry) => entry.text.includes(query)).slice(0, 8);
  results.replaceChildren(
    ...matches.map(({ key }) => {
      const li = document.createElement("li");
      li.role = "option";
      li.tabIndex = 0;
      const pub = stations[key];
      li.textContent = displayName(pub);
      if (!isOpen(pub)) li.classList.add("closed");
      if (state.checkins[key]) li.classList.add("visited");
      const choose = () => {
        results.hidden = true;
        $("search-input").value = "";
        $("search-input").blur();
        openPub(key);
        tube.focus(key);
      };
      li.addEventListener("click", choose);
      li.addEventListener("keydown", (e) => e.key === "Enter" && choose());
      return li;
    }),
  );
  if (!matches.length) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "No pubs found";
    results.append(li);
  }
  results.hidden = false;
});
$("search-input").addEventListener("keydown", (event) => {
  if (event.key === "Enter") $("search-results").querySelector("li:not(.empty)")?.click();
});

// Check in nearby: find the closest open pubs using the phone's location.
$("nearby").addEventListener("click", () => {
  closeSheets("nearby-sheet");
  $("nearby-sheet").hidden = false;
  $("nearby-list").replaceChildren();
  if (!navigator.geolocation) {
    $("nearby-status").textContent = "Your browser can't share its location. Tap the pub on the map instead.";
    return;
  }
  $("nearby-status").textContent = "Finding where you are…";
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      const nearby = nearestPubs(stations, { lat: coords.latitude, lon: coords.longitude }, 4);
      const close = nearby.filter((p) => p.distance <= NEARBY_RADIUS_METRES);
      $("nearby-status").textContent = close.length
        ? "Tap the pub you're in to check in."
        : `No pub on the map within ${NEARBY_RADIUS_METRES} m. The nearest ones are:`;
      $("nearby-list").replaceChildren(
        ...nearby.map(({ key, distance }) => {
          const li = document.createElement("li");
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = displayName(stations[key]);
          const meta = document.createElement("span");
          meta.textContent = distance < 1000 ? `${Math.round(distance)} m` : `${(distance / 1000).toFixed(1)} km`;
          button.append(meta);
          button.addEventListener("click", () => {
            closeSheets();
            if (distance <= NEARBY_RADIUS_METRES) doCheckIn(key);
            openPub(key);
            tube.focus(key);
          });
          li.append(button);
          return li;
        }),
      );
    },
    () => {
      $("nearby-status").textContent = "Couldn't get your location. Tap the pub on the map instead.";
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
  );
});

// Sharing
$("share").addEventListener("click", async () => {
  const mine = visitedSet(state);
  const url = `${location.origin}${location.pathname}${buildShareHash(state.name, mine, stations)}`;
  const text = `I've been to ${countOpen(mine)} of ${openKeys.length} pubs on the Cambridge Pub Map`;
  if (navigator.share) {
    try {
      await navigator.share({ title: "Cambridge Pub Map", text, url });
      return;
    } catch (error) {
      if (error.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast(state.name ? "Share link copied" : "Share link copied. Add your name under “My pubs” so friends know it’s you.");
  } catch {
    prompt("Copy this link to share your map:", url);
  }
});

$("share-compare").addEventListener("change", render);
$("share-exit").addEventListener("click", () => {
  history.pushState(null, "", location.pathname);
  shared = null;
  render();
});
window.addEventListener("hashchange", () => {
  shared = parseShareHash(location.hash, stations);
  render();
});

// Backups
$("export").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `cambridge-pubs-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
});
$("import").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;
  try {
    update(mergeStates(state, JSON.parse(await file.text())));
    toast("Backup restored");
  } catch {
    toast("That file isn't a Cambridge Pub Map backup");
  }
});

$("data-reviewed").textContent = new Date(data.meta.lastReviewed).toLocaleDateString("en-GB", {
  month: "long",
  year: "numeric",
});
$("report-link").href = `${REPO_URL}/issues/new?title=${encodeURIComponent("Pub update: ")}&labels=pub-data`;

const friends = setupFriends({
  getState: () => state,
  setState: update,
  stations,
  toast,
  closeSheets,
  // Shows a friend's map the same way as a share link.
  showFriendMap(name, visited) {
    shared = { name, visited };
    closeSheets();
    render();
  },
});

render();
