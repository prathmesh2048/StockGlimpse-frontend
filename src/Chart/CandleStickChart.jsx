import * as d3 from 'd3';
import domtoimage from 'dom-to-image-more';
import {
  annotation,
  annotationLabel,
  annotationCalloutCurve,
  annotationCustomType,
  annotationCalloutRect
} from 'd3-svg-annotation';

import axios from 'axios';
import ENV from "../config"; // import your config file

import { colors, config, getCursorPoint, parseDate, modifyAnnotationEnd, createToolsBtns } from './CandleStickChartUtils.jsx';
import { placeWithoutOverlap, drawBrushGradient } from './Utils';

class CandleStickChart {

  #colors;
  #config;
  #maxPrice;
  #lockSelectorX;
  #objectIDs;
  #xScaleFunc;
  #yScaleFunc;
  #candleWidth;
  #candleWidthDate;
  #candleLockerWidth;
  #candleLockerWidthDate;
  #filteredData;
  #mode;
  #drawAndMeasureLocked = false;
  #isMouseDown = false;
  #zoomPoint1;
  #zoomPoint2;
  #zoomRange1;
  #zoomRange2;
  #minMaxDate;
  #zoomFactor = 1;
  #panTargetDate;
  #drawPoint1 = null;
  #drawPoint2 = null;
  #tempLine = null;
  #measureState = null;
  #chartMode = null;
  #annotationsData = [];
  #theme = null;
  #annotationCache = new Map();
  #isPnLWindowClosed = false;
  #lineData = [];
  #rightOffsetFactor = 0.40;
  #snrLevels = [];
  #srLevelsFetching = false;

  #candlePattern = null;
  #candlePatternFetching = false;
  #candlePatternActive = false;


  #ema9 = null;
  #ema21 = null;
  #ema50 = null;
  #ema200 = null;

  // ── Panel layout ─────────────────────────────────────
  // Heights are fractions of the total SVG height
  #PRICE_RATIO = 0.70;
  #VOLUME_RATIO = 0.15;
  #RSI_RATIO = 0.15;
  #PANEL_GAP = 4; // px gap between panels


  // Toggles for additional panels (volume, RSI)
  #showVolume = false;
  #showRSI = false;

  // Derived pixel heights (set in #calculatePanelHeights)
  #priceH = 0;
  #volumeH = 0;
  #rsiH = 0;
  #volumeTop = 0; // Y offset where volume panel starts
  #rsiTop = 0; // Y offset where RSI panel starts
  #totalSvgH = 0; // full SVG height covering all panels

  // RSI data
  #rsiData = [];


  constructor(width, height, data, stockAnnotationsData, id, theme = "dark") {

    this.#theme = theme
    this.#colors = colors(theme);
    this.#config = config(width, height);
    this.#maxPrice = d3.max(data.map((x) => x.High));
    this.data = data.sort((a, b) => parseDate(a) - parseDate(b));
    this.#annotationsData = stockAnnotationsData;
    this.#filteredData = data;
    this.id = id;
    this.#lockSelectorX = false;
    this.#calculateExtendConfigs();
    this.#setObjectIDs();
    let minMaxDate = d3.extent(data.map((x) => parseDate(x.Date)));
    this.#calculateCandleWidthDate();
    this.#minMaxDate = minMaxDate;
    this.#zoomRange1 = minMaxDate[0].getTime() - this.#candleWidthDate / 2;

    const totalRange =
      minMaxDate[1].getTime() - minMaxDate[0].getTime();

    const rightPadding = totalRange * this.#rightOffsetFactor;

    this.#zoomRange2 =
      minMaxDate[1].getTime() + rightPadding;


    this.#createToolsBtns();
    this.#measureState = {
      active: false,
      start: null,
      rect: null,
      label: null,
    };

    this.#modeHandler('pan');
    this.#chartMode = 'line';
    this.#annotationCache = this.#annotationCache || new Map();
    this.#rsiData = this.#calculateRSI(14);

    document.getElementById(this.id)?.addEventListener('ema-toggle', (e) => {
      const { period, active } = e.detail;

      if (active) {
        // Temporarily use full data for EMA calculation for accuracy
        const savedFiltered = this.#filteredData;
        this.#filteredData = this.data;
        const emaData = this.#calculateEMA(period);
        this.#filteredData = savedFiltered;

        if (period === 9) this.#ema9 = emaData;
        if (period === 21) this.#ema21 = emaData;
        if (period === 50) this.#ema50 = emaData;
        if (period === 200) this.#ema200 = emaData;

      } else {
        if (period === 9) this.#ema9 = null;
        if (period === 21) this.#ema21 = null;
        if (period === 50) this.#ema50 = null;
        if (period === 200) this.#ema200 = null;
      }

      this.#drawEMALines();   // ← just redraw lines, no full chart redraw
    });

