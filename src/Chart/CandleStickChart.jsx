import * as d3 from 'd3';
import domtoimage from 'dom-to-image-more';
import {
  annotation,
  annotationCalloutCurve,
  annotationCustomType,
} from 'd3-svg-annotation';
import { toBlob } from 'html-to-image';
import axios from 'axios';
import ENV from "../config";

import { colors, config, getCursorPoint, parseDate, modifyAnnotationEnd, createToolsBtns } from './CandleStickChartUtils.jsx';
import { placeWithoutOverlap, drawBrushGradient } from './Utils';

/**
 * CandleStickChart
 * ------------------------------------------------------------------
 * Refactor goals vs the previous version:
 *   1. PERFORMANCE
 *      - Cache the root <svg> D3 selection instead of re-querying the
 *        DOM by id string dozens of times per interaction.
 *      - Throttle continuous input (pan drag / wheel zoom) to one
 *        redraw per animation frame instead of one redraw per event.
 *      - Avoid recomputing expensive derived series (RSI/EMA) unless
 *        the underlying dataset actually changed.
 *   2. STRUCTURE
 *      - Grouped into clearly commented sections: layout, scales,
 *        axes, series rendering, overlays, interaction, brush/PnL,
 *        sharing, and public API.
 *      - Small single-purpose private methods instead of long
 *        monolithic ones.
 *   3. MOBILE RESPONSIVENESS
 *      - Central `#isMobile()` check driven by the chart's own
 *        rendered width (not just window size), used consistently
 *        across padding, font sizes, tick counts, touch target
 *        sizes, and tooltip placement.
 *      - Tooltip and PnL/brush handles get larger hit targets and
 *        clamp themselves inside the viewport on small screens.
 *   4. BUGFIXES carried over from the previous implementation
 *      - Removed duplicate `getChartMode()` definition.
 *      - Fixed the horizontal crosshair line's x2 attribute (was
 *        incorrectly using svgHeight instead of svgWidth).
 */
class CandleStickChart {

  // ── Core state ──────────────────────────────────────────
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
  #isPaid = false;
  #isDemo;

  #candlePattern = null;
  #candlePatternFetching = false;
  #candlePatternActive = false;
  #brushState = null;

  #ema9 = null;
  #ema21 = null;
  #ema50 = null;
  #ema200 = null;

  // -- Device / layout state --------------
  #isFullscreen = false;
  #rotatePromptEl = null;

  // ── Panel layout (fractions of total SVG height) ───────
  #PANEL_GAP = 4;
  #showVolume = false;
  #showRSI = false;
  #priceH = 0;
  #volumeH = 0;
  #rsiH = 0;
  #volumeTop = 0;
  #rsiTop = 0;
  #totalSvgH = 0;
  #rsiData = [];

  // ── Cached DOM/D3 handles (perf) ───────────────────────
  #svg = null;                 // cached d3 selection of the root chart <svg>
  #panRAF = null;               // rAF handle for throttled panning
  #zoomRAF = null;              // rAF handle for throttled wheel zoom
  #pendingPanLocation = null;
  #pendingZoomEvent = null;
  #isMobileFlag = false;        // recalculated whenever layout changes

  #noop = () => { };

  constructor(width, height, data, stockAnnotationsData, id, theme = "dark", isPaid, isDemo = false) {
    this.#isDemo = isDemo;
    this.#theme = theme;
    this.#colors = colors(theme);
    this.#config = config(width, height);
    this.#maxPrice = d3.max(data.map((x) => x.High));
    this.data = data.sort((a, b) => parseDate(a) - parseDate(b));
    this.#annotationsData = stockAnnotationsData;
    this.#filteredData = data;
    this.id = id;
    this.#isPaid = isPaid;
    this.#lockSelectorX = false;

    this.#calculateExtendConfigs();
    this.#setObjectIDs();

    const minMaxDate = d3.extent(data.map((x) => parseDate(x.Date)));
    this.#calculateCandleWidthDate();
    this.#minMaxDate = minMaxDate;
    this.#zoomRange1 = minMaxDate[0].getTime() - this.#candleWidthDate / 2;

    const totalRange = minMaxDate[1].getTime() - minMaxDate[0].getTime();
    const rightPadding = totalRange * this.#rightOffsetFactor;
    this.#zoomRange2 = minMaxDate[1].getTime() + rightPadding;

    this.#createToolsBtns();
    this.#measureState = { active: false, start: null, rect: null, label: null };

    this.#modeHandler('pan');
    this.#chartMode = 'line';
    this.#rsiData = this.#calculateRSI(14);

    this.#bindExternalToolEvents();
    this.#bindFullscreenEvents();
  }

  // ============================================================
  // PUBLIC ACCESSORS
  // ============================================================

