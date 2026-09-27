export type Position = { lat: number; lon: number };

export type Station = {
  id: number;
  name?: string;
  label: string;
  status: "open" | "closed";
  address?: string;
  website?: string;
  phone?: string;
  position?: Position;
  formerly?: string[];
  note?: string;
  needsCheck?: boolean;
  sources?: string[];
};

export type LineNode = { coords: [number, number]; name?: string; labelPos?: string; [key: string]: unknown };

export type Line = { name: string; label?: string; color: string; shiftCoords: [number, number]; nodes: LineNode[] };

export type PubData = {
  meta: { title: string; basedOn: string; lastReviewed: string };
  stations: Record<string, Station>;
  lines: Line[];
  river: { name: string; label: string; shiftCoords: [number, number]; nodes: LineNode[] };
  candidates: { name: string; address?: string; note?: string; sources?: string[] }[];
};

// Check-ins: station key -> ISO timestamps, one per visit.
export type Checkins = Record<string, string[]>;

// A check-in row as the API sends it.
export type CheckinRow = { userId: string; pubKey: string; checkedInAt: string };
