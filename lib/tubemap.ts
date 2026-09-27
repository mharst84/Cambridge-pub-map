import * as d3 from "d3";
import { tubeMap } from "d3-tube-map";

import { isOpen } from "./pubs";
import type { PubData } from "./types";

const LABEL_PADDING = 0.25; // in multiples of the label's font size

// What d3-tube-map attaches to each label, station and interchange element.
type Datum = { name: string; label: string; closed: boolean };

export type TubeMapControls = {
  setVisited(mine: Set<string> | null, friend: Set<string> | null): void;
  setSelected(key: string | null): void;
  focus(key: string, scale?: number): void;
  zoomBy(factor: number): void;
  resetView(): void;
  destroy(): void;
};

// Draws the tube map into `container` and returns controls for highlighting pubs.
export function createTubeMap(
  container: HTMLElement,
  data: PubData,
  onSelect: (key: string) => void,
): TubeMapControls {
  const { width, height } = container.getBoundingClientRect();

  // d3-tube-map mutates the data it is given and uses `closed` to strike through labels.
  const mapData = structuredClone(data) as PubData & { stations: Record<string, { closed?: boolean }> };
  for (const station of Object.values(mapData.stations)) station.closed = !isOpen(station as never);

  const map = tubeMap()
    .width(width)
    .height(height)
    .margin({ top: 60, right: 30, bottom: 90, left: 30 })
    .on("click", (key) => onSelect(key));

  const root = d3.select(container);
  root.datum(mapData).call(map as never);

  const svg = root.select<SVGSVGElement>("svg").attr("role", "img").attr("aria-label", "Cambridge pub tube map");
  const gMap = svg.select<SVGGElement>("g");
  const labels = () => gMap.selectAll<SVGGElement, Datum>(".labels g");

  addLabelBackgrounds(gMap);

  labels()
    .classed("closed", (d) => d.closed)
    .attr("tabindex", 0)
    .attr("role", "button")
    .attr("aria-label", (d) => d.label.replace(/\n/g, " "))
    .on("keydown", (event: KeyboardEvent, d) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onSelect(d.name);
      }
    });

  const zoom = d3.zoom<SVGSVGElement, unknown>().on("zoom", (event) => gMap.attr("transform", event.transform));
  svg.call(zoom).on("dblclick.zoom", null);

  // The whole map, scaled to sit between the search box and the action buttons.
  function fitTransform() {
    const box = contentBox(gMap);
    const { width: w, height: h } = svg.node()!.getBoundingClientRect();
    const area = { top: 120, bottom: 80, side: 16 };
    const availW = w - area.side * 2;
    const availH = h - area.top - area.bottom;
    const scale = Math.min(availW / box.width, availH / box.height);
    return d3.zoomIdentity
      .translate(area.side + availW / 2, area.top + availH / 2)
      .scale(scale)
      .translate(-(box.x + box.width / 2), -(box.y + box.height / 2));
  }

  const fitted = fitTransform();
  zoom.scaleExtent([fitted.k * 0.8, fitted.k * 12]);
  svg.call(zoom.transform, fitted);
  // On a phone the whole map is tiny, so start zoomed in on the city centre.
  if (width < 600) svg.call(zoom.scaleBy, 2.2, [width / 2, height * 0.5]);

  return {
    setVisited(mine, friend) {
      for (const selector of [".labels g", ".interchanges g"]) {
        gMap.selectAll<SVGGElement, Datum>(selector).each(function (d) {
          d3.select(this)
            .classed("mine", mine?.has(d.name) ?? false)
            .classed("friend", friend?.has(d.name) ?? false);
        });
      }
    },

    setSelected(key) {
      labels().classed("selected", (d) => d.name === key);
    },

    focus(key, scale = 3) {
      const node = labels()
        .filter((d) => d.name === key)
        .node();
      if (!node) return;
      const box = node.getBBox();
      const { width: w, height: h } = svg.node()!.getBoundingClientRect();
      const transform = d3.zoomIdentity
        .translate(w / 2, h * 0.4)
        .scale(scale)
        .translate(-(box.x + box.width / 2), -(box.y + box.height / 2));
      svg.transition().duration(600).call(zoom.transform, transform);
    },

    zoomBy(factor) {
      svg.transition().duration(250).call(zoom.scaleBy, factor);
    },

    resetView() {
      svg.transition().duration(500).call(zoom.transform, fitTransform());
    },

    destroy() {
      root.selectAll("*").remove();
    },
  };
}

// Bounding box of the lines, stations and labels. The river runs well past the
// edge of the network, so it is left out.
function contentBox(gMap: d3.Selection<SVGGElement, unknown, null, undefined>) {
  const boxes = gMap
    .selectAll<SVGGElement, unknown>(":scope > g:not(.river)")
    .nodes()
    .map((node) => node.getBBox());
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const right = Math.max(...boxes.map((b) => b.x + b.width));
  const bottom = Math.max(...boxes.map((b) => b.y + b.height));
  return { x, y, width: right - x, height: bottom - y };
}

// Puts a rectangle behind every label so visited pubs can be shown like the
// highlighted station names on a real tube map.
function addLabelBackgrounds(gMap: d3.Selection<SVGGElement, unknown, null, undefined>) {
  gMap.selectAll<SVGGElement, Datum>(".labels g").each(function () {
    const group = d3.select(this);
    const text = group.select<SVGTextElement>("text");
    const box = text.node()!.getBBox();
    const pad = parseFloat(text.style("font-size")) * LABEL_PADDING;
    group
      .insert("rect", "text")
      .attr("class", "label-bg")
      .attr("x", box.x - pad)
      .attr("y", box.y - pad / 2)
      .attr("width", box.width + pad * 2)
      .attr("height", box.height + pad)
      .attr("rx", pad / 2);
  });
}
