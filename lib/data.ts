import raw from "@/data/pubs.json";

import type { PubData } from "./types";

export const pubData = raw as unknown as PubData;
export const stations = pubData.stations;
