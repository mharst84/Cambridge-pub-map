import { useState } from "react";

import { pubData, stations } from "@/lib/data";
import { displayName, lineProgress, openPubKeys } from "@/lib/pubs";
import { type LocalState, visitedSet } from "@/lib/store";

import { formatDate } from "./format";

const REPO_URL = "https://github.com/mharst84/Cambridge-pub-map";

type Props = {
  state: LocalState;
  signedIn: boolean;
  onNameChange: (name: string) => unknown;
  onOpenPub: (key: string) => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onClose: () => void;
};

export default function ProgressDrawer({ state, signedIn, onNameChange, onOpenPub, onExport, onImport, onClose }: Props) {
  const [name, setName] = useState(state.name);
  const visited = visitedSet(state);
  const openKeys = openPubKeys(stations);
  const count = openKeys.filter((key) => visited.has(key)).length;
  const recent = Object.entries(state.checkins)
    .flatMap(([key, visits]) => visits.map((t) => ({ key, t })))
    .sort((a, b) => b.t.localeCompare(a.t))
    .slice(0, 15);

  return (
    <aside className="drawer" aria-labelledby="progress-title">
      <button type="button" className="close" onClick={onClose} aria-label="Close">
        ×
      </button>
      <h2 id="progress-title">My pubs</h2>
      <label className="field">
        Your name (shown to friends)
        <input
          id="my-name"
          maxLength={40}
          placeholder="e.g. Sam"
          autoComplete="nickname"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() !== state.name && onNameChange(name.trim())}
        />
      </label>
      <p className="big-number">
        {count} of {openKeys.length} pubs visited
      </p>

      <h3>Lines</h3>
      <ul className="line-progress">
        {lineProgress(pubData, visited).map(({ name: line, color, done, total }) => (
          <li key={line} style={{ "--line": color, "--pct": `${total ? (done / total) * 100 : 0}%` } as React.CSSProperties}>
            <span className="line-name">{done === total && total > 0 ? `${line} ✓` : line}</span>
            <span className="bar">
              <span />
            </span>
            <span className="count">
              {done}/{total}
            </span>
          </li>
        ))}
      </ul>

      <h3>Recent check-ins</h3>
      <ol className="recent">
        {recent.map(({ key, t }) => (
          <li key={`${key}-${t}`}>
            <button type="button" className="link" onClick={() => onOpenPub(key)}>
              {stations[key] ? displayName(stations[key]) : key}
            </button>
            <time dateTime={t}>{formatDate(t)}</time>
          </li>
        ))}
        {!recent.length && <li className="empty">No check-ins yet. Tap a pub on the map to start.</li>}
      </ol>

      <h3>Your data</h3>
      <p className="small">
        {signedIn
          ? "Your check-ins are saved to your account and on this phone."
          : "Check-ins are saved on this phone only. Sign in under Friends to keep them if you change phone, or download a backup."}
      </p>
      <div className="row">
        <button type="button" onClick={onExport}>
          Download backup
        </button>
        <label className="button">
          Restore backup
          <input
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) onImport(file);
            }}
          />
        </label>
      </div>

      <h3>About the map</h3>
      <p className="small">
        Based on John Walley&apos;s original map at{" "}
        <a href="https://www.pubmap.co.uk/" target="_blank" rel="noopener">
          pubmap.co.uk
        </a>
        , updated in {new Date(pubData.meta.lastReviewed).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}.
        Pub closed, renamed or missing?{" "}
        <a
          href={`${REPO_URL}/issues/new?title=${encodeURIComponent("Pub update: ")}&labels=pub-data`}
          target="_blank"
          rel="noopener"
        >
          Tell us
        </a>
        .
      </p>
    </aside>
  );
}
