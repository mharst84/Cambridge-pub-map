import { useEffect, useState } from "react";

import { stations } from "@/lib/data";
import { displayName, nearestPubs } from "@/lib/pubs";

import { formatDistance } from "./format";

export const NEARBY_RADIUS_METRES = 250;

type Props = {
  onPick: (key: string, closeEnough: boolean) => void;
  onClose: () => void;
};

type Found = { key: string; distance: number }[];

// "Check in nearby": finds the closest open pubs using the phone's location.
export default function NearbySheet({ onPick, onClose }: Props) {
  const [status, setStatus] = useState(() =>
    navigator.geolocation ? "Finding where you are…" : "Your browser can't share its location. Tap the pub on the map instead.",
  );
  const [found, setFound] = useState<Found>([]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const nearby = nearestPubs(stations, { lat: coords.latitude, lon: coords.longitude }, 4);
        setFound(nearby);
        setStatus(
          nearby.some((p) => p.distance <= NEARBY_RADIUS_METRES)
            ? "Tap the pub you're in to check in."
            : `No pub on the map within ${NEARBY_RADIUS_METRES} m. The nearest ones are:`,
        );
      },
      () => setStatus("Couldn't get your location. Tap the pub on the map instead."),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, []);

  return (
    <section className="sheet" aria-labelledby="nearby-title">
      <button type="button" className="close" onClick={onClose} aria-label="Close">
        ×
      </button>
      <h2 id="nearby-title">Which pub are you in?</h2>
      <p>{status}</p>
      <ul className="nearby-list">
        {found.map(({ key, distance }) => (
          <li key={key}>
            <button type="button" onClick={() => onPick(key, distance <= NEARBY_RADIUS_METRES)}>
              {displayName(stations[key])}
              <span>{formatDistance(distance)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
