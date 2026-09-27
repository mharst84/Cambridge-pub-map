"use client";

import { signOut } from "next-auth/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { api, type Profile } from "@/lib/client/api";
import { pubData, stations } from "@/lib/data";
import { displayName, lineProgress, openPubKeys } from "@/lib/pubs";
import { buildShareHash, parseShareHash, type SharedMap } from "@/lib/share";
import { checkIn, type LocalState, loadState, mergeStates, saveState, undoCheckIn, visitedSet } from "@/lib/store";
import { reconcile, unionCheckins } from "@/lib/sync";
import type { TubeMapControls } from "@/lib/tubemap";

import FriendsDrawer from "./FriendsDrawer";
import NearbySheet from "./NearbySheet";
import ProgressDrawer from "./ProgressDrawer";
import PubSheet from "./PubSheet";
import SearchBox from "./SearchBox";
import TubeMap from "./TubeMap";

type Panel = "pub" | "nearby" | "progress" | "friends" | null;
type Account = { status: "loading" } | { status: "signed-out" } | { status: "signed-in"; profile: Profile };

const openKeys = openPubKeys(stations);
const countOpen = (visited: Set<string>) => openKeys.filter((key) => visited.has(key)).length;

function useToast(initial: string | null) {
  const [message, setMessage] = useState(initial);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (initial) timer.current = setTimeout(() => setMessage(null), 3500);
  }, [initial]);
  const show = useCallback((text: string) => {
    setMessage(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), 3500);
  }, []);
  return [message, show] as const;
}

