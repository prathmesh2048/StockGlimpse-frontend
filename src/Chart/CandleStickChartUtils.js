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
    infoTextWidth: undefined,
    infoTextWidthMeta: undefined,
    yLabelWidth: undefined,
    paddingRight: undefined,
    svgWidth: undefined,
    svgHeight: undefined,
  };
};