    document.getElementById(this.id)?.addEventListener("ailevels-toggle", () => {

      if (!this.#snrLevels || this.#snrLevels.length === 0) {

        if (this.#srLevelsFetching) return; // already fetching, ignore click
        this.#fetchSRLevels();

      } else if (d3.select(`#${this.#objectIDs.svgId}`).selectAll('.sr-level').empty()) {
        this.#drawSRLevels();
      } else {
        d3.select(`#${this.#objectIDs.svgId}`).selectAll('.sr-level').remove();
      }
    });


    document.getElementById(this.id)?.addEventListener("volume-toggle", () => {
      this.#showVolume = !this.#showVolume;
      this.draw();
    });

    document.getElementById(this.id)?.addEventListener("rsi-toggle", () => {
      this.#showRSI = !this.#showRSI;
      this.draw();
    });

    document.getElementById(id)?.addEventListener("candle-pattern-toggle", () => {

    });

    document.getElementById(id)?.addEventListener("candle-pattern-toggle", () => {
      if (!this.#candlePattern || this.#candlePattern.patterns?.length === 0) {
        if (this.#candlePatternFetching) return;
        this.#fetchCandlePattern();
      } else if (this.#candlePatternActive) {
        // Turn off
        this.#candlePatternActive = false;
        d3.select(`#${this.#objectIDs.svgId}`)
          .selectAll('.candle-pattern-highlight')
          .interrupt()
          .style("stroke", null)
          .style("filter", null)
          .style("opacity", 1)
          .classed("candle-pattern-highlight", false);
      } else {
        // Turn on
        this.#candlePatternActive = true;
        this.#highlightPatternCandles();
      }
    });

  }

  getChartMode() {
    return this.#chartMode;
  }

  getAnnotationsData() {
    return this.#annotationsData;
  }

  getObjectIDs() {
    return this.#objectIDs;
  }

  getChartMode() {
    return this.#chartMode;
  }

  getYScaleFunc() {
    return this.#yScaleFunc;
  }

  getXScaleFunc() {
    return this.#xScaleFunc;
  }

  getChartData() {
    return this.#filteredData;
  }


  setAnnotations(annotations) {
    this.#annotationsData = annotations;
  }

  toggleChartMode() {

    this.#chartMode = this.#chartMode === 'candlestick' ? 'line' : 'candlestick';
    this.draw();
    d3.select("#tools-btn-5")
      .html(this.#getChartTypeIcon());
  }

  async shareChartScreenshot() {
    const element = document.querySelector(".stockChartCard");
    if (!element) return;

    const toolbar = document.getElementById(this.#objectIDs.toolsBtnsContainer);
    const dropdown = document.getElementById(`${this.#objectIDs.toolsBtnsContainer}-dropdown`);

    // ── Inject !important overrides ───────────────────────
    const styleTag = document.createElement("style");
    styleTag.id = "screenshot-override";
    styleTag.textContent = `
      .stockChartCard,
      .stockChartCard *,
      .stockChartBody,
      .stockChartBody > div,
      .stockChartBody > div > div,
      [class*="ChartDashboard"] {
        border: none !important;
        outline: none !important;
        box-shadow: none !important;
        background-color: #0b1220 !important;
        padding: 0 !important;
        margin: 0 !important;
      }
      .stockChartHeader {
        padding: 8px 12px !important;
      }
    `;
    document.head.appendChild(styleTag);

    if (toolbar) toolbar.style.visibility = "hidden";
    if (dropdown) dropdown.style.visibility = "hidden";

    // ── Flash scoped to card ──────────────────────────────
    const rect = element.getBoundingClientRect();
    const flash = document.createElement("div");
    flash.style.cssText = `
      position: fixed;
      top: ${rect.top}px;
      left: ${rect.left}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
      background: white;
      z-index: 99999;
      opacity: 0;
      pointer-events: none;
      border-radius: 8px;
      transition: opacity 0.08s ease;
    `;
    document.body.appendChild(flash);
    requestAnimationFrame(() => {
      flash.style.opacity = "0.6";
      setTimeout(() => {
        flash.style.opacity = "0";
        setTimeout(() => flash.remove(), 200);
      }, 80);
    });

    await new Promise(r => setTimeout(r, 50));

    try {
      const blob = await domtoimage.toBlob(element, {
        bgcolor: "#0b1220",
        scale: 2,
        width: element.scrollWidth,
        height: element.scrollHeight,
      });

      const imageUrl = URL.createObjectURL(blob);
      this.#showShareModal(imageUrl, blob);

    } catch (err) {
      console.error("Capture failed:", err);
      this.#showToast("❌ Capture failed");
    } finally {
      styleTag.remove();
      if (toolbar) toolbar.style.visibility = "visible";
      if (dropdown) dropdown.style.visibility = "visible";
    }
  }

  #showShareModal(imageUrl, blob) {

    // ── Inject animations once ────────────────────────────
    if (!document.getElementById("share-modal-styles")) {
      const style = document.createElement("style");
      style.id = "share-modal-styles";
      style.textContent = `
        @keyframes smFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes smSlideUp { from { transform: translateY(30px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
      `;
      document.head.appendChild(style);
    }

    // ── Backdrop ──────────────────────────────────────────
    const backdrop = document.createElement("div");
    backdrop.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.75);
      z-index: 99998;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: smFadeIn 0.2s ease;
    `;

    // ── Modal ─────────────────────────────────────────────
    const modal = document.createElement("div");
    modal.style.cssText = `
      background: #0d1b2a;
      border: 1px solid #1e3048;
      border-radius: 16px;
      padding: 20px;
      width: 480px;
      max-width: 95vw;
      box-shadow: 0 24px 64px rgba(0,0,0,0.6);
      animation: smSlideUp 0.25s ease;
      font-family: sans-serif;
    `;

    // ── Header ────────────────────────────────────────────
    const header = document.createElement("div");
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 14px;
    `;
    header.innerHTML = `
      <span style="color:#fff; font-size:15px; font-weight:600;">📸 Share Your Trade</span>
      <span id="share-modal-close" style="color:#888; font-size:20px; cursor:pointer; line-height:1; transition: color 0.15s;">✕</span>
    `;

    // ── Screenshot preview ────────────────────────────────
    const img = document.createElement("img");
    img.src = imageUrl;
    img.style.cssText = `
      width: 100%;
      border-radius: 10px;
      border: 1px solid #1e3048;
      margin-bottom: 16px;
      display: block;
    `;

    // ── Share buttons ─────────────────────────────────────
    const btnRow = document.createElement("div");
    btnRow.style.cssText = `
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    `;

    const makeBtn = (label, icon, bg, action) => {
      const btn = document.createElement("button");
      btn.style.cssText = `
        flex: 1;
        min-width: 100px;
        padding: 10px 12px;
        background: ${bg};
        color: #fff;
        border: none;
        border-radius: 8px;
        font-size: 13px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        font-family: sans-serif;
        font-weight: 500;
        transition: opacity 0.15s;
      `;
      btn.innerHTML = `${icon} ${label}`;
      btn.onmouseenter = () => btn.style.opacity = "0.85";
      btn.onmouseleave = () => btn.style.opacity = "1";
      btn.onclick = action;
      return btn;
    };

    // ── Download button ───────────────────────────────────
    btnRow.appendChild(makeBtn("Download", "📥", "#1e3a4a", () => {
      const a = document.createElement("a");
      a.href = imageUrl;
      a.download = "trade-chart.jpg";
      a.click();
      this.#showToast("📥 Downloaded!");
    }));

    // ── Copy to clipboard button ──────────────────────────
    btnRow.appendChild(makeBtn("Copy Image", "📋", "#1e3a2f", async () => {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob })
        ]);
        this.#showToast("📋 Copied! Paste into Twitter, Discord, anywhere.");
      } catch {
        this.#showToast("❌ Clipboard not supported in this browser");
      }
    }));

    // ── Native share (mobile only) ────────────────────────
    const file = new File([blob], "trade-chart.png", { type: "image/png" });
    const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
    if (isMobile && navigator.canShare && navigator.canShare({ files: [file] })) {
      btnRow.appendChild(makeBtn("Share", "🔗", "#1a2a4a", async () => {
        try {
          await navigator.share({
            title: "My Trade",
            text: "Check out my trade! 📈",
            files: [file]
          });
        } catch (err) {
          console.error("Share failed:", err);
        }
      }));
    }

    // ── Assemble ──────────────────────────────────────────
    modal.appendChild(header);
    modal.appendChild(img);
    modal.appendChild(btnRow);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    // ── Close handlers ────────────────────────────────────
    const close = () => {
      backdrop.remove();
      URL.revokeObjectURL(imageUrl);
    };

    const closeBtn = document.getElementById("share-modal-close");
    closeBtn.onmouseenter = () => closeBtn.style.color = "#fff";
    closeBtn.onmouseleave = () => closeBtn.style.color = "#888";
    closeBtn.onclick = close;
    backdrop.onclick = (e) => { if (e.target === backdrop) close(); };
  }

  #showToast(message) {
    const existing = document.getElementById(`${this.id}-toast`);
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = `${this.id}-toast`;
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 32px;
      left: 50%;
      transform: translateX(-50%);
      background: #1e3a2f;
      color: #22d3ee;
      border: 1px solid #22d3ee;
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 13px;
      font-family: sans-serif;
      z-index: 99999;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4);
      opacity: 1;
      transition: opacity 0.4s ease;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 400);
    }, 2500);
  }

  setData(newData) {
    this.data = newData;
    this.#filteredData = newData;
    this.#rsiData = this.#calculateRSI(14);
    this.destroy()
    this.draw();
  }

  #noop = () => { };

  #calculateInfoTextWidth() {
    this.#config.infoTextWidth =
      (this.#maxPrice.toFixed(this.#config.decimal).toString().length * 4 +
        11) *
      this.#config.charWidth;
  }

  #calculateInfoTextWidthMeta() {
    this.#config.infoTextWidthMeta =
      (this.#maxPrice.toFixed(this.#config.decimal).toString().length * 3 +
        14) *
      this.#config.charWidth;
  }

  #calculateYLabelWidth() {
    this.#config.yLabelWidth =
      2.4 +
      this.#maxPrice.toFixed(this.#config.decimal).toString().length *
      this.#config.charWidth;
  }

  #calculatePaddingRight() {
    this.#config.paddingRight = this.#config.yLabelWidth * 0.1;
  }

  #calculatePaddingLeft() {
    this.#config.paddingLeft = this.#config.xLabelWidth * 0.3;
  }

  #calculateSvgWidth() {
    this.#config.svgWidth =
      this.#config.width -
      (this.#config.paddingLeft + this.#config.paddingRight) -
      2;

  }

  #calculateSvgHeight() {
    const available = this.#config.height - (this.#config.paddingBottom + this.#config.paddingTop + 6);
    const { price, vol, rsi } = this.#getPanelRatios();

    this.#priceH = Math.floor(available * price) - (price < 1 ? this.#PANEL_GAP : 0);
    this.#volumeH = Math.floor(available * vol) - (vol > 0 ? this.#PANEL_GAP : 0);
    this.#rsiH = Math.floor(available * rsi);

    this.#volumeTop = this.#showVolume ? this.#priceH + this.#PANEL_GAP * 2 : 0;
    this.#rsiTop = this.#showRSI
      ? (this.#showVolume ? this.#volumeTop + this.#volumeH + this.#PANEL_GAP * 2 : this.#priceH + this.#PANEL_GAP * 2)
      : 0;

    this.#totalSvgH = this.#priceH
      + (this.#showVolume ? this.#volumeH + this.#PANEL_GAP * 2 : 0)
      + (this.#showRSI ? this.#rsiH + this.#PANEL_GAP * 2 : 0);

    this.#config.svgHeight = this.#priceH;
  }

  #getPanelRatios() {
    const hasVol = this.#showVolume;
    const hasRSI = this.#showRSI;

    if (hasVol && hasRSI) return { price: 0.70, vol: 0.15, rsi: 0.15 };
    if (hasVol && !hasRSI) return { price: 0.85, vol: 0.15, rsi: 0 };
    if (!hasVol && hasRSI) return { price: 0.85, vol: 0, rsi: 0.15 };
    return { price: 1.0, vol: 0, rsi: 0 };
  }

  #calculateXscale() {
    this.#xScaleFunc = d3
      .scaleTime()
      .domain([this.#zoomRange1, this.#zoomRange2])
      .range([0, this.#config.svgWidth]);
  }

  #calculateYscale() {

    let yMinMax;
    if (this.#filteredData.length === 0) {
      yMinMax = [0, 1];
    } else {
      const allValues = this.#filteredData.flatMap((x) =>
        [x.High, x.Low, x.sl, x.tp].filter((v) => v != null)
      );
      yMinMax = d3.extent(allValues).reverse();
      yMinMax[0] += yMinMax[0] * this.#config.yPaddingScaleTop;
      yMinMax[1] -= yMinMax[1] * this.#config.yPaddingScaleBottom;
    }

    this.#yScaleFunc = d3
      .scaleLinear()
      .domain(yMinMax)
      .range([0, this.#config.svgHeight]);

  }

  #calculateCandleWidth() {

    if (this.#filteredData.length === 0) {
      this.#candleLockerWidth = 0;
      this.#candleWidth = 0;
      return;
    }
    let minMax = d3.extent(this.#filteredData.map((x) => parseDate(x.Date)));
    this.#candleLockerWidth =
      this.#xScaleFunc(minMax[0].getTime() + this.#candleLockerWidthDate) -
      this.#xScaleFunc(minMax[0].getTime());

    this.#candleWidth = this.#candleLockerWidth - this.#candleLockerWidth * 0.3;
  }

  #calculateCandleWidthDate() {
    let times = this.#filteredData.map((x) => x.Date).sort();
    let indexes = [0, 1];
    let min = parseDate(times[1]) - parseDate(times[0]);
    for (let i = 1; i < times.length; i++) {
      if (parseDate(times[i + 1]) - parseDate(times[i]) < min) {
        min = parseDate(times[i + 1]) - parseDate(times[i]);
        indexes = [i, i + 1];
      }
    }

    let rWidth = parseDate(times[indexes[1]]) - parseDate(times[indexes[0]]);
    this.#candleLockerWidthDate = rWidth;
    rWidth -= rWidth * 0.3;
    this.#candleWidthDate = rWidth;
  }

  #calculateExtendConfigs() {

    this.#calculateInfoTextWidth();
    this.#calculateInfoTextWidthMeta();
    this.#calculateYLabelWidth();
    this.#calculatePaddingRight();
    this.#calculatePaddingLeft();
    this.#calculateSvgWidth();
    this.#calculateSvgHeight();
  }

  #setObjectIDs() {

    let randomNumber = (Math.random() * 10000).toFixed(0);
    this.#objectIDs = {};
    this.#objectIDs.svgId = `${this.id}-${randomNumber}`;
    this.#objectIDs.yAxisId = `yAxisG-${randomNumber}`;
    this.#objectIDs.xAxisId = `xAxisG-${randomNumber}`;
    this.#objectIDs.candleContainerId = `candles-${randomNumber}`;
    this.#objectIDs.xLineSelectorId = `xLineSelector-${randomNumber}`;
    this.#objectIDs.yLineSelectorId = `yLineSelector-${randomNumber}`;
    this.#objectIDs.xLabelSelectorId = `xLabelSelector-${randomNumber}`;
    this.#objectIDs.yLabelSelectorId = `yLabelSelector-${randomNumber}`;
    this.#objectIDs.candleInfoId = `candle-info-${randomNumber}`;
    this.#objectIDs.candleInfoIdBackground = `bc-candle-info-${randomNumber}`;
    this.#objectIDs.candleInfoIdPosition = `candle-info-${randomNumber}-position`;
    this.#objectIDs.candleInfoIdBackgroundPosition = `bc-candle-info-${randomNumber}-position`;
    this.#objectIDs.zoomBoxId1 = `zoom-box-${randomNumber}-1`;
    this.#objectIDs.zoomBoxId2 = `zoom-box-${randomNumber}-2`;
    this.#objectIDs.toolsBtnsContainer = `tools-btns-${randomNumber}`;
  }

  #createLayout() {
    const svg = d3.select(`#${this.id}`)
      .style('padding', `${this.#config.paddingTop}px ${this.#config.paddingRight}px ${this.#config.paddingBottom}px ${this.#config.paddingLeft}px`)
      .style('display', 'inline-block')
      .attr('width', this.#config.width)
      .attr('height', this.#config.height)
      .append('svg')
      .attr('width', this.#config.svgWidth)
      .attr('height', this.#totalSvgH)
      .style('overflow', 'inherit')
      .style('cursor', 'crosshair')
      .style('background-color', this.#colors.gridBackground)
      .attr('id', this.#objectIDs.svgId)
      .style('margin-top', '-50px');

    const sepColor = this.#colors.grid || '#2a3a4a';

    // ── Volume panel separator + label (only if visible) ──
    if (this.#showVolume) {
      svg.append('line')
        .attr('class', 'panel-separator')
        .attr('x1', 0).attr('x2', this.#config.svgWidth)
        .attr('y1', this.#volumeTop - 1).attr('y2', this.#volumeTop - 1)
        .attr('stroke', sepColor).attr('stroke-width', 1).attr('opacity', 0.5);

      svg.append('text')
        .attr('class', 'panel-label')
        .attr('x', 6).attr('y', this.#volumeTop + 12)
        .attr('fill', this.#colors.tickColor || '#888')
        .attr('font-size', '10px').attr('font-weight', '600')
        .attr('font-family', 'monospace').text('VOL');
    }

    // ── RSI panel separator + label (only if visible) ─────
    if (this.#showRSI) {
      svg.append('line')
        .attr('class', 'panel-separator')
        .attr('x1', 0).attr('x2', this.#config.svgWidth)
        .attr('y1', this.#rsiTop - 1).attr('y2', this.#rsiTop - 1)
        .attr('stroke', sepColor).attr('stroke-width', 1).attr('opacity', 0.5);

      svg.append('text')
        .attr('class', 'panel-label')
        .attr('x', 6).attr('y', this.#rsiTop + 12)
        .attr('fill', this.#colors.tickColor || '#888')
        .attr('font-size', '10px').attr('font-weight', '600')
        .attr('font-family', 'monospace').text('RSI(14)');
    }
  }

  #createYaxis() {
    let yAxis = d3.axisRight(this.#yScaleFunc).tickSize(this.#config.svgWidth);
    d3.select(`#${this.#objectIDs.svgId}`)
      .append('g')
      .attr('id', this.#objectIDs.yAxisId)
      .call(yAxis);

    d3.selectAll(`#${this.#objectIDs.yAxisId} .domain`).each(function (d, i) {
      this.remove();
    });

    d3.selectAll(`#${this.#objectIDs.yAxisId}  g text`).attr(
      'transform',
      'translate(5,0)'
    );

    let gridColor = this.#colors.grid;
    d3.selectAll(`#${this.#objectIDs.yAxisId}  .tick line`).each(function (
      d,
      i
    ) {
      this.style.stroke = gridColor;
    });
    d3.selectAll(`#${this.#objectIDs.yAxisId} .tick text`).style(
      'fill',
      this.#colors.tickColor
    )
      .style('font-size', '10px')
      .style('font-weight', '600')

  }

  #createXaxis() {
    let xAxis = d3
      .axisBottom(this.#xScaleFunc)
      .ticks(this.#config.svgWidth / 100)
      .tickSize(this.#config.svgHeight); // only spans price panel

    d3.select(`#${this.#objectIDs.svgId}`)
      .append('g')
      .attr('id', this.#objectIDs.xAxisId)
      .call(xAxis);

    d3.selectAll(`#${this.#objectIDs.xAxisId} g text`).attr(
      'transform',
      'translate(0,10)'
    );

    let gridColor = this.#colors.grid;
    d3.selectAll(`#${this.#objectIDs.xAxisId} .tick line`).each(function (d, i) {
      this.style.stroke = gridColor;
    });
    d3.selectAll(`#${this.#objectIDs.xAxisId} .domain`).each(function (d, i) {
      this.remove();
    });
    d3.selectAll(`#${this.#objectIDs.xAxisId} .tick text`).style(
      'fill',
      this.#colors.tickColor
    ).style('font-size', '10px')
      .style('font-weight', '600');
  }

  #createInfoText() {

    d3.select(`#${this.#objectIDs.svgId}`)
      .append('rect')
      .attr('id', this.#objectIDs.candleInfoIdBackground)
      .attr('x', window.innerWidth > this.#config.mobileBreakPoint ? 20 : 0)
      .attr('y', window.innerWidth > this.#config.mobileBreakPoint ? 10 : 50)
      .attr('width', this.#config.infoTextWidth)
      .attr('height', 14)
      .attr('fill', this.#colors.background)
      .style('display', 'none');

    d3.select(`#${this.#objectIDs.svgId}`)
      .append('text')
      .attr('id', this.#objectIDs.candleInfoId)
      .style('font-size', '14px')
      .style('font-family', 'monospace')
      .attr('x', window.innerWidth > this.#config.mobileBreakPoint ? 20 : 0)
      .attr('y', window.innerWidth > this.#config.mobileBreakPoint ? 20 : 60)
      .style('fill', this.#colors.candleInfoText);

    d3.select(`#${this.#objectIDs.svgId}`)
      .append('rect')
      .attr('id', this.#objectIDs.candleInfoIdBackgroundPosition)
      .attr('x', window.innerWidth > this.#config.mobileBreakPoint ? 20 : 0)
      .attr('y', window.innerWidth > this.#config.mobileBreakPoint ? 30 : 70)
      .attr('width', this.#config.infoTextWidthMeta)
      .attr('height', 14)
      .attr('fill', this.#colors.background)
      .style('display', 'none');

    d3.select(`#${this.#objectIDs.svgId}`)
      .append('text')
      .attr('id', this.#objectIDs.candleInfoIdPosition)
      .style('font-size', '14px')
      .style('font-family', 'monospace')
      .attr('x', window.innerWidth > this.#config.mobileBreakPoint ? 20 : 0)
      .attr('y', window.innerWidth > this.#config.mobileBreakPoint ? 40 : 80)
      .style('fill', this.#colors.candleInfoText);
  }

  #createLockerGroup() {
    d3.select(`#${this.#objectIDs.svgId}`)
      .append('foreignObject')
      .attr('width', this.#config.svgWidth)
      .attr('height', this.#config.svgHeight)
      .selectAll()
      .data([1])
      .enter()
      .append('svg')
      .attr('id', this.#objectIDs.candleContainerId)
      .style('width', '100%')
      .style('height', '100%')
      .selectAll()
      .data(this.#filteredData)
      .enter()
      .append('g')
      .attr('class', 'candle-locker');
  }
  #createLockerBody() {
    d3.selectAll(`#${this.#objectIDs.candleContainerId} .candle-locker`)
      .append('rect')
      .attr('width', this.#candleLockerWidth)
      .attr('height', this.#config.svgHeight)
      .attr(
        'x',
        (d) => this.#xScaleFunc(parseDate(d.Date)) - this.#candleLockerWidth / 2
      )
      .attr('y', 0)
      .style('opacity', 0);
  }

  #createCandlesGroup() {
    d3.select(
      `#${this.#objectIDs.svgId} foreignObject #${this.#objectIDs.candleContainerId
      }`
    )
      .selectAll()
      .data(this.#filteredData)
      .enter()
      .append('g')
      .attr('class', 'candle');
  }


  #createCandlesBody() {
    const container = d3.selectAll(`#${this.#objectIDs.candleContainerId} .candle`);

    if (this.#chartMode === 'candlestick') {
      container
        .append('rect')
        .attr('width', this.#candleWidth)
        .attr('height', (d) =>
          d.Open > d.Close
            ? this.#yScaleFunc(d.Close) - this.#yScaleFunc(d.Open)
            : this.#yScaleFunc(d.Open) - this.#yScaleFunc(d.Close)
        )
        .attr(
          'x',
          (d) => this.#xScaleFunc(parseDate(d.Date)) - this.#candleWidth / 2
        )
        .attr('y', (d) =>
          d.Open > d.Close ? this.#yScaleFunc(d.Open) : this.#yScaleFunc(d.Close)
        )
        .attr('stroke', (d) =>
          d.Open > d.Close
            ? this.#colors.upCandlesStroke
            : this.#colors.downCandlesStroke
        )
        .attr('fill', (d) =>
          d.Open > d.Close
            ? this.#colors.upCandlesFill
            : this.#colors.downCandlesFill
        );

      // Remove any old line chart
      d3.selectAll(`#${this.#objectIDs.candleContainerId} .line-chart`).remove();

    } else if (this.#chartMode === 'line') {
      // Remove candle rects if switching to line mode
      container.selectAll('rect').remove();

      const lineData = container.data();

      const line = d3.line()
        .x(d => this.#xScaleFunc(parseDate(d.Date)))
        .y(d => this.#yScaleFunc(d.Close));

      d3.select(`#${this.#objectIDs.candleContainerId}`)
        .append('path')
        .attr('class', 'line-chart')
        .attr('fill', 'none')
        .attr('stroke', 'steelblue')
        .attr('stroke-width', 2)
        .attr('d', line(lineData));
    }
  }

  #createCandlesHigh() {
    if (this.#chartMode !== 'candlestick') return;

    d3.selectAll(`#${this.#objectIDs.candleContainerId} .candle`)
      .append('rect')
      .attr('width', this.#config.candleTailWidth)
      .attr('height', (d) =>
        d.Open > d.Close
          ? this.#yScaleFunc(d.Open) - this.#yScaleFunc(d.High)
          : this.#yScaleFunc(d.Close) - this.#yScaleFunc(d.High)
      )
      .attr(
        'x',
        (d) =>
          this.#xScaleFunc(parseDate(d.Date)) - this.#config.candleTailWidth / 2
      )
      .attr('y', (d) => this.#yScaleFunc(d.High))
      .attr('fill', (d) =>
        d.Open > d.Close
          ? this.#colors.upCandlesTail
          : this.#colors.downCandlesTail
      );
  }

  #createCandlesLow() {
    if (this.#chartMode !== 'candlestick') return;

    d3.selectAll(`#${this.#objectIDs.candleContainerId} .candle`)
      .append('rect')
      .attr('width', this.#config.candleTailWidth)
      .attr('height', (d) =>
        d.Open > d.Close
          ? this.#yScaleFunc(d.Low) - this.#yScaleFunc(d.Close)
          : this.#yScaleFunc(d.Low) - this.#yScaleFunc(d.Open)
      )
      .attr(
        'x',
        (d) =>
          this.#xScaleFunc(parseDate(d.Date)) - this.#config.candleTailWidth / 2
      )
      .attr('y', (d) =>
        d.Open > d.Close ? this.#yScaleFunc(d.Close) : this.#yScaleFunc(d.Open)
      )
      .attr('fill', (d) =>
        d.Open > d.Close
          ? this.#colors.upCandlesTail
          : this.#colors.downCandlesTail
      );
  }


  #getChartTypeIcon() {
    if (this.#chartMode === "line") {
      return "<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M4 4v16'/><path d='M4 8h4v8H4'/><path d='M12 2v20'/><path d='M10 6h4v12h-4'/><path d='M20 4v16'/><path d='M18 10h4v4h-4'/></svg>";
    } else {
      return "<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M3 3v18h18'/><path d='M19 9l-5 5-4-4-6 6'/></svg>";

    }
  }

  #calculateEMA(period) {

    const data = this.#filteredData;
    const closes = data.map(d => d.Close);
    const k = 2 / (period + 1);
    const ema = [];

    const seed = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
    ema.push({ Date: data[period - 1].Date, value: seed });

    for (let i = period; i < closes.length; i++) {
      const value = closes[i] * k + ema[ema.length - 1].value * (1 - k);
      ema.push({ Date: data[i].Date, value });
    }

    return ema;
  }

  #drawEMALines() {
    const svg = d3.select(`#${this.#objectIDs.svgId}`);
    svg.selectAll('.ema-line').remove();

    const emaColors = { 9: '#00bfff', 21: '#ffd700', 50: '#ff8c00', 200: '#ff4444' };
    const emas = [
      { period: 9, data: this.#ema9 },
      { period: 21, data: this.#ema21 },
      { period: 50, data: this.#ema50 },
      { period: 200, data: this.#ema200 },
    ];

    const line = d3.line()
      .x(d => this.#xScaleFunc(parseDate(d.Date)))
      .y(d => this.#yScaleFunc(d.value))
      .defined(d => d.value != null);

    emas.forEach(({ period, data }) => {
      if (!data || data.length === 0) return;

      svg.append('path')
        .attr('class', 'ema-line')
        .attr('fill', 'none')
        .attr('stroke', emaColors[period])
        .attr('stroke-width', 1.5)
        .attr('opacity', 0.85)
        .attr('d', line(data));
    });
  }

  #drawSRLevels() {
    const svg = d3.select(`#${this.#objectIDs.svgId}`);
    svg.selectAll('.sr-level').remove();

    console.log("Drawing S/R levels:", this.#snrLevels);
    if (!this.#snrLevels || this.#snrLevels.length === 0) return;

    const xMin = this.#xScaleFunc(parseDate(this.#filteredData[0].Date));
    const xMax = this.#xScaleFunc(parseDate(this.#filteredData[this.#filteredData.length - 1].Date));

    // Get current price to determine support vs resistance
    const currentPrice = this.#filteredData[this.#filteredData.length - 1].Close;

    this.#snrLevels.forEach(price => {
      const y = this.#yScaleFunc(price);
      const isResistance = price > currentPrice;

      // Line
      svg.append('line')
        .attr('class', 'sr-level')
        .attr('x1', xMin)
        .attr('x2', xMax)
        .attr('y1', y)
        .attr('y2', y)
        .attr('stroke', isResistance ? '#ff4444' : '#00ff88')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '4,3')
        .attr('opacity', 0.7);

      // Price label
      svg.append('text')
        .attr('class', 'sr-level')
        .attr('x', xMax + 6)
        .attr('y', y + 4)
        .attr('fill', isResistance ? '#ff4444' : '#00ff88')
        .attr('font-size', '11px')
        .attr('font-family', 'sans-serif')
        .text(price.toFixed(1));
    });
  }

  #highlightPatternCandles() {
    if (!this.#candlePattern?.patterns?.length) return;

    const self = this; // capture reference

    const patternDates = new Set(
      this.#candlePattern.patterns
        .filter(p => p.patterns?.length > 0 || p.score !== undefined)
        .map(p => new Date(p.trade_time).toDateString())
    );

    const pulseCandle = (selection) => {
      selection
        .transition()
        .duration(500)
        .style("opacity", 0.25)
        .transition()
        .duration(500)
        .style("opacity", 1)
        .on("end", function () {
          pulseCandle(d3.select(this));
        });
    };

    d3.selectAll(`#${this.#objectIDs.candleContainerId} .candle`)
      .each(function (d) {  // keep regular function so `this` = DOM element
        const candleDate = new Date(d.Date).toDateString();
        if (patternDates.has(candleDate)) {
          const candle = d3.select(this); // `this` = the candle DOM element

          const match = self.#candlePattern.patterns.find(  // use `self` for class
            p => new Date(p.trade_time).toDateString() === candleDate
          );

          const score = match?.score ?? 50;
          const highlightColor = score >= 70 ? "#00ff88"
            : score >= 40 ? "#FFD700"
              : "#ff4444";

          candle.selectAll("rect")
            .classed("candle-pattern-highlight", true)
            .style("stroke", highlightColor)
            .style("stroke-width", "2px")
            .style("filter", `drop-shadow(0 0 4px ${highlightColor})`)
            .call(pulseCandle);
        }
      });
  }


  #drawVolumeChart() {
    const svg = d3.select(`#${this.#objectIDs.svgId}`);
    svg.selectAll('.volume-bar, .volume-axis, .volume-zero-line').remove();

    const data = this.#filteredData;
    if (!data || data.length === 0) return;

    const maxVolume = d3.max(data, d => d.Volume) || 1;
    const yVol = d3.scaleLinear()
      .domain([0, maxVolume])
      .range([this.#volumeTop + this.#volumeH, this.#volumeTop]);

    // Zero baseline
    svg.append('line')
      .attr('class', 'volume-zero-line')
      .attr('x1', 0).attr('x2', this.#config.svgWidth)
      .attr('y1', this.#volumeTop + this.#volumeH)
      .attr('y2', this.#volumeTop + this.#volumeH)
      .attr('stroke', this.#colors.grid || '#2a3a4a')
      .attr('stroke-width', 1);

    // Volume bars
    data.forEach(d => {
      const x = this.#xScaleFunc(parseDate(d.Date));
      const isGreen = d.Close >= d.Open;
      const barHeight = (this.#volumeTop + this.#volumeH) - yVol(d.Volume);
      const barW = Math.max(1, this.#candleWidth);

      svg.append('rect')
        .attr('class', 'volume-bar')
        .attr('x', x - barW / 2)
        .attr('y', yVol(d.Volume))
        .attr('width', barW)
        .attr('height', Math.max(0, barHeight))
        .attr('fill', isGreen ? '#26a69a' : '#ef5350')
        .attr('opacity', 0.7);
    });

    // Y axis for volume (right side, 2-3 ticks)
    const yVolAxis = d3.axisRight(yVol)
      .ticks(3)
      .tickSize(0)
      .tickFormat(d => d >= 1e6 ? `${(d / 1e6).toFixed(1)}M` : d >= 1e3 ? `${(d / 1e3).toFixed(0)}K` : d);

    svg.append('g')
      .attr('class', 'volume-axis')
      .attr('transform', `translate(${this.#config.svgWidth}, 0)`)
      .call(yVolAxis)
      .selectAll('text')
      .style('fill', this.#colors.tickColor || '#888')
      .style('font-size', '9px');

    svg.select('.volume-axis .domain').remove();
  }

  #calculateRSI(period = 14) {
    const data = this.data; // use full dataset for accurate RSI
    if (data.length < period + 1) return [];

    const closes = data.map(d => d.Close);
    const rsi = [];

    // Seed: first average gain/loss over `period` bars
    let avgGain = 0;
    let avgLoss = 0;
    for (let i = 1; i <= period; i++) {
      const change = closes[i] - closes[i - 1];
      if (change >= 0) avgGain += change;
      else avgLoss += Math.abs(change);
    }
    avgGain /= period;
    avgLoss /= period;

    const rs0 = avgLoss === 0 ? Infinity : avgGain / avgLoss;
    rsi.push({ Date: data[period].Date, value: avgLoss === 0 ? 100 : 100 - 100 / (1 + rs0) });

    // Wilder smoothing
    for (let i = period + 1; i < closes.length; i++) {
      const change = closes[i] - closes[i - 1];
      const gain = change >= 0 ? change : 0;
      const loss = change < 0 ? Math.abs(change) : 0;
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
      rsi.push({ Date: data[i].Date, value: avgLoss === 0 ? 100 : 100 - 100 / (1 + rs) });
    }

    return rsi;
  }

  #drawRSIPanel() {
    const svg = d3.select(`#${this.#objectIDs.svgId}`);
    svg.selectAll('.rsi-element').remove();

    const rsiData = this.#rsiData.filter(d => {
      const t = parseDate(d.Date).getTime();
      return t >= this.#zoomRange1 && t <= this.#zoomRange2;
    });

    if (!rsiData || rsiData.length < 2) return;

    const panelTop = this.#rsiTop;
    const panelH = this.#rsiH;

    const yRsi = d3.scaleLinear()
      .domain([0, 100])
      .range([panelTop + panelH, panelTop]);

    // ── Overbought / Oversold zones ───────────────────────
    const zoneData = [
      { y1: 30, y2: 0, fill: 'rgba(38,166,154,0.08)' },  // oversold zone
      { y1: 100, y2: 70, fill: 'rgba(239,83,80,0.08)' },  // overbought zone
    ];
    zoneData.forEach(z => {
      svg.append('rect')
        .attr('class', 'rsi-element')
        .attr('x', 0)
        .attr('y', yRsi(z.y1))
        .attr('width', this.#config.svgWidth)
        .attr('height', yRsi(z.y2) - yRsi(z.y1))
        .attr('fill', z.fill);
    });

    // ── Reference lines at 70, 50, 30 ───────────────────
    [70, 50, 30].forEach(level => {
      const y = yRsi(level);
      svg.append('line')
        .attr('class', 'rsi-element')
        .attr('x1', 0).attr('x2', this.#config.svgWidth)
        .attr('y1', y).attr('y2', y)
        .attr('stroke', level === 50 ? (this.#colors.grid || '#2a3a4a') : (level === 70 ? '#ef5350' : '#26a69a'))
        .attr('stroke-width', level === 50 ? 1 : 0.8)
        .attr('stroke-dasharray', level === 50 ? '3,3' : '4,2')
        .attr('opacity', 0.6);

      svg.append('text')
        .attr('class', 'rsi-element')
        .attr('x', this.#config.svgWidth + 3)
        .attr('y', y + 3)
        .attr('fill', level === 70 ? '#ef5350' : level === 30 ? '#26a69a' : (this.#colors.tickColor || '#888'))
        .attr('font-size', '9px')
        .text(level);
    });

    // ── RSI line ──────────────────────────────────────────
    const line = d3.line()
      .x(d => this.#xScaleFunc(parseDate(d.Date)))
      .y(d => yRsi(d.value))
      .defined(d => d.value != null)
      .curve(d3.curveMonotoneX);

    svg.append('path')
      .attr('class', 'rsi-element')
      .attr('fill', 'none')
      .attr('stroke', '#b388ff')
      .attr('stroke-width', 1.5)
      .attr('opacity', 0.9)
      .attr('d', line(rsiData));

    // ── Current RSI value label ───────────────────────────
    const lastRsi = rsiData[rsiData.length - 1];
    if (lastRsi) {
      const rsiColor = lastRsi.value >= 70 ? '#ef5350' : lastRsi.value <= 30 ? '#26a69a' : '#b388ff';
      svg.append('text')
        .attr('class', 'rsi-element')
        .attr('x', this.#config.svgWidth + 3)
        .attr('y', yRsi(lastRsi.value) + 3)
        .attr('fill', rsiColor)
        .attr('font-size', '9px')
        .attr('font-weight', '700')
        .text(lastRsi.value.toFixed(1));
    }

    // ── Y axis ────────────────────────────────────────────
    const yRsiAxis = d3.axisRight(yRsi)
      .tickValues([30, 50, 70])
      .tickSize(0);

    svg.append('g')
      .attr('class', 'rsi-element')
      .attr('transform', `translate(${this.#config.svgWidth}, 0)`)
      .call(yRsiAxis)
      .selectAll('text').remove(); // labels already drawn above

    svg.select('.rsi-element.domain').remove();
  }

  #createToolsBtns() {

    createToolsBtns({ id: this.id, objectIDs: this.#objectIDs, getChartTypeIcon: () => this.#getChartTypeIcon() });

  }

  async #fetchSRLevels() {
    try {
      const res = await axios.post(
        `${ENV.BASE_API_URL}/api/sr-levels/`,
        {
          candles: this.#filteredData,
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("jwtToken")}`,
          },
        }
      );
      console.log("SR Levels:", res.data);
      this.#snrLevels = res.data.lines;
      this.#drawSRLevels();
    } catch (err) {
      console.error("SR Levels fetch error:", err);
    } finally {
      this.#srLevelsFetching = false;
    }
  }

  async #fetchCandlePattern() {
    try {
      const res = await axios.post(
        `${ENV.BASE_API_URL}/api/candle-pattern/`,
        {
          candles: this.#filteredData,
          trade_data: this.#annotationsData.map(a => ({
            date: a.Date,
            trade_type: a.transactionType
          })),
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("jwtToken")}`,
          },
        }
      );
      console.log("Candle Pattern:", res.data);
      this.#candlePattern = res.data;
    } catch (err) {
      console.error("Candle Pattern fetch error:", err);
    } finally {
      this.#candlePatternFetching = false;
    }
  }

  #modeHandler(mode) {

    this.#mode = mode;

    const btn0 = `#${this.#objectIDs.toolsBtnsContainer} #tools-btn-0`;
    const btn1 = `#${this.#objectIDs.toolsBtnsContainer} #tools-btn-1`;
    const btn2 = `#${this.#objectIDs.toolsBtnsContainer} #tools-btn-2`;
    const btn3 = `#${this.#objectIDs.toolsBtnsContainer} #tools-btn-3`;
    const btn4 = `#${this.#objectIDs.toolsBtnsContainer} #tools-btn-4`;
    const btn5 = `#${this.#objectIDs.toolsBtnsContainer} #tools-btn-5`;
    const btn6 = `#${this.#objectIDs.toolsBtnsContainer} #tools-btn-6`;

    // 🆕 Updated: Added btn4 in reset loop
    [btn0, btn1, btn2, btn3, btn4, btn5, btn6].forEach((selector) => {
      if (!document.querySelector(selector)) return;
      const svg = document.querySelector(`${selector} svg g g`) || document.querySelector(`${selector} svg`);
      svg?.setAttribute('fill', this.#colors.deActiveTools);
      d3.select(selector).style('border', `1px solid ${this.#colors.deActiveTools}`);
    });

    const activeBtn = {
      pan: btn2,
      zoom: btn1,
      draw: btn3,
      measure: btn4,
    }[mode];

    const activeSVG = document.querySelector(`${activeBtn} svg g g`) || document.querySelector(`${activeBtn} svg`);
    activeSVG?.setAttribute('fill', this.#colors.activeTools);
    d3.select(activeBtn).style('border', `1px solid ${this.#colors.activeTools}`);

  }


  #handleResetZoom() {
    this.#zoomRange1 =
      this.#minMaxDate[0].getTime() - this.#candleWidthDate / 2;

    // this.#zoomRange2 =
    //   this.#minMaxDate[1].getTime() + this.#candleWidthDate / 2;

    const totalRange =
      this.#minMaxDate[1].getTime() - this.#minMaxDate[0].getTime();

    this.#zoomRange2 =
      this.#minMaxDate[1].getTime() + totalRange * this.#rightOffsetFactor;


    this.#filteredData = this.data;
    this.#zoomFactor = 1;
    this.#removeAllLines();
    this.draw();
  }

  #xLineHandler(d, position) {
    let xPosition;
    if (position) xPosition = position;
    else xPosition = this.#xScaleFunc(parseDate(d.Date));

    let xLine = document.getElementById(this.#objectIDs.xLineSelectorId);

    if (xLine) {
      d3.select(xLine)
        .attr('x1', xPosition)
        .attr('y1', 0)
        .attr('x2', xPosition)
        .attr('y2', this.#config.svgHeight);
    } else {
      d3.select(`#${this.#objectIDs.svgId}`)
        .insert('line', `#${this.#objectIDs.xAxisId}`)
        .attr('id', this.#objectIDs.xLineSelectorId)
        .attr('stroke', this.#colors.selectorLine)
        .attr('stroke-dasharray', this.#config.selectoreStrokeDashArray)
        .attr('x1', xPosition)
        .attr('y1', 0)
        .attr('x2', xPosition)
        .attr('y2', this.#config.svgHeight);
    }
  }

  #xLabelHandler(d, position) {
    let xPosition;
    if (position) xPosition = position;
    else xPosition = this.#xScaleFunc(parseDate(d.Date));

    let xLabel = document.getElementById(this.#objectIDs.xLabelSelectorId);
    if (xLabel) {
      d3.select(xLabel).attr(
        'transform',
        `translate(
      ${xPosition >= this.#config.svgWidth - this.#config.xLabelWidth / 2
          ? this.#config.svgWidth - this.#config.xLabelWidth
          : xPosition <= this.#config.xLabelWidth / 2
            ? 0
            : xPosition - this.#config.xLabelWidth / 2
        },${this.#config.svgHeight})`
      );
      document.querySelector(
        `#${this.#objectIDs.xLabelSelectorId} text`
      ).innerHTML = d3.timeFormat(this.#config.timeFormat)(
        this.#xScaleFunc.invert(xPosition)
      );
    } else {
      d3.select(`#${this.#objectIDs.svgId}`)
        .append('g')
        .attr('id', this.#objectIDs.xLabelSelectorId)
        .attr(
          'transform',
          `translate(
          ${xPosition >= this.#config.svgWidth - this.#config.xLabelWidth / 2
            ? this.#config.svgWidth - this.#config.xLabelWidth
            : xPosition <= this.#config.xLabelWidth / 2
              ? 0
              : xPosition - this.#config.xLabelWidth / 2
          },${this.#config.svgHeight})`
        );

      d3.select(`#${this.#objectIDs.xLabelSelectorId}`)
        .append('rect')
        .attr('fill', this.#colors.selectorLableBackground)
        .attr('width', this.#config.xLabelWidth)
        .attr('height', this.#config.xLabelHeight);

      d3.select(`#${this.#objectIDs.xLabelSelectorId}`)
        .append('text')
        .style('font-size', `${this.#config.xLabelFontSize}px`)
        .attr('fill', this.#colors.selectorLabelText)
        .style('font-family', 'monospace')
        .attr('x', 10)
        .attr('y', 15);

      document.querySelector(
        `#${this.#objectIDs.xLabelSelectorId} text`
      ).innerHTML = d3.timeFormat(this.#config.timeFormat)(
        this.#xScaleFunc.invert(xPosition)
      );
    }
  }

  #yLineHandler(d, position) {
    let yLine = document.getElementById(this.#objectIDs.yLineSelectorId);
    if (yLine) {
      d3.select(yLine)
        .attr('x1', 0)
        .attr('y1', position)
        .attr('x2', this.#config.svgWidth)
        .attr('y2', position);
    } else {
      d3.select(`#${this.#objectIDs.svgId}`)
        .insert('line', `#${this.#objectIDs.xAxisId}`)
        .attr('id', this.#objectIDs.yLineSelectorId)
        .attr('stroke', this.#colors.selectorLine)
        .attr('stroke-dasharray', this.#config.selectoreStrokeDashArray)
        .attr('x1', 0)
        .attr('y1', position)
        .attr('x2', this.#config.svgHeight)
        .attr('y2', position);
    }
  }

  #yLabelHandler(d, position) {
    let yLabel = document.getElementById(this.#objectIDs.yLabelSelectorId);
    if (yLabel) {
      d3.select(yLabel).attr(
        'transform',
        `translate(${this.#config.svgWidth},
        ${position >= this.#config.svgHeight - this.#config.yLabelHeight / 2
          ? this.#config.svgHeight - this.#config.yLabelHeight
          : position <= this.#config.yLabelHeight / 2
            ? 0
            : position - this.#config.yLabelHeight / 2
        })`
      );
      document.querySelector(
        `#${this.#objectIDs.yLabelSelectorId} text`
      ).innerHTML = this.#yScaleFunc
        .invert(position)
        .toFixed(this.#config.decimal);
    } else {
      d3.select(`#${this.#objectIDs.svgId}`)
        .append('g')
        .attr('id', this.#objectIDs.yLabelSelectorId)
        .attr(
          'transform',
          `translate(${this.#config.svgWidth},
            ${position >= this.#config.svgHeight - this.#config.yLabelHeight / 2
            ? this.#config.svgHeight - this.#config.yLabelHeight
            : position <= this.#config.yLabelHeight / 2
              ? 0
              : position - this.#config.yLabelHeight / 2
          })`
        );

      d3.select(`#${this.#objectIDs.yLabelSelectorId}`)
        .append('rect')
        .attr('fill', this.#colors.selectorLableBackground)
        .attr('width', this.#config.yLabelWidth)
        .attr('height', this.#config.yLabelHeight);

      d3.select(`#${this.#objectIDs.yLabelSelectorId}`)
        .append('text')
        .style('font-size', `${this.#config.yLabelFontSize}px`)
        .attr('fill', this.#colors.selectorLabelText)
        .style('font-family', 'monospace')
        .attr('x', 5)
        .attr('y', 15);

      document.querySelector(
        `#${this.#objectIDs.yLabelSelectorId} text`
      ).innerHTML = this.#yScaleFunc.invert(position).toFixed(1);
    }
  }

  #candleInfoHandler(d) {

    if (this.#chartMode == 'line') return;

    let isUp = d.Open > d.Close;
    document.getElementById(this.#objectIDs.candleInfoId).innerHTML = `
    O <tspan style='fill:${isUp ? this.#colors.candleInfoTextUp : this.#colors.candleInfoTextDown
      }'>${d.Open.toFixed(this.#config.decimal)}</tspan> 
    H <tspan style='fill:${isUp ? this.#colors.candleInfoTextUp : this.#colors.candleInfoTextDown
      }'>${d.High.toFixed(this.#config.decimal)}</tspan> 
    L <tspan style='fill:${isUp ? this.#colors.candleInfoTextUp : this.#colors.candleInfoTextDown
      }'>${d.Low.toFixed(this.#config.decimal)}</tspan> 
    C <tspan style='fill:${isUp ? this.#colors.candleInfoTextUp : this.#colors.candleInfoTextDown
      }'>${d.Close.toFixed(this.#config.decimal)}</tspan>`;
    document.getElementById(
      this.#objectIDs.candleInfoIdBackground
    ).style.display = 'block';

    if (d.long || d.short) {
      let text = '';
      if (d.long) {
        text = `Long <tspan style='fill:${this.#colors.long}'> ${d.long.toFixed(
          this.#config.decimal
        )}</tspan>`;
      } else {
        text = `Short <tspan style='fill:${this.#colors.short
          }'> ${d.short.toFixed(this.#config.decimal)}</tspan>`;
      }
      text += ` SL <tspan style='fill:${this.#colors.sl}'> ${d.sl.toFixed(
        this.#config.decimal
      )}</tspan>`;
      text += ` TP <tspan style='fill:${this.#colors.tp}'> ${d.tp.toFixed(
        this.#config.decimal
      )}</tspan>`;

      document.getElementById(this.#objectIDs.candleInfoIdPosition).innerHTML =
        text;
      document.getElementById(
        this.#objectIDs.candleInfoIdBackgroundPosition
      ).style.display = 'block';
    }
  }

  #candleInfoLeaveHandler() {
    document.getElementById(this.#objectIDs.candleInfoId).innerHTML = ``;
    document.getElementById(
      this.#objectIDs.candleInfoIdBackground
    ).style.display = 'none';

    document.getElementById(
      this.#objectIDs.candleInfoIdPosition
    ).innerHTML = ``;
    document.getElementById(
      this.#objectIDs.candleInfoIdBackgroundPosition
    ).style.display = 'none';
  }

  #initPatternTooltip() {
    // Remove if exists
    d3.select(`#${this.id} .pattern-tooltip`).remove();

    d3.select(`#${this.id}`)
      .append("div")
      .attr("class", "pattern-tooltip")
      .style("position", "absolute")
      .style("display", "none")
      .style("background", "#0d1b2a")
      .style("border", "1px solid #1e3048")
      .style("border-radius", "8px")
      .style("padding", "10px 14px")
      .style("pointer-events", "none")
      .style("z-index", "9999")
      .style("font-size", "12px")
      .style("font-family", "sans-serif")
      .style("box-shadow", "0 4px 16px rgba(0,0,0,0.5)")
      .style("max-width", "220px")
      .style("line-height", "1.8");
  }

  #mouseMoveLockers(d, event) {
    this.#lockSelectorX = true;
    this.#xLineHandler(d);
    this.#xLabelHandler(d);
    this.#candleInfoHandler(d);

    // Pattern tooltip
    if (this.#candlePatternActive && this.#candlePattern?.patterns?.length) {
      const candleDate = new Date(d.Date).toDateString();
      const match = this.#candlePattern.patterns.find(
        p => new Date(p.trade_time).toDateString() === candleDate
      );

      if (match) {
        const score = match.score ?? 50;
        const scoreColor = score >= 70 ? "#00ff88"
          : score >= 40 ? "#FFD700"
            : "#ff4444";

        const patternNames = match.patterns?.length
          ? match.patterns.map(p => `<span style="color:${scoreColor}">${p}</span>`).join(", ")
          : `<span style="color:#aaa">No named pattern</span>`;

        const tooltip = d3.select(`#${this.id} .pattern-tooltip`);
        tooltip
          .style("display", "block")
          .html(`
          <div style="color:#fff; font-weight:600; margin-bottom:4px;">
            Candle Pattern
          </div>
          <div style="color:#aaa; margin-bottom:6px; font-size:11px;">
            ${match.description ?? ""}
          </div>
          <div style="margin-bottom:4px;">${patternNames}</div>
          <div style="margin-top:6px; border-top:1px solid #1e3048; padding-top:6px;">
            Score: <span style="color:${scoreColor}; font-weight:700; font-size:14px;">
              ${score}/100
            </span>
          </div>
        `);

        // Position near the candle
        const chartRect = document.getElementById(this.id).getBoundingClientRect();
        const x = this.#xScaleFunc(parseDate(d.Date));
        const y = this.#yScaleFunc(d.High);

        tooltip
          .style("left", `${x + 50}px`)
          .style("top", `${y - 10}px`);

      } else {
        d3.select(`#${this.id} .pattern-tooltip`).style("display", "none");
      }
    }
  }

  #mouseLeaveLocker(d) {
    this.#lockSelectorX = false;
    this.#candleInfoLeaveHandler();
    d3.select(`#${this.id} .pattern-tooltip`).style("display", "none");
  }

  #handleZoomBox() {

    let zoomBox1 = document.querySelector(`#${this.#objectIDs.zoomBoxId1}`);
    if (zoomBox1) zoomBox1.remove();

    let zoomBox2 = document.querySelector(`#${this.#objectIDs.zoomBoxId2}`);
    if (zoomBox2) zoomBox2.remove();

    let height = document.getElementById(`${this.#objectIDs.candleContainerId}`)
      .height.baseVal.value;
    let width = document.getElementById(`${this.#objectIDs.candleContainerId}`)
      .width.baseVal.value;

    d3.select(`#${this.#objectIDs.candleContainerId}`)
      .selectAll()
      .data([0])
      .enter()
      .append('rect')
      .attr('id', this.#objectIDs.zoomBoxId1)
      .attr(
        'width',
        this.#zoomPoint2 > this.#zoomPoint1
          ? this.#zoomPoint1
          : this.#zoomPoint2
      )
      .attr('x', 0)
      .attr('y', 0)
      .attr('height', height)
      .attr('fill', 'black')
      .attr('stroke', 'none')
      .style('opacity', 0.5);

    d3.select(`#${this.#objectIDs.candleContainerId}`)
      .selectAll()
      .data([0])
      .enter()
      .append('rect')
      .attr('id', this.#objectIDs.zoomBoxId2)
      .attr('width', width - this.#zoomPoint2)
      .attr(
        'x',
        this.#zoomPoint2 > this.#zoomPoint1
          ? this.#zoomPoint2
          : this.#zoomPoint1
      )
      .attr('y', 0)
      .attr('height', height)
      .attr('fill', 'black')
      .attr('stroke', 'none')
      .style('opacity', 0.5);

  }

  #handleZoom() {
    let zoomBox1 = document.querySelector(`#${this.#objectIDs.zoomBoxId1}`);
    if (zoomBox1) zoomBox1.remove();

    let zoomBox2 = document.querySelector(`#${this.#objectIDs.zoomBoxId2}`);
    if (zoomBox2) zoomBox2.remove();

    let minMaxZoom = d3.extent([this.#zoomPoint1, this.#zoomPoint2]);

    let leftDate = parseDate(this.#xScaleFunc.invert(minMaxZoom[0]));
    let rightDate = parseDate(this.#xScaleFunc.invert(minMaxZoom[1]));

    if (leftDate - rightDate === 0) {
      return;
    }

    let filteredData = this.data.filter((x) => {
      return (
        parseDate(x.Date).getTime() >
        leftDate.getTime() - this.#candleWidthDate &&
        parseDate(x.Date).getTime() <
        rightDate.getTime() + this.#candleWidthDate
      );
    });

    let oldZoomRange1 = this.#minMaxDate[0];
    let oldZoomRange2 = this.#minMaxDate[1];

    let newZoomRange1 = parseDate(this.#xScaleFunc.invert(minMaxZoom[0]));
    let newZoomRange2 = parseDate(this.#xScaleFunc.invert(minMaxZoom[1]));

    this.#zoomFactor =
      (oldZoomRange2 - oldZoomRange1) / (newZoomRange2 - newZoomRange1);

    this.#zoomRange1 = newZoomRange1;
    this.#zoomRange2 = newZoomRange2;

    this.#filteredData = filteredData;
    this.#mode = 'pan';
    this.draw();
  }

  #handlePan(location) {
    let dateWidth = this.#zoomRange2 - this.#zoomRange1;
    let width = document.getElementById(`${this.#objectIDs.candleContainerId}`)
      .width.baseVal.value;

    let fraction = location / width;

    let newZoomRange1 = this.#panTargetDate - fraction * dateWidth;
    let newZoomRange2 = newZoomRange1 + dateWidth;

    let filteredData = this.data.filter((x) => {
      return (
        parseDate(x.Date).getTime() > newZoomRange1 - this.#candleWidthDate &&
        parseDate(x.Date).getTime() < newZoomRange2 + this.#candleWidthDate
      );
    });

    this.#zoomRange1 = newZoomRange1;
    this.#zoomRange2 = newZoomRange2;

    this.#filteredData = filteredData;
    this.draw();
  }

  #handleDrawLine(location) {

    if (this.#mode !== 'draw' || this.#drawAndMeasureLocked) return;

    const svg = d3.select(`#${this.#objectIDs.svgId}`);

    if (!this.#drawPoint1) {
      this.#drawPoint1 = location;

      this.#tempLine = svg.append('line')
        .attr('x1', location.x)
        .attr('y1', location.y)
        .attr('x2', location.x)
        .attr('y2', location.y)
        .attr('stroke', this.#colors.lineColor)
        .attr('stroke-width', 1.5);
    } else {

      this.#drawPoint2 = { x: location.x, y: location.y };

      const lineData = {
        x1: this.#xScaleFunc.invert(this.#drawPoint1.x),
        y1: this.#yScaleFunc.invert(this.#drawPoint1.y),
        x2: this.#xScaleFunc.invert(this.#drawPoint2.x),
        y2: this.#yScaleFunc.invert(this.#drawPoint2.y),
      };
      this.#lineData.push(lineData);

      svg.append('line')
        .attr('x1', this.#drawPoint1.x)
        .attr('y1', this.#drawPoint1.y)
        .attr('x2', this.#drawPoint2.x)
        .attr('y2', this.#drawPoint2.y)
        .attr('stroke', this.#colors.lineColor)
        .attr('stroke-width', 1.5);

      // Remove temp line
      if (this.#tempLine) {
        this.#tempLine.remove();
      }

      requestAnimationFrame(() => {
        this.#drawPoint1 = null;
        this.#drawPoint2 = null;
        this.#tempLine = null;
        this.#drawAndMeasureLocked = false;
        this.#mode = 'pan';
      });

    }
  }

  #redrawCachedLines() {

    const svg = d3.select(`#${this.#objectIDs.svgId}`);

    svg.selectAll('.line').remove();

    d3.select(`#${this.#objectIDs.svgId}`)
      .selectAll('.user-line')
      .data(this.#lineData)
      .enter()
      .append('line')
      .attr('class', 'user-line')
      .attr('x1', d => this.#xScaleFunc(d.x1))
      .attr('y1', d => this.#yScaleFunc(d.y1))
      .attr('x2', d => this.#xScaleFunc(d.x2))
      .attr('y2', d => this.#yScaleFunc(d.y2))
      .attr('stroke', this.#colors.lineColor)
      .attr('stroke-width', 1.5);
  }

  #removeAllLines() {

    const svg = d3.select(`#${this.#objectIDs.svgId}`);
    svg.selectAll('user-line').remove();
    this.#lineData = [];
  }


  #handleMeasure(location) {

    if (this.#mode !== 'measure' || this.#drawAndMeasureLocked) return;

    const svg = d3.select(`#${this.#objectIDs.svgId}`);

    if (!this.#measureState.start) {
      svg.selectAll('.measure-rect').remove();
      svg.selectAll('.measure-label').remove();

      this.#measureState.start = location;

      this.#measureState.rect = svg.append('rect')
        .attr('class', 'measure-rect')
        .attr('x', location.x)
        .attr('y', location.y)
        .attr('width', 0)
        .attr('height', 0)
        .attr('fill', 'rgba(0,255,0,0.2)')
        .attr('stroke', 'lime')
        .attr('stroke-width', 1);

      this.#measureState.label = svg.append('text')
        .attr('class', 'measure-label')
        .attr('x', location.x)
        .attr('y', location.y - 8)
        .attr('fill', 'white')
        .attr('font-size', '12px');

      d3.select(`#${this.#objectIDs.svgId}`)
        .on('mousemove.measure', (event) => {
          const current = getCursorPoint(this.#objectIDs.svgId, event);
          if (!this.#drawAndMeasureLocked) {
            this.#updateMeasureBox(current);
          }
        });

    } else {
      
      this.#drawAndMeasureLocked = true;
      d3.select(`#${this.#objectIDs.svgId}`).on('mousemove.measure', null);

      this.#measureState.start = null;
      this.#measureState.rect = null;
      this.#measureState.label = null;
      this.#drawAndMeasureLocked = false;
      this.#mode = 'pan';
    }
  }

  #updateMeasureBox(current) {

    const { start, rect, label } = this.#measureState;

    const x = Math.min(start.x, current.x);
    const y = Math.min(start.y, current.y);
    const width = Math.abs(current.x - start.x);
    const height = Math.abs(current.y - start.y);

    rect.attr('x', x).attr('y', y).attr('width', width).attr('height', height);

    const priceA = this.#yScaleFunc.invert(start.y);
    const priceB = this.#yScaleFunc.invert(current.y);
    const diff = priceB - priceA;
    const percent = ((diff / priceA) * 100).toFixed(2);

    const fillColor = priceB > priceA ? 'rgba(0,255,0,0.2)' : 'rgba(255,0,0,0.2)';
    const strokeColor = priceB > priceA ? 'lime' : 'red';

    rect.attr('x', x)
      .attr('y', y)
      .attr('width', width)
      .attr('height', height)
      .attr('fill', fillColor)
      .attr('stroke', strokeColor);

    // 🔥 Get time-based data
    const timeA = this.#xScaleFunc.invert(start.x);
    const timeB = this.#xScaleFunc.invert(current.x);
    const bars = this.#filteredData.filter(d => {
      const date = new Date(d.Date);
      return date >= timeA && date <= timeB || date >= timeB && date <= timeA;
    });

    const numBars = bars.length;
    const numDays = Math.abs((timeB - timeA) / (1000 * 60 * 60 * 24)).toFixed(1);

    label
      .attr('x', x + width / 2)
      .attr('y', y - 8)
      .text(`${diff.toFixed(2)} (${percent}%) | ${numBars} bars | ${numDays} days`);
  }


  #drawStaticAnnotationFromData() {
    const data = this.#annotationsData;
    if (!data?.length) return;

    const parseTime = d => new Date(d);
    const formatTime = d3.timeFormat("%Y-%m-%d");

    const customType = annotationCustomType(annotationCalloutCurve, {
      className: "custom",
      connector: {
        type: "elbow",
        end: "arrow",
      },
      note: {
        align: "middle",
        wrap: 400,
        lineType: null,
        line: []
      }
    });

    const tempPlacedBoxes = [];

    const makeAnnotation = annotation()
      .editMode(true)
      .notePadding(15)
      .type(customType)
      .accessors({
        x: d => this.#xScaleFunc(parseTime(d.Date)),
        y: d => this.#yScaleFunc(d.Close)
      })
      .accessorsInverse({
        Date: d => formatTime(this.#xScaleFunc.invert(d.x)),
        Close: d => this.#yScaleFunc.invert(d.y)
      })
      .annotations(
        data.map(d => {

          const override = this.#annotationCache.get(d.id) || {};

          let dx, dy;
          if (override.dx !== undefined) {
            dx = override.dx;
            dy = override.dy;
          } else {
            // base offsets
            dx = d.transactionType === "buy" ? -150 : 150;
            dy = d.transactionType === "buy" ? 50 : -50;

            // get anchor position on chart
            const ax = this.#xScaleFunc(parseTime(d.Date));
            const ay = this.#yScaleFunc(d.Close);

            // resolve overlap with previous annotations
            const prev = tempPlacedBoxes;
            const resolved = placeWithoutOverlap({ x: ax, y: ay, dx, dy }, prev);

            dx = resolved.dx;
            dy = resolved.dy;

            // store box for next iterations
            tempPlacedBoxes.push({ x: ax + dx, y: ay + dy, w: 150, h: 60 });
          }


          return {
            note: {
              title: d.title || `₹${d.Close}`,
              label: d.label || '',
              align: 'middle',
              wrap: 150
            },
            data: d,
            dx,
            dy,
            subject: {
              radius: 20,
              radiusPadding: 5
            },
            color: this.#colors.annotationLineColor,
            disable: ['subject']
          };
        })
      ).on("dragend", ann => {
        this.#annotationCache.set(ann.data.id, { dx: ann.dx, dy: ann.dy });
      });


    const group = d3.select(`#${this.#objectIDs.candleContainerId}`)
      .style("touch-action", "none") // critical for touch drag
      .style("z-index", 100)
      .append("g")
      .attr("class", "annotation-group")
      .call(makeAnnotation)
      .raise();

    // drawTradeGradientAreas(this, group);
    modifyAnnotationEnd(group, this.#colors);

  }

  #handleScrollZoom(e) {

    let location = getCursorPoint(this.#objectIDs.svgId, e.sourceEvent);

    this.#zoomFactor *= e.transform.k > 1 ? 1.1 : 0.9;

    // 🔧 Clamp zoomFactor between 1 candle and full data
    const totalCandles = this.data.length;
    const minZoom = totalCandles + 100;
    const maxZoom = 1;
    this.#zoomFactor = Math.min(totalCandles / maxZoom, Math.max(this.#zoomFactor, totalCandles / minZoom));


    let width = parseDate(this.#minMaxDate[1]) - parseDate(this.#minMaxDate[0]);
    let newWidth = Math.round(width / this.#zoomFactor);

    let svgWidth = document.getElementById(
      `${this.#objectIDs.candleContainerId}`
    ).width.baseVal.value;

    let target = this.#xScaleFunc.invert(location.x).getTime();
    let coeff = Math.round((newWidth * location.x) / svgWidth);
    let left = target - coeff;
    let right = left + newWidth;

    this.#zoomRange1 = left;
    this.#zoomRange2 = right;
    // this.#zoomRange2 += (right - this.#zoomRange1) * this.#rightOffsetFactor;


    let filteredData = this.data.filter((x) => {
      return (
        parseDate(x.Date).getTime() > left - this.#candleWidthDate &&
        parseDate(x.Date).getTime() < right + this.#candleWidthDate
      );
    });

    this.#filteredData = filteredData;

    this.draw();
  }

  #handleMouseMove(e, d) {

    let location = getCursorPoint(this.#objectIDs.svgId, e);

    if (location.x > this.#config.width) location.x = this.#config.width;
    if (location.y > this.#config.height) location.y = this.#config.svgHeight;

    //x line
    if (!this.#lockSelectorX) this.#xLineHandler(d, location.x);

    //y line
    this.#yLineHandler(d, location.y);

    //x label
    if (!this.#lockSelectorX) {
      this.#xLabelHandler(d, location.x);
    }

    //y label
    this.#yLabelHandler(d, location.y);

    if (this.#mode === 'draw' && this.#drawPoint1 && !this.#drawPoint2 && this.#tempLine) {

      // Update temp line dynamically
      this.#tempLine
        .attr('x1', this.#drawPoint1.x)
        .attr('y1', this.#drawPoint1.y)
        .attr('x2', location.x)
        .attr('y2', location.y);

    }

    if (this.#isMouseDown && this.#mode === 'zoom') {
      this.#zoomPoint2 = location.x;
      this.#handleZoomBox();
    } else if (this.#isMouseDown && this.#mode === 'pan') {
      this.#handlePan(location.x);
    }

  }

  #handleMouseLeave() {
    let xLine = document.getElementById(this.#objectIDs.xLineSelectorId);
    let yLine = document.getElementById(this.#objectIDs.yLineSelectorId);
    let xLabel = document.getElementById(this.#objectIDs.xLabelSelectorId);
    let yLabel = document.getElementById(this.#objectIDs.yLabelSelectorId);

    if (xLine) xLine.remove();
    if (yLine) yLine.remove();
    if (xLabel) xLabel.remove();
    if (yLabel) yLabel.remove();
  }

  #handleMouseDown(e) {
    this.#isMouseDown = true;
    let location = getCursorPoint(this.#objectIDs.svgId, e);
    if (this.#mode === 'zoom') {
      this.#zoomPoint1 = location.x;
    } else if (this.#mode === 'pan') {
      this.#panTargetDate = this.#xScaleFunc.invert(location.x).getTime();
    }

  }

  #handleMouseUp() {
    this.#isMouseDown = false;
    if (this.#mode === 'zoom') {
      this.#handleZoom();
      this.#zoomPoint1 = 0;
      this.#zoomPoint2 = 0;
    } else if (this.#mode === 'pan') {
      this.#panTargetDate = 0;
    }
  }

  #addEventListeners() {

    let thisProxy = this;

    d3.selectAll(`#${this.#objectIDs.candleContainerId} .candle`)
      .on('mouseover', function (e, d) {
        thisProxy.#mouseMoveLockers(d);
      })
      .on('mouseleave', (e, d) => {
        thisProxy.#mouseLeaveLocker(d);
      });

    d3.selectAll(`#${this.#objectIDs.candleContainerId} .candle-locker`)
      .on('mouseover', function (e, d) {
        thisProxy.#mouseMoveLockers(d);
      })
      .on('mouseleave', (e, d) => {
        thisProxy.#mouseLeaveLocker(d);
      });

    d3.selectAll(`#${this.#objectIDs.candleContainerId} .sl`)
      .on('mouseover', function (e, d) {
        thisProxy.#mouseMoveLockers(d);
      })
      .on('mouseleave', (e, d) => {
        thisProxy.#mouseLeaveLocker(d);
      });

    d3.selectAll(`#${this.#objectIDs.candleContainerId} .tp`)
      .on('mouseover', function (e, d) {
        thisProxy.#mouseMoveLockers(d);
      })
      .on('mouseleave', (e, d) => {
        thisProxy.#mouseLeaveLocker(d);
      });

    d3.selectAll(`#${this.#objectIDs.candleContainerId} .short`)
      .on('mouseover', function (e, d) {
        thisProxy.#mouseMoveLockers(d);
      })
      .on('mouseleave', (e, d) => {
        thisProxy.#mouseLeaveLocker(d);
      });

    d3.selectAll(`#${this.#objectIDs.candleContainerId} .long`)
      .on('mouseover', function (e, d) {
        thisProxy.#mouseMoveLockers(d);
      })
      .on('mouseleave', (e, d) => {
        thisProxy.#mouseLeaveLocker(d);
      });

    d3.select(`#${this.#objectIDs.candleContainerId}`).on(
      'mouseleave',
      function (e, d) {
        thisProxy.#handleMouseLeave();
      }
    );

    d3.select(`#${this.#objectIDs.candleContainerId}`).on(
      'mousedown',
      function (e, d) {
        thisProxy.#handleMouseDown(e);
      }
    );

    d3.select(`#${this.#objectIDs.candleContainerId}`).on(
      'mouseup',
      function (e, d) {
        thisProxy.#handleMouseUp();
      }
    );

    d3.select(`#${this.#objectIDs.candleContainerId}`).on(
      'touchstart',
      function (e, d) {
        thisProxy.#handleMouseDown(e);
      }
    );

    d3.select(`#${this.#objectIDs.candleContainerId}`).on(
      'touchend',
      function (e, d) {
        thisProxy.#handleMouseUp();
      }
    );

    d3.select(`#${this.#objectIDs.candleContainerId}`).on('mousemove', (event, d) => {
      thisProxy.#handleMouseMove(event, d);
    });

    d3.select(`#${this.#objectIDs.candleContainerId}`).on('touchmove', (event, d) => {
      thisProxy.#handleMouseMove(event, d);
    });


    d3.select(`#${this.#objectIDs.candleContainerId}`).on('click', (e, d) => {
      const location = getCursorPoint(this.#objectIDs.svgId, e);
      if (this.#mode === 'measure') {
        this.#handleMeasure(location);
      } else if (this.#mode === 'draw') {
        this.#handleDrawLine(location);
      }
    });

    d3.select(`#${this.#objectIDs.toolsBtnsContainer} #tools-btn-reset`)
      .on('click', () => this.#handleResetZoom());

    d3.select(`#${this.#objectIDs.toolsBtnsContainer} #tools-btn-chartmode`)
      .on('click', () => {
        this.toggleChartMode();
        // Refresh the icon after toggle
        d3.select(`#${this.#objectIDs.toolsBtnsContainer} #tools-btn-chartmode`)
          .html(this.#getChartTypeIcon());
      });

    d3.select(`#${this.#objectIDs.toolsBtnsContainer}-dropdown #tools-menu-zoom`)
      .on('click', () => { this.#modeHandler('zoom'); this.#closeMenu(); });

    d3.select(`#${this.#objectIDs.toolsBtnsContainer}-dropdown #tools-menu-pan`)
      .on('click', () => { this.#modeHandler('pan'); this.#closeMenu(); });

    d3.select(`#${this.#objectIDs.toolsBtnsContainer}-dropdown #tools-menu-draw`)
      .on('click', () => { this.#modeHandler('draw'); this.#closeMenu(); });

    d3.select(`#${this.#objectIDs.toolsBtnsContainer}-dropdown #tools-menu-measure`)
      .on('click', () => { this.#modeHandler('measure'); this.#closeMenu(); });

    d3.select(`#${this.#objectIDs.toolsBtnsContainer}-dropdown #tools-menu-share`)
      .on('click', () => { this.shareChartScreenshot(); this.#closeMenu(); });


    let zoom = d3.zoom().on('zoom', function (e) {
      thisProxy.#handleScrollZoom(e);
    });

    d3.select(`#${this.#objectIDs.svgId}`)
      .call(zoom)
      .on('mousedown.zoom', null)
      .on('touchstart.zoom', null)
      .on('touchmove.zoom', null)
      .on('touchend.zoom', null);
  }

  #closeMenu() {
    d3.select(`#${this.#objectIDs.toolsBtnsContainer}-dropdown`).style('display', 'none');
  }

  #removeEventListeners() {

    if (!this.#objectIDs.candleContainerId) return;

    d3.selectAll(`#${this.#objectIDs.candleContainerId} .candle`)
      .on('mouseover', this.#noop)
      .on('mouseleave', this.#noop);

    d3.selectAll(`#${this.#objectIDs.candleContainerId} .candle-locker`)
      .on('mouseover', this.#noop)
      .on('mouseleave', this.#noop);

    d3.selectAll(`#${this.#objectIDs.candleContainerId} .sl`)
      .on('mouseover', this.#noop)
      .on('mouseleave', this.#noop);

    d3.selectAll(`#${this.#objectIDs.candleContainerId} .tp`)
      .on('mouseover', this.#noop)
      .on('mouseleave', this.#noop);

    d3.selectAll(`#${this.#objectIDs.candleContainerId} .short`)
      .on('mouseover', this.#noop)
      .on('mouseleave', this.#noop);

    d3.selectAll(`#${this.#objectIDs.candleContainerId} .long`)
      .on('mouseover', this.#noop)
      .on('mouseleave', this.#noop);

    d3.select(`#${this.#objectIDs.candleContainerId}`).on('mousemove', null);

    d3.select(`#${this.#objectIDs.candleContainerId}`).on('mouseleave', null);

    d3.select(`#${this.#objectIDs.candleContainerId}`).on('mousedown', null);

    d3.select(`#${this.#objectIDs.candleContainerId}`).on('mouseup', null);

    d3.select(`#${this.#objectIDs.toolsBtnsContainer} #tools-btn-0`).on(
      'click',
      null
    );

    d3.select(`#${this.#objectIDs.toolsBtnsContainer} #tools-btn-1`).on(
      'click',
      null
    );
    d3.select(`#${this.#objectIDs.toolsBtnsContainer} #tools-btn-2`).on(
      'click',
      null
    );

    d3.select(`#${this.#objectIDs.toolsBtnsContainer} #tools-btn-3`).on(
      'click',
      null
    );

    d3.select(`#${this.#objectIDs.toolsBtnsContainer} #tools-btn-4`).on(
      'click',
      null
    );


    d3.zoom().on('zoom', null);
  }

  #renderBrush() {

    if (this.#isPnLWindowClosed) return;

    const svg = d3.select(`#${this.#objectIDs.svgId}`);
    const height = this.#config.svgHeight;
    const width = this.#config.svgWidth;

    let winX = width * 0.1;
    let winWidth = width * 0.12;

    const handleW = 5;
    const handleHeight = height * 0.2;
    const handleYOffset = (height - handleHeight) / 2;
    const minWidth = handleW * 2 + 6;
    const closeSize = 14;
    const gripDotR = 1.8;
    const gripSpacing = 6;

    // top layer
    let brushLayer = svg.select(`#${this.id}-brush-layer`);
    if (brushLayer.empty()) {
      brushLayer = svg.append("g").attr("id", `${this.id}-brush-layer`);
    } else {
      brushLayer.selectAll("*").remove();
    }
    brushLayer.raise();

    // window
    const windowRect = brushLayer.append("rect")
      .attr("y", 0)
      .attr("height", height)
      .attr("rx", 2)
      .attr("fill", "rgba(20,228,107,0.01)")
      .attr("stroke", "#888")
      .attr("cursor", "grab");

    // ── Left Handle ───────────────────────────────────────
    const leftHandleGroup = brushLayer.append("g")
      .attr("class", "brush-handle-left")
      .style("cursor", "ew-resize");

    leftHandleGroup.append("rect")
      .attr("y", handleYOffset)
      .attr("width", handleW)
      .attr("height", handleHeight)
      .attr("rx", 3)
      .attr("fill", "rgba(34, 211, 238, 0.85)")
      .attr("stroke", "#fff")
      .attr("stroke-width", 0.5);

    [-gripSpacing, 0, gripSpacing].forEach(offset => {
      leftHandleGroup.append("circle")
        .attr("r", gripDotR)
        .attr("cx", handleW / 2)
        .attr("cy", handleYOffset + handleHeight / 2 + offset)
        .attr("fill", "rgba(0,0,0,0.5)");
    });

    leftHandleGroup
      .on("mouseenter", function () {
        d3.select(this).select("rect")
          .attr("fill", "rgba(34, 211, 238, 1)")
          .attr("stroke-width", 1.5);
      })
      .on("mouseleave", function () {
        d3.select(this).select("rect")
          .attr("fill", "rgba(34, 211, 238, 0.85)")
          .attr("stroke-width", 0.5);
      });

    // ── Right Handle ──────────────────────────────────────
    const rightHandleGroup = brushLayer.append("g")
      .attr("class", "brush-handle-right")
      .style("cursor", "ew-resize");

    rightHandleGroup.append("rect")
      .attr("y", handleYOffset)
      .attr("width", handleW)
      .attr("height", handleHeight)
      .attr("rx", 3)
      .attr("fill", "rgba(34, 211, 238, 0.85)")
      .attr("stroke", "#fff")
      .attr("stroke-width", 0.5);

    [-gripSpacing, 0, gripSpacing].forEach(offset => {
      rightHandleGroup.append("circle")
        .attr("r", gripDotR)
        .attr("cx", handleW / 2)
        .attr("cy", handleYOffset + handleHeight / 2 + offset)
        .attr("fill", "rgba(0,0,0,0.5)");
    });

    rightHandleGroup
      .on("mouseenter", function () {
        d3.select(this).select("rect")
          .attr("fill", "rgba(34, 211, 238, 1)")
          .attr("stroke-width", 1.5);
      })
      .on("mouseleave", function () {
        d3.select(this).select("rect")
          .attr("fill", "rgba(34, 211, 238, 0.85)")
          .attr("stroke-width", 0.5);
      });

    // ── Close Button ──────────────────────────────────────
    const closeBtn = brushLayer.append("g")
      .attr("cursor", "pointer")
      .on("pointerdown", e => e.stopPropagation())
      .on("click", () => {
        this.#isPnLWindowClosed = true;
        brushLayer.remove();
        this.draw();
      });

    closeBtn.append("circle")
      .attr("r", closeSize / 2)
      .attr("fill", "rgba(40,40,40,0.85)");

    closeBtn.append("path")
      .attr("d", "M -4 -4 L 4 4 M -4 4 L 4 -4")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.6)
      .attr("stroke-linecap", "round");

    // block pan
    brushLayer.selectAll("*")
      .on("pointerdown", e => e.stopPropagation());

    // ── Update ────────────────────────────────────────────
    const update = () => {
      winX = Math.round(winX);
      winWidth = Math.round(winWidth);

      windowRect
        .attr("x", winX)
        .attr("width", winWidth);

      leftHandleGroup.attr("transform", `translate(${winX - handleW / 2}, 0)`);
      rightHandleGroup.attr("transform", `translate(${winX + winWidth - handleW / 2}, 0)`);

      closeBtn.attr(
        "transform",
        `translate(${winX + winWidth - closeSize / 2 - 4},${closeSize / 2 + 4})`
      );

      drawBrushGradient(winX, winWidth, brushLayer, this.getChartData(), this.getAnnotationsData(), this.#objectIDs.svgId, this.getXScaleFunc(), this.getYScaleFunc());
    };

    update();

    // ── Drag: Window ──────────────────────────────────────
    windowRect.call(
      d3.drag()
        .on("start", e => e.sourceEvent.stopPropagation())
        .on("drag", e => {
          winX = Math.max(0, Math.min(width - winWidth, e.x));
          update();
        })
    );

    // ── Drag: Left Handle ─────────────────────────────────
    leftHandleGroup.call(
      d3.drag()
        .on("start", e => e.sourceEvent.stopPropagation())
        .on("drag", e => {
          const newX = Math.max(0, Math.min(winX + winWidth - minWidth, e.x));
          winWidth += winX - newX;
          winX = newX;
          update();
        })
    );

    // ── Drag: Right Handle ────────────────────────────────
    rightHandleGroup.call(
      d3.drag()
        .on("start", e => e.sourceEvent.stopPropagation())
        .on("drag", e => {
          winWidth = Math.max(minWidth, Math.min(width - winX, e.x - winX));
          update();
        })
    );
  }


  #renderPnLToggleButton() {

    if (!this.#isPnLWindowClosed) return;

    const svg = d3.select(`#${this.#objectIDs.svgId}`);
    const height = this.#config.svgHeight;
    const width = this.#config.svgWidth;

    // prevent duplicate
    if (!svg.select(`#${this.id}-pnl-btn`).empty()) return;

    const btnGroup = svg.append("g")
      .attr("id", `${this.id}-pnl-btn`)
      .attr("transform", `translate(${width - 40}, ${height / 2 - 70})`) // more space from edge
      .attr("cursor", "pointer")
      .on("pointerdown", e => e.stopPropagation())
      .on("click", () => {
        this.#isPnLWindowClosed = !this.#isPnLWindowClosed;
        this.draw();
      });

    // Button background
    btnGroup.append("rect")
      .attr("width", 20)
      .attr("height", 160)
      .attr("rx", 4)
      .attr("fill", "#1f2933")
      .attr("stroke", "#3b82f6")
      .attr("stroke-width", 1.5)
      .style("filter", "drop-shadow(0 4px 8px rgba(0,0,0,0.4))");

    // Rotated text
    btnGroup.append("text")
      .attr("x", 15)
      .attr("y", 77)
      .attr("fill", "#fff")
      .attr("font-size", 14)
      .attr("font-weight", 300)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("transform", "rotate(-90, 15, 80)")
      .text("💰 View P&L Now");

  }


  setColors(colorObj) {
    for (const key in colorObj) {
      let color = colorObj[key];
      this.#colors[key] = color;
    }
  }

  setConfig(configObj) {
    for (const key in configObj) {
      let config = configObj[key];
      this.#config[key] = config;
    }

    this.#calculateExtendConfigs();
  }

  getColors() {
    return this.#colors;
  }

  getConfig() {
    return {
      candleTailWidth: this.#config.candleTailWidth,
      width: this.#config.width,
      height: this.#config.height,
      xLabelFontSize: this.#config.xLabelFontSize,
      yLabelFontSize: this.#config.yLabelFontSize,
      decimal: this.#config.decimal,
      timeFormat: this.#config.timeFormat,
    };
  }

  destroy() {
    this.#removeEventListeners();
    if (document.getElementById(this.#objectIDs.svgId))
      document.getElementById(this.#objectIDs.svgId).remove();
  }

  draw() {

    this.#calculateExtendConfigs();
    this.destroy();
    this.#createLayout();
    this.#calculateXscale();
    this.#calculateYscale();
    this.#calculateCandleWidth();
    this.#createYaxis();
    this.#createXaxis();
    this.#createInfoText();
    this.#createLockerGroup();
    this.#createLockerBody();
    this.#createCandlesGroup();
    this.#createCandlesBody();
    this.#createCandlesHigh();
    this.#createCandlesLow();
    if (this.#candlePatternActive) this.#highlightPatternCandles();
    this.#addEventListeners();
    this.#drawStaticAnnotationFromData();
    this.#redrawCachedLines();
    this.#drawEMALines();
    if (this.#showVolume) this.#drawVolumeChart();
    if (this.#showRSI) this.#drawRSIPanel();
    this.#renderBrush();
    this.#renderPnLToggleButton();
    this.#initPatternTooltip();

  }

}

export default CandleStickChart;