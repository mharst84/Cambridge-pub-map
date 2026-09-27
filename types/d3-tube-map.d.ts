declare module "d3-tube-map" {
  import type { Selection } from "d3";

  interface TubeMap {
    (selection: Selection<HTMLElement, unknown, null, undefined>): void;
    width(w: number): TubeMap;
    height(h: number): TubeMap;
    margin(m: { top: number; right: number; bottom: number; left: number }): TubeMap;
    on(event: "click", listener: (name: string) => void): TubeMap;
  }

  export function tubeMap(): TubeMap;
}
