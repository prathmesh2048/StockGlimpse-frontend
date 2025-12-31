import * as d3 from "d3";

export function drawTradeGradientAreas(ctx, group) {
  if (ctx.getChartMode() !== "line") return;

  const annotations = ctx.getAnnotationsData() || [];
  if (!annotations.length) return;

  // Pair up buys & sells
  const buySells = [];
  let lastBuy = null;
  for (const ann of annotations) {
    if (ann.transactionType === "buy") {
      lastBuy = ann;
    } else if (ann.transactionType === "sell" && lastBuy) {
      buySells.push([lastBuy, ann]);
      lastBuy = null;
    }
  }
  if (!buySells.length) return;

  let defs = d3
    .select(`#${ctx.getObjectIDs().candleContainerId}`)
    .select("defs");
  if (defs.empty())
    defs = d3.select(`#${ctx.getObjectIDs().candleContainerId}`).append("defs");

  for (const [buy, sell] of buySells) {
    const profit = sell.Close - buy.Close;
    const gradientId = `tradeGradient_${buy.Date}_${sell.Date}`;

    if (defs.select(`#${gradientId}`).empty()) {
      const gradient = defs
        .append("linearGradient")
        .attr("id", gradientId)
        .attr("x1", "0")
        .attr("y1", "0")
        .attr("x2", "0")
        .attr("y2", "1");

      const color = profit >= 0 ? "19,201,92" : "201,19,19"; // green if profit, red if loss
      gradient
        .append("stop")
        .attr("offset", "0%")
        .attr("stop-color", `rgba(${color},0.4)`);
      gradient
        .append("stop")
        .attr("offset", "100%")
        .attr("stop-color", `rgba(${color},0)`);
    }

    const area = d3
      .area()
      .x((d) => ctx.getXScaleFunc()(new Date(d.Date)))
      .y0(d3.max(ctx.getYScaleFunc().range()))
      .y1((d) => ctx.getYScaleFunc()(d.Close));

    const start = new Date(buy.Date);
    const end = new Date(sell.Date);

    const slice = ctx.getChartData().filter((d) => {
      const t = new Date(d.Date);
      return t >= start && t <= end;
    });
    if (!slice.length) continue;

    group
      .insert("path", ":first-child")
      .datum(slice)
      .attr("d", area)
      .attr("fill", `url(#${gradientId})`)
      .attr("class", "trade-gradient")
      .attr("pointer-events", "none");

    const path = group
      .insert("path", ":first-child")
      .datum(slice)
      .attr("d", area)
      .attr("fill", `url(#${gradientId})`)
      .attr("class", "trade-gradient")
      .attr("pointer-events", "none");

    // horizontal midpoint between buy & sell
    const midX =
      (ctx.getXScaleFunc()(new Date(buy.Date)) +
        ctx.getXScaleFunc()(new Date(sell.Date))) /
      2;

    // a bit above the bottom of chart
    const bottomY = d3.max(ctx.getYScaleFunc().range());
    const offset = 20;

    group
      .append("text")
      .attr("x", midX)
      .attr("y", bottomY - offset)
      .attr("text-anchor", "middle")
      .attr("fill", profit >= 0 ? "limegreen" : "red")
      .style("font-weight", "bold")
      .style("font-size", "12px")
      .text(
        `${profit >= 0 ? "+" : "-"} ${((profit / buy.Close) * 100).toFixed(2)}%  ( ₹${Math.abs(profit.toFixed(2))} )`,
      );
  }
}

export function placeWithoutOverlap(newAnn, existing) {
  let dx = newAnn.dx;
  let dy = newAnn.dy;

  const step = 25; // how much to push until it clears
  let tries = 0;

  while (tries < 20) {
    const newBox = {
      x: newAnn.x + dx,
      y: newAnn.y + dy,
      w: 150,
      h: 60,
    };

    const collides = existing.some(
      (b) =>
        !(
          newBox.x > b.x + b.w ||
          newBox.x + newBox.w < b.x ||
          newBox.y > b.y + b.h ||
          newBox.y + newBox.h < b.y
        ),
    );

    if (!collides) return { dx, dy };

    dx += step; // try spaced horizontal shift
    dy += step; // try spaced vertical shift
    tries++;
  }

  return { dx, dy };
}

