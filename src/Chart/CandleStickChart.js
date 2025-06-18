import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';

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

export const colors = () => {
  return {
    grid: '#222631',
    background: '#171b26',
    candleInfoText: '#b2b5be',
    candleInfoTextUp: '#089981',
    candleInfoTextDown: '#e13443',
    tickColor: '#020814',
    downCandlesStroke: '#e13443',
    downCandlesFill: '#e13443',
    downCandlesTail: '#e13443',
    upCandlesStroke: '#089981',
    upCandlesFill: '#089981',
    upCandlesTail: '#089981',
    selectorLine: 'rgba(178,181,190,0.5)',
    selectorLableBackground: '#2a2e39',
    selectorLabelText: '#b2b5be',
    short: '#fff',
    shortStroke: '#fff',
    long: '#fff',
    longStroke: '#fff',
    sl: '#F9DB04',
    slStroke: '#F9DB04',
    tp: '#04F5F9',
    tpStroke: '#04F5F9',
    activeTools: '#04F5F9',
    deActiveTools: '#ffffff',
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
    decimal: 3,
    charWidth: 7.8,
    selectoreStrokeDashArray: '2,2',
    timeFormat: "%a %d %b'%y",
    mobileBreakPoint: 600,
    //calcualte after set data//
    infoTextWidth: undefined,
    infoTextWidthMeta: undefined,
    yLabelWidth: undefined,
    paddingRight: undefined,
    svgWidth: undefined,
    svgHeight: undefined,
  };
};

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


  constructor(width, height, data, id) {
    this.#colors = colors();
    this.#config = config(width, height);
    this.#maxPrice = d3.max(data.map((x) => x.High));
    this.data = data.sort((a, b) => parseDate(a) - parseDate(b));
    this.#filteredData = data;
    this.id = id;
    this.#lockSelectorX = false;
    this.#calculateExtendConfigs();
    this.#setObjectIDs();
    let minMaxDate = d3.extent(data.map((x) => parseDate(x.Date)));
    this.#calculateCandleWidthDate();
    this.#minMaxDate = minMaxDate;
    this.#zoomRange1 = minMaxDate[0].getTime() - this.#candleWidthDate / 2;
    this.#zoomRange2 = minMaxDate[1].getTime() + this.#candleWidthDate / 2;
    this.#createToolsBtns();
    this.#measureState = {
      active: false,
      start: null,
      rect: null,
      label: null,
    };

    this.#modeHandler('pan');
  }

  setData(newData) {
    this.data = newData;
    this.#filteredData = this.data;
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
      .style('background-color', '#171b26') // backgroundColor
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
    d3.selectAll(`#${this.#objectIDs.candleContainerId} .candle`)
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
  }

  #createCandlesHigh() {

    d3.selectAll(`#${this.#objectIDs.candleContainerId} .candle`)
      .append('rect')
      .attr('width', this.#config.candleTailWidth)
      .attr('height', (d) => {

        return d.Open > d.Close
          ? this.#yScaleFunc(d.Open) - this.#yScaleFunc(d.High)
          : this.#yScaleFunc(d.Close) - this.#yScaleFunc(d.High);
      })

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

  #createShortPositions() {
    d3.select(
      `#${this.#objectIDs.svgId} foreignObject #${this.#objectIDs.candleContainerId
      }`
    )
      .selectAll()
      .data(this.#filteredData.filter((x) => x.short))
      .enter()
      .append('polygon')
      .attr(
        'points',
        (d) =>
          `${this.#xScaleFunc(parseDate(d.Date)) - this.#candleWidth / 2
          },${this.#yScaleFunc(d.short)} ${this.#xScaleFunc(parseDate(d.Date)) + this.#candleWidth / 2
          },${this.#yScaleFunc(d.short)} ${this.#xScaleFunc(
            parseDate(d.Date)
          )},${this.#yScaleFunc(d.short) + this.#candleWidth / 1.5}`
      )
      .attr('fill', this.#colors.short)
      .attr('stroke', this.#colors.shortStroke)
      .attr('class', 'short');
  }

  #createLongPositions() {
    d3.select(
      `#${this.#objectIDs.svgId} foreignObject #${this.#objectIDs.candleContainerId
      }`
    )
      .selectAll()
      .data(this.#filteredData.filter((x) => x.long))
      .enter()
      .append('polygon')
      .attr(
        'points',
        (d) =>
          `${this.#xScaleFunc(parseDate(d.Date)) - this.#candleWidth / 2
          },${this.#yScaleFunc(d.long)} ${this.#xScaleFunc(parseDate(d.Date)) + this.#candleWidth / 2
          },${this.#yScaleFunc(d.long)} ${this.#xScaleFunc(
            parseDate(d.Date)
          )},${this.#yScaleFunc(d.long) - this.#candleWidth / 1.5}`
      )
      .attr('fill', this.#colors.long)
      .attr('stroke', this.#colors.longStroke)
      .attr('class', 'long');
  }

  #createStopLosses() {
    d3.select(
      `#${this.#objectIDs.svgId} foreignObject #${this.#objectIDs.candleContainerId
      }`
    )
      .selectAll()
      .data(this.#filteredData.filter((x) => x.short || x.long))
      .enter()
      .append('rect')
      .attr('width', this.#candleWidth * 1.6)
      .attr('height', 3)
      .attr(
        'x',
        (d) => this.#xScaleFunc(parseDate(d.Date)) - this.#candleWidth / 1.2
      )
      .attr('y', (d) => this.#yScaleFunc(d.sl))
      .attr('fill', this.#colors.sl)
      .attr('stroke', this.#colors.slStroke)
      .attr('class', 'sl');
  }

  #createTakeProfits() {
    d3.select(
      `#${this.#objectIDs.svgId} foreignObject #${this.#objectIDs.candleContainerId
      }`
    )
      .selectAll()
      .data(this.#filteredData.filter((x) => x.short || x.long))
      .enter()
      .append('rect')
      .attr('width', this.#candleWidth * 1.6)
      .attr('height', 3)
      .attr(
        'x',
        (d) => this.#xScaleFunc(parseDate(d.Date)) - this.#candleWidth / 1.2
      )
      .attr('y', (d) => this.#yScaleFunc(d.tp))
      .attr('fill', this.#colors.tp)
      .attr('stroke', this.#colors.tpStroke)
      .attr('class', 'tp');
  }

  #createToolsBtns() {
    d3.select(`#${this.id}`)
      .selectAll()
      .data([0])
      .enter()
      .append('div')
      .attr('id', this.#objectIDs.toolsBtnsContainer)
      .style('display', 'flex')
      .style('height', '40px')
      .style('justify-content', 'end')
      .style('gap', '10px')
      .style(
        'padding-right',
        window.innerWidth > this.#config.mobileBreakPoint ? '20px' : '0'
      )
      .style('position', 'relative')
      .style('z-index', '2');

    d3.select(`#${this.#objectIDs.toolsBtnsContainer}`)
      .selectAll()
      .data([0, 1, 2, 3, 4]) // ← Added 4 here
      .enter()
      .append('div')
      .attr('id', (d) => `tools-btn-${d}`)
      .style('width', '24px')
      .style('height', '24px')
      .style('border', `1px solid ${this.#colors.deActiveTools}`)
      .style('border-radius', '4px')
      .style('cursor', 'pointer')
      .style('display', 'flex')
      .style('justify-content', 'center')
      .style('align-items', 'center');

    document.querySelector(
      `#${this.#objectIDs.toolsBtnsContainer} #tools-btn-0`
    ).innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 20 20">
      <g fill="none" fill-rule="evenodd" stroke="${this.#colors.deActiveTools
      }" stroke-linecap="round" stroke-linejoin="round" transform="matrix(0 1 1 0 2.5 2.5)">
      <path d="m3.98652376 1.07807068c-2.38377179 1.38514556-3.98652376 3.96636605-3.98652376 6.92192932 0 4.418278 3.581722 8 8 8s8-3.581722 8-8-3.581722-8-8-8"/>
      <path d="m4 1v4h-4" transform="matrix(1 0 0 -1 0 6)"/>
      </g>
    </svg>`;

    document.querySelector(
      `#${this.#objectIDs.toolsBtnsContainer} #tools-btn-1`
    ).innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" fill="${this.#colors.deActiveTools
      }" width="18" height="18" viewBox="2 2 30 30" id="icon">
      <defs>
        <style>
          .cls-1 {
            fill: none;
          }
        </style>
      </defs>
      <path d="M31,29.5859l-4.6885-4.6884a8.028,8.028,0,1,0-1.414,1.414L29.5859,31ZM20,26a6,6,0,1,1,6-6A6.0066,6.0066,0,0,1,20,26Z"/>
      <path d="M8,26H4a2.0021,2.0021,0,0,1-2-2V20H4v4H8Z"/>
      <rect x="2" y="12" width="2" height="4"/>
      <path d="M26,8H24V4H20V2h4a2.0021,2.0021,0,0,1,2,2Z"/>
      <rect x="12" y="2" width="4" height="2"/>
      <path d="M4,8H2V4A2.0021,2.0021,0,0,1,4,2H8V4H4Z"/>
      <rect id="_Transparent_Rectangle_" data-name="&lt;Transparent Rectangle&gt;" class="cls-1" width="32" height="32"/>
    </svg>`;

    document.querySelector(
      `#${this.#objectIDs.toolsBtnsContainer} #tools-btn-2`
    ).innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="21" height="21" viewBox="0 0 512 512" version="1.1">
      <title>pan</title>
      <g id="Page-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
          <g id="drop" fill="${this.#colors.deActiveTools
      }" transform="translate(42.666667, 42.666667)">
              <path d="M234.666667,256 L234.666667,341.333333 L277.333333,341.333333 L213.333333,426.666667 L149.333333,341.333333 L192,341.333333 L192,256 L234.666667,256 Z M341.333333,149.333333 L426.666667,213.333333 L341.333333,277.333333 L341.333333,234.666667 L256,234.666667 L256,192 L341.333333,192 L341.333333,149.333333 Z M85.3333333,149.333333 L85.3333333,192 L170.666667,192 L170.666667,234.666667 L85.3333333,234.666667 L85.3333333,277.333333 L3.55271368e-14,213.333333 L85.3333333,149.333333 Z M213.333333,3.55271368e-14 L277.333333,85.3333333 L234.666667,85.3333333 L234.666667,170.666667 L192,170.666667 L192,85.3333333 L149.333333,85.3333333 L213.333333,3.55271368e-14 Z" id="Combined-Shape">
              </path>
          </g>
      </g>
    </svg>`;

    // New Draw button (3)
    document.querySelector(
      `#${this.#objectIDs.toolsBtnsContainer} #tools-btn-3`
    ).innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${this.#colors.deActiveTools}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="2" y1="21" x2="21" y2="2"></line>
      <polyline points="17 2 21 2 21 6"></polyline>
    </svg>`;

    document.querySelector(
      `#${this.#objectIDs.toolsBtnsContainer} #tools-btn-4`
    ).innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="${this.#colors.deActiveTools}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 7h16M4 12h8m-8 5h16"/>
    </svg>`;

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
    this.#zoomRange2 =
      this.#minMaxDate[1].getTime() + this.#candleWidthDate / 2;
    this.#filteredData = this.data;
    this.#zoomFactor = 1;
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
        .attr('stroke', 'white')
        .attr('stroke-width', 1.5);
    } else {

      this.#drawPoint2 = { x: location.x, y: location.y };

      svg.append('line')
        .attr('x1', this.#drawPoint1.x)
        .attr('y1', this.#drawPoint1.y)
        .attr('x2', this.#drawPoint2.x)
        .attr('y2', this.#drawPoint2.y)
        .attr('stroke', 'white')
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
      });

    }
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
      // 🧠 Lock out trailing mousemove
      this.#drawAndMeasureLocked = true;
      d3.select(`#${this.#objectIDs.svgId}`).on('mousemove.measure', null);
  
      // Reset in next frame
      requestAnimationFrame(() => {
        this.#measureState.start = null;
        this.#measureState.rect = null;
        this.#measureState.label = null;
        this.#drawAndMeasureLocked = false;
      });
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

  #addEvenetListeners() {

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
    this.#createShortPositions();
    this.#createLongPositions();
    this.#createStopLosses();
    this.#createTakeProfits();
    this.#addEvenetListeners();
  }
}

export default CandleStickChart;


// let chart = new CandleStickChart(
//   window.innerWidth,
//   window.innerHeight - 50,
//   data,
//   'chart1'
// );
// chart.draw();

// window.addEventListener('resize', () => {
//   chart.setConfig({
//     width: window.innerWidth,
//     height: window.innerHeight - 50,
//   });
//   chart.draw();
// });