export default function PubMapApp() {
  // This component only renders in the browser (see ClientApp), so it can read
  // saved check-ins and the URL straight away.
  const [local, setLocal] = useState<LocalState>(loadState);
  const localRef = useRef(local);
  const [shared, setShared] = useState<SharedMap | null>(() => parseShareHash(location.hash, stations));
  const [compare, setCompare] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  // Messages passed back after signing in or accepting an invite.
  const [startParams] = useState(() => new URLSearchParams(location.search));
  const invitedBy = startParams.get("friend");
  const [panel, setPanel] = useState<Panel>(invitedBy === null ? null : "friends");
  const [account, setAccount] = useState<Account>({ status: "loading" });
  const [toast, showToast] = useToast(
    invitedBy !== null
      ? `You and ${invitedBy || "your friend"} are now friends`
      : startParams.get("signin") === "error"
        ? "That sign-in link has expired or was already used. Ask for a new one."
        : null,
  );
  const map = useRef<TubeMapControls | null>(null);
  const onMapReady = useCallback((controls: TubeMapControls) => (map.current = controls), []);

  const profile = account.status === "signed-in" ? account.profile : null;

  const updateLocal = useCallback((change: (state: LocalState) => LocalState) => {
    setLocal((previous) => {
      const next = change(previous);
      saveState(next);
      localRef.current = next;
      return next;
    });
  }, []);

  // ---------- start-up ----------

  useEffect(() => {
    const readHash = () => setShared(parseShareHash(location.hash, stations));
    window.addEventListener("hashchange", readHash);

    api
      .me()
      .then((me) => setAccount(me ? { status: "signed-in", profile: me } : { status: "signed-out" }))
      .catch(() => setAccount({ status: "signed-out" }));
    return () => window.removeEventListener("hashchange", readHash);
  }, [showToast]);

  // Two-way sync of this phone's check-ins with the account, once signed in.
  const syncNow = useCallback(async () => {
    if (!profile) return;
    try {
      const current = localRef.current;
      // Check-ins on this phone from a different account stay out of this one.
      const otherAccount = Boolean(current.syncedUserId && current.syncedUserId !== profile.id);
      const { toUpload, merged } = reconcile(otherAccount ? {} : current.checkins, (await api.listCheckins()).checkins);
      if (toUpload.length) await api.addCheckins(toUpload);
      let name = otherAccount ? "" : current.name;
      if (!name && profile.name) name = profile.name;
      else if (name && name !== profile.name) await api.setName(name);
      updateLocal((state) => ({
        ...state,
        name,
        checkins: otherAccount ? merged : unionCheckins(state.checkins, merged),
        syncedUserId: profile.id,
      }));
    } catch (error) {
      showToast(`Couldn't sync your check-ins: ${(error as Error).message}`);
    }
  }, [profile, updateLocal, showToast]);

  useEffect(() => {
    if (startParams.size) history.replaceState(null, "", location.pathname + location.hash);
  }, [startParams]);

  useEffect(() => {
    if (profile) syncNow();
  }, [profile, syncNow]);

  useEffect(() => {
    const onVisible = () => document.visibilityState === "visible" && syncNow();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [syncNow]);

  // ---------- actions ----------

  const mine = useMemo(() => visitedSet(local), [local]);

  const openPub = useCallback((key: string, focus = false) => {
    setSelected(key);
    setPanel("pub");
    if (focus) map.current?.focus(key);
  }, []);

  function closePanels() {
    setPanel(null);
    setSelected(null);
  }

  function doCheckIn(key: string) {
    const before = visitedSet(localRef.current);
    const when = new Date();
    updateLocal((state) => checkIn(state, key, when));
    if (profile) api.addCheckins([{ pubKey: key, checkedInAt: when.toISOString() }]).catch(() => {}); // retried at next sync

    const pub = displayName(stations[key]);
    if (before.has(key)) return showToast(`Checked in at ${pub} again`);
    const after = new Set([...before, key]);
    const previous = lineProgress(pubData, before);
    const finished = lineProgress(pubData, after).find((line, i) => line.done === line.total && previous[i].done !== line.total);
    showToast(finished ? `Checked in at ${pub}. You've completed the ${finished.name} line!` : `Checked in at ${pub}`);
  }

  function undo(key: string) {
    const removed = localRef.current.checkins[key]?.at(-1);
    if (!removed) return;
    updateLocal((state) => undoCheckIn(state, key));
    showToast("Last check-in removed");
    if (profile) {
      api.removeCheckin({ pubKey: key, checkedInAt: removed }).catch(() => showToast("Couldn't remove it from your account. Try again later."));
    }
  }

  async function changeName(name: string) {
    updateLocal((state) => ({ ...state, name }));
    if (profile) await api.setName(name).catch(() => showToast("Couldn't save your name. Try again later."));
  }

  async function share() {
    const url = `${location.origin}${location.pathname}${buildShareHash(local.name, mine, stations)}`;
    const text = `I've been to ${countOpen(mine)} of ${openKeys.length} pubs on the Cambridge Pub Map`;
    if (navigator.share) {
      try {
        return await navigator.share({ title: "Cambridge Pub Map", text, url });
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast(local.name ? "Share link copied" : "Share link copied. Add your name under “My pubs” so friends know it’s you.");
    } catch {
      window.prompt("Copy this link to share your map:", url);
    }
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify(local, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `cambridge-pubs-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function importBackup(file: File) {
    try {
      const imported = JSON.parse(await file.text());
      updateLocal((state) => mergeStates(state, imported));
      showToast("Backup restored");
      if (profile) setTimeout(syncNow, 0);
    } catch {
      showToast("That file isn't a Cambridge Pub Map backup");
    }
  }

  async function doSignOut() {
    await signOut({ redirect: false });
    setAccount({ status: "signed-out" });
    showToast("Signed out. Your check-ins are still saved on this phone.");
  }

  function exitShared() {
    history.pushState(null, "", location.pathname);
    setShared(null);
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPanel(null);
        setSelected(null);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // ---------- render ----------

  const friendName = shared?.name || "A friend";

  return (
    <div className={shared ? "share-mode" : undefined}>
      <header className="topbar">
        <div className="brand">
          <span className="roundel" aria-hidden="true" />
          <h1>Cambridge Pub Map</h1>
        </div>
        <div className="topbar-buttons">
          <button type="button" className="progress-pill" onClick={() => setPanel("friends")}>
            Friends
          </button>
          <button type="button" className="progress-pill" onClick={() => setPanel("progress")} aria-label="Open my progress">
            {countOpen(mine)} / {openKeys.length} pubs
          </button>
        </div>
      </header>

      {shared && (
        <div className="share-banner">
          <p>
            <strong>{friendName}</strong>’s map: {countOpen(shared.visited)} of {openKeys.length} pubs
          </p>
          <label className="toggle">
            <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} /> Show mine too
          </label>
          <button type="button" onClick={exitShared}>
            Back to my map
          </button>
        </div>
      )}

      <SearchBox visited={mine} onChoose={(key) => openPub(key, true)} />

      <TubeMap
        data={pubData}
        mine={shared && !compare ? null : mine}
        friend={shared?.visited ?? null}
        selected={selected}
        onSelect={openPub}
        onReady={onMapReady}
      />

      <div className="legend" aria-hidden="true">
        <span>
          <i className="swatch mine" />
          Visited
        </span>
        {shared && (
          <span>
            <i className="swatch friend" />
            {friendName}
          </span>
        )}
        <span>
          <s>Closed</s>
        </span>
      </div>

      <nav className="actions" aria-label="Map actions">
        <button type="button" className="zoom" onClick={() => map.current?.zoomBy(1.5)} aria-label="Zoom in">
          +
        </button>
        <button type="button" className="zoom" onClick={() => map.current?.zoomBy(1 / 1.5)} aria-label="Zoom out">
          −
        </button>
        <button type="button" className="reset" onClick={() => map.current?.resetView()} aria-label="Show whole map">
          ⤢
        </button>
        <button type="button" className="primary" onClick={() => setPanel("nearby")}>
          Check in nearby
        </button>
        <button type="button" onClick={share}>
          Share
        </button>
      </nav>

      {panel === "pub" && selected && (
        <PubSheet
          pubKey={selected}
          visits={local.checkins[selected] ?? []}
          friendName={shared?.visited.has(selected) ? friendName : null}
          onCheckIn={() => doCheckIn(selected)}
          onUndo={() => undo(selected)}
          onClose={closePanels}
        />
      )}
      {panel === "nearby" && (
        <NearbySheet
          onClose={closePanels}
          onPick={(key, closeEnough) => {
            if (closeEnough) doCheckIn(key);
            openPub(key, true);
          }}
        />
      )}
      {panel === "progress" && (
        <ProgressDrawer
          state={local}
          signedIn={Boolean(profile)}
          onNameChange={changeName}
          onOpenPub={(key) => openPub(key, true)}
          onExport={exportBackup}
          onImport={importBackup}
          onClose={closePanels}
        />
      )}
      {panel === "friends" && account.status !== "loading" && (
        <FriendsDrawer
          profile={profile}
          name={local.name}
          onNameChange={changeName}
          onSignOut={doSignOut}
          toast={showToast}
          onClose={closePanels}
          onShowFriendMap={(name, visited) => {
            setShared({ name, visited });
            closePanels();
          }}
        />
      )}

      {toast && (
        <div className="toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </div>
  );
}