export function drawBrushGradient(
  winX,
  winWidth,
  brushLayer,
  chartData,
  annotationData,
  element,
  xScaleFunc,
  yScaleFunc,
) {
  if (!chartData?.length) return;

  let defs = d3.select(`#${element}`).select("defs");
  if (defs.empty()) defs = d3.select(`#${element}`).append("defs");

  // data inside brush window
  const visibleData = chartData.filter((d) => {
    const x = xScaleFunc(new Date(d.Date));
    return x >= winX && x <= winX + winWidth;
  });
  if (!visibleData.length) return;

  // decide trend
  const first = visibleData[0].Close;
  const last = visibleData[visibleData.length - 1].Close;
  const isUp = last >= first;
  const color = isUp ? "19,201,92" : "201,19,19";

  // cleanup old path
  brushLayer.selectAll("path.brush-gradient").remove();

  // unique gradient per state (green / red)
  const gradientId = `brushGradient-${isUp ? "up" : "down"}`;

  // recreate gradient every time (color can change)
  defs.select(`#${gradientId}`).remove();

  const gradient = defs
    .append("linearGradient")
    .attr("id", gradientId)
    .attr("x1", "0")
    .attr("y1", "0")
    .attr("x2", "0")
    .attr("y2", "1");

  gradient
    .append("stop")
    .attr("offset", "0%")
    .attr("stop-color", `rgba(${color},0.4)`);

  gradient
    .append("stop")
    .attr("offset", "100%")
    .attr("stop-color", `rgba(${color},0)`);

  // area
  const area = d3
    .area()
    .x((d) => xScaleFunc(new Date(d.Date)))
    .y0(d3.max(yScaleFunc.range()))
    .y1((d) => yScaleFunc(d.Close));

  brushLayer
    .insert("path", ":first-child")
    .datum(visibleData)
    .attr("d", area)
    .attr("fill", `url(#${gradientId})`)
    .attr("class", "brush-gradient")
    .attr("pointer-events", "none");

  /* =====================================================
    🔽 ADDITIONS START HERE (safe, isolated)
    ===================================================== */

  // cleanup text before re-render
  brushLayer.selectAll(".brush-window-pnl,.brush-user-pnl").remove();

  const midX = winX + winWidth / 2;
  const bottomY = d3.max(yScaleFunc.range()) - 8;

  /* ---------- WINDOW P&L (bottom-center) ---------- */
  const windowPct = ((last - first) / first) * 100;

  brushLayer
    .append("text")
    .attr("class", "brush-window-pnl")
    .attr("x", midX)
    .attr("y", bottomY)
    .attr("text-anchor", "middle")
    .attr("fill", isUp ? "limegreen" : "red")
    .style("font-size", "12px")
    .style("font-weight", "bold")
    .text(`Window Move: ${windowPct >= 0 ? "+" : ""}${windowPct.toFixed(2)}%`);

  /* ---------- USER P&L (top-left of window) ---------- */
  if (!annotationData?.length) return;

  const windowAnnotations = annotationData.filter((a) => {
    const x = xScaleFunc(new Date(a.Date));
    return x >= winX && x <= winX + winWidth;
  });

  let booked = 0;
  let open = 0;
  let lastBuy = null;

  for (const a of windowAnnotations) {
    if (a.transactionType === "buy") {
      lastBuy = a;
    } else if (a.transactionType === "sell" && lastBuy) {
      booked += (a.price - lastBuy.price) * a.qty;
      lastBuy = null;
    }
  }

  if (lastBuy) {
    open += (last - lastBuy.price) * lastBuy.qty;
  }

  const total = booked + open;
  const pnlColor = total >= 0 ? "limegreen" : "red";

  // top-left padding inside window
  const pnlX = winX + 8;
  const pnlY = 16;

  const pnlGroup = brushLayer
    .append("g")
    .attr("class", "brush-user-pnl")
    .attr("transform", `translate(${pnlX},${pnlY})`);

  pnlGroup
    .append("text")
    .attr("fill", pnlColor)
    .style("font-size", "12px")
    .style("font-weight", "bold")
    .text(`Your P&L: ${total >= 0 ? "+" : ""}₹${total.toFixed(0)}`);

  pnlGroup
    .append("text")
    .attr("y", 14)
    .attr("fill", "#999")
    .style("font-size", "10px")
    .text(`Booked: ₹${booked.toFixed(0)} | Open: ₹${open.toFixed(0)}`);
}
