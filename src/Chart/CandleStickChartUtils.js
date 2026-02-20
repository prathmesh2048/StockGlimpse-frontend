import ReactDOMServer from "react-dom/server";
import ReactDOM from "react-dom/client";

import * as d3 from "d3";
import NoteTextarea from "./NoteTextArea";

export const parseDate = (dateStr) => new Date(dateStr);

export const getCursorPoint = (id, evt) => {
  let svg = document.querySelector(`#${id}`);
  let pt = svg.createSVGPoint();
  let cursorPoint = (evt) => {
    if (evt.touches && evt.touches[0]) {
      pt.x = evt.touches[0].clientX;
      pt.y = evt.touches[0].clientY;
    } else {
      pt.x = evt.clientX;
      pt.y = evt.clientY;
    }

    return pt.matrixTransform(svg.getScreenCTM().inverse());
  };

  return cursorPoint(evt);
};

export const findFixedDataIndex = (dataPoint, data) => {
  let index = 0;
  let min = Math.abs(parseDate(dataPoint) - parseDate(data[0].date));
  for (let i = 0; i < data.length; i++) {
    let newMin = Math.abs(parseDate(dataPoint) - parseDate(data[i].date));
    if (newMin < min) {
      min = newMin;
      index = i;
    }
  }
  return index;
};

export const modifyAnnotationEnd = (group, colors) => {
  group.selectAll(".annotation-note-title").style("font-size", "13px");

  group
    .selectAll(".annotation-note-label")
    .style("font-size", "11px")
    .style("fill", colors.annotationTextColor);

  // Add the "✏️ Notes" clickable text
  group
    .selectAll(".annotation-note-label")
    .append("tspan")
    .attr("x", 0)
    .attr("dy", "1.8em")
    .attr("class", "annotation-add-note")
    .style("font-size", "10px")
    .style("fill", "#9aa0a6")
    .style("cursor", "pointer")
    .text("Notes ✏️")
    .on("click", function (event, d) {
      console.log("Note data:", d);

      const noteGroup = d3.select(this.closest(".annotation-note-content"));
      noteGroup.select(".note-textarea").remove();

      const isMobile = window.innerWidth <= 600;
      const foX = 50;
      const foY = 50;
      const foWidth = isMobile ? 200 : 400;
      const foHeight = isMobile ? 200 : 300;

      const fo = noteGroup
        .append("foreignObject")
        .attr("class", "note-textarea")
        .attr("x", foX)
        .attr("y", foY)
        .attr("width", foWidth)
        .attr("height", foHeight);

      const container = document.createElement("div");
      fo.node().appendChild(container);

      const root = ReactDOM.createRoot(container);
      root.render(
        <NoteTextarea
          data={d}
          onClose={() => fo.remove()}
          x={foX}
          y={foY}
          width={foWidth}
          height={foHeight}
        />,
      );

      const foNode = fo.node();
      ["wheel", "touchmove", "pointerdown"].forEach((evt) =>
        foNode.addEventListener(evt, (e) => e.stopPropagation(), {
          passive: true,
        }),
      );
    });

  // Style the annotation handle and add icon
  d3.selectAll(".annotation .annotation-note .handle")
    .attr("stroke-dasharray", null)
    .each(function () {
      const handle = d3.select(this);
      const parent = d3.select(this.parentNode);

      const cx = +handle.attr("cx");
      const cy = +handle.attr("cy");

      parent
        .append("image")
        .attr("x", cx - 8)
        .attr("y", cy - 8)
        .attr("width", 16)
        .attr("height", 16)
        .attr(
          "href",
          d3.select(this.parentNode).datum().data.transactionType === "buy"
            ? process.env.PUBLIC_URL + "/images/B.png"
            :process.env.PUBLIC_URL + "/images/S.png",
        )
        .attr("pointer-events", "none");
    });
};

export const colors = (theme) => {
  return {
    grid: theme === "dark" ? "rgb(34, 38, 49)" : "rgb(225, 225, 225)",
    gridBackground: theme === "dark" ? "rgb(23, 27, 38)" : "rgb(244, 253, 254)",
    background:
      theme === "dark" ? "rgb(23, 27, 38)" : "rgba(191, 193, 198,0.1)",
    candleInfoText: "#b2b5be",
    candleInfoTextUp: "#089981",
    candleInfoTextDown: "#e13443",
    tickColor: theme === "dark" ? "rgb(255, 255, 255)" : "rgb(74, 76, 82)", // this color is used for x and y labels
    downCandlesStroke: "#e13443",
    downCandlesFill: "#e13443",
    downCandlesTail: "#e13443",
    upCandlesStroke: "#089981",
    upCandlesFill: "#089981",
    upCandlesTail: "#089981",
    selectorLine: "rgba(178,181,190,0.5)",
    selectorLableBackground: "#2a2e39",
    selectorLabelText: "#b2b5be",
    short: "#fff",
    shortStroke: "#fff",
    long: "#fff",
    longStroke: "#fff",
    sl: "#F9DB04",
    slStroke: "#F9DB04",
    tp: "#04F5F9",
    tpStroke: "#04F5F9",
    activeTools: theme === "dark" ? "rgb(4, 245, 249)" : "rgb(13, 110, 253)",
    deActiveTools: theme === "dark" ? "rgb(255, 255, 255)" : "rgb(85, 85, 85)",
    annotationTextColor:
      theme === "dark" ? "rgb(203, 203, 203)" : "rgb(5, 4, 4)",
    annotationLineColor:
      theme === "dark" ? "rgb(203, 203, 203)" : "rgb(5, 4, 4)",
    lineColor: theme === "dark" ? "rgb(203, 203, 203)" : "rgb(5, 4, 4)",
  };
};

export const config = (width, height) => {
  return {
    width: width,
    height: height,
    candleTailWidth: 1,
    paddingLeft: 25,
    paddingTop: 10,
    paddingBottom: 30,
    yPaddingScaleTop: 0.04,
    yPaddingScaleBottom: 0.03,
    xTicksTransform: 10,
    xLabelWidth: 110,
    xLabelHeight: 25,
    xLabelFontSize: 12,
    yLabelHeight: 25,
    yLabelFontSize: 12,
    decimal: 2,
    charWidth: 42,
    selectoreStrokeDashArray: "2,2",
    timeFormat: "%a %d %b'%y",
    mobileBreakPoint: 600,
    infoTextWidth: undefined,
    infoTextWidthMeta: undefined,
    yLabelWidth: undefined,
    paddingRight: undefined,
    svgWidth: undefined,
    svgHeight: undefined,
  };
};
