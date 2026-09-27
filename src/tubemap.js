import * as d3 from "d3";
import { tubeMap } from "d3-tube-map";

import { isOpen } from "./pubs.js";

const LABEL_PADDING = 0.25; // in multiples of the label's font size

// Draws the tube map into `container` and returns controls for highlighting pubs.
// `data` is the parsed data/pubs.json; it is not modified.
export function createTubeMap(container, data, { onSelect }) {
  const { width, height } = container.getBoundingClientRect();

  // d3-tube-map mutates the data it is given and uses `closed` to strike through labels.
  const mapData = structuredClone(data);
  for (const station of Object.values(mapData.stations)) station.closed = !isOpen(station);

  const map = tubeMap()
    .width(width)
    .height(height)
    .margin({ top: 60, right: 30, bottom: 90, left: 30 })
    .on("click", (key) => onSelect(key));

  d3.select(container).datum(mapData).call(map);

  const svg = d3.select(container).select("svg").attr("role", "img").attr("aria-label", "Cambridge pub tube map");
  const gMap = svg.select("g");

  addLabelBackgrounds(gMap);

  gMap
    .selectAll(".labels g")
    .classed("closed", (d) => d.closed)
    .attr("tabindex", 0)
    .attr("role", "button")
    .attr("aria-label", (d) => d.label.replace(/\n/g, " "))
    .on("keydown", (event, d) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onSelect(d.name);
      }
    });

  const zoom = d3.zoom().on("zoom", (event) => gMap.attr("transform", event.transform));
  svg.call(zoom).on("dblclick.zoom", null);

  // The whole map, scaled to sit between the search box and the action buttons.
  function fitTransform() {
    const box = contentBox(gMap);
    const { width: w, height: h } = svg.node().getBoundingClientRect();
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
  // On a phone the whole map is tiny, so start zoomed in on the city centre.
  const startScale = width < 600 ? 2.2 : 1;
  svg.call(zoom.transform, fitted);
  if (startScale !== 1) svg.call(zoom.scaleBy, startScale, [width / 2, height * 0.5]);

  function labelGroup(key) {
    return gMap.selectAll(".labels g").filter((d) => d.name === key);
  }

  return {
    // mine / friend: Set of station keys. friend is null outside share mode.
    setVisited(mine, friend = null) {
      gMap.selectAll(".labels g").each(function (d) {
        const inMine = mine?.has(d.name) ?? false;
        const inFriend = friend?.has(d.name) ?? false;
        d3.select(this).classed("mine", inMine).classed("friend", inFriend);
      });
      gMap.selectAll(".interchanges g").each(function (d) {
        d3.select(this)
          .classed("mine", mine?.has(d.name) ?? false)
          .classed("friend", friend?.has(d.name) ?? false);
      });
    },

    setSelected(key) {
      gMap.selectAll(".labels g").classed("selected", (d) => d.name === key);
    },

    focus(key, scale = 3) {
      const node = labelGroup(key).node();
      if (!node) return;
      const box = node.getBBox();
      const { width: w, height: h } = svg.node().getBoundingClientRect();
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
  };
}

// Bounding box of the lines, stations and labels. The river runs well past the
// edge of the network, so it is left out.
function contentBox(gMap) {
  const boxes = gMap
    .selectAll(":scope > g:not(.river)")
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
function addLabelBackgrounds(gMap) {
  gMap.selectAll(".labels g").each(function () {
    const group = d3.select(this);
    const text = group.select("text");
    const box = text.node().getBBox();
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
