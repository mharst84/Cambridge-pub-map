"use client";

import { useEffect, useEffectEvent, useRef } from "react";

import { createTubeMap, type TubeMapControls } from "@/lib/tubemap";
import type { PubData } from "@/lib/types";

type Props = {
  data: PubData;
  mine: Set<string> | null;
  friend: Set<string> | null;
  selected: string | null;
  onSelect: (key: string) => void;
  onReady: (controls: TubeMapControls) => void;
};

export default function TubeMap({ data, mine, friend, selected, onSelect, onReady }: Props) {
  const container = useRef<HTMLElement>(null);
  const controls = useRef<TubeMapControls | null>(null);
  const select = useEffectEvent((key: string) => onSelect(key));
  const ready = useEffectEvent((map: TubeMapControls) => onReady(map));

  useEffect(() => {
    const map = createTubeMap(container.current!, data, select);
    controls.current = map;
    ready(map);
    return () => map.destroy();
  }, [data]);

  useEffect(() => controls.current?.setVisited(mine, friend), [mine, friend]);
  useEffect(() => controls.current?.setSelected(selected), [selected]);

  return <main id="map" ref={container} aria-label="Map" />;
}
