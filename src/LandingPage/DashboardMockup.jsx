import React from 'react';
import { RotateCcw, List, ArrowRight } from 'lucide-react';

const DashboardMockup = () => {
  // Realistic price data from 2100 to 3100 mapped to match the screenshot's exact curve
  const candles = [
    { o: 2220, c: 2235, l: 2210, h: 2248 },
    { o: 2235, c: 2218, l: 2202, h: 2242 },
    { o: 2218, c: 2260, l: 2212, h: 2278 }, // strong bull
    { o: 2260, c: 2285, l: 2252, h: 2300 },
    { o: 2285, c: 2272, l: 2255, h: 2296 },
    { o: 2272, c: 2328, l: 2268, h: 2342 }, // breakout
    { o: 2328, c: 2306, l: 2295, h: 2338 },
    { o: 2306, c: 2258, l: 2242, h: 2318 }, // selloff
    { o: 2258, c: 2212, l: 2190, h: 2270 },
    { o: 2212, c: 2178, l: 2140, h: 2225 }, // panic

    // BUY
    { o: 2178, c: 2252, l: 2125, h: 2265 }, // hammer

    { o: 2252, c: 2308, l: 2238, h: 2325 },
    { o: 2308, c: 2380, l: 2296, h: 2405 }, // marubozu
    { o: 2380, c: 2445, l: 2370, h: 2460 },
    { o: 2445, c: 2492, l: 2430, h: 2515 },
    { o: 2492, c: 2478, l: 2465, h: 2508 },
    { o: 2478, c: 2538, l: 2468, h: 2555 },
    { o: 2538, c: 2586, l: 2525, h: 2602 },
    { o: 2586, c: 2566, l: 2554, h: 2595 },
    { o: 2566, c: 2618, l: 2558, h: 2635 },

    // consolidation
    { o: 2618, c: 2604, l: 2588, h: 2628 },
    { o: 2604, c: 2594, l: 2580, h: 2618 },
    { o: 2594, c: 2615, l: 2585, h: 2628 },
    { o: 2615, c: 2608, l: 2596, h: 2625 },

    // breakout
    { o: 2608, c: 2668, l: 2600, h: 2688 },
    { o: 2668, c: 2710, l: 2658, h: 2728 },
    { o: 2710, c: 2692, l: 2680, h: 2722 },
    { o: 2692, c: 2768, l: 2686, h: 2790 }, // large bull
    { o: 2768, c: 2746, l: 2734, h: 2780 },
    { o: 2746, c: 2826, l: 2738, h: 2852 }, // breakout
    { o: 2826, c: 2888, l: 2810, h: 2908 },
    { o: 2888, c: 2868, l: 2852, h: 2898 },
    { o: 2868, c: 2938, l: 2858, h: 2962 },
    { o: 2938, c: 2965, l: 2928, h: 2998 },
    { o: 2965, c: 2946, l: 2932, h: 2976 },

    // SELL
    { o: 2946, c: 2962, l: 2938, h: 3028 }, // shooting star

    { o: 2962, c: 2912, l: 2894, h: 2972 }, // bearish confirmation
    { o: 2912, c: 2878, l: 2860, h: 2924 },
    { o: 2878, c: 2928, l: 2868, h: 2948 },
    { o: 2928, c: 2982, l: 2918, h: 3005 }
  ];

  // Map price (2100 to 3100) to SVG Y coordinate (180 to 10)
  const priceToY = (price) => {
    const minP = 2100;
    const maxP = 3100;
    const minY = 180;
    const maxY = 10;
    return minY - ((price - minP) / (maxP - minP)) * (minY - maxY);
  };

  const overallScore = 95;

  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const progress = circumference * (1 - overallScore / 100);

  const metrics = [
    { label: 'TREND', value: 29, max: 30, color: 'bg-[#10B981]' },
    { label: 'MOMENTUM', value: 20, max: 20, color: 'bg-[#10B981]' },
    { label: 'VOLUME', value: 14, max: 15, color: 'bg-[#10B981]' },
    { label: 'S/R PLACEMENT', value: 23, max: 25, color: 'bg-[#10B981]' },
    { label: 'CANDLE PATTERN', value: 9, max: 10, color: 'bg-[#F59E0B]' },
  ];

  return (
    <div className="w-full max-w-[px] bg-[#0A0E1A] border border-slate-800/80 rounded-2xl p-6 shadow-2xl font-sans text-slate-300 select-none">

      {/* Top Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-slate-200 font-bold text-sm tracking-wide">RELIANCE</h3>
            <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded font-semibold text-slate-400">NSE</span>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-extrabold text-white tracking-tight">₹2,930.45</span>
            <span className="text-[#10B981] text-sm font-semibold">+28.60 (0.98%)</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="p-2.5 bg-transparent hover:bg-slate-800/50 rounded-lg transition-colors border border-slate-800 text-slate-400">
            <RotateCcw className="w-4 h-4" />
          </button>
          <button className="p-2.5 bg-transparent hover:bg-slate-800/50 rounded-lg transition-colors border border-slate-800 text-slate-400">
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Candlestick Chart Area (Pure SVG) */}
      <div className="relative w-full h-[220px] mb-2">
        <svg viewBox="0 0 540 220" className="w-full h-full overflow-visible">

          {/* Horizontal Grid Lines */}
          {[3100, 2900, 2700, 2500, 2300, 2100, 2000, 1900].map((price) => {
            const y = priceToY(price);
            return (
              <g key={price}>
                <line x1="0" y1={y} x2="490" y2={y} stroke="#1E293B" strokeWidth="1" strokeOpacity="0.5" />
                <text x="500" y={y + 3} fill="#64748B" fontSize="10" fontFamily="monospace" fontWeight="500">
                  {price.toLocaleString()}
                </text>
              </g>
            );
          })}

          {/* Candlesticks */}
          {candles.map((c, i) => {
            const x = i * 12 + 8;
            const isUp = c.c >= c.o;
            const color = isUp ? '#10B981' : '#F43F5E';
            let yTop = priceToY(Math.max(c.o, c.c));
            let yBottom = priceToY(Math.min(c.o, c.c));

            const center = (yTop + yBottom) / 2;
            const scale = 1.2; // 22% taller candles

            yTop = center - ((center - yTop) * scale);
            yBottom = center + ((yBottom - center) * scale);

            const bodyHeight = Math.max(yBottom - yTop, 2.5);
            let yHigh = priceToY(c.h);
            let yLow = priceToY(c.l);

            yHigh -= 2;
            yLow += 2;

            return (
              <g key={i}>
                {/* Wick */}
                <line
                  x1={x + 3}
                  y1={yHigh}
                  x2={x + 3}
                  y2={yLow}
                  stroke={color}
                  strokeWidth="1.2"
                />

                {/* Body */}
                <rect
                  x={x}
                  y={yTop}
                  width="6"
                  height={bodyHeight}
                  fill={color}
                  rx="1"
                />

                {/* BUY MARKER */}
                {i === 10 && (
                  <g transform={`translate(${x + 3}, ${yLow + 4})`}>
                    <path
                      d="M -4 6 L 0 0 L 4 6 M 0 0 L 0 18"
                      stroke="#10B981"
                      strokeWidth="1"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    <circle cx="0" cy="22" r="9" fill="#10B981" />
                    <text
                      x="0"
                      y="25"
                      fill="#FFF"
                      fontSize="10"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      B
                    </text>

                    <text
                      x="0"
                      y="43"
                      fill="#FFF"
                      fontSize="10"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      BUY
                    </text>
                  </g>
                )}

                {/* SELL MARKER */}
                {i === 35 && (
                  <g transform={`translate(${x + 3}, ${yHigh - 24})`}>
                    <circle cx="0" cy="0" r="9" fill="#F43F5E" />

                    <text
                      x="0"
                      y="3.5"
                      fill="#FFF"
                      fontSize="10"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      S
                    </text>

                    <path
                      d="M -4 14 L 0 20 L 4 14 M 0 5 L 0 20"
                      stroke="#F43F5E"
                      strokeWidth="1"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Chart X-Axis Labels */}
      <div className="flex justify-between text-[11px] font-medium text-slate-500 mb-6 pr-12 border-t border-slate-800/60 pt-2.5">
        <span>Mar 2025</span>
        <span>May 2025</span>
        <span>Jul 2025</span>
        <span>Sep 2025</span>
        <span>Nov 2025</span>
        <span>Jan 2026</span>
      </div>

      {/* RSI (14) Section */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-xs font-bold text-slate-300">RSI (14)</span>
        </div>
        <div className="relative w-full h-[45px]">
          <svg viewBox="0 0 540 45" className="w-full h-full overflow-visible">
            {/* RSI 70 Line (Dashed Red) */}
            <line x1="0" y1="8" x2="490" y2="8" stroke="#F43F5E" strokeWidth="1" strokeDasharray="3 3" strokeOpacity="0.6" />
            <text x="500" y="11" fill="#64748B" fontSize="10" fontFamily="monospace">70</text>

            {/* RSI 50 Line (Dashed Blue/Slate) */}
            <line x1="0" y1="22.5" x2="490" y2="22.5" stroke="#3B82F6" strokeWidth="1" strokeDasharray="3 3" strokeOpacity="0.4" />
            <text x="500" y="25.5" fill="#64748B" fontSize="10" fontFamily="monospace">50</text>

            {/* RSI 30 Line (Dashed Blue) */}
            <line x1="0" y1="37" x2="490" y2="37" stroke="#3B82F6" strokeWidth="1" strokeDasharray="3 3" strokeOpacity="0.6" />
            <text x="500" y="40" fill="#64748B" fontSize="10" fontFamily="monospace">30</text>

            {/* RSI Jagged Purple Line */}
            <polyline
              points="8,30 20,28 32,32 44,24 56,26 68,20 80,29 92,36 104,32 116,28 128,38 140,34 152,28 164,31 176,26 188,24 200,20 212,22 224,18 236,15 248,16 260,19 272,16 284,14 296,17 308,12 320,15 332,10 344,14 356,11 368,8 380,10 392,14 404,11 416,7 428,15 440,18 452,14 464,19 476,22"
              fill="none"
              stroke="#A855F7"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      {/* RSI X-Axis Labels */}
      <div className="flex justify-between text-[11px] font-medium text-slate-500 mb-6 pr-12">
        <span>Mar 2025</span>
        <span>May 2025</span>
        <span>Jul 2025</span>
        <span>Sep 2025</span>
        <span>Nov 2025</span>
        <span>Jan 2026</span>
      </div>

      {/* Bottom 3 Cards (Equal Height & Perfect Padding) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Card 1: Overall Score */}
        <div className="bg-[#111726] rounded-xl p-5 flex flex-col items-center justify-center border border-slate-800/80 min-h-[130px]">
          <div className="relative w-20 h-20 mb-3 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="40" cy="40" r="34" fill="transparent" stroke="#1E293B" strokeWidth="6" />
              <circle
                cx="40"
                cy="40"
                r={radius}
                fill="transparent"
                stroke="#10B981"
                strokeWidth="6"
                strokeDasharray={circumference}
                strokeDashoffset={progress}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-white leading-none">{overallScore}</span>
              <span className="text-[10px] text-slate-400 font-medium mt-0.5">/100</span>
            </div>
          </div>
          <span className="text-[11px] font-bold tracking-wider text-slate-300">TRADE SCORE</span>
        </div>

        {/* Card 2: Metrics Bars */}
        <div className="bg-[#111726] rounded-xl p-4 border border-slate-800/80 flex flex-col justify-between min-h-[160px]">
          {metrics.map((m) => {
            const pct = (m.value / m.max) * 100;

            return (
              <div key={m.label} className="space-y-1">
                <div className="flex justify-between text-[10px] font-bold mb-1">
                  <span className="text-slate-400 tracking-wide">{m.label}</span>
                  <span className="text-slate-300">
                    {m.value}/{m.max}
                  </span>
                </div>

                <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${m.color} rounded-full`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Card 3: Trade Summary */}
        <div className="bg-[#111726] rounded-xl p-5 border border-slate-800/80 flex flex-col justify-between min-h-[160px]">
          <div>
            <h4 className="text-[11px] font-bold text-white mb-2 tracking-wider">TRADE SUMMARY</h4>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Price successfully bounced from key S1 support area with rising RSI momentum. Candlestick patterns suggest strong accumulation.
            </p>
          </div>
          <button className="text-[#0052FF] text-[11px] font-semibold flex items-center gap-1 hover:text-blue-400 transition-colors w-max mt-3">
            View Trade Note <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>
    </div>
  );
};

export default DashboardMockup;