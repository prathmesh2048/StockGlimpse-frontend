import * as d3 from 'd3';
import {
  annotation,
  annotationLabel,
  annotationCalloutCurve,
  annotationCustomType,
  annotationCalloutRect
} from 'd3-svg-annotation';

import { colors, config, getCursorPoint, parseDate, modifyAnnotationEnd } from './CandleStickChartUtils.js';
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

  setData(newData) {
    this.data = newData;
    this.#filteredData = newData;
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
    console.log("this.#config.xLabelWidth ", this.#config.xLabelWidth);
    this.#config.paddingLeft = this.#config.xLabelWidth * 0.3;
  }

  #calculateSvgWidth() {
    this.#config.svgWidth =
      this.#config.width -
      (this.#config.paddingLeft + this.#config.paddingRight) -
      2;

  }

  #calculateSvgHeight() {
    this.#config.svgHeight =
      this.#config.height -
      (this.#config.paddingBottom + this.#config.paddingTop + 6);
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
    d3.select(`#${this.id}`)
      .style(
        'padding',
        `${this.#config.paddingTop}px ${this.#config.paddingRight}px ${this.#config.paddingBottom
        }px ${this.#config.paddingLeft}px`
      )
      .style('display', 'inline-block')
      .attr('width', this.#config.width)
      .attr('height', this.#config.height)
      .append('svg')
      .attr('width', this.#config.svgWidth)
      .attr('height', this.#config.svgHeight)
      .style('overflow', 'inherit')
      .style('cursor', 'crosshair')
      .style('background-color', this.#colors.gridBackground) // backgroundColor
      .attr('id', this.#objectIDs.svgId)
      .style('margin-top', '-50px');
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
      .tickSize(this.#config.svgHeight);

    d3.select(`#${this.#objectIDs.svgId}`)
      .append('g')
      .attr('id', this.#objectIDs.xAxisId)
      .call(xAxis);

    d3.selectAll(`#${this.#objectIDs.xAxisId} g text`).attr(
      'transform',
      'translate(0,10)'
    );

    let gridColor = this.#colors.grid;
    d3.selectAll(`#${this.#objectIDs.xAxisId} .tick line`).each(function (
      d,
      i
    ) {
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

  #createToolsBtns() {

    d3.select(`#${this.#objectIDs.toolsBtnsContainer}`).remove();

    d3.select(`#${this.id}`)
      .selectAll()
      .data([0])
      .enter()
      .append('div')
      .attr('id', this.#objectIDs.toolsBtnsContainer)
      .style('display', 'flex')
      .style('height', '60px')
      .style('pointer-events', 'none')
      .style('justify-content', 'end')
      .style('gap', '10px')
      .style(
        'padding-right',
        window.innerWidth > this.#config.mobileBreakPoint ? '10px' : '0'
      )
      .style('position', 'relative');

    const btns = [
      { id: 0, tooltip: "Reset Zoom", icon: "<svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 20 20'><g fill='none' fill-rule='evenodd' stroke='white' stroke-linecap='round' stroke-linejoin='round' transform='matrix(0 1 1 0 2.5 2.5)'><path d='m3.98652376 1.07807068c-2.38377179 1.38514556-3.98652376 3.96636605-3.98652376 6.92192932 0 4.418278 3.581722 8 8 8s8-3.581722 8-8-3.581722-8-8-8'/><path d='m4 1v4h-4' transform='matrix(1 0 0 -1 0 6)'/></g></svg>" },
      { id: 1, tooltip: "Select Zoom Area", icon: "<svg xmlns=\'http://www.w3.org/2000/svg\' fill=\'${this.#colors.deActiveTools}\' width=\'18\' height=\'18\' viewBox=\'2 2 30 30\' id=\'icon\'><path d=\'M31,29.5859l-4.6885-4.6884a8.028,8.028,0,1,0-1.414,1.414L29.5859,31ZM20,26a6,6,0,1,1,6-6A6.0066,6.0066,0,0,1,20,26Z\'/><path d=\'M8,26H4a2.0021,2.0021,0,0,1-2-2V20H4v4H8Z\'/><rect x=\'2\' y=\'12\' width=\'2\' height=\'4\'/><path d=\'M26,8H24V4H20V2h4a2.0021,2.0021,0,0,1,2,2Z\'/><rect x=\'12\' y=\'2\' width=\'4\' height=\'2\'/><path d=\'M4,8H2V4A2.0021,2.0021,0,0,1,4,2H8V4H4Z\'/><rect id=\'_Transparent_Rectangle_\' data-name=\'&lt;Transparent Rectangle&gt;\' fill=\'none\' width=\'32\' height=\'32\'/></svg>'" },
      { id: 2, tooltip: "Pan (Move Chart)", icon: "<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'21\' height=\'21\' viewBox=\'0 0 512 512\'><title>pan</title><g fill=\'${this.#colors.deActiveTools}\' transform=\'translate(42.666667,42.666667)\'><path d=\'M234.666667,256 L234.666667,341.333333 L277.333333,341.333333 L213.333333,426.666667 L149.333333,341.333333 L192,341.333333 L192,256 L234.666667,256 Z M341.333333,149.333333 L426.666667,213.333333 L341.333333,277.333333 L341.333333,234.666667 L256,234.666667 L256,192 L341.333333,192 L341.333333,149.333333 Z M85.3333333,149.333333 L85.3333333,192 L170.666667,192 L170.666667,234.666667 L85.3333333,234.666667 L85.3333333,277.333333 L0,213.333333 L85.3333333,149.333333 Z M213.333333,0 L277.333333,85.3333333 L234.666667,85.3333333 L234.666667,170.666667 L192,170.666667 L192,85.3333333 L149.333333,85.3333333 L213.333333,0 Z\'/></g></svg>" },
      { id: 3, tooltip: "Draw Line", icon: "<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'><defs><marker id='arrow' markerWidth='4' markerHeight='4' refX='3.5' refY='2' orient='auto'><path d='M0,0 L0,4 L4,2 z' fill='white'/></marker></defs><line x1='5' y1='19' x2='19' y2='5' stroke='white' stroke-width='2' stroke-linecap='round' marker-end='url(#arrow)'/></svg>" },
      { id: 4, tooltip: "Ruler / Scale", icon: "<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' class='lucide lucide-ruler-icon'><path d='M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z'/><path d='m14.5 12.5 2-2'/><path d='m11.5 9.5 2-2'/><path d='m8.5 6.5 2-2'/><path d='m17.5 15.5 2-2'/></svg>" },
      { id: 5, tooltip: "Switch Chart Type", icon: "<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><line x1='6' y1='4' x2='6' y2='20'/><rect x='4.5' y='8' width='3' height='8'/><line x1='12' y1='2' x2='12' y2='22'/><rect x='10.5' y='6' width='3' height='12'/><line x1='18' y1='4' x2='18' y2='20'/><rect x='16.5' y='10' width='3' height='4'/></svg>" }
    ];

    // render buttons
    const container = d3.select(`#${this.#objectIDs.toolsBtnsContainer}`);

    btns.forEach(btn => {
      const el = container.append('div')
        .attr('id', `tools-btn-${btn.id}`)
        .style('width', '28px')
        .style('height', '28px')
        .style('border', `1px solid ${this.#colors.deActiveTools}`)
        .style('border-radius', '4px')
        .style('cursor', 'pointer')
        .style('display', 'flex')
        .style('pointer-events', 'auto')
        .style('justify-content', 'center')
        .style('align-items', 'center')
        .style('position', 'relative')
        .html(btn.icon);

      el.append('title').text(btn.tooltip);
    });
  }


  #modeHandler(mode) {

    this.#mode = mode;

    const btn0 = `#${this.#objectIDs.toolsBtnsContainer} #tools-btn-0`;
    const btn1 = `#${this.#objectIDs.toolsBtnsContainer} #tools-btn-1`;
    const btn2 = `#${this.#objectIDs.toolsBtnsContainer} #tools-btn-2`;
    const btn3 = `#${this.#objectIDs.toolsBtnsContainer} #tools-btn-3`;
    const btn4 = `#${this.#objectIDs.toolsBtnsContainer} #tools-btn-4`;

    // 🆕 Updated: Added btn4 in reset loop
    [btn0, btn1, btn2, btn3, btn4].forEach((selector) => {
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

  #mouseMoveLockers(d) {
    this.#lockSelectorX = true;
    //x line
    this.#xLineHandler(d);

    //x label
    this.#xLabelHandler(d);

    //info
    this.#candleInfoHandler(d);
  }

  #mouseLeaveLocker(d) {
    this.#lockSelectorX = false;
    this.#candleInfoLeaveHandler();
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
      console.log('Measure complete');
      // 🧠 Lock out trailing mousemove
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
        console.log("Annotation dragged:", ann);
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

    d3.select(`#${this.#objectIDs.toolsBtnsContainer} #tools-btn-0`).on(
      'click',
      function (e, d) {
        thisProxy.#handleResetZoom();
      }
    );

    d3.select(`#${this.#objectIDs.toolsBtnsContainer} #tools-btn-1`).on(
      'click',
      function (e, d) {
        thisProxy.#modeHandler('zoom');
      }
    );

    d3.select(`#${this.#objectIDs.toolsBtnsContainer} #tools-btn-2`).on(
      'click',
      function (e, d) {
        thisProxy.#modeHandler('pan');
      }
    );

    d3.select(`#${this.#objectIDs.toolsBtnsContainer} #tools-btn-3`).on(
      'click',
      function (e, d) {
        thisProxy.#modeHandler('draw');
      }
    );

    d3.select(`#${this.#objectIDs.toolsBtnsContainer} #tools-btn-4`).on(
      'click',
      function (e, d) {
        thisProxy.#modeHandler('measure');
      }
    );

    d3.select(`#${this.#objectIDs.toolsBtnsContainer} #tools-btn-5`).on(
      'click',
      function (e, d) {
        thisProxy.toggleChartMode();
      }
    );


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

    const handleWidth = 5;
    const handleHeight = height * 0.2;
    const handleYOffset = (height - handleHeight) / 2;
    const minWidth = handleWidth * 2 + 6;
    const closeSize = 14;

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

    // handles
    const leftHandle = brushLayer.append("rect")
      .attr("y", handleYOffset)
      .attr("width", handleWidth)
      .attr("height", handleHeight)
      .attr("fill", "rgba(228,228,20,0.9)")
      .attr("stroke", "#888")
      .attr("cursor", "ew-resize");

    const rightHandle = brushLayer.append("rect")
      .attr("y", handleYOffset)
      .attr("width", handleWidth)
      .attr("height", handleHeight)
      .attr("fill", "rgba(228,228,20,0.9)")
      .attr("stroke", "#888")
      .attr("cursor", "ew-resize");

    // close button
    const closeBtn = brushLayer.append("g")
      .attr("cursor", "pointer")
      .on("pointerdown", e => e.stopPropagation())
      .on("click", () => {
        this.#isPnLWindowClosed = true;
        brushLayer.remove()
        this.draw(); // redraw to remove brush
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

    const update = () => {
      winX = Math.round(winX);
      winWidth = Math.round(winWidth);

      windowRect
        .attr("x", winX)
        .attr("width", winWidth);

      leftHandle.attr("x", winX - handleWidth / 2);
      rightHandle.attr("x", winX + winWidth - handleWidth / 2);

      closeBtn.attr(
        "transform",
        `translate(${winX + winWidth - closeSize / 2 - 4},${closeSize / 2 + 4})`
      );

      // Drawing Gradient Area Inside Brush Window
      drawBrushGradient(winX, winWidth, brushLayer, this.getChartData(), this.getAnnotationsData(), this.#objectIDs.svgId, this.getXScaleFunc(), this.getYScaleFunc());
    };

    update();

    // Drawing Gradient Area Inside Brush Window
    drawBrushGradient(winX, winWidth, brushLayer, this.getChartData(), this.getAnnotationsData(), this.#objectIDs.svgId, this.getXScaleFunc(), this.getYScaleFunc());

    // drag window
    windowRect.call(
      d3.drag()
        .on("start", e => e.sourceEvent.stopPropagation())
        .on("drag", e => {
          winX = Math.max(0, Math.min(width - winWidth, e.x));
          update();
        })
    );

    // left handle drag
    leftHandle.call(
      d3.drag()
        .on("start", e => e.sourceEvent.stopPropagation())
        .on("drag", e => {
          const newX = Math.max(0, Math.min(winX + winWidth - minWidth, e.x));
          winWidth += winX - newX;
          winX = newX;
          update();
        })
    );

    // right handle drag
    rightHandle.call(
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
    this.#addEventListeners();
    this.#drawStaticAnnotationFromData();
    this.#redrawCachedLines();
    this.#renderBrush();
    this.#renderPnLToggleButton();
  }

}

export default CandleStickChart;