  getChartMode() { return this.#chartMode; }
  getAnnotationsData() { return this.#annotationsData; }
  getObjectIDs() { return this.#objectIDs; }
  getYScaleFunc() { return this.#yScaleFunc; }
  getXScaleFunc() { return this.#xScaleFunc; }
  getChartData() { return this.#filteredData; }
  setAnnotations(annotations) { this.#annotationsData = annotations; }

  toggleChartMode() {
    this.#chartMode = this.#chartMode === 'candlestick' ? 'line' : 'candlestick';
    this.draw();
  }

  setCandlestickPatternMode() {
    this.#chartMode = 'candlestickpatter';
    this.draw();
  }

  setData(newData) {
    this.data = newData;
    this.#filteredData = newData;
    this.#rsiData = this.#calculateRSI(14);
    this.destroy();
    this.draw();
  }

  setColors(colorObj) {
    Object.assign(this.#colors, colorObj);
  }

  setConfig(configObj) {
    Object.assign(this.#config, configObj);
    this.#calculateExtendConfigs();
  }

  getColors() { return this.#colors; }

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
    this.#cancelPendingFrames();
    this.#removeEventListeners();
    if (document.getElementById(this.#objectIDs.svgId)) {
      document.getElementById(this.#objectIDs.svgId).remove();
    }
    this.#svg = null;
  }

  /** Full rebuild — the source of truth render pass. */
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
    this.#renderFullscreenButton();

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

  // ============================================================
  // MOBILE / RESPONSIVE HELPERS
  // ============================================================

  /** Chart is "mobile" based on its own rendered width, not the window,
   *  so embedded/split-screen usages behave correctly too. */
  #isMobile() {
    return this.#isMobileFlag;
  }

  #recalculateMobileFlag() {
    this.#isMobileFlag = this.#config.width <= this.#config.mobileBreakPoint;
  }

  // ============================================================
  // CONFIG / LAYOUT CALCULATIONS
  // ============================================================

  #calculateInfoTextWidth() {
    this.#config.infoTextWidth =
      (this.#maxPrice.toFixed(this.#config.decimal).toString().length * 4 + 11) *
      this.#config.charWidth;
  }

  #calculateInfoTextWidthMeta() {
    this.#config.infoTextWidthMeta =
      (this.#maxPrice.toFixed(this.#config.decimal).toString().length * 3 + 14) *
      this.#config.charWidth;
  }

  #calculateYLabelWidth() {
    this.#config.yLabelWidth =
      2.4 + this.#maxPrice.toFixed(this.#config.decimal).toString().length * this.#config.charWidth;
  }

  #calculatePaddingRight() {
    this.#config.paddingRight = this.#config.yLabelWidth * 0.1;
  }

  #calculatePaddingLeft() {
    this.#config.paddingLeft = this.#config.xLabelWidth * (this.#isMobile() ? 0.18 : 0.3);
  }

  #calculateSvgWidth() {
    this.#config.svgWidth =
      this.#config.width - (this.#config.paddingLeft + this.#config.paddingRight) - 2;
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
    // On mobile, give the price panel a bit more room since sub-panels
    // are harder to read on small screens.
    const mobile = this.#isMobile();

    if (hasVol && hasRSI) return mobile ? { price: 0.62, vol: 0.19, rsi: 0.19 } : { price: 0.70, vol: 0.15, rsi: 0.15 };
    if (hasVol && !hasRSI) return mobile ? { price: 0.78, vol: 0.22, rsi: 0 } : { price: 0.85, vol: 0.15, rsi: 0 };
    if (!hasVol && hasRSI) return mobile ? { price: 0.78, vol: 0, rsi: 0.22 } : { price: 0.85, vol: 0, rsi: 0.15 };
    return { price: 1.0, vol: 0, rsi: 0 };
  }

  #calculateCandleWidth() {
    if (this.#filteredData.length === 0) {
      this.#candleLockerWidth = 0;
      this.#candleWidth = 0;
      return;
    }
    const minMax = d3.extent(this.#filteredData.map((x) => parseDate(x.Date)));
    this.#candleLockerWidth =
      this.#xScaleFunc(minMax[0].getTime() + this.#candleLockerWidthDate) -
      this.#xScaleFunc(minMax[0].getTime());

    this.#candleWidth = this.#candleLockerWidth - this.#candleLockerWidth * 0.3;
  }

  #calculateCandleWidthDate() {
    const times = this.#filteredData.map((x) => x.Date).sort();
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
    this.#recalculateMobileFlag();
    this.#calculateInfoTextWidth();
    this.#calculateInfoTextWidthMeta();
    this.#calculateYLabelWidth();
    this.#calculatePaddingRight();
    this.#calculatePaddingLeft();
    this.#calculateSvgWidth();
    this.#calculateSvgHeight();
  }

  #setObjectIDs() {
    const randomNumber = (Math.random() * 10000).toFixed(0);
    this.#objectIDs = {
      svgId: `${this.id}-${randomNumber}`,
      yAxisId: `yAxisG-${randomNumber}`,
      xAxisId: `xAxisG-${randomNumber}`,
      candleContainerId: `candles-${randomNumber}`,
      xLineSelectorId: `xLineSelector-${randomNumber}`,
      yLineSelectorId: `yLineSelector-${randomNumber}`,
      xLabelSelectorId: `xLabelSelector-${randomNumber}`,
      yLabelSelectorId: `yLabelSelector-${randomNumber}`,
      candleInfoId: `candle-info-${randomNumber}`,
      candleInfoIdBackground: `bc-candle-info-${randomNumber}`,
      candleInfoIdPosition: `candle-info-${randomNumber}-position`,
      candleInfoIdBackgroundPosition: `bc-candle-info-${randomNumber}-position`,
      zoomBoxId1: `zoom-box-${randomNumber}-1`,
      zoomBoxId2: `zoom-box-${randomNumber}-2`,
      toolsBtnsContainer: `tools-btns-${randomNumber}`,
    };
  }

  // ============================================================
  // LAYOUT / AXES
  // ============================================================

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
      .style('touch-action', 'none')
      .style('background-color', this.#colors.gridBackground)
      .attr('id', this.#objectIDs.svgId);

    d3.select(`#${this.id}`).style('position', 'relative');

    // Cache the selection for the rest of this render pass.
    this.#svg = svg;

    const sepColor = this.#colors.grid || '#2a3a4a';
    const mobile = this.#isMobile();
    const labelFontSize = mobile ? '9px' : '10px';

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
        .attr('font-size', labelFontSize).attr('font-weight', '600')
        .attr('font-family', 'monospace').text('VOL');
    }

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
        .attr('font-size', labelFontSize).attr('font-weight', '600')
        .attr('font-family', 'monospace').text('RSI(14)');
    }
  }

  #calculateXscale() {
    this.#xScaleFunc = d3.scaleTime()
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

    this.#yScaleFunc = d3.scaleLinear()
      .domain(yMinMax)
      .range([0, this.#config.svgHeight]);
  }

  #createYaxis() {
    const mobile = this.#isMobile();
    const yAxis = d3.axisRight(this.#yScaleFunc).tickSize(this.#config.svgWidth);

    const g = this.#svg.append('g')
      .attr('id', this.#objectIDs.yAxisId)
      .call(yAxis);

    g.selectAll('.domain').remove();
    g.selectAll('g text').attr('transform', 'translate(5,0)');

    g.selectAll('.tick line').style('stroke', this.#colors.grid);
    g.selectAll('.tick text')
      .style('fill', this.#colors.tickColor)
      .style('font-size', mobile ? '9px' : '10px')
      .style('font-weight', '600');
  }

  #createXaxis() {
    const mobile = this.#isMobile();
    // Fewer ticks on narrow screens so labels don't collide.
    const tickDivisor = mobile ? 140 : 100;

    const xAxis = d3.axisBottom(this.#xScaleFunc)
      .ticks(this.#config.svgWidth / tickDivisor)
      .tickSize(this.#config.svgHeight);

    const g = this.#svg.append('g')
      .attr('id', this.#objectIDs.xAxisId)
      .call(xAxis);

    g.selectAll('g text').attr('transform', 'translate(0,10)');
    g.selectAll('.tick line').style('stroke', this.#colors.grid);
    g.selectAll('.domain').remove();
    g.selectAll('.tick text')
      .style('fill', this.#colors.tickColor)
      .style('font-size', mobile ? '9px' : '10px')
      .style('font-weight', '600');
  }

  #createInfoText() {
    const mobile = this.#isMobile();
    const x = mobile ? 0 : 20;

    this.#svg.append('rect')
      .attr('id', this.#objectIDs.candleInfoIdBackground)
      .attr('x', x).attr('y', mobile ? 50 : 10)
      .attr('width', this.#config.infoTextWidth)
      .attr('height', 14)
      .attr('fill', this.#colors.background)
      .style('display', 'none');

    this.#svg.append('text')
      .attr('id', this.#objectIDs.candleInfoId)
      .style('font-size', mobile ? '11px' : '14px')
      .style('font-family', 'monospace')
      .attr('x', x).attr('y', mobile ? 60 : 20)
      .style('fill', this.#colors.candleInfoText);

    this.#svg.append('rect')
      .attr('id', this.#objectIDs.candleInfoIdBackgroundPosition)
      .attr('x', x).attr('y', mobile ? 70 : 30)
      .attr('width', this.#config.infoTextWidthMeta)
      .attr('height', 14)
      .attr('fill', this.#colors.background)
      .style('display', 'none');

    this.#svg.append('text')
      .attr('id', this.#objectIDs.candleInfoIdPosition)
      .style('font-size', mobile ? '11px' : '14px')
      .style('font-family', 'monospace')
      .attr('x', x).attr('y', mobile ? 80 : 40)
      .style('fill', this.#colors.candleInfoText);
  }

  // ============================================================
  // CANDLE / LINE SERIES RENDERING
  // ============================================================

  #createLockerGroup() {
    this.#svg.append('foreignObject')
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
      .attr('x', (d) => this.#xScaleFunc(parseDate(d.Date)) - this.#candleLockerWidth / 2)
      .attr('y', 0)
      .style('opacity', 0);
  }

  #createCandlesGroup() {
    d3.select(`#${this.#objectIDs.svgId} foreignObject #${this.#objectIDs.candleContainerId}`)
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
        .attr('x', (d) => this.#xScaleFunc(parseDate(d.Date)) - this.#candleWidth / 2)
        .attr('y', (d) => (d.Open > d.Close ? this.#yScaleFunc(d.Open) : this.#yScaleFunc(d.Close)))
        .attr('stroke', (d) => (d.Open > d.Close ? this.#colors.upCandlesStroke : this.#colors.downCandlesStroke))
        .attr('fill', (d) => (d.Open > d.Close ? this.#colors.upCandlesFill : this.#colors.downCandlesFill));

      d3.selectAll(`#${this.#objectIDs.candleContainerId} .line-chart`).remove();
    } else if (this.#chartMode === 'line') {
      container.selectAll('rect').remove();

      const lineData = container.data();
      const line = d3.line()
        .x((d) => this.#xScaleFunc(parseDate(d.Date)))
        .y((d) => this.#yScaleFunc(d.Close));

      d3.select(`#${this.#objectIDs.candleContainerId}`)
        .append('path')
        .attr('class', 'line-chart')
        .attr('fill', 'none')
        .attr('stroke', 'steelblue')
        .attr('stroke-width', this.#isMobile() ? 1.5 : 2)
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
      .attr('x', (d) => this.#xScaleFunc(parseDate(d.Date)) - this.#config.candleTailWidth / 2)
      .attr('y', (d) => this.#yScaleFunc(d.High))
      .attr('fill', (d) => (d.Open > d.Close ? this.#colors.upCandlesTail : this.#colors.downCandlesTail));
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
      .attr('x', (d) => this.#xScaleFunc(parseDate(d.Date)) - this.#config.candleTailWidth / 2)
      .attr('y', (d) => (d.Open > d.Close ? this.#yScaleFunc(d.Close) : this.#yScaleFunc(d.Open)))
      .attr('fill', (d) => (d.Open > d.Close ? this.#colors.upCandlesTail : this.#colors.downCandlesTail));
  }

  #getChartTypeIcon() {
    if (this.#chartMode === "line") {
      return "<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M4 4v16'/><path d='M4 8h4v8H4'/><path d='M12 2v20'/><path d='M10 6h4v12h-4'/><path d='M20 4v16'/><path d='M18 10h4v4h-4'/></svg>";
    }
    return "<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M3 3v18h18'/><path d='M19 9l-5 5-4-4-6 6'/></svg>";
  }

  // ============================================================
  // DERIVED SERIES (EMA / RSI) — computed lazily, cached until
  // the underlying dataset changes (see setData()).
  // ============================================================

  #calculateEMA(period) {
    const data = this.#filteredData;
    const closes = data.map((d) => d.Close);
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
    this.#svg.selectAll('.ema-line').remove();

    const emaColors = { 9: '#00bfff', 21: '#ffd700', 50: '#ff8c00', 200: '#ff4444' };
    const emas = [
      { period: 9, data: this.#ema9 },
      { period: 21, data: this.#ema21 },
      { period: 50, data: this.#ema50 },
      { period: 200, data: this.#ema200 },
    ];

    const line = d3.line()
      .x((d) => this.#xScaleFunc(parseDate(d.Date)))
      .y((d) => this.#yScaleFunc(d.value))
      .defined((d) => d.value != null);

    emas.forEach(({ period, data }) => {
      if (!data || data.length === 0) return;
      this.#svg.append('path')
        .attr('class', 'ema-line')
        .attr('fill', 'none')
        .attr('stroke', emaColors[period])
        .attr('stroke-width', this.#isMobile() ? 1.2 : 1.5)
        .attr('opacity', 0.85)
        .attr('d', line(data));
    });
  }

  #calculateRSI(period = 14) {
    const data = this.data;
    if (data.length < period + 1) return [];

    const closes = data.map((d) => d.Close);
    const rsi = [];

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
    this.#svg.selectAll('.rsi-element').remove();

    const rsiData = this.#rsiData.filter((d) => {
      const t = parseDate(d.Date).getTime();
      return t >= this.#zoomRange1 && t <= this.#zoomRange2;
    });
    if (!rsiData || rsiData.length < 2) return;

    const mobile = this.#isMobile();
    const panelTop = this.#rsiTop;
    const panelH = this.#rsiH;

    const yRsi = d3.scaleLinear().domain([0, 100]).range([panelTop + panelH, panelTop]);

    [{ y1: 30, y2: 0, fill: 'rgba(38,166,154,0.08)' }, { y1: 100, y2: 70, fill: 'rgba(239,83,80,0.08)' }]
      .forEach((z) => {
        this.#svg.append('rect')
          .attr('class', 'rsi-element')
          .attr('x', 0).attr('y', yRsi(z.y1))
          .attr('width', this.#config.svgWidth)
          .attr('height', yRsi(z.y2) - yRsi(z.y1))
          .attr('fill', z.fill);
      });

    [70, 50, 30].forEach((level) => {
      const y = yRsi(level);
      this.#svg.append('line')
        .attr('class', 'rsi-element')
        .attr('x1', 0).attr('x2', this.#config.svgWidth)
        .attr('y1', y).attr('y2', y)
        .attr('stroke', level === 50 ? (this.#colors.grid || '#2a3a4a') : (level === 70 ? '#ef5350' : '#26a69a'))
        .attr('stroke-width', level === 50 ? 1 : 0.8)
        .attr('stroke-dasharray', level === 50 ? '3,3' : '4,2')
        .attr('opacity', 0.6);

      this.#svg.append('text')
        .attr('class', 'rsi-element')
        .attr('x', this.#config.svgWidth + 3).attr('y', y + 3)
        .attr('fill', level === 70 ? '#ef5350' : level === 30 ? '#26a69a' : (this.#colors.tickColor || '#888'))
        .attr('font-size', mobile ? '8px' : '9px')
        .text(level);
    });

    const line = d3.line()
      .x((d) => this.#xScaleFunc(parseDate(d.Date)))
      .y((d) => yRsi(d.value))
      .defined((d) => d.value != null)
      .curve(d3.curveMonotoneX);

    this.#svg.append('path')
      .attr('class', 'rsi-element')
      .attr('fill', 'none')
      .attr('stroke', '#b388ff')
      .attr('stroke-width', mobile ? 1.2 : 1.5)
      .attr('opacity', 0.9)
      .attr('d', line(rsiData));

    const lastRsi = rsiData[rsiData.length - 1];
    if (lastRsi) {
      const rsiColor = lastRsi.value >= 70 ? '#ef5350' : lastRsi.value <= 30 ? '#26a69a' : '#b388ff';
      this.#svg.append('text')
        .attr('class', 'rsi-element')
        .attr('x', this.#config.svgWidth + 3).attr('y', yRsi(lastRsi.value) + 3)
        .attr('fill', rsiColor)
        .attr('font-size', mobile ? '8px' : '9px')
        .attr('font-weight', '700')
        .text(lastRsi.value.toFixed(1));
    }

    const yRsiAxis = d3.axisRight(yRsi).tickValues([30, 50, 70]).tickSize(0);
    const g = this.#svg.append('g')
      .attr('class', 'rsi-element')
      .attr('transform', `translate(${this.#config.svgWidth}, 0)`)
      .call(yRsiAxis);
    g.selectAll('text').remove();
    g.select('.domain').remove();
  }

  #drawVolumeChart() {
    this.#svg.selectAll('.volume-bar, .volume-axis, .volume-zero-line').remove();

    const data = this.#filteredData;
    if (!data || data.length === 0) return;

    const mobile = this.#isMobile();
    const maxVolume = d3.max(data, (d) => d.Volume) || 1;
    const yVol = d3.scaleLinear()
      .domain([0, maxVolume])
      .range([this.#volumeTop + this.#volumeH, this.#volumeTop]);

    this.#svg.append('line')
      .attr('class', 'volume-zero-line')
      .attr('x1', 0).attr('x2', this.#config.svgWidth)
      .attr('y1', this.#volumeTop + this.#volumeH).attr('y2', this.#volumeTop + this.#volumeH)
      .attr('stroke', this.#colors.grid || '#2a3a4a')
      .attr('stroke-width', 1);

    // Build all bars via a single data-join instead of a manual forEach
    // that re-selects the SVG on every iteration.
    this.#svg.selectAll('.volume-bar')
      .data(data)
      .enter()
      .append('rect')
      .attr('class', 'volume-bar')
      .attr('x', (d) => this.#xScaleFunc(parseDate(d.Date)) - Math.max(1, this.#candleWidth) / 2)
      .attr('y', (d) => yVol(d.Volume))
      .attr('width', Math.max(1, this.#candleWidth))
      .attr('height', (d) => Math.max(0, (this.#volumeTop + this.#volumeH) - yVol(d.Volume)))
      .attr('fill', (d) => (d.Close >= d.Open ? '#26a69a' : '#ef5350'))
      .attr('opacity', 0.7);

    const yVolAxis = d3.axisRight(yVol)
      .ticks(3)
      .tickSize(0)
      .tickFormat((d) => (d >= 1e6 ? `${(d / 1e6).toFixed(1)}M` : d >= 1e3 ? `${(d / 1e3).toFixed(0)}K` : d));

    const g = this.#svg.append('g')
      .attr('class', 'volume-axis')
      .attr('transform', `translate(${this.#config.svgWidth}, 0)`)
      .call(yVolAxis);

    g.selectAll('text').style('fill', this.#colors.tickColor || '#888').style('font-size', mobile ? '8px' : '9px');
    g.select('.domain').remove();
  }

  #drawSRLevels() {
    this.#svg.selectAll('.sr-level').remove();
    if (!this.#snrLevels || this.#snrLevels.length === 0) return;

    const mobile = this.#isMobile();
    const xMin = this.#xScaleFunc(parseDate(this.#filteredData[0].Date));
    const xMax = this.#xScaleFunc(parseDate(this.#filteredData[this.#filteredData.length - 1].Date));
    const currentPrice = this.#filteredData[this.#filteredData.length - 1].Close;

    this.#snrLevels.forEach((price) => {
      const y = this.#yScaleFunc(price);
      const isResistance = price > currentPrice;
      const color = isResistance ? '#ff4444' : '#00ff88';

      this.#svg.append('line')
        .attr('class', 'sr-level')
        .attr('x1', xMin).attr('x2', xMax).attr('y1', y).attr('y2', y)
        .attr('stroke', color).attr('stroke-width', 1)
        .attr('stroke-dasharray', '4,3').attr('opacity', 0.7);

      this.#svg.append('text')
        .attr('class', 'sr-level')
        .attr('x', xMax + 6).attr('y', y + 4)
        .attr('fill', color)
        .attr('font-size', mobile ? '10px' : '11px')
        .attr('font-family', 'sans-serif')
        .text(price.toFixed(1));
    });
  }

  #highlightPatternCandles() {
    if (!this.#candlePattern?.patterns?.length) return;
    const self = this;

    const patternDates = new Set(
      this.#candlePattern.patterns
        .filter((p) => p.patterns?.length > 0 || p.score !== undefined)
        .map((p) => new Date(p.trade_time).toDateString())
    );

    const pulseCandle = (selection) => {
      selection
        .transition().duration(500).style('opacity', 0.25)
        .transition().duration(500).style('opacity', 1)
        .on('end', function () { pulseCandle(d3.select(this)); });
    };

    d3.selectAll(`#${this.#objectIDs.candleContainerId} .candle`)
      .each(function (d) {
        const candleDate = new Date(d.Date).toDateString();
        if (!patternDates.has(candleDate)) return;

        const candle = d3.select(this);
        const match = self.#candlePattern.patterns.find(
          (p) => new Date(p.trade_time).toDateString() === candleDate
        );
        const score = match?.score ?? 50;
        const highlightColor = score >= 70 ? '#00ff88' : score >= 40 ? '#FFD700' : '#ff4444';

        candle.selectAll('rect')
          .classed('candle-pattern-highlight', true)
          .style('stroke', highlightColor)
          .style('stroke-width', '2px')
          .style('filter', `drop-shadow(0 0 4px ${highlightColor})`)
          .call(pulseCandle);
      });
  }

  // ============================================================
  // ANNOTATIONS
  // ============================================================

  #drawStaticAnnotationFromData() {
    const data = this.#annotationsData;
    if (!data?.length) return;

    const parseTime = (d) => new Date(d);
    const formatTime = d3.timeFormat("%Y-%m-%d");
    const isMobile = this.#isMobile();

    const customType = annotationCustomType(annotationCalloutCurve, {
      className: "custom",
      connector: { type: "elbow", end: "arrow" },
      note: { align: "middle", wrap: 400, lineType: null, line: [] },
    });

    const tempPlacedBoxes = [];
    const makeAnnotation = annotation()
      .editMode(true)
      .notePadding(15)
      .type(customType)
      .accessors({
        x: (d) => this.#xScaleFunc(parseTime(d.Date)),
        y: (d) => this.#yScaleFunc(d.Close),
      })
      .accessorsInverse({
        Date: (d) => formatTime(this.#xScaleFunc.invert(d.x)),
        Close: (d) => this.#yScaleFunc.invert(d.y),
      })
      .annotations(
        data.map((d) => {
          const override = this.#annotationCache.get(d.id) || {};
          let dx, dy;

          if (override.dx !== undefined) {
            dx = override.dx;
            dy = override.dy;
          } else {
            dx = d.transactionType === "buy" ? (isMobile ? -80 : -150) : (isMobile ? 80 : 150);
            dy = d.transactionType === "buy" ? (isMobile ? 30 : 50) : (isMobile ? -30 : -50);

            const ax = this.#xScaleFunc(parseTime(d.Date));
            const ay = this.#yScaleFunc(d.Close);
            const resolved = placeWithoutOverlap({ x: ax, y: ay, dx, dy }, tempPlacedBoxes);
            dx = resolved.dx;
            dy = resolved.dy;
            tempPlacedBoxes.push({ x: ax + dx, y: ay + dy, w: 150, h: 60 });
          }

          return {
            note: {
              title: d.title || `₹${d.Close}`,
              label: d.label || '',
              align: 'middle',
              wrap: isMobile ? 80 : 150,
            },
            data: d,
            dx,
            dy,
            subject: { radius: isMobile ? 14 : 20, radiusPadding: 5 },
            color: this.#colors.annotationLineColor,
            disable: ['subject'],
          };
        })
      )
      .on("dragend", (ann) => {
        this.#annotationCache.set(ann.data.id, { dx: ann.dx, dy: ann.dy });
      });

    const group = d3.select(`#${this.#objectIDs.candleContainerId}`)
      .style("touch-action", "none")
      .style("z-index", 100)
      .append("g")
      .attr("class", "annotation-group")
      .call(makeAnnotation)
      .raise();

    modifyAnnotationEnd(group, this.#colors, isMobile);
  }

  #redrawCachedLines() {
    this.#svg.selectAll('.line').remove();

    this.#svg.selectAll('.user-line')
      .data(this.#lineData)
      .enter()
      .append('line')
      .attr('class', 'user-line')
      .attr('x1', (d) => this.#xScaleFunc(d.x1))
      .attr('y1', (d) => this.#yScaleFunc(d.y1))
      .attr('x2', (d) => this.#xScaleFunc(d.x2))
      .attr('y2', (d) => this.#yScaleFunc(d.y2))
      .attr('stroke', this.#colors.lineColor)
      .attr('stroke-width', 1.5);
  }

  #removeAllLines() {
    this.#svg?.selectAll('.user-line').remove();
    this.#lineData = [];
  }

  // ============================================================
  // TOOLBAR / EXTERNAL TOOL EVENTS
  // ============================================================

  #createToolsBtns() {
    createToolsBtns({
      id: this.id,
      objectIDs: this.#objectIDs,
      getChartTypeIcon: () => this.#getChartTypeIcon(),
      isPaid: this.#isPaid,
    });
  }

  #bindExternalToolEvents() {
    const el = document.getElementById(this.id);
    if (!el) return;

    el.addEventListener('ema-toggle', (e) => {
      const { period, active } = e.detail;

      if (active) {
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
      this.#drawEMALines();
    });

    el.addEventListener('ailevels-toggle', () => {
      if (!this.#snrLevels || this.#snrLevels.length === 0) {
        if (this.#srLevelsFetching) return;
        this.#fetchSRLevels();
      } else if (d3.select(`#${this.#objectIDs.svgId}`).selectAll('.sr-level').empty()) {
        this.#drawSRLevels();
      } else {
        d3.select(`#${this.#objectIDs.svgId}`).selectAll('.sr-level').remove();
      }
    });

    el.addEventListener('volume-toggle', () => {
      this.#showVolume = !this.#showVolume;
      this.draw();
    });

    el.addEventListener('rsi-toggle', () => {
      this.#showRSI = !this.#showRSI;
      this.draw();
    });

    el.addEventListener('candle-pattern-toggle', () => {
      // Ensure we're in candlestick mode before doing anything else —
      // pattern highlighting only works on candle rects, not the line path.
      if (this.#chartMode !== 'candlestick') {
        this.#chartMode = 'candlestick';
        this.draw();
      }

      if (!this.#candlePattern || this.#candlePattern.patterns?.length === 0) {
        if (this.#candlePatternFetching) return;
        this.#fetchCandlePattern();
      } else if (this.#candlePatternActive) {
        this.#candlePatternActive = false;
        d3.select(`#${this.#objectIDs.svgId}`)
          .selectAll('.candle-pattern-highlight')
          .interrupt()
          .style('stroke', null)
          .style('filter', null)
          .style('opacity', 1)
          .classed('candle-pattern-highlight', false);
      } else {
        this.#candlePatternActive = true;
        this.#highlightPatternCandles();
      }
    });
  }

  async #fetchSRLevels() {
    this.#srLevelsFetching = true;
    try {
      const res = await axios.post(
        `${ENV.BASE_API_URL}/api${this.#isDemo ? '/demo' : ''}/sr-levels/`,
        { candles: this.#filteredData },
        { headers: { Authorization: `Bearer ${localStorage.getItem("jwtToken")}` } }
      );
      this.#snrLevels = res.data.lines;
      this.#drawSRLevels();
    } catch (err) {
      console.error("SR Levels fetch error:", err);
    } finally {
      this.#srLevelsFetching = false;
    }
  }

  async #fetchCandlePattern() {
    this.#candlePatternFetching = true;
    try {
      const res = await axios.post(
        `${ENV.BASE_API_URL}/api${this.#isDemo ? '/demo' : ''}/candle-pattern/`,
        {
          candles: this.#filteredData,
          trade_data: this.#annotationsData.map((a) => ({ date: a.Date, trade_type: a.transactionType })),
        },
        { headers: { Authorization: `Bearer ${localStorage.getItem("jwtToken")}` } }
      );
      this.#candlePattern = res.data;
      this.#candlePatternActive = true;      // <-- was missing
      this.#highlightPatternCandles();        // <-- was missing
    } catch (err) {
      console.error("Candle Pattern fetch error:", err);
    } finally {
      this.#candlePatternFetching = false;
    }
  }

  // ============================================================
  // MODE / TOOL-STATE HANDLING
  // ============================================================

  #modeHandler(mode) {
    this.#mode = mode;
    const container = `#${this.#objectIDs.toolsBtnsContainer}`;
    const btnIds = ['tools-btn-0', 'tools-btn-1', 'tools-btn-2', 'tools-btn-3', 'tools-btn-4', 'tools-btn-5', 'tools-btn-6'];

    btnIds.forEach((btnId) => {
      const selector = `${container} #${btnId}`;
      if (!document.querySelector(selector)) return;
      const svg = document.querySelector(`${selector} svg g g`) || document.querySelector(`${selector} svg`);
      svg?.setAttribute('fill', this.#colors.deActiveTools);
      d3.select(selector).style('border', `1px solid ${this.#colors.deActiveTools}`);
    });

    const activeBtn = {
      pan: `${container} #tools-btn-2`,
      zoom: `${container} #tools-btn-1`,
      draw: `${container} #tools-btn-3`,
      measure: `${container} #tools-btn-4`,
    }[mode];

    if (!activeBtn) return;
    const activeSVG = document.querySelector(`${activeBtn} svg g g`) || document.querySelector(`${activeBtn} svg`);
    activeSVG?.setAttribute('fill', this.#colors.activeTools);
    d3.select(activeBtn).style('border', `1px solid ${this.#colors.activeTools}`);
  }

  #handleResetZoom() {
    this.#zoomRange1 = this.#minMaxDate[0].getTime() - this.#candleWidthDate / 2;
    const totalRange = this.#minMaxDate[1].getTime() - this.#minMaxDate[0].getTime();
    this.#zoomRange2 = this.#minMaxDate[1].getTime() + totalRange * this.#rightOffsetFactor;

    this.#filteredData = this.data;
    this.#zoomFactor = 1;
    this.#removeAllLines();

    // Reset all overlay/indicator state too — not just zoom/lines.
    this.#showVolume = false;
    this.#showRSI = false;
    this.#candlePatternActive = false;
    this.#ema9 = null;
    this.#ema21 = null;
    this.#ema50 = null;
    this.#ema200 = null;

    // Let the toolbar dropdown know so its checkboxes/menu highlight
    // states go back to unchecked (it owns that UI, not this class).
    document.getElementById(this.id)?.dispatchEvent(new CustomEvent("chart-reset"));

    this.draw();
  }

  // ============================================================
  // CROSSHAIR / SELECTOR LINES & LABELS
  // ============================================================

  #xLineHandler(d, position) {
    const xPosition = position ?? this.#xScaleFunc(parseDate(d.Date));
    const xLine = document.getElementById(this.#objectIDs.xLineSelectorId);

    if (xLine) {
      d3.select(xLine).attr('x1', xPosition).attr('y1', 0).attr('x2', xPosition).attr('y2', this.#config.svgHeight);
    } else {
      this.#svg.insert('line', `#${this.#objectIDs.xAxisId}`)
        .attr('id', this.#objectIDs.xLineSelectorId)
        .attr('stroke', this.#colors.selectorLine)
        .attr('stroke-dasharray', this.#config.selectoreStrokeDashArray)
        .attr('x1', xPosition).attr('y1', 0).attr('x2', xPosition).attr('y2', this.#config.svgHeight);
    }
  }

  #xLabelHandler(d, position) {
    const xPosition = position ?? this.#xScaleFunc(parseDate(d.Date));
    const clampedX = xPosition >= this.#config.svgWidth - this.#config.xLabelWidth / 2
      ? this.#config.svgWidth - this.#config.xLabelWidth
      : xPosition <= this.#config.xLabelWidth / 2
        ? 0
        : xPosition - this.#config.xLabelWidth / 2;

    let xLabel = document.getElementById(this.#objectIDs.xLabelSelectorId);
    const text = d3.timeFormat(this.#config.timeFormat)(this.#xScaleFunc.invert(xPosition));

    if (xLabel) {
      d3.select(xLabel).attr('transform', `translate(${clampedX},${this.#config.svgHeight})`);
      document.querySelector(`#${this.#objectIDs.xLabelSelectorId} text`).innerHTML = text;
    } else {
      const g = this.#svg.append('g')
        .attr('id', this.#objectIDs.xLabelSelectorId)
        .attr('transform', `translate(${clampedX},${this.#config.svgHeight})`);

      g.append('rect')
        .attr('fill', this.#colors.selectorLableBackground)
        .attr('width', this.#config.xLabelWidth)
        .attr('height', this.#config.xLabelHeight);

      g.append('text')
        .style('font-size', `${this.#config.xLabelFontSize}px`)
        .attr('fill', this.#colors.selectorLabelText)
        .style('font-family', 'monospace')
        .attr('x', 10).attr('y', 15)
        .html(text);
    }
  }

  #yLineHandler(d, position) {
    const yLine = document.getElementById(this.#objectIDs.yLineSelectorId);
    if (yLine) {
      d3.select(yLine).attr('x1', 0).attr('y1', position).attr('x2', this.#config.svgWidth).attr('y2', position);
    } else {
      this.#svg.insert('line', `#${this.#objectIDs.xAxisId}`)
        .attr('id', this.#objectIDs.yLineSelectorId)
        .attr('stroke', this.#colors.selectorLine)
        .attr('stroke-dasharray', this.#config.selectoreStrokeDashArray)
        .attr('x1', 0).attr('y1', position)
        // Fixed: this previously used svgHeight for x2, which drew the
        // crosshair's horizontal line the wrong length.
        .attr('x2', this.#config.svgWidth).attr('y2', position);
    }
  }

  #yLabelHandler(d, position) {
    const clampedY = position >= this.#config.svgHeight - this.#config.yLabelHeight / 2
      ? this.#config.svgHeight - this.#config.yLabelHeight
      : position <= this.#config.yLabelHeight / 2
        ? 0
        : position - this.#config.yLabelHeight / 2;

    let yLabel = document.getElementById(this.#objectIDs.yLabelSelectorId);
    const text = this.#yScaleFunc.invert(position).toFixed(this.#config.decimal);

    if (yLabel) {
      d3.select(yLabel).attr('transform', `translate(${this.#config.svgWidth}, ${clampedY})`);
      document.querySelector(`#${this.#objectIDs.yLabelSelectorId} text`).innerHTML = text;
    } else {
      const g = this.#svg.append('g')
        .attr('id', this.#objectIDs.yLabelSelectorId)
        .attr('transform', `translate(${this.#config.svgWidth}, ${clampedY})`);

      g.append('rect')
        .attr('fill', this.#colors.selectorLableBackground)
        .attr('width', this.#config.yLabelWidth)
        .attr('height', this.#config.yLabelHeight);

      g.append('text')
        .style('font-size', `${this.#config.yLabelFontSize}px`)
        .attr('fill', this.#colors.selectorLabelText)
        .style('font-family', 'monospace')
        .attr('x', 5).attr('y', 15)
        .html(text);
    }
  }

  #candleInfoHandler(d) {
    if (this.#chartMode === 'line') return;

    const isUp = d.Open > d.Close;
    const color = isUp ? this.#colors.candleInfoTextUp : this.#colors.candleInfoTextDown;
    const dec = this.#config.decimal;

    document.getElementById(this.#objectIDs.candleInfoId).innerHTML =
      `O <tspan style='fill:${color}'>${d.Open.toFixed(dec)}</tspan> ` +
      `H <tspan style='fill:${color}'>${d.High.toFixed(dec)}</tspan> ` +
      `L <tspan style='fill:${color}'>${d.Low.toFixed(dec)}</tspan> ` +
      `C <tspan style='fill:${color}'>${d.Close.toFixed(dec)}</tspan>`;

    document.getElementById(this.#objectIDs.candleInfoIdBackground).style.display = 'block';

    if (d.long || d.short) {
      let text = d.long
        ? `Long <tspan style='fill:${this.#colors.long}'> ${d.long.toFixed(dec)}</tspan>`
        : `Short <tspan style='fill:${this.#colors.short}'> ${d.short.toFixed(dec)}</tspan>`;
      text += ` SL <tspan style='fill:${this.#colors.sl}'> ${d.sl.toFixed(dec)}</tspan>`;
      text += ` TP <tspan style='fill:${this.#colors.tp}'> ${d.tp.toFixed(dec)}</tspan>`;

      document.getElementById(this.#objectIDs.candleInfoIdPosition).innerHTML = text;
      document.getElementById(this.#objectIDs.candleInfoIdBackgroundPosition).style.display = 'block';
    }
  }

  #candleInfoLeaveHandler() {
    document.getElementById(this.#objectIDs.candleInfoId).innerHTML = ``;
    document.getElementById(this.#objectIDs.candleInfoIdBackground).style.display = 'none';
    document.getElementById(this.#objectIDs.candleInfoIdPosition).innerHTML = ``;
    document.getElementById(this.#objectIDs.candleInfoIdBackgroundPosition).style.display = 'none';
  }

  // ============================================================
  // PATTERN TOOLTIP (clamped to viewport for mobile)
  // ============================================================

  #initPatternTooltip() {
    d3.select(`#${this.id} .pattern-tooltip`).remove();

    d3.select(`#${this.id}`)
      .append("div")
      .attr("class", "pattern-tooltip")
      .style("position", "absolute")
      .style("display", "none")
      .style("background", "#0d1b2a")
      .style("border", "1px solid #1e3048")
      .style("border-radius", "8px")
      .style("padding", this.#isMobile() ? "8px 10px" : "10px 14px")
      .style("pointer-events", "none")
      .style("z-index", "9999")
      .style("font-size", this.#isMobile() ? "11px" : "12px")
      .style("font-family", "sans-serif")
      .style("box-shadow", "0 4px 16px rgba(0,0,0,0.5)")
      .style("max-width", this.#isMobile() ? "160px" : "220px")
      .style("line-height", "1.8");
  }

  #positionPatternTooltip(x, y) {
    const tooltip = d3.select(`#${this.id} .pattern-tooltip`);
    const node = tooltip.node();
    if (!node) return;

    const chartRect = document.getElementById(this.id)?.getBoundingClientRect();
    const tooltipRect = node.getBoundingClientRect();
    const chartWidth = chartRect?.width ?? this.#config.width;

    // Keep the tooltip inside the chart's horizontal bounds — critical
    // on narrow mobile viewports where a fixed "+50px" offset would
    // otherwise push it off-screen.
    let left = x + 50;
    if (left + tooltipRect.width > chartWidth) {
      left = Math.max(0, x - tooltipRect.width - 20);
    }

    tooltip.style("left", `${left}px`).style("top", `${Math.max(0, y - 10)}px`);
  }

  // ============================================================
  // POINTER / TOUCH INTERACTION
  // ============================================================

  #mouseMoveLockers(d) {
    this.#lockSelectorX = true;
    this.#xLineHandler(d);
    this.#xLabelHandler(d);
    this.#candleInfoHandler(d);

    if (this.#candlePatternActive && this.#candlePattern?.patterns?.length) {
      const candleDate = new Date(d.Date).toDateString();
      const match = this.#candlePattern.patterns.find(
        (p) => new Date(p.trade_time).toDateString() === candleDate
      );

      const tooltip = d3.select(`#${this.id} .pattern-tooltip`);

      if (match) {
        const score = match.score ?? 50;
        const scoreColor = score >= 70 ? "#00ff88" : score >= 40 ? "#FFD700" : "#ff4444";
        const patternNames = match.patterns?.length
          ? match.patterns.map((p) => `<span style="color:${scoreColor}">${p}</span>`).join(", ")
          : `<span style="color:#aaa">No named pattern</span>`;

        tooltip
          .style("display", "block")
          .html(`
            <div style="color:#fff; font-weight:600; margin-bottom:4px;">Candle Pattern</div>
            <div style="color:#aaa; margin-bottom:6px; font-size:11px;">${match.description ?? ""}</div>
            <div style="margin-bottom:4px;">${patternNames}</div>
            <div style="margin-top:6px; border-top:1px solid #1e3048; padding-top:6px;">
              Score: <span style="color:${scoreColor}; font-weight:700; font-size:14px;">${score}/100</span>
            </div>
          `);

        const x = this.#xScaleFunc(parseDate(d.Date));
        const y = this.#yScaleFunc(d.High);
        this.#positionPatternTooltip(x, y);
      } else {
        tooltip.style("display", "none");
      }
    }
  }

  #mouseLeaveLocker() {
    this.#lockSelectorX = false;
    this.#candleInfoLeaveHandler();
    d3.select(`#${this.id} .pattern-tooltip`).style("display", "none");
  }

  #handleZoomBox() {
    document.querySelector(`#${this.#objectIDs.zoomBoxId1}`)?.remove();
    document.querySelector(`#${this.#objectIDs.zoomBoxId2}`)?.remove();

    const candleContainer = document.getElementById(this.#objectIDs.candleContainerId);
    const height = candleContainer.height.baseVal.value;
    const width = candleContainer.width.baseVal.value;
    const container = d3.select(`#${this.#objectIDs.candleContainerId}`);

    const leftW = this.#zoomPoint2 > this.#zoomPoint1 ? this.#zoomPoint1 : this.#zoomPoint2;
    const rightX = this.#zoomPoint2 > this.#zoomPoint1 ? this.#zoomPoint2 : this.#zoomPoint1;

    container.append('rect')
      .attr('id', this.#objectIDs.zoomBoxId1)
      .attr('width', leftW).attr('x', 0).attr('y', 0).attr('height', height)
      .attr('fill', 'black').attr('stroke', 'none').style('opacity', 0.5);

    container.append('rect')
      .attr('id', this.#objectIDs.zoomBoxId2)
      .attr('width', width - rightX).attr('x', rightX).attr('y', 0).attr('height', height)
      .attr('fill', 'black').attr('stroke', 'none').style('opacity', 0.5);
  }

  #handleZoom() {
    document.querySelector(`#${this.#objectIDs.zoomBoxId1}`)?.remove();
    document.querySelector(`#${this.#objectIDs.zoomBoxId2}`)?.remove();

    const minMaxZoom = d3.extent([this.#zoomPoint1, this.#zoomPoint2]);
    const leftDate = parseDate(this.#xScaleFunc.invert(minMaxZoom[0]));
    const rightDate = parseDate(this.#xScaleFunc.invert(minMaxZoom[1]));
    if (leftDate - rightDate === 0) return;

    const filteredData = this.data.filter((x) =>
      parseDate(x.Date).getTime() > leftDate.getTime() - this.#candleWidthDate &&
      parseDate(x.Date).getTime() < rightDate.getTime() + this.#candleWidthDate
    );

    const oldZoomRange1 = this.#minMaxDate[0];
    const oldZoomRange2 = this.#minMaxDate[1];
    const newZoomRange1 = parseDate(this.#xScaleFunc.invert(minMaxZoom[0]));
    const newZoomRange2 = parseDate(this.#xScaleFunc.invert(minMaxZoom[1]));

    this.#zoomFactor = (oldZoomRange2 - oldZoomRange1) / (newZoomRange2 - newZoomRange1);
    this.#zoomRange1 = newZoomRange1;
    this.#zoomRange2 = newZoomRange2;
    this.#filteredData = filteredData;
    this.#mode = 'pan';
    this.draw();
  }

  /** Pure computation — no DOM writes — so it's safe to call every rAF. */
  #computePan(location) {
    const dateWidth = this.#zoomRange2 - this.#zoomRange1;
    const width = document.getElementById(this.#objectIDs.candleContainerId).width.baseVal.value;
    const fraction = location / width;

    const newZoomRange1 = this.#panTargetDate - fraction * dateWidth;
    const newZoomRange2 = newZoomRange1 + dateWidth;

    const filteredData = this.data.filter((x) =>
      parseDate(x.Date).getTime() > newZoomRange1 - this.#candleWidthDate &&
      parseDate(x.Date).getTime() < newZoomRange2 + this.#candleWidthDate
    );

    this.#zoomRange1 = newZoomRange1;
    this.#zoomRange2 = newZoomRange2;
    this.#filteredData = filteredData;
  }

  /** Throttle continuous pan events to one redraw per animation frame. */
  #handlePan(location) {
    this.#pendingPanLocation = location;
    if (this.#panRAF) return;

    this.#panRAF = requestAnimationFrame(() => {
      this.#panRAF = null;
      if (this.#pendingPanLocation == null) return;
      this.#computePan(this.#pendingPanLocation);
      this.#pendingPanLocation = null;
      this.draw();
    });
  }

  #handleDrawLine(location) {
    if (this.#mode !== 'draw' || this.#drawAndMeasureLocked) return;

    if (!this.#drawPoint1) {
      this.#drawPoint1 = location;
      this.#tempLine = this.#svg.append('line')
        .attr('x1', location.x).attr('y1', location.y)
        .attr('x2', location.x).attr('y2', location.y)
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

      this.#svg.append('line')
        .attr('x1', this.#drawPoint1.x).attr('y1', this.#drawPoint1.y)
        .attr('x2', this.#drawPoint2.x).attr('y2', this.#drawPoint2.y)
        .attr('stroke', this.#colors.lineColor)
        .attr('stroke-width', 1.5);

      this.#tempLine?.remove();

      requestAnimationFrame(() => {
        this.#drawPoint1 = null;
        this.#drawPoint2 = null;
        this.#tempLine = null;
        this.#drawAndMeasureLocked = false;
        this.#mode = 'pan';
      });
    }
  }

  #handleMeasure(location) {
    if (this.#mode !== 'measure' || this.#drawAndMeasureLocked) return;

    if (!this.#measureState.start) {
      this.#svg.selectAll('.measure-rect').remove();
      this.#svg.selectAll('.measure-label').remove();

      this.#measureState.start = location;

      this.#measureState.rect = this.#svg.append('rect')
        .attr('class', 'measure-rect')
        .attr('x', location.x).attr('y', location.y)
        .attr('width', 0).attr('height', 0)
        .attr('fill', 'rgba(0,255,0,0.2)')
        .attr('stroke', 'lime').attr('stroke-width', 1);

      this.#measureState.label = this.#svg.append('text')
        .attr('class', 'measure-label')
        .attr('x', location.x).attr('y', location.y - 8)
        .attr('fill', 'white').attr('font-size', '12px');

      this.#svg.on('mousemove.measure', (event) => {
        const current = getCursorPoint(this.#objectIDs.svgId, event);
        if (!this.#drawAndMeasureLocked) this.#updateMeasureBox(current);
      });
    } else {
      this.#drawAndMeasureLocked = true;
      this.#svg.on('mousemove.measure', null);

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

    const priceA = this.#yScaleFunc.invert(start.y);
    const priceB = this.#yScaleFunc.invert(current.y);
    const diff = priceB - priceA;
    const percent = ((diff / priceA) * 100).toFixed(2);

    const fillColor = priceB > priceA ? 'rgba(0,255,0,0.2)' : 'rgba(255,0,0,0.2)';
    const strokeColor = priceB > priceA ? 'lime' : 'red';

    rect.attr('x', x).attr('y', y).attr('width', width).attr('height', height)
      .attr('fill', fillColor).attr('stroke', strokeColor);

    const timeA = this.#xScaleFunc.invert(start.x);
    const timeB = this.#xScaleFunc.invert(current.x);
    const bars = this.#filteredData.filter((d) => {
      const date = new Date(d.Date);
      return (date >= timeA && date <= timeB) || (date >= timeB && date <= timeA);
    });

    const numBars = bars.length;
    const numDays = Math.abs((timeB - timeA) / (1000 * 60 * 60 * 24)).toFixed(1);

    label.attr('x', x + width / 2).attr('y', y - 8)
      .text(`${diff.toFixed(2)} (${percent}%) | ${numBars} bars | ${numDays} days`);
  }

  /** Pure computation for wheel-zoom — DOM writes happen in draw(). */
  #computeScrollZoom(e) {
    const location = getCursorPoint(this.#objectIDs.svgId, e.sourceEvent);

    this.#zoomFactor *= e.transform.k > 1 ? 1.1 : 0.9;

    const totalCandles = this.data.length;
    const minZoom = totalCandles + 100;
    const maxZoom = 1;
    this.#zoomFactor = Math.min(totalCandles / maxZoom, Math.max(this.#zoomFactor, totalCandles / minZoom));

    const width = parseDate(this.#minMaxDate[1]) - parseDate(this.#minMaxDate[0]);
    const newWidth = Math.round(width / this.#zoomFactor);

    const svgWidth = document.getElementById(this.#objectIDs.candleContainerId).width.baseVal.value;
    const target = this.#xScaleFunc.invert(location.x).getTime();
    const coeff = Math.round((newWidth * location.x) / svgWidth);
    const left = target - coeff;
    const right = left + newWidth;

    this.#zoomRange1 = left;
    this.#zoomRange2 = right;

    this.#filteredData = this.data.filter((x) =>
      parseDate(x.Date).getTime() > left - this.#candleWidthDate &&
      parseDate(x.Date).getTime() < right + this.#candleWidthDate
    );
  }

  /** Throttle wheel/pinch zoom to one redraw per animation frame. */
  #handleScrollZoom(e) {
    this.#pendingZoomEvent = e;
    if (this.#zoomRAF) return;

    this.#zoomRAF = requestAnimationFrame(() => {
      this.#zoomRAF = null;
      if (!this.#pendingZoomEvent) return;
      this.#computeScrollZoom(this.#pendingZoomEvent);
      this.#pendingZoomEvent = null;
      this.draw();
    });
  }

  #handleMouseMove(e, d) {
    const location = getCursorPoint(this.#objectIDs.svgId, e);

    if (location.x > this.#config.width) location.x = this.#config.width;
    if (location.y > this.#config.height) location.y = this.#config.svgHeight;

    if (!this.#lockSelectorX) this.#xLineHandler(d, location.x);
    this.#yLineHandler(d, location.y);
    if (!this.#lockSelectorX) this.#xLabelHandler(d, location.x);
    this.#yLabelHandler(d, location.y);

    if (this.#mode === 'draw' && this.#drawPoint1 && !this.#drawPoint2 && this.#tempLine) {
      this.#tempLine
        .attr('x1', this.#drawPoint1.x).attr('y1', this.#drawPoint1.y)
        .attr('x2', location.x).attr('y2', location.y);
    }

    if (this.#isMouseDown && this.#mode === 'zoom') {
      this.#zoomPoint2 = location.x;
      this.#handleZoomBox();
    } else if (this.#isMouseDown && this.#mode === 'pan') {
      this.#handlePan(location.x);
    }
  }

  #handleMouseLeave() {
    document.getElementById(this.#objectIDs.xLineSelectorId)?.remove();
    document.getElementById(this.#objectIDs.yLineSelectorId)?.remove();
    document.getElementById(this.#objectIDs.xLabelSelectorId)?.remove();
    document.getElementById(this.#objectIDs.yLabelSelectorId)?.remove();
  }

  #handleMouseDown(e) {
    this.#isMouseDown = true;
    const location = getCursorPoint(this.#objectIDs.svgId, e);
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

  #cancelPendingFrames() {
    if (this.#panRAF) { cancelAnimationFrame(this.#panRAF); this.#panRAF = null; }
    if (this.#zoomRAF) { cancelAnimationFrame(this.#zoomRAF); this.#zoomRAF = null; }
    this.#pendingPanLocation = null;
    this.#pendingZoomEvent = null;
  }

  #closeMenu() {
    d3.select(`#${this.#objectIDs.toolsBtnsContainer}-dropdown`).style('display', 'none');
  }

  #addEventListeners() {
    const thisProxy = this;
    const containerSel = `#${this.#objectIDs.candleContainerId}`;

    // Hover targets that should show/hide the crosshair info panel.
    ['.candle', '.candle-locker', '.sl', '.tp', '.short', '.long'].forEach((cls) => {
      d3.selectAll(`${containerSel} ${cls}`)
        .on('mouseover', function (e, d) { thisProxy.#mouseMoveLockers(d); })
        .on('mouseleave', () => thisProxy.#mouseLeaveLocker());
    });

    d3.select(containerSel)
      .on('mouseleave', () => thisProxy.#handleMouseLeave())
      .on('mousedown', (e) => thisProxy.#handleMouseDown(e))
      .on('mouseup', () => thisProxy.#handleMouseUp())
      .on('touchstart', (e) => thisProxy.#handleMouseDown(e))
      .on('touchend', () => thisProxy.#handleMouseUp())
      .on('mousemove', (event, d) => thisProxy.#handleMouseMove(event, d))
      .on('touchmove', (event, d) => thisProxy.#handleMouseMove(event, d))
      .on('click', (e) => {
        const location = getCursorPoint(this.#objectIDs.svgId, e);
        if (this.#mode === 'measure') this.#handleMeasure(location);
        else if (this.#mode === 'draw') this.#handleDrawLine(location);
      });

    d3.select(`#${this.#objectIDs.toolsBtnsContainer} #tools-btn-reset`)
      .on('click', () => this.#handleResetZoom());

    d3.select(`#${this.#objectIDs.toolsBtnsContainer} #tools-btn-chartmode`)
      .on('click', () => {
        this.toggleChartMode();
        d3.select(`#${this.#objectIDs.toolsBtnsContainer} #tools-btn-chartmode`).html(this.#getChartTypeIcon());
      });

    const dropdown = `#${this.#objectIDs.toolsBtnsContainer}-dropdown`;
    const menuActions = {
      zoom: () => this.#modeHandler('zoom'),
      pan: () => this.#modeHandler('pan'),
      draw: () => this.#modeHandler('draw'),
      measure: () => this.#modeHandler('measure'),
      share: () => this.shareChartScreenshot(),
    };
    Object.entries(menuActions).forEach(([key, action]) => {
      d3.select(`${dropdown} #tools-menu-${key}`).on('click', () => { action(); this.#closeMenu(); });
    });

    const zoom = d3.zoom().on('zoom', (e) => thisProxy.#handleScrollZoom(e));
    this.#svg
      .call(zoom)
      .on('mousedown.zoom', null)
      .on('touchstart.zoom', null)
      .on('touchmove.zoom', null)
      .on('touchend.zoom', null);
  }

  #removeEventListeners() {
    if (!this.#objectIDs?.candleContainerId) return;
    const containerSel = `#${this.#objectIDs.candleContainerId}`;

    ['.candle', '.candle-locker', '.sl', '.tp', '.short', '.long'].forEach((cls) => {
      d3.selectAll(`${containerSel} ${cls}`).on('mouseover', this.#noop).on('mouseleave', this.#noop);
    });

    d3.select(containerSel)
      .on('mousemove', null).on('mouseleave', null)
      .on('mousedown', null).on('mouseup', null)
      .on('touchstart', null).on('touchend', null).on('touchmove', null)
      .on('click', null);

    ['tools-btn-0', 'tools-btn-1', 'tools-btn-2', 'tools-btn-3', 'tools-btn-4'].forEach((btnId) => {
      d3.select(`#${this.#objectIDs.toolsBtnsContainer} #${btnId}`).on('click', null);
    });

    d3.zoom().on('zoom', null);
  }

  // ============================================================
  // PnL BRUSH WINDOW
  // ============================================================

  #renderBrush() {
    if (this.#isPnLWindowClosed) return;

    const mobile = this.#isMobile();
    const svg = this.#svg;
    const height = this.#config.svgHeight;
    const width = this.#config.svgWidth;

    let winX = this.#brushState?.winX ?? width * 0.1;
    let winWidth = this.#brushState?.winWidth ?? width * 0.12;

    // Bigger touch targets on mobile so handles are easy to grab.
    const handleW = mobile ? 5 : 5;
    const hitW = mobile ? 22 : handleW;
    const handleHeight = height * 0.2;
    const handleYOffset = (height - handleHeight) / 2;
    const minWidth = handleW * 2 + 6;
    const closeSize = mobile ? 18 : 14;
    const gripDotR = mobile ? 2.2 : 1.8;
    const gripSpacing = 6;

    let brushLayer = svg.select(`#${this.id}-brush-layer`);
    if (brushLayer.empty()) {
      brushLayer = svg.append("g").attr("id", `${this.id}-brush-layer`);
    } else {
      brushLayer.selectAll("*").remove();
    }
    brushLayer.raise();

    const windowRect = brushLayer.append("rect")
      .attr("y", 0).attr("height", height).attr("rx", 2)
      .attr("fill", "rgba(20,228,107,0.01)")
      .attr("stroke", "#888")
      .attr("cursor", "grab");

    const makeHandle = (className) => {
      const g = brushLayer.append("g").attr("class", className).style("cursor", "ew-resize");
      // invisible, wider hit area for easy thumb dragging
      if (mobile) {
        g.append("rect")
          .attr("class", "handle-hit-area")
          .attr("x", -hitW / 2 + handleW / 2)
          .attr("y", handleYOffset - 10)
          .attr("width", hitW)
          .attr("height", handleHeight + 20)
          .attr("fill", "transparent");
      }
      g.append("rect")
        .attr("y", handleYOffset).attr("width", handleW).attr("height", handleHeight)
        .attr("rx", 3).attr("fill", "rgba(34, 211, 238, 0.85)")
        .attr("stroke", "#fff").attr("stroke-width", 0.5);

      [-gripSpacing, 0, gripSpacing].forEach((offset) => {
        g.append("circle")
          .attr("r", gripDotR).attr("cx", handleW / 2)
          .attr("cy", handleYOffset + handleHeight / 2 + offset)
          .attr("fill", "rgba(0,0,0,0.5)");
      });

      g.on("mouseenter", function () {
        d3.select(this).select("rect").attr("fill", "rgba(34, 211, 238, 1)").attr("stroke-width", 1.5);
      }).on("mouseleave", function () {
        d3.select(this).select("rect").attr("fill", "rgba(34, 211, 238, 0.85)").attr("stroke-width", 0.5);
      });
      return g;
    };

    const leftHandleGroup = makeHandle("brush-handle-left");
    const rightHandleGroup = makeHandle("brush-handle-right");

    const closeBtn = brushLayer.append("g")
      .attr("cursor", "pointer")
      .on("pointerdown", (e) => e.stopPropagation())
      .on("click", () => {
        this.#isPnLWindowClosed = true;
        this.#brushState = null;
        brushLayer.remove();
        this.draw();
      });

    closeBtn.append("circle").attr("r", closeSize / 2).attr("fill", "rgba(40,40,40,0.85)");
    closeBtn.append("path")
      .attr("d", "M -4 -4 L 4 4 M -4 4 L 4 -4")
      .attr("stroke", "#fff").attr("stroke-width", 1.6).attr("stroke-linecap", "round");

    brushLayer.selectAll("*").on("pointerdown", (e) => e.stopPropagation());

    const update = () => {
      winX = Math.round(winX);
      winWidth = Math.round(winWidth);
      this.#brushState = { winX, winWidth };

      windowRect.attr("x", winX).attr("width", winWidth);
      leftHandleGroup.attr("transform", `translate(${winX - handleW / 2}, 0)`);
      rightHandleGroup.attr("transform", `translate(${winX + winWidth - handleW / 2}, 0)`);
      closeBtn.attr("transform", `translate(${winX + winWidth - closeSize / 2 - 4},${closeSize / 2 + 4})`);

      drawBrushGradient(
        winX, winWidth, brushLayer, this.getChartData(), this.getAnnotationsData(),
        this.#objectIDs.svgId, this.getXScaleFunc(), this.getYScaleFunc()
      );
    };
    update();

    windowRect.call(d3.drag()
      .on("start", (e) => e.sourceEvent.stopPropagation())
      .on("drag", (e) => { winX = Math.max(0, Math.min(width - winWidth, e.x)); update(); }));

    leftHandleGroup.call(d3.drag()
      .on("start", (e) => e.sourceEvent.stopPropagation())
      .on("drag", (e) => {
        const newX = Math.max(0, Math.min(winX + winWidth - minWidth, e.x));
        winWidth += winX - newX;
        winX = newX;
        update();
      }));

    rightHandleGroup.call(d3.drag()
      .on("start", (e) => e.sourceEvent.stopPropagation())
      .on("drag", (e) => {
        winWidth = Math.max(minWidth, Math.min(width - winX, e.x - winX));
        update();
      }));
  }

  #renderPnLToggleButton() {
    if (!this.#isPnLWindowClosed) return;

    const mobile = this.#isMobile();
    const svg = this.#svg;
    const height = this.#config.svgHeight;
    const width = this.#config.svgWidth;

    if (!svg.select(`#${this.id}-pnl-btn`).empty()) return;

    const btnW = mobile ? 22 : 26;
    const btnH = mobile ? 108 : 128;
    const accent = "rgba(34, 211, 238, 0.45)";   // matches the cyan used everywhere else
    const accentHover = "rgba(34, 211, 238, 0.85)";
    const bg = this.#colors.gridBackground || "#171b26";
    const hoverBg = this.#theme === "dark" ? "#1c2534" : "#eef6f8";

    const btnGroup = svg.append("g")
      .attr("id", `${this.id}-pnl-btn`)
      .attr("transform", `translate(${width - btnW - 6}, ${height / 2 - btnH / 2})`)
      .attr("cursor", "pointer")
      .on("pointerdown", (e) => e.stopPropagation())
      .on("click", () => {
        this.#isPnLWindowClosed = !this.#isPnLWindowClosed;
        this.draw();
      })
      .on("mouseenter", function () {
        d3.select(this).select("rect").attr("stroke", accentHover).attr("fill", hoverBg);
      })
      .on("mouseleave", function () {
        d3.select(this).select("rect").attr("stroke", accent).attr("fill", bg);
      });

    btnGroup.append("rect")
      .attr("width", btnW).attr("height", btnH).attr("rx", 7)
      .attr("fill", bg)
      .attr("stroke", accent)
      .attr("stroke-width", 1)
      .style("filter", "drop-shadow(0 2px 6px rgba(0,0,0,0.3))");

    btnGroup.append("text")
      .attr("x", btnW / 2).attr("y", btnH / 2)
      .attr("fill", "#7fd9e6")
      .attr("font-size", mobile ? 10 : 11)
      .attr("font-weight", 500)
      .attr("font-family", "sans-serif")
      .attr("letter-spacing", "0.4px")
      .attr("text-anchor", "middle").attr("dominant-baseline", "middle")
      .attr("transform", `rotate(-90, ${btnW / 2}, ${btnH / 2})`)
      .text(mobile ? "P&L" : "View P&L");
  }

  // ============================================================
  // SHARE / SCREENSHOT
  // ============================================================

  async shareChartScreenshot() {
    const toolbar = document.getElementById(this.#objectIDs.toolsBtnsContainer);
    const dropdown = document.getElementById(`${this.#objectIDs.toolsBtnsContainer}-dropdown`);
    const card = toolbar?.closest(".stockChartCard");
    if (!card) return;

    const foreignObjects = [...card.querySelectorAll("foreignObject.note-textarea")];
    const snapshots = foreignObjects.map((fo) => {
      const container = fo.querySelector("div");
      const staticHTML = container ? container.innerHTML : "";
      const clone = fo.cloneNode(true);

      if (container) {
        const staticDiv = document.createElement("div");
        staticDiv.innerHTML = staticHTML;
        staticDiv.style.cssText = container.style.cssText;
        fo.innerHTML = "";
        fo.appendChild(staticDiv);
      }
      return { fo, clone };
    });

    foreignObjects.forEach((fo) => {
      const div = fo.querySelector("div");
      if (div) {
        const computed = window.getComputedStyle(div);
        div.style.background = computed.background;
        div.style.color = computed.color;
        div.style.fontFamily = computed.fontFamily;
        div.style.fontSize = computed.fontSize;
        div.style.padding = computed.padding;
        div.style.borderRadius = computed.borderRadius;
        div.style.border = computed.border;
      }
    });

    const loader = document.createElement("div");
    loader.id = "screenshot-loader";
    loader.style.cssText = `
      position: fixed; inset: 0; z-index: 999999;
      background: rgba(0,0,0,0.7);
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
    `;
    loader.innerHTML = `
      <style>
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
        #screenshot-loader .spinner {
          width: 44px; height: 44px;
          border: 3px solid rgba(255,255,255,0.1);
          border-top-color: #22d3ee; border-radius: 50%;
          animation: spin 0.7s linear infinite; margin-bottom: 16px;
        }
        #screenshot-loader .label {
          color: #fff; font-size: 14px; font-family: sans-serif;
          font-weight: 500; animation: pulse 1.2s ease infinite; letter-spacing: 0.3px;
        }
      </style>
      <div class="spinner"></div>
      <div class="label">Capturing screenshot…</div>
    `;
    document.body.appendChild(loader);

    if (toolbar) toolbar.style.visibility = "hidden";
    if (dropdown) dropdown.style.visibility = "hidden";

    try {
      const blob = await toBlob(card, {
        backgroundColor: "#0b1220",
        pixelRatio: 2,
        filter: (node) => node.id !== "screenshot-loader",
      });
      if (!blob) throw new Error("toBlob returned null");

      const imageUrl = URL.createObjectURL(blob);
      this.#showShareModal(imageUrl, blob);
    } catch (err) {
      console.error("Capture failed:", err);
      this.#showToast("❌ Capture failed");
    } finally {
      snapshots.forEach(({ fo, clone }) => { fo.innerHTML = clone.innerHTML; });
      if (toolbar) toolbar.style.visibility = "visible";
      if (dropdown) dropdown.style.visibility = "visible";
      loader.remove();
    }
  }

  #showShareModal(imageUrl, blob) {
    if (!document.getElementById("share-modal-styles")) {
      const style = document.createElement("style");
      style.id = "share-modal-styles";
      style.textContent = `
        @keyframes smFadeIn  { from{opacity:0}         to{opacity:1} }
        @keyframes smSlideUp { from{transform:translateY(24px);opacity:0} to{transform:translateY(0);opacity:1} }
        .te-modal *{box-sizing:border-box;margin:0;padding:0;}
        .te-modal button{font-family:inherit;cursor:pointer;}
        .te-close-btn:hover{background:#1a3050!important;color:#e2f0ff!important;}
        .te-copy-btn:hover{background:#0ea5e9!important;}
        .te-dl-btn:hover{background:#1a3050!important;border-color:#2a4a70!important;color:#e2f0ff!important;}
        .te-social-btn:hover{background:#1a3050!important;border-color:#2a4a70!important;}
        .te-social-btn:hover svg{color:#22d3ee;}
      `;
      document.head.appendChild(style);
    }

    const applyWatermark = (srcUrl) => new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0);

        const padding = Math.max(20, c.width * 0.02);
        const fontSize = Math.max(16, c.width * 0.025);
        const text = "tradeye.in";

        ctx.font = `600 ${fontSize}px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif`;
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.textAlign = "right";
        ctx.textBaseline = "bottom";
        ctx.fillText(text, c.width - padding, c.height - padding);

        resolve(c.toDataURL("image/png"));
      };
      img.src = srcUrl;
    });

    applyWatermark(imageUrl).then((wmDataUrl) => {
      const byteStr = atob(wmDataUrl.split(",")[1]);
      const ab = new ArrayBuffer(byteStr.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteStr.length; i++) ia[i] = byteStr.charCodeAt(i);
      const wmBlob = new Blob([ab], { type: "image/png" });

      const div = (css = "") => { const el = document.createElement("div"); el.style.cssText = css; return el; };
      const btn = (css = "") => { const el = document.createElement("button"); el.style.cssText = css; return el; };
      const span = (txt, css = "") => { const el = document.createElement("span"); el.style.cssText = css; el.textContent = txt; return el; };

      const shareUrl = "https://tradeye.in";
      const directLink = `tradeye.in/t/caplipoint-${Date.now().toString().slice(-4)}`;
      const captionText = `📈Trade captured & analysed on tradeye.in\nBacktested. Scored. Tracked — all in one place.\n#trading #stockmarket #tradeye`;
      const encodedCap = encodeURIComponent(`📈 Trade captured & analysed on tradeye.in — Backtested. Scored. Tracked. #trading #tradeye`);
      const encodedUrl = encodeURIComponent(shareUrl);

      const backdrop = div(`
        position:fixed;inset:0;background:rgba(0,0,0,0.82);
        z-index:99998;display:flex;align-items:center;justify-content:center;
        animation:smFadeIn 0.2s ease; padding:16px;
      `);
      backdrop.className = "te-modal";

      const modal = div(`
        background:#0d1b2a;border:1px solid #1a3050;border-radius:16px;
        width:500px;max-width:95vw; max-height:92vh; overflow-y:auto;
        box-shadow:0 24px 64px rgba(0,0,0,0.75);
        animation:smSlideUp 0.25s ease;
        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      `);

      const header = div(`
        display:flex;align-items:center;justify-content:space-between;
        padding:16px 20px 14px;border-bottom:1px solid #1a3050;
        position:sticky; top:0; background:#0d1b2a; z-index:1;
      `);
      const titleWrap = div(`display:flex;align-items:center;gap:10px;`);
      const titleIcon = div(`
        width:30px;height:30px;background:#0ea5e9;border-radius:8px;
        display:flex;align-items:center;justify-content:center;flex-shrink:0;
      `);
      titleIcon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`;
      titleWrap.appendChild(titleIcon);
      titleWrap.appendChild(span("Share Your Trade", "color:#e2f0ff;font-size:15px;font-weight:600;letter-spacing:0.2px;"));
      const closeBtn = btn(`
        width:28px;height:28px;border-radius:6px;border:1px solid #1a3050;
        background:transparent;color:#5a7a99;display:flex;align-items:center;
        justify-content:center;transition:all 0.15s;flex-shrink:0;
      `);
      closeBtn.className = "te-close-btn";
      closeBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
      header.appendChild(titleWrap);
      header.appendChild(closeBtn);

      const previewWrap = div(`padding:16px 20px 0;`);
      const previewImg = document.createElement("img");
      previewImg.src = wmDataUrl;
      previewImg.style.cssText = `width:100%;border-radius:10px;border:1px solid #1a3050;display:block;`;
      previewWrap.appendChild(previewImg);

      const linkSection = div(`padding:14px 20px 0;`);
      const linkLabel = div(`font-size:11px;color:#3a5a79;font-weight:600;letter-spacing:0.8px;text-transform:uppercase;margin-bottom:8px;`);
      linkLabel.textContent = "Direct Link";
      const linkRow = div(`display:flex;gap:8px;flex-wrap:wrap;`);

      const linkInput = document.createElement("input");
      linkInput.readOnly = true;
      linkInput.value = directLink;
      linkInput.style.cssText = `
        flex:1;background:#080f17;border:1px solid #1a3050;border-radius:8px;
        padding:10px 14px;font-size:13px;color:#6a8faa;font-family:inherit;outline:none;
        min-width:120px;
      `;

      const copyLinkBtn = btn(`
        padding:10px 18px;border-radius:8px;border:none;
        background:#0ea5e9;color:#fff;font-size:13px;font-weight:600;
        display:flex;align-items:center;gap:6px;white-space:nowrap;transition:background 0.15s;
      `);
      copyLinkBtn.className = "te-copy-btn";
      copyLinkBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> Copy Link`;
      copyLinkBtn.onclick = () => {
        navigator.clipboard.writeText(`https://${directLink}`).catch(() => { });
        showToast("Link copied!");
      };

      const dlBtn = btn(`
        padding:10px 16px;border-radius:8px;
        border:1px solid #1a3050;background:#0a1828;
        color:#a0bdd8;font-size:13px;font-weight:500;
        display:flex;align-items:center;gap:6px;white-space:nowrap;transition:all 0.15s;
      `);
      dlBtn.className = "te-dl-btn";
      dlBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download PNG`;
      dlBtn.onclick = () => {
        const a = document.createElement("a");
        a.href = wmDataUrl;
        a.download = `tradeye-${Date.now()}.png`;
        a.click();
        showToast("Downloaded!");
      };

      linkRow.appendChild(linkInput);
      linkRow.appendChild(copyLinkBtn);
      linkRow.appendChild(dlBtn);
      linkSection.appendChild(linkLabel);
      linkSection.appendChild(linkRow);

      const captionSection = div(`padding:14px 20px 0;`);
      const captionLabel = div(`font-size:11px;color:#3a5a79;font-weight:600;letter-spacing:0.8px;text-transform:uppercase;margin-bottom:8px;`);
      captionLabel.textContent = "Caption";
      const captionBox = div(`
        background:#080f17;border:1px solid #1a3050;border-radius:10px;
        padding:12px 14px;font-size:13px;color:#a0bdd8;line-height:1.65;
        white-space:pre-line;position:relative;
      `);
      captionBox.textContent = captionText;

      const copyCaptionBtn = btn(`
        position:absolute;top:10px;right:10px;
        background:transparent;border:1px solid #1a3050;border-radius:6px;
        padding:4px 8px;color:#3a5a79;font-size:11px;
        display:flex;align-items:center;gap:4px;transition:all 0.15s;
      `);
      copyCaptionBtn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
      copyCaptionBtn.onmouseenter = () => { copyCaptionBtn.style.background = "#1a3050"; copyCaptionBtn.style.color = "#e2f0ff"; };
      copyCaptionBtn.onmouseleave = () => { copyCaptionBtn.style.background = "transparent"; copyCaptionBtn.style.color = "#3a5a79"; };
      copyCaptionBtn.onclick = () => {
        navigator.clipboard.writeText(captionText).catch(() => { });
        showToast("Caption copied!");
      };
      captionBox.style.position = "relative";
      captionBox.appendChild(copyCaptionBtn);
      captionSection.appendChild(captionLabel);
      captionSection.appendChild(captionBox);

      const shareSection = div(`padding:16px 20px 20px;`);
      const shareLabel2 = div(`font-size:11px;color:#3a5a79;font-weight:600;letter-spacing:0.8px;text-transform:uppercase;margin-bottom:14px;text-align:center;`);
      shareLabel2.textContent = "Share On";
      const iconRow = div(`display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;`);

      const makeSocialBtn = (svgIcon, label, action) => {
        const b = btn(`
          width:48px;height:48px;border-radius:50%;
          border:1px solid #1a3050;background:#0a1828;
          display:flex;align-items:center;justify-content:center;
          transition:all 0.15s;color:#7a9bba;
        `);
        b.className = "te-social-btn";
        b.title = label;
        b.innerHTML = svgIcon;
        b.onclick = action;
        return b;
      };

      const socials = [
        {
          label: "Instagram",
          icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>`,
          action: () => {
            wmBlob && navigator.clipboard.write([new ClipboardItem({ "image/png": wmBlob })]).catch(() => { });
            showToast("Image copied — paste into Instagram!");
          },
        },
        {
          label: "X / Twitter",
          icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.845L1.254 2.25H8.08l4.261 5.632 5.903-5.632Zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`,
          action: () => window.open(`https://twitter.com/intent/tweet?text=${encodedCap}&url=${encodedUrl}`, "_blank", "noopener"),
        },
        {
          label: "Discord",
          icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.098.248-.198.373-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>`,
          action: () => {
            wmBlob && navigator.clipboard.write([new ClipboardItem({ "image/png": wmBlob })]).catch(() => { });
            showToast("Copied — paste into Discord!");
          },
        },
        {
          label: "Telegram",
          icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.244-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>`,
          action: () => window.open(`https://t.me/share/url?url=${encodedUrl}&text=${encodedCap}`, "_blank", "noopener"),
        },
        {
          label: "WhatsApp",
          icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.121 1.535 5.856L.057 23.04c-.07.304.206.58.51.51l5.184-1.478A11.95 11.95 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.96 0-3.8-.527-5.382-1.442l-.386-.228-4.003 1.142 1.142-4.003-.228-.386A9.951 9.951 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>`,
          action: () => window.open(`https://wa.me/?text=${encodedCap}%20${encodedUrl}`, "_blank", "noopener"),
        },
      ];

      const mobileFile = new File([wmBlob], "tradeye-trade.png", { type: "image/png" });
      if (/iPhone|iPad|Android/i.test(navigator.userAgent) && navigator.canShare?.({ files: [mobileFile] })) {
        socials.unshift({
          label: "Share",
          icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`,
          action: async () => {
            try { await navigator.share({ title: "My Trade on Tradeye", text: "📈 Trade captured & analysed on tradeye.in", files: [mobileFile] }); } catch { }
          },
        });
      }

      socials.forEach(({ icon, label, action }) => iconRow.appendChild(makeSocialBtn(icon, label, action)));

      shareSection.appendChild(shareLabel2);
      shareSection.appendChild(iconRow);

      const toast = div(`
        margin:0 20px 16px;background:rgba(34,211,238,0.08);
        border:1px solid rgba(34,211,238,0.2);border-radius:8px;
        padding:8px 12px;font-size:12px;color:#22d3ee;
        align-items:center;gap:6px;display:none;
      `);
      toast.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg><span id="te-toast-msg"></span>`;

      let toastTimer;
      const showToast = (msg) => {
        document.getElementById("te-toast-msg").textContent = msg;
        toast.style.display = "flex";
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { toast.style.display = "none"; }, 2500);
      };

      modal.appendChild(header);
      modal.appendChild(previewWrap);
      modal.appendChild(linkSection);
      modal.appendChild(captionSection);
      modal.appendChild(shareSection);
      modal.appendChild(toast);
      backdrop.appendChild(modal);
      document.body.appendChild(backdrop);

      const close = () => { backdrop.remove(); URL.revokeObjectURL(imageUrl); };
      closeBtn.onclick = close;
      backdrop.onclick = (e) => { if (e.target === backdrop) close(); };
    });
  }

  #showToast(message) {
    const existing = document.getElementById(`${this.id}-toast`);
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = `${this.id}-toast`;
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed; bottom: 32px; left: 50%; transform: translateX(-50%);
      background: #1e3a2f; color: #22d3ee; border: 1px solid #22d3ee;
      padding: 10px 20px; border-radius: 8px; font-size: 13px; font-family: sans-serif;
      z-index: 99999; box-shadow: 0 4px 16px rgba(0,0,0,0.4);
      opacity: 1; transition: opacity 0.4s ease;
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 400);
    }, 2500);
  }

  #renderFullscreenButton() {
    const mobile = this.#isMobile();
    const size = mobile ? 34 : 30;
    const wrap = d3.select(`#${this.id}`);

    wrap.select(`.fullscreen-btn`).remove();

    const btn = wrap.append("div")
      .attr("class", "fullscreen-btn")
      .style("position", "absolute")
      .style("bottom", "10px").style("right", "10px")
      .style("width", `${size}px`).style("height", `${size}px`)
      .style("display", "flex").style("align-items", "center").style("justify-content", "center")
      .style("background", "#0f1923")
      .style("border", "1px solid #2a3a4a")
      .style("border-radius", "6px")
      .style("cursor", "pointer")
      .style("z-index", "9998")
      .html(this.#isFullscreen
        ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3"/></svg>`
        : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/></svg>`);

    btn.on("click", () => this.#toggleFullscreen());
  }

  async #toggleFullscreen() {
    const wrapEl = document.getElementById(this.id);
    if (!document.fullscreenElement) {
      await wrapEl.requestFullscreen?.().catch(() => { });
    } else {
      await document.exitFullscreen?.().catch(() => { });
    }
  }

  #bindFullscreenEvents() {
    document.addEventListener("fullscreenchange", () => {
      this.#isFullscreen = document.fullscreenElement === document.getElementById(this.id);
      this.#checkOrientation();
      this.setConfig({
        width: this.#isFullscreen ? window.innerWidth : this.#config.width,
        height: this.#isFullscreen ? window.innerHeight : this.#config.height,
      });
      this.draw();
    });
    window.addEventListener("orientationchange", () => this.#checkOrientation());
    this.#checkOrientation();
  }

  #checkOrientation() {
    const isPortrait = window.innerHeight > window.innerWidth;
    if (this.#isMobile() && isPortrait) this.#showRotatePrompt();
    else this.#hideRotatePrompt();
  }

  #showRotatePrompt() {
    if (this.#rotatePromptEl) return;

    this.#rotatePromptEl = d3.select(`#${this.id}`)
      .append("div")
      .style("position", "absolute").style("inset", "0")
      .style("background", "rgba(5,8,14,0.92)")
      .style("z-index", "99999")
      .style("display", "flex").style("flex-direction", "column")
      .style("align-items", "center").style("justify-content", "center")
      .style("gap", "16px");

    this.#rotatePromptEl.html(`
      <style>
        @keyframes tiltPhone { 0%,100%{transform:rotate(0deg)} 50%{transform:rotate(90deg)} }
        .rotate-icon { animation: tiltPhone 1.6s ease-in-out infinite; }
      </style>
      <svg class="rotate-icon" width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="7" y="2" width="10" height="20" rx="2"/><line x1="11" y1="18" x2="13" y2="18"/>
      </svg>
      <div style="color:#fff;font-family:sans-serif;font-size:14px;font-weight:600;text-align:center;padding:0 20px;">
        Rotate your device for a better view
      </div>
    `);

    this.#rotatePromptEl.append("button")
      .style("background", "transparent").style("border", "1px solid #2a3a4a")
      .style("color", "#aaa").style("border-radius", "6px")
      .style("padding", "8px 20px").style("font-size", "13px").style("cursor", "pointer")
      .text("Close").on("click", () => this.#hideRotatePrompt());
  }

  #hideRotatePrompt() {
    this.#rotatePromptEl?.remove();
    this.#rotatePromptEl = null;
  }
}

export default CandleStickChart;