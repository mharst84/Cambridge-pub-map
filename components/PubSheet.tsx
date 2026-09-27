import { pubData } from "@/lib/data";
import { displayName, isOpen, linesForPub } from "@/lib/pubs";

import { formatDate } from "./format";

type Props = {
  pubKey: string;
  visits: string[];
  friendName: string | null; // set when viewing a friend's map and they've been here
  onCheckIn: () => void;
  onUndo: () => void;
  onClose: () => void;
};

export default function PubSheet({ pubKey, visits, friendName, onCheckIn, onUndo, onClose }: Props) {
  const pub = pubData.stations[pubKey];
  const open = isOpen(pub);
  const notes = [!open && "This pub has closed.", pub.note, pub.needsCheck && "We're not sure this is up to date."].filter(Boolean);

  let visitText = open ? "You haven't checked in here yet." : "";
  if (visits.length) {
    const times = visits.length === 1 ? "once" : `${visits.length} times`;
    visitText = `You've been here ${times}. Last check-in: ${formatDate(visits.at(-1)!)}.`;
  }
  if (friendName) visitText += ` ${friendName} has been here.`;

  return (
    <section className="sheet" aria-labelledby="pub-name">
      <button type="button" className="close" onClick={onClose} aria-label="Close">
        ×
      </button>
      <h2 id="pub-name">{displayName(pub)}</h2>
      {pub.formerly?.length ? <p className="formerly">Formerly {pub.formerly.join(", ")}</p> : null}
      <p className="lines">
        {linesForPub(pubData, pubKey).map((line) => (
          <span key={line.name} className="line-chip" style={{ "--line": line.color } as React.CSSProperties}>
            {line.label ?? line.name}
          </span>
        ))}
      </p>
      {pub.address && <p className="address">{pub.address}</p>}
      {notes.length > 0 && <p className={`note${!open || pub.needsCheck ? " warning" : ""}`}>{notes.join(" ")}</p>}
      {visitText && <p className="visits">{visitText}</p>}
      <div className="sheet-actions">
        {open && (
          <button type="button" className="primary" onClick={onCheckIn}>
            {visits.length ? "Check in again" : "Check in"}
          </button>
        )}
        {visits.length > 0 && (
          <button type="button" onClick={onUndo}>
            Undo last check-in
          </button>
        )}
        {pub.position && (
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${pub.position.lat},${pub.position.lon}`}
            target="_blank"
            rel="noopener"
          >
            Directions
          </a>
        )}
        {pub.website && open && (
          <a href={pub.website} target="_blank" rel="noopener">
            Website
          </a>
        )}
      </div>
    </section>
  );
}
