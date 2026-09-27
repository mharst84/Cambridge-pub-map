import { useMemo, useState } from "react";

import { stations } from "@/lib/data";
import { displayName, isOpen } from "@/lib/pubs";

type Props = { visited: Set<string>; onChoose: (key: string) => void };

export default function SearchBox({ visited, onChoose }: Props) {
  const [query, setQuery] = useState("");
  const index = useMemo(
    () =>
      Object.entries(stations).map(([key, s]) => ({
        key,
        text: [displayName(s), ...(s.formerly ?? []), s.address ?? ""].join(" ").toLowerCase(),
      })),
    [],
  );
  const q = query.trim().toLowerCase();
  const matches = q ? index.filter((entry) => entry.text.includes(q)).slice(0, 8) : [];

  function choose(key: string) {
    setQuery("");
    (document.activeElement as HTMLElement | null)?.blur();
    onChoose(key);
  }

  return (
    <div className="search">
      <input
        type="search"
        placeholder="Find a pub…"
        autoComplete="off"
        aria-label="Find a pub"
        aria-controls="search-results"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && matches[0] && choose(matches[0].key)}
      />
      {q && (
        <ul id="search-results" role="listbox">
          {matches.map(({ key }) => (
            <li
              key={key}
              role="option"
              aria-selected={false}
              tabIndex={0}
              className={[!isOpen(stations[key]) && "closed", visited.has(key) && "visited"].filter(Boolean).join(" ")}
              onClick={() => choose(key)}
              onKeyDown={(e) => e.key === "Enter" && choose(key)}
            >
              {displayName(stations[key])}
            </li>
          ))}
          {!matches.length && <li className="empty">No pubs found</li>}
        </ul>
      )}
    </div>
  );
}
