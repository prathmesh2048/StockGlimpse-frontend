import ReactDOMServer from "react-dom/server";
import ReactDOM from "react-dom/client";

import * as d3 from "d3";
import NoteTextarea from "./NoteTextArea";

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
            : process.env.PUBLIC_URL + "/images/S.png",
        )
        .attr("pointer-events", "none");
    });
};

export const createToolsBtns = (opts) => {
  // Support both call-binding and explicit options object
  const id = opts?.id ?? this.id;
  const isPaid = opts?.isPaid ?? false;
  console.log("isPaid in createToolsBtns:", isPaid);
  const premiumItems = ["ailevels", "candle-pattern"];

  const objectIDs =
    opts?.objectIDs ??
    this._objectIDs ??
    this["#objectIDs" in this ? "#objectIDs" : "_objectIDs"];

  const getChartTypeIcon =
    opts?.getChartTypeIcon ??
    this.getChartTypeIcon?.bind(this) ??
    this["#getChartTypeIcon"]?.bind(this);

  // ── Clean up previous instance ──────────────────────────────────────────
  d3.select(`#${objectIDs.toolsBtnsContainer}`).remove();

  // ── Container ───────────────────────────────────────────────────────────
  const container = d3
    .select(`#${id}`)
    .append("div")
    .attr("id", objectIDs.toolsBtnsContainer)
    .style("display", "flex")
    .style("align-items", "center")
    .style("justify-content", "flex-end")
    .style("gap", "8px")
    .style("height", "44px")
    .style("pointer-events", "none")
    .style("padding-right", "12px")
    .style("position", "relative");

  d3.select(`#${id}`).style("position", "relative");

  // ── Icon button factory ─────────────────────────────────────────────────
  const makeIconBtn = (btnId, icon, tooltip) => {
    const btn = container
      .append("div")
      .attr("id", btnId)
      .style("display", "flex")
      .style("align-items", "center")
      .style("justify-content", "center")
      .style("width", "34px")
      .style("height", "34px")
      .style("background", "#0f1923")
      .style("border", "1px solid #2a3a4a")
      .style("border-radius", "6px")
      .style("cursor", "pointer")
      .style("pointer-events", "auto")
      .style("position", "relative")
      .html(icon);

    const tip = btn
      .append("div")
      .text(tooltip)
      .style("position", "absolute")
      .style("bottom", "-28px")
      .style("left", "50%")
      .style("transform", "translateX(-50%)")
      .style("background", "#111")
      .style("color", "#fff")
      .style("padding", "4px 8px")
      .style("font-size", "11px")
      .style("border-radius", "4px")
      .style("white-space", "nowrap")
      .style("opacity", 0)
      .style("pointer-events", "none")
      .style("transition", "0.15s ease")
      .style("z-index", "9999");

    btn
      .on("mouseenter", () => tip.style("opacity", 1))
      .on("mouseleave", () => tip.style("opacity", 0));

    return btn;
  };

  // ── Reset Zoom ──────────────────────────────────────────────────────────
  makeIconBtn(
    "tools-btn-reset",
    `<svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 20 20'>
      <g fill='none' stroke='white' stroke-linecap='round' stroke-linejoin='round'
         transform='matrix(0 1 1 0 2.5 2.5)'>
        <path d='m3.98 1.08c-2.38 1.38-3.98 3.97-3.98 6.92 0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8'/>
        <path d='m4 1v4h-4' transform='matrix(1 0 0 -1 0 6)'/>
      </g>
    </svg>`,
    "Reset Zoom",
  );

  // ── Switch Chart Type ───────────────────────────────────────────────────
  makeIconBtn("tools-btn-chartmode", getChartTypeIcon(), "Switch Chart Type");

  // ── Hamburger ───────────────────────────────────────────────────────────
  const hamburgerBtn = makeIconBtn(
    "tools-btn-hamburger",
    `<svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24'
      fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>
      <line x1='3' y1='6'  x2='21' y2='6'/>
      <line x1='3' y1='12' x2='21' y2='12'/>
      <line x1='3' y1='18' x2='21' y2='18'/>
    </svg>`,
    "More Tools",
  );

  // ── Dropdown ────────────────────────────────────────────────────────────
  const dropdown = d3
    .select(`#${id}`)
    .append("div")
    .attr("id", `${objectIDs.toolsBtnsContainer}-dropdown`)
    .style("position", "absolute")
    .style("top", "44px")
    .style("right", "12px")
    .style("background", "#0d1b2a")
    .style("border", "1px solid #1e3048")
    .style("border-radius", "8px")
    .style("padding", "6px 0")
    .style("min-width", "200px")
    .style("z-index", "9999")
    .style("display", "none")
    .style("box-shadow", "0 8px 24px rgba(0,0,0,0.5)")
    .style("pointer-events", "auto");

  // ── EMA state ───────────────────────────────────────────────────────────
  const emaState = { 9: false, 21: false, 50: false, 200: false };
  const emaColors = {
    9: "#00bfff",
    21: "#ffd700",
    50: "#ff8c00",
    200: "#ff4444",
  };

  // ── Regular menu items ──────────────────────────────────────────────────
  const menuItems = [
    {
      id: "zoom",
      label: "Zoom Area",
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="2 2 30 30" fill="currentColor">
              <path d="M31,29.5859l-4.6885-4.6884a8.028,8.028,0,1,0-1.414,1.414L29.5859,31ZM20,26a6,6,0,1,1,6-6A6.0066,6.0066,0,0,1,20,26Z"/>
              <path d="M8,26H4a2.0021,2.0021,0,0,1-2-2V20H4v4H8Z"/>
              <rect x="2" y="12" width="2" height="4"/>
              <path d="M26,8H24V4H20V2h4a2.0021,2.0021,0,0,1,2,2Z"/>
              <rect x="12" y="2" width="4" height="2"/>
              <path d="M4,8H2V4A2.0021,2.0021,0,0,1,4,2H8V4H4Z"/>
            </svg>`,
    },
    {
      id: "pan",
      label: "Pan Chart",
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 512 512" fill="currentColor">
              <path d="M234.6 256v85.3h42.7L213.3 426.6 149.3 341.3H192V256ZM341.3 149.3l85.3 64-85.3 64v-42.7H256V192h85.3ZM85.3 149.3V192h85.3v42.7H85.3v42.7L0 213.3ZM213.3 0l64 85.3h-42.7v85.3H192V85.3h-42.7Z"/>
            </svg>`,
    },
    {
      id: "draw",
      label: "Draw Tools",
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round">
              <line x1='5' y1='19' x2='19' y2='5'/>
            </svg>`,
    },
    {
      id: "measure",
      label: "Measure Move",
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round">
              <path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"/>
              <path d="m14.5 12.5 2-2"/><path d="m11.5 9.5 2-2"/>
              <path d="m8.5 6.5 2-2"/><path d="m17.5 15.5 2-2"/>
            </svg>`,
    },
    {
      id: "share",
      label: "Share / Download",
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
              stroke="currentColor" fill="none" stroke-width="2">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/>
              <line x1="15.4" y1="6.5" x2="8.6" y2="10.5"/>
            </svg>`,
    },
    {
      id: "ailevels",
      label: "AI Levels",
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round">
              <line x1="3" y1="8" x2="21" y2="8"/>
              <line x1="3" y1="16" x2="21" y2="16"/>
              <circle cx="7" cy="8" r="2" fill="currentColor"/>
              <circle cx="17" cy="16" r="2" fill="currentColor"/>
            </svg>`,
    },
    {
      id: "volume",
      label: "Volume",
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="14" width="4" height="7"/>
              <rect x="9" y="9" width="4" height="12"/>
              <rect x="16" y="4" width="4" height="17"/>
            </svg>`,
    },
    {
      id: "rsi",
      label: "RSI (14)",
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round">
              <polyline points="2,18 6,10 10,15 14,7 18,12 22,6"/>
            </svg>`,
    },
    {
      id: "candle-pattern",
      label: "Candle Pattern",
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="4" height="10"/>
              <rect x="10" y="6" width="4" height="7"/>
              <rect x="17" y="2" width="4" height="12"/>
              <line x1="5" y1="3" x2="5" y2="1"/>
              <line x1="5" y1="13" x2="5" y2="15"/>
              <line x1="12" y1="6" x2="12" y2="4"/>
              <line x1="12" y1="13" x2="12" y2="15"/>
              <line x1="19" y1="2" x2="19" y2="0"/>
              <line x1="19" y1="14" x2="19" y2="16"/>
            </svg>`,
    },

  ];

  menuItems.forEach((item) => {
    const isPremium = premiumItems.includes(item.id) && !isPaid;

    const row = dropdown
      .append("div")
      .attr("id", `tools-menu-${item.id}`)
      .style("display", "flex")
      .style("align-items", "center")
      .style("gap", "12px")
      .style("padding", "9px 18px")
      .style("cursor", "pointer")
      .style("color", isPremium ? "#6a8aaa" : "#ccc")
      .style("font-size", "13px")
      .style("font-family", "sans-serif")
      .style("transition", "background 0.15s")
      .style("position", "relative");

    row
      .on("mouseover", function () {
        d3.select(this)
          .style("background", "#162033")
          .style("color", isPremium ? "#8aaacf" : "#fff");
      })
      .on("mouseout", function () {
        d3.select(this)
          .style("background", "transparent")
          .style("color", isPremium ? "#6a8aaa" : "#ccc");
      });

    row
      .append("span")
      .style("display", "flex")
      .style("align-items", "center")
      .style("opacity", isPremium ? "0.45" : "0.75")
      .html(item.icon);

    row.append("span").text(item.label);

    // Lock badge for premium items
    if (isPremium) {
      row
        .append("div")
        .style("margin-left", "auto")
        .style("display", "flex")
        .style("align-items", "center")
        .style("gap", "4px")
        .style("background", "rgba(59,130,246,0.12)")
        .style("border", "1px solid rgba(59,130,246,0.25)")
        .style("border-radius", "4px")
        .style("padding", "2px 6px")
        .html(`
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <span style="font-size:10px;color:#3b82f6;font-weight:600;letter-spacing:0.02em">Pro</span>
            `);
    }

    // Event listeners — clicks always fire the CustomEvent,
    // gate logic lives in the constructor listeners
    if (item.id === "ailevels") {
      row.on("click", (event) => {
        event.stopPropagation();
        document.getElementById(id)?.dispatchEvent(new CustomEvent("ailevels-toggle"));
      });
    }

    if (item.id === "volume") {
      row.on("click", (event) => {
        event.stopPropagation();
        document.getElementById(id)?.dispatchEvent(new CustomEvent("volume-toggle"));
      });
    }

    if (item.id === "rsi") {
      row.on("click", (event) => {
        event.stopPropagation();
        document.getElementById(id)?.dispatchEvent(new CustomEvent("rsi-toggle"));
      });
    }

    if (item.id === "candle-pattern") {
      row.on("click", (event) => {
        event.stopPropagation();
        document.getElementById(id)?.dispatchEvent(new CustomEvent("candle-pattern-toggle"));
      });
    }
  });

  // ── Divider before EMA ──────────────────────────────────────────────────

  dropdown
    .append("div")
    .style("height", "1px")
    .style("background", "#1e3048")
    .style("margin", "6px 0");

  // ── EMA accordion header ────────────────────────────────────────────────
  let emaOpen = false;

  const emaHeader = dropdown
    .append("div")
    .attr("id", "tools-menu-ema")
    .style("display", "flex")
    .style("align-items", "center")
    .style("justify-content", "space-between")
    .style("padding", "9px 18px")
    .style("cursor", "pointer")
    .style("color", "#ccc")
    .style("font-size", "13px")
    .style("font-family", "sans-serif")
    .style("transition", "background 0.15s");

  emaHeader
    .on("mouseover", function () {
      d3.select(this).style("background", "#162033").style("color", "#fff");
    })
    .on("mouseout", function () {
      d3.select(this).style("background", "transparent").style("color", "#ccc");
    });

  // Left side of EMA header
  const emaLeft = emaHeader
    .append("div")
    .style("display", "flex")
    .style("align-items", "center")
    .style("gap", "12px");

  emaLeft
    .append("span")
    .style("display", "flex")
    .style("align-items", "center")
    .style("opacity", "0.75")
    .html(`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <polyline points="2,18 7,10 12,14 17,6 22,8"/>
           </svg>`);

  emaLeft.append("span").text("EMA");

  // Arrow indicator
  const emaArrow = emaHeader
    .append("span")
    .style("opacity", "0.4")
    .style("font-size", "10px")
    .style("transition", "transform 0.2s")
    .style("display", "inline-block")
    .text("▼");

  // ── EMA accordion body ──────────────────────────────────────────────────
  const emaBody = dropdown
    .append("div")
    .style("display", "none")
    .style("background", "#080f17")
    .style("border-top", "1px solid #1e3048")
    .style("border-bottom", "1px solid #1e3048")
    .style("padding", "2px 0");

  [9, 21, 50, 200].forEach((period) => {
    const optRow = emaBody
      .append("div")
      .style("display", "flex")
      .style("align-items", "center")
      .style("gap", "12px")
      .style("padding", "2px 18px 2px 24px")
      .style("cursor", "pointer")
      .style("color", "#aaa")
      .style("font-size", "13px")
      .style("font-family", "sans-serif")
      .style("transition", "background 0.15s")
      .style("user-select", "none");

    optRow
      .on("mouseover", function () {
        d3.select(this).style("background", "#162033").style("color", "#fff");
      })
      .on("mouseout", function () {
        d3.select(this)
          .style("background", "transparent")
          .style("color", "#aaa");
      });

    const checkBox = optRow
      .append("div")
      .attr("id", `ema-check-${period}`)
      .style("width", "14px")
      .style("height", "14px")
      .style("border", `2px solid ${emaColors[period]}`)
      .style("border-radius", "3px")
      .style("background", "transparent")
      .style("flex-shrink", "0")
      .style("display", "flex")
      .style("align-items", "center")
      .style("justify-content", "center")
      .style("transition", "background 0.15s");

    optRow
      .append("div")
      .style("width", "8px")
      .style("height", "8px")
      .style("border-radius", "50%")
      .style("background", emaColors[period])
      .style("flex-shrink", "0");

    optRow.append("span").text(`${period} EMA`);

    optRow.on("click", (event) => {
      event.stopPropagation();
      emaState[period] = !emaState[period];

      checkBox
        .style(
          "background",
          emaState[period] ? emaColors[period] : "transparent",
        )
        .html(
          emaState[period]
            ? `<svg width="10" height="10" viewBox="0 0 10 10">
              <polyline points="1.5,5 4,7.5 8.5,2.5"
                stroke="white" stroke-width="1.5"
                fill="none" stroke-linecap="round"/>
             </svg>`
            : "",
        );

      document.getElementById(id)?.dispatchEvent(
        new CustomEvent("ema-toggle", {
          detail: {
            period,
            active: emaState[period],
            color: emaColors[period],
          },
        }),
      );

    });
  });

  // ── EMA accordion toggle ────────────────────────────────────────────────
  emaHeader.on("click", (event) => {
    event.stopPropagation();
    emaOpen = !emaOpen;
    emaBody.style("display", emaOpen ? "block" : "none");
    emaArrow.style("transform", emaOpen ? "rotate(180deg)" : "rotate(0deg)");
    emaHeader.style("color", emaOpen ? "#fff" : "#ccc");
  });

  // ── Hamburger toggle ────────────────────────────────────────────────────
  let isOpen = false;
  hamburgerBtn.on("click", () => {
    isOpen = !isOpen;
    dropdown.style("display", isOpen ? "block" : "none");
    if (!isOpen) {
      emaOpen = false;
      emaBody.style("display", "none");
      emaArrow.style("transform", "rotate(0deg)");
    }
    hamburgerBtn.style("border-color", isOpen ? "#3b82f6" : "#2a3a4a");
  });

  // ── Close on outside click ──────────────────────────────────────────────
  d3.select("body").on(`click.menu-${id}`, (e) => {
    const dropNode = dropdown.node();
    const btnNode = hamburgerBtn.node();
    if (
      dropNode &&
      !dropNode.contains(e.target) &&
      btnNode &&
      !btnNode.contains(e.target)
    ) {
      isOpen = false;
      emaOpen = false;
      dropdown.style("display", "none");
      emaBody.style("display", "none");
      emaArrow.style("transform", "rotate(0deg)");
      hamburgerBtn.style("border-color", "#2a3a4a");
    }
  });
};
