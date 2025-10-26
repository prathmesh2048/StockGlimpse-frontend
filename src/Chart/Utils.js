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

    let defs = d3.select(`#${ctx.getObjectIDs().candleContainerId}`).select("defs");
    if (defs.empty()) defs = d3.select(`#${ctx.getObjectIDs().candleContainerId}`).append("defs");

    for (const [buy, sell] of buySells) {
        const profit = sell.Close - buy.Close;
        const gradientId = `tradeGradient_${buy.Date}_${sell.Date}`;

        if (defs.select(`#${gradientId}`).empty()) {
            const gradient = defs.append("linearGradient")
                .attr("id", gradientId)
                .attr("x1", "0").attr("y1", "0")
                .attr("x2", "0").attr("y2", "1");

            const color = profit >= 0 ? "19,201,92" : "201,19,19"; // green if profit, red if loss
            gradient.append("stop").attr("offset", "0%").attr("stop-color", `rgba(${color},0.4)`);
            gradient.append("stop").attr("offset", "100%").attr("stop-color", `rgba(${color},0)`);
        }

        const area = d3.area()
            .x(d => ctx.getXScaleFunc()(new Date(d.Date)))
            .y0(d3.max(ctx.getYScaleFunc().range()))
            .y1(d => ctx.getYScaleFunc()(d.Close));

        const start = new Date(buy.Date);
        const end = new Date(sell.Date);

        const slice = ctx.getChartData().filter(d => {
            const t = new Date(d.Date);
            return t >= start && t <= end;
        });
        if (!slice.length) continue;

        group.insert("path", ":first-child")
            .datum(slice)
            .attr("d", area)
            .attr("fill", `url(#${gradientId})`)
            .attr("class", "trade-gradient")
            .attr("pointer-events", "none");

        const path = group.insert("path", ":first-child")
            .datum(slice)
            .attr("d", area)
            .attr("fill", `url(#${gradientId})`)
            .attr("class", "trade-gradient")
            .attr("pointer-events", "none");


        // horizontal midpoint between buy & sell
        const midX = (ctx.getXScaleFunc()(new Date(buy.Date)) + ctx.getXScaleFunc()(new Date(sell.Date))) / 2;

        // a bit above the bottom of chart
        const bottomY = d3.max(ctx.getYScaleFunc().range());
        const offset = 20;

        group.append("text")
            .attr("x", midX)
            .attr("y", bottomY - offset)
            .attr("text-anchor", "middle")
            .attr("fill", profit >= 0 ? "limegreen" : "red")
            .style("font-weight", "bold")
            .style("font-size", "12px")
            .text(`${profit >= 0 ? '+' : '-'} ${((profit / buy.Close) * 100).toFixed(2)}%  ( ₹${Math.abs(profit.toFixed(2))} )`);
    }
}
