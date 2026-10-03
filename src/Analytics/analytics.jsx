import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import * as d3 from "d3";

import {
    LineChart as LineChartIcon,
    AlertTriangle,
    Trophy,
    BarChart3,
    TrendingDown,
    TrendingUp,
    Info,
    ArrowDown,
    ArrowUp,
    Sparkles,
    Activity
} from "lucide-react";

import ENV from "../config";
import Navbar from "../Navbar/Navbar";
/**
 * analytics.jsx
 * "The Pulse" — aggregate analytics dashboard.
 *
 * Stack: React + D3 (geometry/scales only, rendered as SVG in JSX) + Tailwind.
 * Single self-contained file, default export, no required props (sample data
 * ships inline so the component renders standalone).
 *
 * Mobile: grid collapses to a single column under `md`; charts read their
 * width from a ResizeObserver so nothing overflows on small screens.
 */

// ---------------------------------------------------------------------------
// Sample data (swap for real data via props — see `PulseDashboard` signature)
// ---------------------------------------------------------------------------

const DEFAULT_DATA = {
    brokerSync: "Zerodha / Groww",
    eqi: { score: 75, deltaVsLastMonth: 6, entry: 71, exit: 80 },
    scoreTrend: {
        weeks: ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8"],
        series: [
            { name: "S/R", color: "#34D399", values: [60, 62, 65, 66, 70, 72, 75, 78] },
            { name: "Trend", color: "#3B82F6", values: [38, 42, 40, 45, 48, 50, 54, 58] },
            { name: "Momentum", color: "#E879F9", values: [50, 52, 50, 54, 56, 58, 60, 63] },
            { name: "Candle", color: "#94A3B8", values: [48, 47, 50, 49, 52, 53, 55, 56] },
            { name: "Volume", color: "#FB7185", values: [42, 40, 38, 36, 34, 33, 31, 29] },
        ],
        weakest: "Volume",
        moneyLeftOnTable: {
            amount: 1240,
            breakdown: [
                { param: "S/R", detail: "0.7% from support at ₹291.23" },
                { param: "Trend", detail: "1.2% below the 21-EMA at ₹293.00" },
            ],
        },
        verdict: "Entries fire before trend confirms. That's where losses cluster.",
    },
    behavioralEdge: {
        most: {
            label: "Counter-Trend Specialist",
            tone: "positive",
            count: 33,
            percent: 38.4,
        },
        least: {
            label: "Overtrader (Weekends)",
            tone: "negative",
            count: 5,
            percent: 5.8,
        },
        totalTrades: 86,
        consistency: 72,
    },
    // ---------------------------------------------------------------------
    // Sector Alignment — now split by execution side (Entries vs Exits),
    // since "was this genuinely about the stock" means something different
    // on a buy (thesis quality) vs a sell (timing quality — see `payoff`,
    // which only ever appears on the exits side).
    //
    // Each side carries its own Nifty row (100% coverage — every execution
    // on that side gets a vs-Nifty comparison, real sector or not) plus
    // sector rows (only executions where resolve_sector() found a real,
    // non-fallback sector — isSectorFallback / isIndexFund trades are
    // excluded, not folded in).
    //
    // Each row's quadrant split comes from verdict.py's pre_alpha /
    // current_alpha classification, counted across trades instead of
    // narrated per trade:
    //   genuineEdge       — pre-aligned + stock-dominant  (real stock-picking)
    //   sectorAssisted     — pre-aligned + not stock-dominant (thesis right,
    //                         sector did the work)
    //   noEdge              — not pre-aligned + stock-dominant (no thesis,
    //                         stock moved on its own anyway)
    //   indistinguishable   — neither (traded like a passive sector/index bet)
    // ---------------------------------------------------------------------
    sectorAlignment: {
        entries: {
            subtitle: "Were your buys genuinely about the stock, or the market",
            nifty: {
                name: "Nifty 50",
                trades: 96,
                avgAlpha: -2.1,
                quadrant: { genuineEdge: 20, sectorAssisted: 26, noEdge: 14, indistinguishable: 40 },
                note: "Only 31% of your buys show real stock-specific edge over just holding Nifty 50.",
            },
            sectors: [
                {
                    name: "Healthcare",
                    trades: 61,
                    avgAlpha: -7.4,
                    quadrant: { genuineEdge: 22, sectorAssisted: 24, noEdge: 12, indistinguishable: 42 },
                },
            ],
        },
        exits: {
            subtitle: "Was the exit about the stock — and did it pay off",
            nifty: {
                name: "Nifty 50",
                trades: 63,
                avgAlpha: 0.6,
                quadrant: { genuineEdge: 25, sectorAssisted: 30, noEdge: 13, indistinguishable: 32 },
                note: "38% of your exits were genuinely about the stock, not Nifty 50.",
            },
            // Only appears on exits — of the stock-driven exits, was the
            // timing actually good (price kept falling) or premature
            // (price rose after you sold).
            payoff: { wellTimed: 61, leftOnTable: 39 },
            sectors: [
                {
                    name: "Financial Services",
                    trades: 18,
                    avgAlpha: 1.2,
                    quadrant: { genuineEdge: 42, sectorAssisted: 24, noEdge: 12, indistinguishable: 22 },
                },
            ],
        },
    },
    mistakeRadar: {
        trades: 214,
        axes: [
            "CounterTrendDipMistake",
            "ChasingHighsMistake",
            "EarlyExitMistake",
        ],
        thisMonth: [78, 62, 40],
        lastMonth: [55, 70, 30],
        callouts: [
            { label: "CounterTrendDipMistake", value: "31%" },
            { label: "ChasingHighsMistake", value: "24%" },
            { label: "EarlyExitMistake", value: "18%" },
        ],
    },

    winningConditionsMatrix: {
        "meta": {
            "basedOnTrades": 118,
            "timeframe": "3_weeks",
            "tradeType": "buy",
            "recalculatedAt": "2026-09-25T09:12:00Z",
            "nextRecalcInTrades": 5
        },
        "strongest": {
            "trades": 42,
            "confidenceTier": 4,
            "technicalTags": ["Trend ≥ 80", "Momentum ≥ 70"],
            "behavioralTags": ["Counter-Trend Dip"],
            "comparison": {
                "thisValue": 14.2,
                "restValue": 4.4
            },
            "quote": "Pullbacks you take inside strong uptrends run 3.2x further in your favor than your breakout entries — and it's held for the last 3 recalculations.",
            "metricLabel": "Avg MFE",
            "metricValue": "14.2 pts",
            "tradeIds": [1012, 1045, 1088, 1103, 1129, 1150]
        },
        "weakest": {
            "trades": 18,
            "confidenceTier": 2,
            "technicalTags": ["Volume ≤ 40", "S/R ≤ 30"],
            "behavioralTags": ["Chasing Highs"],
            "comparison": {
                "thisValue": -8.6,
                "restValue": -3.1
            },
            "quote": "Entries at resistance on low volume consistently trigger your max drawdown — this pattern is still forming, worth watching over your next few trades.",
            "metricLabel": "Avg MAE",
            "metricValue": "-8.6 pts",
            "tradeIds": [1021, 1067, 1094, 1112]
        },
        "coldStart": {
            "label": "Breakout on Volume Spike",
            "current": 12,
            "target": 20
        }
    }
    ,
    priceReaction: {
        buy: {
            headline: "The cost of buying too early",
            subheadline: "What your buy trades did in the days right after you entered",
            amount: 9400,
            amountNote:
                "an estimated amount sitting below your buy price this month, on weak-setup entries",
            weak: {
                label: "Weak setups",
                pct: 62,
                avgMove: 1.4,
                detail: "of the time, price fell below what you paid within a few days",
            },
            strong: {
                label: "Strong setups",
                pct: 21,
                avgMove: 0.6,
                detail: "of the time, price fell below what you paid within a few days",
            },
            plotLabel: "Every buy, plotted",
            disclaimer:
                "Based on the trades in your uploaded data for this period. Doesn't reflect what you actually paid.",
            points: [
                2.1, 3.4, 4.6, 3.9, -1.1, -1.4, -1.9, -1.6, -2.2,
            ],
        },
        sell: {
            headline: "The cost of selling too early",
            subheadline: "What your sell trades did in the days right after you exited",
            amount: 6200,
            amountNote:
                "an estimated amount left on the table after selling on weak-setup exits",
            weak: {
                label: "Weak setups",
                pct: 58,
                avgMove: 1.1,
                detail: "of the time, price rose above what you sold at within a few days",
            },
            strong: {
                label: "Strong setups",
                pct: 19,
                avgMove: 0.4,
                detail: "of the time, price rose above what you sold at within a few days",
            },
            plotLabel: "Every sell, plotted",
            disclaimer:
                "Based on the trades in your uploaded data for this period. Doesn't reflect what you actually sold at.",
            points: [
                1.8, 2.6, 3.5, 2.9, -1.0, -1.3, -1.7, -2.0, -1.5,
            ],
        },
    },
    convictionPenalty: {
        sampleCount: 86,
        minSample: 20,
        ratio: 2.3,
        extraCapital: 18400,
        trend: { pct: 8, better: true },
        buckets: [
            { label: "Score < 50", trades: 32, avgCapital: 42600, tier: "weak" },
            { label: "Score 50–70", trades: 39, avgCapital: 27100, tier: "mid" },
            { label: "Score > 70", trades: 15, avgCapital: 18300, tier: "strong" },
        ],
    },
    maeMfe: {
        win: [
            [12, 62],
            [18, 78],
            [22, 88],
            [24, 72],
            [16, 68],
        ],
        loss: [
            [32, 30],
            [38, 32],
            [44, 22],
            [52, 25],
            [58, 18],
        ],
    },
    feed: [
        {
            icon: "trend",
            symbol: "Reliance Industries",
            date: "May 28 · 10:42 AM",
            note: "Mixed execution, improving structure. Entered on a pullback to support with volume confirmation.",
            pnl: 3200,
        },
        {
            icon: "warning",
            symbol: "Tata Motors",
            date: "May 27 · 02:15 PM",
            note: "Chased a breakout that failed — classic FOMO entry. Consider waiting for retest next time.",
            pnl: -1850,
        },
        {
            icon: "trophy",
            symbol: "HDFC Bank",
            date: "May 26 · 09:30 AM",
            note: "Textbook counter-trend dip buy. Held through noise, exited at resistance. Great patience.",
            pnl: 5400,
        },
        {
            icon: "bars",
            symbol: "Infosys",
            date: "May 25 · 11:05 AM",
            note: "Solid trend-following entry but exited too early. Let winners run a bit longer.",
            pnl: 2100,
        },
    ],
};

const fmtRupee = (n) => {
    const sign = n < 0 ? "-" : "+";
    const abs = Math.abs(n);
    return `${sign}₹${abs.toLocaleString("en-IN")}`;
};

// ---------------------------------------------------------------------------
// Hook: measure container width so SVG charts stay responsive
// ---------------------------------------------------------------------------

function useMeasure() {
    const ref = useRef(null);
    const [size, setSize] = useState({ width: 0, height: 0 });

    useEffect(() => {
        if (!ref.current) return;
        const el = ref.current;
        const ro = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (!entry) return;
            const { width, height } = entry.contentRect;
            setSize({ width, height });
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    return [ref, size];
}

// Fires once on mount, after a tick, to trigger CSS transitions from 0 -> value
function useMountedAfterPaint(delay = 40) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        const t = setTimeout(() => setMounted(true), delay);
        return () => clearTimeout(t);
    }, [delay]);
    return mounted;
}


const DEFAULT_TIMEFRAME = "3_weeks";

const TIMEFRAME_OPTIONS = [
    { value: "1_week", short: "1W", phrase: "1-week" },
    { value: "3_weeks", short: "3W", phrase: "3-week" },
    { value: "3_months", short: "3M", phrase: "3-month" },
    { value: "6_months", short: "6M", phrase: "6-month" },
    { value: "1_year", short: "1Y", phrase: "1-year" },
];

function getTimeframeOption(value) {
    return TIMEFRAME_OPTIONS.find((option) => option.value === value)
        || TIMEFRAME_OPTIONS.find((option) => option.value === DEFAULT_TIMEFRAME);
}

function useAnalyticsData(timeframe) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);

        axios
            .get(`${ENV.BASE_API_URL}/api/analytics/`, {
                params: { timeframe },
                headers: { Authorization: `Bearer ${localStorage.getItem("jwtToken")}` },
            })
            .then((res) => {
                if (!cancelled) setData(res.data);
            })
            .catch((err) => {
                if (!cancelled) {
                    console.error("Analytics Data fetch error:", err);
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [timeframe]);

    return { data, loading };
}


// Fires once, the first time the element scrolls into view
function useInView(threshold = 0.35) {
    const ref = useRef(null);
    const [inView, setInView] = useState(false);
    useEffect(() => {
        if (!ref.current) return;
        const obs = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setInView(true);
                    obs.disconnect();
                }
            },
            { threshold }
        );
        obs.observe(ref.current);
        return () => obs.disconnect();
    }, [threshold]);
    return [ref, inView];
}

// Counts a number up from 0 -> target once `active` becomes true
function useCountUp(target, active, duration = 900) {
    const [value, setValue] = useState(0);
    useEffect(() => {
        if (!active) return;
        const interpolate = d3.interpolateNumber(0, target);
        let raf;
        const start = performance.now();
        const tick = (now) => {
            const t = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - t, 3);
            setValue(interpolate(eased));
            if (t < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [active, target, duration]);
    return value;
}

// ---------------------------------------------------------------------------
// Shared card shell
// ---------------------------------------------------------------------------

function Card({ title, subtitle, right, children, className = "" }) {
    return (
        <div
            className={`rounded-2xl border border-white/[0.06] bg-[#0F1523] p-5 sm:p-6 ${className}`}
        >
            {(title || right) && (
                <div className="mb-5 flex items-start justify-between gap-3">
                    <div>
                        {title && (
                            <h3 className="text-[15px] font-semibold text-slate-100">
                                {title}
                            </h3>
                        )}
                        {subtitle && (
                            <p className="mt-0.5 text-[12.5px] text-slate-500">
                                {subtitle}
                            </p>
                        )}
                    </div>
                    {right}
                </div>
            )}
            {children}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Execution Quality Index — animated donut gauge
// ---------------------------------------------------------------------------

function GaugeChart({ score = 75, delta = 6 }) {
    const mounted = useMountedAfterPaint();
    const size = 168;
    const stroke = 10;
    const radius = 66;

    const startAngle = -225;
    const totalSweep = 270;

    const valueSweep = mounted ? (score / 100) * totalSweep : 0;

    const polarToCartesian = (angle) => {
        const radians = ((angle - 90) * Math.PI) / 180;

        return {
            x: size / 2 + radius * Math.cos(radians),
            y: size / 2 + radius * Math.sin(radians),
        };
    };

    const describeArc = (start, end) => {
        const startPoint = polarToCartesian(end);
        const endPoint = polarToCartesian(start);
        const largeArcFlag = end - start <= 180 ? 0 : 1;

        return [
            "M",
            startPoint.x,
            startPoint.y,
            "A",
            radius,
            radius,
            0,
            largeArcFlag,
            0,
            endPoint.x,
            endPoint.y,
        ].join(" ");
    };

    const scoreColor =
        score >= 80
            ? "#34D399"
            : score >= 60
                ? "#60A5FA"
                : "#FB7185";

    const label =
        score >= 80
            ? "Strong execution"
            : score >= 60
                ? "Room to refine"
                : "Needs attention";

    return (
        <div className="flex flex-col items-center">
            <div
                className="relative"
                style={{ width: size, height: size }}
            >
                <svg
                    width={size}
                    height={size}
                    viewBox={`0 0 ${size} ${size}`}
                >
                    {/* Background arc */}
                    <path
                        d={describeArc(startAngle, startAngle + totalSweep)}
                        fill="none"
                        stroke="#1B2333"
                        strokeWidth={stroke}
                        strokeLinecap="round"
                    />

                    {/* Score arc */}
                    <path
                        d={describeArc(
                            startAngle,
                            startAngle + valueSweep
                        )}
                        fill="none"
                        stroke={scoreColor}
                        strokeWidth={stroke}
                        strokeLinecap="round"
                        style={{
                            transition:
                                "stroke-dashoffset 900ms cubic-bezier(0.22,1,0.36,1)",
                        }}
                    />

                    {/* Endpoint marker */}
                    {mounted && (
                        <circle
                            cx={
                                polarToCartesian(
                                    startAngle + valueSweep
                                ).x
                            }
                            cy={
                                polarToCartesian(
                                    startAngle + valueSweep
                                ).y
                            }
                            r={4}
                            fill={scoreColor}
                            stroke="#0D1420"
                            strokeWidth={3}
                        />
                    )}
                </svg>

                {/* Center score */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
                        Quality
                    </span>

                    <span
                        className="mt-1 text-[42px] font-semibold leading-none tabular-nums"
                        style={{ color: scoreColor }}
                    >
                        {mounted ? score : 0}
                    </span>

                    <span className="mt-2 text-[10px] text-slate-500">
                        OUT OF 100
                    </span>
                </div>
            </div>

            {/* Status row */}
            <div className="mt-1 flex items-center gap-2">
                <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: scoreColor }}
                />

                <span className="text-[12px] text-slate-400">
                    {label}
                </span>
            </div>

            {/* Delta */}
            <div className="mt-2 text-[11px] tabular-nums text-emerald-400">
                {delta >= 0 ? "+ " : ""}
                {delta}%
                <span className="ml-1 text-slate-600">
                    vs last month
                </span>
            </div>
        </div>
    );
}

function ExecutionQualityCard({ eqi }) {
    return (
        <Card
            title="Execution Quality Index"
            className="flex flex-col"
        >
            <div className="flex flex-1 items-center justify-center py-1">
                <GaugeChart score={eqi.score} delta={eqi.deltaVsLastMonth} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
                {[
                    { label: "Entry", value: eqi.entry },
                    { label: "Exit", value: eqi.exit },
                ].map((s) => (
                    <div
                        key={s.label}
                        className="rounded-xl border border-white/[0.06] bg-[#151C2C] px-3 py-2.5 text-center"
                    >
                        <p className="text-[15px] font-semibold text-slate-100">
                            {s.value}
                        </p>
                        <p className="text-[11.5px] text-slate-500">{s.label}</p>
                    </div>
                ))}
            </div>
        </Card>
    );
}

// ---------------------------------------------------------------------------
// Profit/Loss vs Quality Score — dual-axis line chart
// ---------------------------------------------------------------------------

function ScoreTrendChart({ weeks, series, hovered, onHover }) {
    const [ref, { width }] = useMeasure();
    const mounted = useMountedAfterPaint(80);

    const height = 140;
    const margin = { top: 8, right: 8, bottom: 18, left: 8 };

    const w = Math.max(width - margin.left - margin.right, 0);
    const h = height - margin.top - margin.bottom;

    // Prevent edge clipping on both sides
    const xPadding = 12;

    const x = useMemo(
        () =>
            d3
                .scalePoint()
                .domain(weeks)
                .range([xPadding, Math.max(xPadding, w - xPadding)]),
        [weeks, w]
    );

    // Dynamic Y domain prevents lines from being clipped
    const yDomain = useMemo(() => {
        const values = series.flatMap((s) => s.values);
        const min = d3.min(values) ?? 20;
        const max = d3.max(values) ?? 90;

        const padding = Math.max((max - min) * 0.12, 5);

        return [min - padding, max + padding];
    }, [series]);

    const y = useMemo(
        () =>
            d3
                .scaleLinear()
                .domain(yDomain)
                .range([h, 0]),
        [h, yDomain]
    );

    const lineGen = useMemo(
        () =>
            d3
                .line()
                .x((_, i) => x(weeks[i]))
                .y((d) => y(d))
                .curve(d3.curveMonotoneX),
        [weeks, x, y]
    );

    const pathLength = 700;

    return (
        <div ref={ref} className="w-full overflow-visible">
            {w > 0 && (
                <svg
                    width={w + margin.left + margin.right}
                    height={height}
                    className="overflow-visible"
                >
                    <g
                        transform={`translate(${margin.left},${margin.top})`}
                    >
                        {[30, 50, 70].map((t) => (
                            <line
                                key={t}
                                x1={0}
                                x2={w}
                                y1={y(t)}
                                y2={y(t)}
                                stroke="#1B2333"
                                strokeWidth={1}
                            />
                        ))}

                        {weeks.map(
                            (wk, i) =>
                                i % 2 === 0 && (
                                    <text
                                        key={wk}
                                        x={x(wk)}
                                        y={h + 13}
                                        textAnchor="middle"
                                        className="fill-slate-500 text-[9.5px]"
                                    >
                                        {wk}
                                    </text>
                                )
                        )}

                        {series.map((s) => {
                            const isHovered = hovered === s.name;
                            const isDimmed = hovered && !isHovered;
                            const active =
                                isHovered || (!hovered && s.flagged);

                            return (
                                <g key={s.name}>
                                    <path
                                        d={lineGen(s.values)}
                                        fill="none"
                                        stroke="transparent"
                                        strokeWidth={14}
                                        onMouseEnter={() => onHover(s.name)}
                                        onMouseLeave={() => onHover(null)}
                                        style={{ cursor: "pointer" }}
                                    />

                                    <path
                                        d={lineGen(s.values)}
                                        fill="none"
                                        stroke={s.color}
                                        strokeWidth={active ? 3 : 1.5}
                                        opacity={
                                            isDimmed
                                                ? 0.15
                                                : active
                                                    ? 1
                                                    : 0.7
                                        }
                                        strokeDasharray={pathLength}
                                        strokeDashoffset={
                                            mounted ? 0 : pathLength
                                        }
                                        pointerEvents="none"
                                        style={{
                                            transition:
                                                "stroke-dashoffset 900ms cubic-bezier(0.22,1,0.36,1), opacity 180ms ease, stroke-width 180ms ease",
                                        }}
                                    />
                                </g>
                            );
                        })}
                    </g>
                </svg>
            )}
        </div>
    );
}

function ScoreLegendChip({ s, isHovered, onHover }) {
    return (
        <button
            onMouseEnter={() => onHover(s.name)}
            onMouseLeave={() => onHover(null)}
            className={`flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] transition-colors ${s.flagged ? "bg-rose-400/10" : isHovered ? "bg-white/[0.06]" : ""
                }`}
        >
            <span
                className="h-1.5 w-1.5 rounded-full transition-transform"
                style={{
                    backgroundColor: s.color,
                    transform: isHovered ? "scale(1.4)" : "scale(1)",
                }}
            />
            <span className={s.flagged ? "text-rose-300" : "text-slate-400"}>
                {s.name}
            </span>
            <span
                className={`tabular-nums font-medium ${s.flagged ? "text-rose-200" : "text-slate-300"
                    }`}
            >
                {s.values[s.values.length - 1]}
            </span>
        </button>
    );
}

function ScoreTrendCard({ data }) {
    const [hovered, setHovered] = useState(null);
    const series = data.series.map((s) => ({
        ...s,
        flagged: s.name === data.weakest,
    }));

    return (
        <Card
            title="Score Trend"
            subtitle="Weekly avg per parameter"
            className="flex flex-col"
        >
            <div className="mb-3 flex flex-wrap gap-x-1 gap-y-1">
                {series.map((s) => (
                    <ScoreLegendChip
                        key={s.name}
                        s={s}
                        isHovered={hovered === s.name}
                        onHover={setHovered}
                    />
                ))}
            </div>

            <ScoreTrendChart
                weeks={data.weeks}
                series={series}
                hovered={hovered}
                onHover={setHovered}
            />

            {data.moneyLeftOnTable && (
                <div className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/[0.06] px-3 py-2.5">
                    <p className="text-[11.5px] leading-snug text-amber-200">
                        Potentially{" "}
                        <span className="font-medium text-amber-100">
                            {fmtRupee(data.moneyLeftOnTable.amount).replace("+", "")}
                        </span>{" "}
                        left on the table this month.
                    </p>
                    <ul className="mt-1.5 space-y-0.5">
                        {data.moneyLeftOnTable.breakdown.map((b) => (
                            <li
                                key={b.param}
                                className="text-[11px] leading-snug text-amber-200/60"
                            >
                                {b.param}: {b.detail}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <p className="mt-2.5 text-[11.5px] leading-snug text-slate-500">
                {data.verdict}
            </p>
        </Card>
    );
}

// ---------------------------------------------------------------------------
// Your Behavioral Edge
// ---------------------------------------------------------------------------

const TONE = {
    positive: {
        Icon: Sparkles,
        border: "border-emerald-400/20 bg-emerald-400/[0.025]",
        iconWrap: "bg-emerald-400/10 text-emerald-400",
        text: "text-emerald-400",
    },
    negative: {
        Icon: AlertTriangle,
        border: "border-rose-400/20 bg-rose-400/[0.025]",
        iconWrap: "bg-rose-400/10 text-rose-400",
        text: "text-rose-400",
    },
    neutral: {
        Icon: Activity,
        border: "border-blue-400/20 bg-blue-400/[0.025]",
        iconWrap: "bg-blue-400/10 text-blue-400",
        text: "text-blue-400",
    },
};

const formatPercent = (p) =>
    p == null || Number.isNaN(p) ? "—" : `${Number(p.toFixed(1))}%`;

const BAR = {
    positive: "bg-emerald-400",
    negative: "bg-rose-400",
    neutral: "bg-blue-400",
};
const TEXT = {
    positive: "text-emerald-400",
    negative: "text-rose-400",
    neutral: "text-blue-400",
};

const FALLBACK_LABELS = ["Average Entry", "Average Exit"];

function buildInsights(patterns) {
    const top = patterns[0];
    if (!top) return [];

    const lines = [
        {
            tone: "neutral",
            text: `${top.label} is your most frequent pattern (${formatPercent(top.percent)} of trades).`,
        },
    ];

    if (top.tone === "positive") {
        lines.push({
            tone: "positive",
            text: `Those trades average +${top.avgOutcome}%. Worth repeating.`,
        });
    } else if (top.tone === "negative") {
        lines.push({
            tone: "negative",
            text: `Those trades average ${top.avgOutcome}%. Worth reviewing.`,
        });
    } else {
        lines.push({
            tone: "neutral",
            text: `Only ${top.count} trades so far, not enough to call it good or bad yet.`,
        });
    }
    return lines;
}

function PatternRow({ pattern, isTop }) {
    const tone = BAR[pattern.tone] ? pattern.tone : "neutral";

    return (
        <a
            href={`/history?badge=${encodeURIComponent(pattern.label)}`}
            className="group block rounded-md transition-colors hover:bg-white/[0.02]"
        >
            <div className="flex items-baseline justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                    <p className="truncate text-[12.5px] font-medium text-slate-100">
                        {pattern.label}
                    </p>

                    {isTop && (
                        <span className="shrink-0 rounded-full bg-white/5 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-slate-400">
                            Most identified
                        </span>
                    )}
                </div>

                <p
                    className={`shrink-0 text-[12.5px] font-semibold tabular-nums ${TEXT[tone]}`}
                >
                    {formatPercent(pattern.percent)}
                    <span className="ml-1.5 text-[10px] font-normal text-slate-500 group-hover:text-blue-400">
                        {pattern.count} {pattern.count === 1 ? "trade" : "trades"} →
                    </span>
                </p>
            </div>

            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/5">
                <div
                    className={`h-full rounded-full ${BAR[tone]}`}
                    style={{
                        width: `${Math.min(pattern.percent ?? 0, 100)}%`,
                    }}
                />
            </div>
        </a>
    );
}

const INSIGHT_TEXT = {
    positive: "text-emerald-400",
    negative: "text-rose-400",
    neutral: "text-slate-400",
};

function BehavioralEdgeCard({ data }) {
    const [showAll, setShowAll] = useState(false);

    const patterns = data?.patterns ?? [];
    const total = data?.totalTrades ?? 0;
    const unclassified = data?.unclassified ?? 0;
    const visible = showAll ? patterns : patterns.slice(0, 5);

    const insights = buildInsights(patterns);

    return (
        <Card title="Your Behavioral Edge">
            {patterns.length === 0 ? (
                <p className="text-[12px] text-slate-500">No patterns yet</p>
            ) : (
                <div className="flex flex-col gap-3.5">
                    {visible.map((p, i) => (
                        <PatternRow key={p.label} pattern={p} isTop={i === 0} />
                    ))}
                </div>
            )}

            {patterns.length > 5 && (
                <button
                    onClick={() => setShowAll((s) => !s)}
                    className="mt-3 text-[11px] font-medium text-blue-400 hover:text-blue-300"
                >
                    {showAll ? "Show less" : `Show all ${patterns.length}`}
                </button>
            )}

            {unclassified > 0 && (
                <p className="mt-3 text-[11px] text-slate-500">
                    {unclassified} {unclassified === 1 ? "trade" : "trades"} had no clear pattern
                </p>
            )}

            {insights.length > 0 && (
                <div className="mt-4 flex flex-col gap-2 border-t border-white/5 pt-3">
                    {insights.map((i) => (
                        <p
                            key={i.text}
                            className={`text-[11.5px] leading-snug ${INSIGHT_TEXT[i.tone]}`}
                        >
                            {i.text}
                        </p>
                    ))}
                </div>
            )}

            <p className="mt-4 text-[10.5px] text-slate-500">
                Share of {total} analysed trades · a trade can show more than one pattern
            </p>
        </Card>
    );
}

// ---------------------------------------------------------------------------
// Sector Alignment
// ---------------------------------------------------------------------------

const QUADRANT_SEGMENTS = [
    {
        key: "genuineEdge",
        color: "bg-emerald-400",
        label: "Stock-specific move",
        description:
            "The stock was already moving differently from the market or sector before the trade, and that difference continued afterward.",
    },
    {
        key: "sectorAssisted",
        color: "bg-amber-400",
        label: "Sector helped",
        description:
            "The stock looked different before the trade, but afterward its movement was mostly explained by the market or sector.",
    },
    {
        key: "noEdge",
        color: "bg-amber-700",
        label: "Stock moved on its own",
        description:
            "There was no clear difference before the trade, but the stock moved differently from the market or sector afterward.",
    },
    {
        key: "indistinguishable",
        color: "bg-rose-400",
        label: "Moved with the market",
        description:
            "There was no clear stock-specific difference before or after the trade. The stock mostly moved with the market or sector.",
    },
];

function AlignmentBar({ quadrant, delay = 0, onTooltipChange }) {
    const [ref, inView] = useInView(0.4);
    const [hovered, setHovered] = useState(null);

    const values = QUADRANT_SEGMENTS.map((seg) => ({
        ...seg,
        value: Number(quadrant?.[seg.key]) || 0,
    }));

    const total = values.reduce(
        (sum, item) => sum + item.value,
        0
    );

    return (
        <div
            ref={ref}
            className="relative mt-3"
            onMouseLeave={() => setHovered(null)}
        >
            <div className="flex h-2 w-full overflow-visible rounded-full bg-white/[0.06]">
                {values.map((seg, i) => {
                    const percentage =
                        total > 0
                            ? (seg.value / total) * 100
                            : 0;

                    if (seg.value <= 0) return null;

                    return (
                        <div
                            key={seg.key}
                            className="relative h-full"
                            style={{
                                width: inView
                                    ? `${percentage}%`
                                    : "0%",
                                transition: `
            width 750ms cubic-bezier(0.22,1,0.36,1) ${delay + i * 80}ms,
            opacity 300ms ease ${delay + i * 80}ms
        `,
                                opacity: inView ? 1 : 0,
                            }}
                            onMouseEnter={() => {
                                setHovered(seg.key);
                                onTooltipChange?.(true);
                            }}
                            onMouseLeave={() => {
                                setHovered(null);
                                onTooltipChange?.(false);
                            }}
                            onFocus={() => {
                                setHovered(seg.key);
                                onTooltipChange?.(true);
                            }}
                            tabIndex={0}
                            role="button"
                            aria-label={`${seg.label}: ${seg.value.toFixed(1)}%`}
                        >
                            <div
                                className={`h-full ${seg.color} ${i === 0 ? "rounded-l-full" : ""
                                    } ${i === values.length - 1
                                        ? "rounded-r-full"
                                        : ""
                                    }`}
                            />

                            {hovered === seg.key && (
                                <div className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 w-64 -translate-x-1/2 rounded-lg border border-white/[0.10] bg-[#0b1320] px-3 py-2.5 shadow-xl">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2">
                                            <span
                                                className={`h-2 w-2 shrink-0 rounded-full ${seg.color}`}
                                            />
                                            <span className="text-[11.5px] font-semibold text-slate-100">
                                                {seg.label}
                                            </span>
                                        </div>

                                        <span className="text-[11px] font-semibold tabular-nums text-slate-300">
                                            {seg.value.toFixed(1)}%
                                        </span>
                                    </div>

                                    <p className="mt-1.5 text-[10.5px] leading-relaxed text-slate-400">
                                        {seg.description}
                                    </p>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function movementColor(value) {
    if (value <= -1) return "text-rose-400";
    if (value >= 1) return "text-emerald-400";
    return "text-slate-100";
}

function AlignmentMovementValue({ value, active }) {
    const displayed = useCountUp(value, active, 700);
    const sign = value > 0 ? "+" : "";

    return (
        <span
            className={`text-[25px] font-bold leading-none tabular-nums ${movementColor(
                value
            )}`}
        >
            {sign}
            {displayed.toFixed(1)}
            <span className="ml-1 text-[12px] font-medium text-slate-500">
                pts
            </span>
        </span>
    );
}

// ---------------------------------------------------------------------------
// Exit payoff
// ---------------------------------------------------------------------------

function PayoffSplit({ wellTimed, leftOnTable, active }) {
    const items = [
        {
            pct: wellTimed,
            dot: "bg-emerald-400",
            valueClass: "text-emerald-400",
            label: "Well timed",
            detail: "Price kept falling after you sold.",
        },
        {
            pct: leftOnTable,
            dot: "bg-amber-400",
            valueClass: "text-amber-400",
            label: "Left on the table",
            detail: "Price rose after you sold.",
        },
    ];

    return (
        <div className="mt-3.5 border-t border-white/[0.07] pt-3.5">
            <p className="text-[10.5px] font-medium uppercase tracking-wide text-slate-500">
                What happened after your sells?
            </p>

            <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                {items.map((it, i) => (
                    <div
                        key={it.label}
                        className="rounded-xl border border-white/[0.06] bg-black/20 p-3.5"
                        style={{
                            opacity: active ? 1 : 0,
                            transform: active
                                ? "scale(1)"
                                : "scale(0.96)",
                            transition: `opacity 350ms ${350 + i * 90
                                }ms, transform 350ms ${350 + i * 90
                                }ms`,
                        }}
                    >
                        <div
                            className={`text-lg font-bold tabular-nums ${it.valueClass}`}
                        >
                            {it.pct}%
                        </div>

                        <div className="mt-1 flex items-start gap-1.5">
                            <span
                                className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${it.dot}`}
                            />

                            <div>
                                <div className="text-[11.5px] leading-snug text-slate-300">
                                    {it.label}
                                </div>

                                <div className="mt-0.5 text-[10.5px] leading-snug text-slate-500">
                                    {it.detail}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// One alignment row
// ---------------------------------------------------------------------------

function AlignmentRow({
    variant = "sector",
    label,
    count,
    countLabel,
    avgAlpha,
    quadrant,
    note,
    payoff,
    index = 0,
}) {
    const [ref, inView] = useInView(0.4);
    const [tooltipActive, setTooltipActive] = useState(false);
    const isNifty = variant === "nifty";

    return (
        <div
            ref={ref}
            className={`relative rounded-xl px-4 py-3.5 transition-colors duration-300 ${tooltipActive ? "z-50" : "z-0"
                } ${isNifty
                    ? "border border-blue-400/20 bg-blue-400/[0.05]"
                    : "border border-white/[0.06] bg-[#151C2C] hover:bg-white/[0.03]"
                }`}
            style={{
                opacity: inView ? 1 : 0,
                transform: inView
                    ? "translateY(0)"
                    : "translateY(8px)",
                transition: `opacity 350ms ${index * 70
                    }ms, transform 350ms ${index * 70}ms`,
            }}
        >
            <div className="flex items-baseline justify-between gap-3">
                <span className="text-[13.5px] font-medium text-slate-100">
                    {label}
                </span>

                <span className="shrink-0 text-[12px] text-slate-500">
                    {count} {countLabel}
                </span>
            </div>

            <div className="mt-1.5 flex items-baseline gap-2">
                <AlignmentMovementValue
                    value={avgAlpha}
                    active={inView}
                />

                <span className="text-[11.5px] text-slate-500">
                    vs {isNifty ? "NIFTY 50" : "sector"} on average
                </span>
            </div>

            <p className="mt-1 text-[10.5px] leading-snug text-slate-600">
                Positive = the stock moved more than its benchmark.
                Negative = it moved less.
            </p>

            <AlignmentBar
                quadrant={quadrant}
                delay={index * 70}
                onTooltipChange={setTooltipActive}
            />

            {note && (
                <p className="mt-2.5 text-[11.5px] leading-snug text-slate-400">
                    {note}
                </p>
            )}

            {payoff && (
                <PayoffSplit
                    {...payoff}
                    active={inView}
                />
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// One side — Entries / Exits
// ---------------------------------------------------------------------------

function AlignmentPanel({ side, panel }) {
    const isEntries = side === "entries";
    const countLabel = isEntries ? "buys" : "sells";

    return (
        <div className="rounded-2xl border border-white/[0.06] bg-[#0F1523] p-5 sm:p-6">
            <div className="flex items-center gap-2.5">
                <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide ${isEntries
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-rose-500/15 text-rose-400"
                        }`}
                >
                    {isEntries ? "BUY" : "SELL"}
                </span>

                <h3 className="text-[15px] font-semibold text-slate-100">
                    Sector Alignment
                </h3>
            </div>

            <p className="mt-1.5 text-[12.5px] leading-snug text-slate-500">
                {panel.subtitle}
            </p>

            <div className="mt-4 flex flex-col gap-3">
                {panel.nifty && (
                    <AlignmentRow
                        variant="nifty"
                        label={panel.nifty.name}
                        count={panel.nifty.trades}
                        countLabel={countLabel}
                        avgAlpha={panel.nifty.avgAlpha}
                        quadrant={panel.nifty.quadrant}
                        note={panel.nifty.note}
                        payoff={!isEntries ? panel.payoff : null}
                        index={0}
                    />
                )}

                {panel.sectors?.length > 0 && (
                    <>
                        <div className="mt-1 flex items-center justify-between">
                            <p className="text-[11.5px] text-slate-500">
                                By sector
                            </p>

                            {panel.sectors.length > 3 && (
                                <span className="text-[10px] text-slate-600">
                                    Scroll for more
                                </span>
                            )}
                        </div>

                        <div
                            className="flex h-[270px] flex-col gap-2 overflow-y-auto pr-1"
                            style={{
                                scrollbarWidth: "thin",
                            }}
                        >
                            {panel.sectors.map((s, i) => (
                                <AlignmentRow
                                    key={s.name}
                                    label={s.name}
                                    count={s.trades}
                                    countLabel={countLabel}
                                    avgAlpha={s.avgAlpha}
                                    quadrant={s.quadrant}
                                    note={s.note}
                                    index={i + 1}
                                />
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Conclusion
// ---------------------------------------------------------------------------

function SectorAlignmentConclusion({ conclusion }) {
    if (!conclusion) return null;

    return (
        <div className="rounded-2xl border border-white/[0.07] bg-[#0F1523] px-5 py-4 sm:px-6">
            <div className="flex items-start gap-3">
                <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-400" />

                <div className="min-w-0">
                    <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                        What your trades are showing
                    </p>

                    <p className="mt-1.5 text-[15px] font-semibold leading-snug text-slate-100">
                        {cleanSectorConclusion(
                            conclusion.headline
                        )}
                    </p>

                    {conclusion.detail && (
                        <p className="mt-1.5 max-w-4xl text-[12px] leading-relaxed text-slate-400">
                            {cleanSectorConclusion(
                                conclusion.detail
                            )}
                        </p>
                    )}

                    {conclusion.sampleNote && (
                        <p className="mt-2 text-[10.5px] text-slate-600">
                            {cleanSectorConclusion(
                                conclusion.sampleNote
                            )}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

// Removes technical terminology from the backend-generated conclusion
// without changing the actual underlying numbers or conclusion logic.
function cleanSectorConclusion(text) {
    if (!text) return text;

    return text
        .replace(
            /average alpha vs NIFTY/gi,
            "average compared with NIFTY"
        )
        .replace(
            /running at ([+-]?\d+(?:\.\d+)?)% average compared with NIFTY/gi,
            "moving $1% compared with NIFTY on average"
        )
        .replace(
            /percentage points stronger than/gi,
            "points ahead of"
        )
        .replace(
            /percentage points weaker than/gi,
            "points behind"
        );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

function SectorAlignmentCard({ data }) {
    if (!data) return null;

    return (
        <div className="flex flex-col gap-4">
            <SectorAlignmentConclusion
                conclusion={data.conclusion}
            />

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <AlignmentPanel
                    side="entries"
                    panel={data.entries}
                />

                <AlignmentPanel
                    side="exits"
                    panel={data.exits}
                />
            </div>

            <div className="rounded-2xl border border-white/[0.06] bg-[#0F1523] px-5 py-3.5">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <span className="flex items-center gap-1.5 text-[10.5px] text-slate-400">
                        <span className="h-2 w-2 rounded-full bg-emerald-400" />
                        Stock-specific move
                    </span>

                    <span className="flex items-center gap-1.5 text-[10.5px] text-slate-400">
                        <span className="h-2 w-2 rounded-full bg-amber-400" />
                        Sector helped
                    </span>

                    <span className="flex items-center gap-1.5 text-[10.5px] text-slate-400">
                        <span className="h-2 w-2 rounded-full bg-amber-700" />
                        Stock moved on its own
                    </span>

                    <span className="flex items-center gap-1.5 text-[10.5px] text-slate-400">
                        <span className="h-2 w-2 rounded-full bg-rose-400" />
                        Moved with the market
                    </span>
                </div>

                <p className="mt-2 text-[10px] leading-relaxed text-slate-600">
                    Hover over any part of a bar to see exactly what it
                    means. The comparison shows how much the stock moved
                    differently from its benchmark — it does not mean
                    profit or loss.
                </p>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// The Mistake Radar (3-axis version)
// ---------------------------------------------------------------------------
//
// Expected data shape:
//   data.axes      -> ["Chasing Highs", "Counter-Trend Dip", "Overleveraged"]
//   data.thisMonth -> [72, 61, 45]   (one value per axis, 0-100)
//   data.lastMonth -> [50, 68, 38]
//   data.callouts  -> 3 items { label, value }
//   data.trades    -> 214
//
// The chart itself is still generic in `axes.length`, but the sizing and
// centering below are tuned so a triangle looks balanced (a triangle's
// vertices aren't symmetric top-to-bottom like a hexagon's, so simply
// centering the circle around the plot leaves the shape sitting too high).

function RadarChart({ axes, seriesA, seriesB }) {
    const [ref, { width }] = useMeasure();
    const mounted = useMountedAfterPaint(120);

    const n = axes.length;
    const levels = 4;
    const maxVal = 100;

    // Plot diameter is capped independently of the card's width so the chart
    // stays a compact, centered gauge. With only 3 axes there is less to
    // crowd the plot, so it can be a little larger than the 6-axis version.
    const plotSize = Math.max(Math.min(width, 260), 200);
    const radius = plotSize / 2;

    const angleFor = (i) => (Math.PI * 2 * i) / n - Math.PI / 2;

    // --- Layout -------------------------------------------------------------
    // Horizontal: the two lower vertices of a triangle carry side labels
    // ("Counter-Trend Dip"), so we reserve generous room left and right.
    const marginX = 110;
    const svgWidth = plotSize + marginX * 2;

    // Vertical: measure the real vertical extent of the outer polygon
    // (top vertex at -r, lower vertices at +r/2 for a triangle) and size the
    // SVG around that instead of assuming a full circle. This removes the
    // dead space under the triangle and keeps it optically centered.
    const labelPad = radius * 0.14 + 14;
    const ys = axes.map((_, i) => Math.sin(angleFor(i)) * radius);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const svgHeight = maxY - minY + labelPad * 2;

    const cx = svgWidth / 2;
    const cy = labelPad - minY;

    // --- Geometry helpers ---------------------------------------------------
    const pointFor = (value, i, r = radius) => {
        const a = angleFor(i);
        const dist = (value / maxVal) * r;
        return [cx + Math.cos(a) * dist, cy + Math.sin(a) * dist];
    };

    const lineGen = d3.line().curve(d3.curveLinearClosed);

    const pathFor = (series) =>
        lineGen(series.map((v, i) => pointFor(mounted ? v : 0, i)));

    const gridPolygon = (level) =>
        lineGen(axes.map((_, i) => pointFor(maxVal * (level / levels), i)));

    return (
        <div ref={ref} className="flex w-full justify-center">
            <svg
                width={svgWidth}
                height={svgHeight}
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                overflow="visible"
                style={{ maxWidth: "100%", height: "auto" }}
            >
                {/* grid rings */}
                {Array.from({ length: levels }).map((_, li) => (
                    <path
                        key={li}
                        d={gridPolygon(li + 1)}
                        fill="none"
                        stroke="#212a3d"
                        strokeWidth={1}
                    />
                ))}
                {/* spokes */}
                {axes.map((_, i) => {
                    const [px, py] = pointFor(maxVal, i);
                    return (
                        <line
                            key={i}
                            x1={cx}
                            y1={cy}
                            x2={px}
                            y2={py}
                            stroke="#212a3d"
                            strokeWidth={1}
                        />
                    );
                })}
                {/* last month (dashed outline) */}
                <path
                    d={pathFor(seriesB)}
                    fill="none"
                    stroke="#8B7BF7"
                    strokeDasharray="4 3"
                    strokeWidth={1.5}
                    style={{ transition: "d 900ms cubic-bezier(0.22,1,0.36,1)" }}
                />
                {/* this month (filled) */}
                <path
                    d={pathFor(seriesA)}
                    fill="#3B82F6"
                    fillOpacity={0.28}
                    stroke="#3B82F6"
                    strokeWidth={2}
                    style={{ transition: "d 900ms cubic-bezier(0.22,1,0.36,1)" }}
                />
                {/* vertex dots: with only 3 points they make each value easy to read */}
                {seriesA.map((v, i) => {
                    const [px, py] = pointFor(mounted ? v : 0, i);
                    return (
                        <circle
                            key={i}
                            cx={px}
                            cy={py}
                            r={3}
                            fill="#3B82F6"
                            style={{
                                transition:
                                    "cx 900ms cubic-bezier(0.22,1,0.36,1), cy 900ms cubic-bezier(0.22,1,0.36,1)",
                            }}
                        />
                    );
                })}
                {/* axis labels */}
                {axes.map((label, i) => {
                    const [lx, ly] = pointFor(maxVal + 14, i);
                    const cos = Math.cos(angleFor(i));
                    const anchor =
                        Math.abs(cos) < 0.2 ? "middle" : cos > 0 ? "start" : "end";
                    return (
                        <text
                            key={label}
                            x={lx}
                            y={ly}
                            textAnchor={anchor}
                            dy="0.32em"
                            className="fill-slate-400 text-[10px]"
                        >
                            {label}
                        </text>
                    );
                })}
            </svg>
        </div>
    );
}

function MistakeRadarCard({ data }) {
    const [range, setRange] = useState("this");
    return (
        <Card
            title="The Mistake Radar"
            right={
                <span className="text-[12px] text-slate-500">{data.trades} trades</span>
            }
        >
            <div className="mb-2 flex items-center gap-4 text-[12px]">
                <button
                    onClick={() => setRange("this")}
                    className="flex items-center gap-1.5 text-slate-300"
                >
                    <span
                        className={`h-2.5 w-2.5 rounded-full ${range === "this" ? "bg-blue-500" : "bg-blue-500/40"
                            }`}
                    />
                    This Month
                </button>
                <button
                    onClick={() => setRange("last")}
                    className="flex items-center gap-1.5 text-slate-400"
                >
                    <span className="h-2.5 w-2.5 rounded-full border border-violet-400" />
                    Last Month
                </button>
            </div>

            <RadarChart
                axes={data.axes}
                seriesA={data.thisMonth}
                seriesB={data.lastMonth}
            />

            {/* 3 callouts -> 3 columns, one per axis */}
            <div className="mt-4 grid grid-cols-3 gap-2">
                {data.callouts.map((c) => (
                    <div
                        key={c.label}
                        className="rounded-xl border border-white/[0.06] bg-[#151C2C] px-3 py-2.5 text-center"
                    >
                        <p className="text-[15px] font-semibold text-rose-400">
                            {c.value}
                        </p>
                        <p className="text-[11px] leading-tight text-slate-500">
                            {c.label}
                        </p>
                    </div>
                ))}
            </div>
        </Card>
    );
}

// ---------------------------------------------------------------------------
// Winning Conditions Matrix
// ---------------------------------------------------------------------------

function LowSampleBadge({ show }) {
    if (!show) return null;
    return (
        <span className="mt-1 inline-block text-[10px] text-amber-400/80">
            Based on limited trades — accuracy improves as you trade more
        </span>
    );
}

function ConfidenceBars({ tier = 0, tone }) {
    // tier: 0-5, how many bars are "on"
    return (
        <div className="flex flex-col items-end gap-0.5">
            <span className="text-[9px] font-medium uppercase tracking-wide text-slate-500">
                Confidence
            </span>
            <div className="flex gap-[3px]">
                {[1, 2, 3, 4, 5].map((i) => (
                    <span
                        key={i}
                        className="h-2.5 w-1 rounded-[1px]"
                        style={{
                            backgroundColor:
                                i <= tier
                                    ? tone === "strong"
                                        ? "#5b9dff"
                                        : "#ef6a6a"
                                    : "#1c2432",
                        }}
                    />
                ))}
            </div>
        </div>
    );
}

function CompareBars({ variant, thisLabel = "This setup", restLabel = "Rest of trades", thisValue, restValue }) {
    const isStrong = variant === "strong";
    const max = Math.max(Math.abs(thisValue), Math.abs(restValue)) || 1;
    return (
        <div className="mb-3 rounded-lg bg-white/[0.03] p-2.5">
            <div className="mb-1.5 flex items-center gap-2 text-[11px]">
                <span className="w-20 shrink-0 text-slate-500">{thisLabel}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#1c2432]">
                    <span
                        className="block h-full rounded-full"
                        style={{
                            width: `${(Math.abs(thisValue) / max) * 100}%`,
                            backgroundColor: isStrong ? "#5b9dff" : "#ef6a6a",
                        }}
                    />
                </span>
                <span className="w-11 shrink-0 text-right font-medium text-slate-200">
                    {thisValue}
                </span>
            </div>
            <div className="flex items-center gap-2 text-[11px]">
                <span className="w-20 shrink-0 text-slate-500">{restLabel}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#1c2432]">
                    <span
                        className="block h-full rounded-full bg-slate-600"
                        style={{ width: `${(Math.abs(restValue) / max) * 100}%` }}
                    />
                </span>
                <span className="w-11 shrink-0 text-right font-medium text-slate-200">
                    {restValue}
                </span>
            </div>
        </div>
    );
}

function SetupPanel({ variant, setup }) {
    const isStrong = variant === "strong";
    if (!setup) return null;

    return (
        <div
            className={`flex flex-1 flex-col rounded-xl border p-4 ${isStrong
                ? "border-blue-500/20 bg-blue-500/[0.05]"
                : "border-rose-500/20 bg-rose-500/[0.05]"
                }`}
        >
            <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <div
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${isStrong
                            ? "bg-blue-500/20 text-blue-300"
                            : "bg-rose-500/20 text-rose-300"
                            }`}
                    >
                        {isStrong ? <Trophy size={12} /> : <AlertTriangle size={12} />}
                    </div>
                    <div>
                        <p className="text-[13px] font-semibold text-slate-100">
                            {isStrong ? "Strongest Setup" : "Weakest Setup"}
                        </p>
                        <p className="text-[10.5px] text-slate-500">{setup.trades} trades matched</p>
                        <LowSampleBadge show={setup.lowSampleWarning} />
                    </div>
                </div>
                <ConfidenceBars tier={setup.confidenceTier} tone={variant} />
            </div>

            <p className="mb-1.5 text-[10px] font-medium text-slate-500">
                Conditions at Entry
            </p>
            <div className="mb-3 flex flex-wrap gap-1.5">
                {setup.technicalTags.map((t) => (
                    <span
                        key={t}
                        className={`rounded-md border px-2 py-0.5 text-[10.5px] font-medium ${isStrong
                            ? "border-blue-500/30 text-blue-300"
                            : "border-rose-500/30 text-rose-300"
                            }`}
                    >
                        {t}
                    </span>
                ))}
                {setup.behavioralTags.map((t) => (
                    <span
                        key={t}
                        className="rounded-md bg-[#1B2333] px-2 py-0.5 text-[10.5px] font-medium text-slate-300"
                    >
                        {t}
                    </span>
                ))}
            </div>

            <CompareBars
                variant={variant}
                thisValue={setup.comparison.thisValue}
                restValue={setup.comparison.restValue}
            />

            <p className="flex-1 text-[12px] italic leading-relaxed text-slate-400">
                "{setup.quote}"
            </p>

            <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-3 text-[11.5px]">
                <span className="text-slate-400">
                    {setup.metricLabel}:{" "}
                    <span className="font-medium text-slate-200">{setup.metricValue}</span>
                </span>
                <button
                    className={
                        isStrong
                            ? "text-blue-400 hover:text-blue-300"
                            : "text-rose-400 hover:text-rose-300"
                    }
                >
                    View {setup.trades} Trades
                </button>
            </div>
        </div>
    );
}

function ColdStartNote({ coldStart }) {
    if (!coldStart) return null;
    return (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-dashed border-white/10 px-3.5 py-2.5 text-[11.5px] text-slate-500">
            <span>
                A pattern — <span className="font-medium text-slate-300">{coldStart.label}</span> — is still building confidence.
            </span>
            <span className="font-medium text-slate-400">
                {coldStart.current} / {coldStart.target}
            </span>
        </div>
    );
}

function WinningConditionsCard({ data }) {
    if (!data) return null;
    return (
        <Card
            title="Winning Conditions Matrix"
            subtitle="Patterns pulled from your own trade history — not a generic rulebook."
            right={
                <span className="flex items-center gap-1 whitespace-nowrap text-[12px] text-slate-500">
                    <TrendingUp size={13} /> {data.meta?.basedOnTrades} trades analyzed
                </span>
            }
        >
            <div className="flex flex-col gap-3 sm:flex-row">
                <SetupPanel variant="strong" setup={data.strongest} />
                <SetupPanel variant="weak" setup={data.weakest} />
            </div>
            <ColdStartNote coldStart={data.coldStart} />
        </Card>
    );
}

// // ---------------------------------------------------------------------------
// // MAE / MFE Drawdown Map — scatter
// // ---------------------------------------------------------------------------

// function MaeMfeChart({ data }) {
//     const [ref, { width }] = useMeasure();
//     const mounted = useMountedAfterPaint(200);
//     const height = 220;
//     const margin = { top: 10, right: 16, bottom: 30, left: 40 };
//     const w = Math.max(width - margin.left - margin.right, 0);
//     const h = height - margin.top - margin.bottom;

//     const allX = [...data.win, ...data.loss].map((d) => d[0]);
//     const allY = [...data.win, ...data.loss].map((d) => d[1]);

//     const x = useMemo(
//         () =>
//             d3
//                 .scaleLinear()
//                 .domain([0, Math.max(...allX) * 1.15])
//                 .range([0, w]),
//         [allX, w]
//     );
//     const y = useMemo(
//         () =>
//             d3
//                 .scaleLinear()
//                 .domain([0, Math.max(...allY) * 1.15])
//                 .range([h, 0]),
//         [allY, h]
//     );

//     return (
//         <div ref={ref} className="w-full">
//             {w > 0 && (
//                 <svg width={w + margin.left + margin.right} height={height}>
//                     <g transform={`translate(${margin.left},${margin.top})`}>
//                         {y.ticks(5).map((t) => (
//                             <g key={t}>
//                                 <line
//                                     x1={0}
//                                     x2={w}
//                                     y1={y(t)}
//                                     y2={y(t)}
//                                     stroke="#1B2333"
//                                 />
//                                 <text
//                                     x={-8}
//                                     y={y(t)}
//                                     dy="0.32em"
//                                     textAnchor="end"
//                                     className="fill-slate-500 text-[10px]"
//                                 >
//                                     {t}
//                                 </text>
//                             </g>
//                         ))}
//                         {x.ticks(6).map((t) => (
//                             <text
//                                 key={t}
//                                 x={x(t)}
//                                 y={h + 18}
//                                 textAnchor="middle"
//                                 className="fill-slate-500 text-[10px]"
//                             >
//                                 {t}
//                             </text>
//                         ))}

//                         {data.win.map(([mx, my], i) => (
//                             <circle
//                                 key={`w-${i}`}
//                                 cx={x(mx)}
//                                 cy={mounted ? y(my) : h}
//                                 r={5}
//                                 fill="#34D399"
//                                 opacity={mounted ? 0.9 : 0}
//                                 style={{
//                                     transition: `cy 700ms cubic-bezier(0.22,1,0.36,1) ${i * 60}ms, opacity 500ms ${i * 60}ms`,
//                                 }}
//                             />
//                         ))}
//                         {data.loss.map(([mx, my], i) => (
//                             <circle
//                                 key={`l-${i}`}
//                                 cx={x(mx)}
//                                 cy={mounted ? y(my) : h}
//                                 r={5}
//                                 fill="#FB7185"
//                                 opacity={mounted ? 0.9 : 0}
//                                 style={{
//                                     transition: `cy 700ms cubic-bezier(0.22,1,0.36,1) ${(data.win.length + i) * 60
//                                         }ms, opacity 500ms ${(data.win.length + i) * 60}ms`,
//                                 }}
//                             />
//                         ))}
//                     </g>
//                 </svg>
//             )}
//         </div>
//     );
// }

// function MaeMfeCard({ data }) {
//     return (
//         <Card
//             title="MAE / MFE Drawdown Map"
//             subtitle="How far price went against you vs. in your favor"
//             right={
//                 <div className="flex items-center gap-3 text-[12px] text-slate-400">
//                     <span className="flex items-center gap-1.5">
//                         <span className="h-2 w-2 rounded-full bg-emerald-400" /> Win
//                     </span>
//                     <span className="flex items-center gap-1.5">
//                         <span className="h-2 w-2 rounded-full bg-rose-400" /> Loss
//                     </span>
//                 </div>
//             }
//         >
//             <MaeMfeChart data={data} />
//             <div className="mt-1 flex justify-between px-1 text-[11px] text-slate-500">
//                 <span>Max Adverse Excursion (pts)</span>
//             </div>
//         </Card>
//     );
// }


// ---------------------------------------------------------------------------
// Price Reaction Card — "cost of buying/selling too early" (buy + sell)
// ---------------------------------------------------------------------------

function PriceReactionMiniStat({ variant, stat, active }) {
    const isWeak = variant === "weak";
    return (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div
                className={`flex items-center gap-1.5 text-[13px] font-medium ${isWeak ? "text-rose-400" : "text-emerald-400"
                    }`}
            >
                {isWeak ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
                {stat.label}
            </div>
            <div
                className={`mt-2 text-[28px] font-semibold leading-none ${isWeak ? "text-rose-400" : "text-emerald-400"
                    }`}
            >
                {active ? stat.pct : 0}%
            </div>
            <p className="mt-2 text-[12.5px] leading-snug text-slate-400">
                {stat.detail} · average move {stat.avgMove}%
            </p>
        </div>
    );
}

function PriceReactionScatter({ points, active }) {
    const [ref, { width }] = useMeasure();
    const height = 180;
    const margin = { top: 18, right: 12, bottom: 22, left: 12 };
    const w = Math.max(width - margin.left - margin.right, 0);
    const h = height - margin.top - margin.bottom;

    const maxAbs = Math.max(...points.map((p) => Math.abs(p))) * 1.2;
    const y = useMemo(
        () => d3.scaleLinear().domain([-maxAbs, maxAbs]).range([h, 0]),
        [maxAbs, h]
    );
    const x = useMemo(
        () =>
            d3
                .scalePoint()
                .domain(points.map((_, i) => i))
                .range([0, w])
                .padding(0.5),
        [points, w]
    );

    return (
        <div ref={ref} className="w-full">
            {w > 0 && (
                <svg width={w + margin.left + margin.right} height={height}>
                    <g transform={`translate(${margin.left},${margin.top})`}>
                        <text x={0} y={-6} className="fill-slate-500 text-[10.5px]">
                            ↑ Rose more
                        </text>
                        <text x={0} y={h + 16} className="fill-slate-500 text-[10.5px]">
                            ↓ Fell more
                        </text>
                        <line
                            x1={0}
                            x2={w}
                            y1={y(0)}
                            y2={y(0)}
                            stroke="#1B2333"
                            strokeDasharray="3 4"
                        />
                        {points.map((p, i) => {
                            const rose = p >= 0;
                            return (
                                <circle
                                    key={i}
                                    cx={x(i)}
                                    cy={active ? y(p) : y(0)}
                                    r={6}
                                    fill={rose ? "#34D399" : "#FB7185"}
                                    opacity={active ? 0.9 : 0}
                                    style={{
                                        transition: `cy 650ms cubic-bezier(0.22,1,0.36,1) ${i * 55}ms, opacity 400ms ${i * 55}ms`,
                                    }}
                                />
                            );
                        })}
                    </g>
                </svg>
            )}
        </div>
    );
}

function PriceReactionCard({ data }) {
    const [ref, inView] = useInView();
    const amount = useCountUp(data.amount, inView, 1000);

    return (
        <div
            ref={ref}
            className="rounded-2xl border border-white/[0.06] bg-[#0F1523] p-5 sm:p-6"
        >
            <h3 className="text-[15px] font-semibold text-slate-100">
                {data.headline}
            </h3>
            <p className="mt-0.5 text-[12.5px] text-slate-500">
                {data.subheadline}
            </p>

            <div className="mt-5 flex flex-wrap items-start gap-x-3 gap-y-1">
                <span className="text-[32px] font-semibold leading-none text-rose-400">
                    ~₹{Math.round(amount).toLocaleString("en-IN")}
                </span>
                <span className="max-w-[280px] pt-1 text-[12.5px] leading-snug text-slate-400">
                    {data.amountNote}
                </span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
                <PriceReactionMiniStat variant="weak" stat={data.weak} active={inView} />
                <PriceReactionMiniStat variant="strong" stat={data.strong} active={inView} />
            </div>

            <div className="my-5 border-t border-white/[0.06]" />

            <h4 className="mb-1 text-[13.5px] font-medium text-slate-200">
                {data.plotLabel}
            </h4>
            <PriceReactionScatter points={data.points} active={inView} />

            <div className="mt-3 flex flex-wrap items-center gap-4 text-[12px] text-slate-400">
                <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" /> Price was higher at this checkpoint
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-rose-400" /> Price was lower at this checkpoint
                </span>
            </div>

            <p className="mt-4 text-[11.5px] leading-snug text-slate-500">
                {data.disclaimer}
            </p>
        </div>
    );
}
// ---------------------------------------------------------------------------
// Conviction Penalty — capital deployed vs. setup quality
// ---------------------------------------------------------------------------

const TIER_COLOR = { weak: "#FB7185", mid: "#FBBF24", strong: "#34D399" };

function ConvictionBars({ buckets, active }) {
    const [ref, { width }] = useMeasure();
    const height = 164; // was 150, extra room for the "avg dip" line
    const margin = { top: 20, right: 8, bottom: 48, left: 8 }; // bottom was 34
    const w = Math.max(width - margin.left - margin.right, 0);
    const h = height - margin.top - margin.bottom;
    // the ", 1" keeps this safe when every bucket is empty
    const max = Math.max(...buckets.map((b) => b.avgCapital), 1) * 1.15;

    const x = useMemo(
        () =>
            d3
                .scaleBand()
                .domain(buckets.map((b) => b.label))
                .range([0, w])
                .padding(0.42),
        [buckets, w]
    );
    const y = useMemo(() => d3.scaleLinear().domain([0, max]).range([h, 0]), [max, h]);

    return (
        <div ref={ref} className="w-full">
            {w > 0 && (
                <svg width={w + margin.left + margin.right} height={height}>
                    <g transform={`translate(${margin.left},${margin.top})`}>
                        {buckets.map((b, i) => {
                            const bw = x.bandwidth();
                            const bh = active ? h - y(b.avgCapital) : 0;
                            return (
                                <g key={b.label}>
                                    <text
                                        x={x(b.label) + bw / 2}
                                        y={h - bh - 8}
                                        textAnchor="middle"
                                        className="text-[12px] font-medium"
                                        fill={TIER_COLOR[b.tier]}
                                        style={{
                                            opacity: active ? 1 : 0,
                                            transition: `opacity 350ms ${i * 90 + 400}ms`,
                                        }}
                                    >
                                        {b.trades > 0 ? `₹${Math.round(b.avgCapital / 1000)}k` : "—"}
                                    </text>
                                    <rect
                                        x={x(b.label)}
                                        y={h - bh}
                                        width={bw}
                                        height={bh}
                                        rx={7}
                                        fill={TIER_COLOR[b.tier]}
                                        style={{
                                            transition: `height 700ms cubic-bezier(0.22,1,0.36,1) ${i * 90}ms, y 700ms cubic-bezier(0.22,1,0.36,1) ${i * 90}ms`,
                                        }}
                                    />
                                    <text
                                        x={x(b.label) + bw / 2}
                                        y={h + 16}
                                        textAnchor="middle"
                                        className="fill-slate-400 text-[11px]"
                                    >
                                        {b.label}
                                    </text>
                                    <text
                                        x={x(b.label) + bw / 2}
                                        y={h + 29}
                                        textAnchor="middle"
                                        className="fill-slate-600 text-[10px]"
                                    >
                                        {b.trades} trades
                                    </text>
                                    {/* NEW: what happened after entry, per bucket */}
                                    {b.avgDrawdownPct != null && (
                                        <text
                                            x={x(b.label) + bw / 2}
                                            y={h + 42}
                                            textAnchor="middle"
                                            className="fill-slate-500 text-[10px]"
                                        >
                                            avg dip {b.avgDrawdownPct}%
                                        </text>
                                    )}
                                </g>
                            );
                        })}
                    </g>
                </svg>
            )}
        </div>
    );
}

function ConvictionPenaltyCard({ data }) {
    const [ref, inView] = useInView();
    const c = data.consequence;

    // hooks must run unconditionally, so feed them 0 when the backend sends null
    const ratio = useCountUp(data.ratio ?? 0, inView, 900);
    const extra = useCountUp(data.extraCapital ?? 0, inView, 900);
    const dd = useCountUp(c?.weak.drawdownAmount ?? 0, inView, 900);

    const ready = data.sampleCount >= data.minSample;
    const hasRatio = data.ratio != null;
    const hasExtra = data.extraCapital != null;
    // no ratio yet, but we do know what the weak entries cost: make that the hero
    const consequenceHero = !hasRatio && !!c;

    const ratioColor =
        data.ratio >= 1.2 ? "text-rose-400" : data.ratio > 1 ? "text-amber-300" : "text-emerald-400";
    const ratioText =
        data.ratio >= 1
            ? "more capital on setups scoring below 50 vs. above 70"
            : "the capital on setups scoring below 50 vs. above 70. You size up your best setups";

    return (
        <div
            ref={ref}
            className="rounded-2xl border border-white/[0.06] bg-[#0F1523] p-5 sm:p-6"
        >
            <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                    <h3 className="text-[15px] font-semibold text-slate-100">
                        The Conviction Penalty
                    </h3>
                    <p className="mt-0.5 text-[12.5px] text-slate-500">
                        Capital deployed vs. setup quality
                    </p>
                    {ready && data.lowSampleWarning && (
                        <p className="mt-1 text-[10.5px] text-amber-400/80">
                            Based on limited trades. Accuracy improves as you trade more
                        </p>
                    )}
                </div>
                <span className="whitespace-nowrap text-[11.5px] text-slate-500">
                    {data.sampleCount} trades
                </span>
            </div>

            {!ready ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="mb-3 h-7 w-7 animate-spin rounded-full border-2 border-slate-700 border-t-blue-400" />
                    <p className="max-w-[260px] text-[12.5px] text-slate-400">
                        {data.sampleCount} of {data.minSample} trades scored. A few more and
                        we'll show you where your capital is going.
                    </p>
                </div>
            ) : (
                <>
                    {hasRatio ? (
                        <div className="flex flex-wrap items-end gap-x-5 gap-y-2">
                            <div>
                                <div className={`text-[30px] font-semibold leading-none ${ratioColor}`}>
                                    {ratio.toFixed(1)}×
                                </div>
                                <p className="mt-1.5 max-w-[190px] text-[12px] leading-snug text-slate-400">
                                    {ratioText}
                                </p>
                            </div>
                            {hasExtra && (
                                <>
                                    <div className="h-10 w-px bg-white/[0.06]" />
                                    <div>
                                        <div className="text-[20px] font-semibold leading-none text-slate-100">
                                            ₹{Math.round(extra).toLocaleString("en-IN")}
                                        </div>
                                        <p className="mt-1.5 max-w-[190px] text-[12px] leading-snug text-slate-400">
                                            extra deployed this month on weak-setup entries
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>
                    ) : consequenceHero ? (
                        <div>
                            <div className="text-[30px] font-semibold leading-none text-slate-100">
                                ~₹{Math.round(dd).toLocaleString("en-IN")}
                            </div>
                            <p className="mt-1.5 max-w-[360px] text-[12px] leading-snug text-slate-400">
                                what your {c.weak.trades} sub‑50 entries dipped below cost at their
                                worst — this is what better sizing on these could save you
                            </p>
                            <p className="mt-2 text-[11px] text-slate-500">
                                Once you score a setup above 70, we'll also compare how you
                                size it against your weaker entries.
                            </p>
                        </div>
                    ) : (
                        <p className="text-[12.5px] text-slate-400">
                            We need at least one setup scoring below 50 and one above 70 to
                            compare how you size them.
                        </p>
                    )}

                    <h4 className="mb-1 mt-5 text-[12.5px] font-medium text-slate-300">
                        Avg. capital per trade, by score
                    </h4>
                    <ConvictionBars buckets={data.buckets} active={inView} />

                    {c && (
                        <div className="mt-4 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                            <p className="text-[12px] leading-snug text-slate-300">
                                <span className="font-medium text-slate-200">Worth noticing: </span>
                                Your sub-50 entries dipped an average of{" "}
                                <span className="font-medium text-slate-100">
                                    {c.weak.avgDrawdownPct}%
                                </span>{" "}
                                below your buy price at their worst
                                {!consequenceHero && (
                                    <>
                                        , roughly{" "}
                                        <span className="font-medium text-slate-100">
                                            ₹{c.weak.drawdownAmount.toLocaleString("en-IN")}
                                        </span>{" "}
                                        of estimated drawdown across {c.weak.trades} completed
                                        trades
                                    </>
                                )}
                                .
                                {c.reference && c.comparison === "worse" && (
                                    <>
                                        {" "}Your {c.reference.label} entries dipped only{" "}
                                        {c.reference.avgDrawdownPct}% ({c.multiple}× less) — a real gap
                                        worth acting on.
                                    </>
                                )}
                                {c.reference && c.comparison === "similar" && (
                                    <>
                                        {" "}Your {c.reference.label} entries dipped a similar{" "}
                                        {c.reference.avgDrawdownPct}% — more trades will sharpen
                                        this comparison.
                                    </>
                                )}
                                {c.reference && c.comparison === "better" && (
                                    <>
                                        {" "}Interestingly, your {c.reference.label} entries dipped
                                        more ({c.reference.avgDrawdownPct}%), which is worth a look.
                                    </>
                                )}
                            </p>
                            {c.lowSample && (
                                <p className="mt-1.5 text-[10.5px] text-amber-400/80">
                                    Based on limited completed trades
                                </p>
                            )}
                        </div>
                    )}

                    {data.quickWin && (
                        <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-amber-400/15 bg-amber-400/[0.06] p-3">
                            <TrendingUp size={14} className="mt-0.5 shrink-0 text-amber-300" />
                            <p className="text-[12px] leading-snug text-slate-300">
                                <span className="font-medium text-amber-300">Quick win: </span>
                                {data.quickWin}
                            </p>
                        </div>
                    )}

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3 text-[11.5px]">
                        {data.trend ? (
                            <span
                                className={`flex items-center gap-1.5 ${data.trend.better ? "text-emerald-400" : "text-rose-400"
                                    }`}
                            >
                                {data.trend.better ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
                                Gap {data.trend.better ? "narrowed" : "widened"} {data.trend.pct}% vs
                                last month
                            </span>
                        ) : (
                            <span />
                        )}
                        <span className="text-slate-500">
                            Capital = quantity × entry price
                        </span>
                    </div>
                </>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Timeframe switch
// ---------------------------------------------------------------------------

function TimeframeSwitch({ value, onChange }) {
    return (
        <div
            className="inline-flex shrink-0 rounded-xl border border-blue-400/15 bg-[#0D1725] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]"
            aria-label="Dashboard timeframe"
        >
            {TIMEFRAME_OPTIONS.map((option) => {
                const active = option.value === value;

                return (
                    <button
                        key={option.value}
                        type="button"
                        onClick={() => onChange(option.value)}
                        aria-pressed={active}
                        className={`min-w-[48px] rounded-lg px-3 py-2 text-[12.5px] font-semibold tracking-wide transition-all duration-200 sm:min-w-[52px] ${active
                            ? "bg-[#213955] text-white shadow-[0_0_0_1px_rgba(96,165,250,0.10),0_4px_14px_rgba(30,64,175,0.18)]"
                            : "text-slate-500 hover:bg-white/[0.035] hover:text-slate-200"
                            }`}
                    >
                        {option.short}
                    </button>
                );
            })}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export default function PulseDashboard({ data = DEFAULT_DATA }) {
    const [timeframe, setTimeframe] = useState(DEFAULT_TIMEFRAME);
    const selectedTimeframe = getTimeframeOption(timeframe);

    const { data: liveAnalytics, loading } = useAnalyticsData(timeframe);

    const analyticsData = liveAnalytics
        ? { ...data, ...liveAnalytics }
        : data;

    const scoreTrend = analyticsData.scoreTrend || data.scoreTrend;
    const eqi = analyticsData.eqi || data.eqi;
    const mistakeRadar = analyticsData.mistakeRadar || data.mistakeRadar;
    const behavioral_edge = analyticsData.behavioralEdge || data.behavioralEdge;
    const sector_alignment = analyticsData.sectorAlignment || data.sectorAlignment;
    const priceReaction = analyticsData.priceReaction || data.priceReaction;
    const winningConditionsMatrix = analyticsData.winningConditionsMatrix || data.winningConditionsMatrix;
    const convictionPenalty = analyticsData.convictionPenalty || data.convictionPenalty;

    return (
        <div className="min-h-screen bg-[#0A0F1A] font-sans text-slate-200 antialiased">
            <Navbar solidBackground={true} />

            <div className="mx-auto px-4 py-6 sm:px-6 sm:py-8">
                <div className="mb-6">
                    <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
                        <div>
                            <h1 className="text-[22px] font-semibold text-white">The Pulse</h1>
                            <p className="mt-0.5 text-[13px] text-slate-500">
                                Execution quality · behavioral edge · market alignment
                            </p>
                        </div>
                    </div>

                    <div className="relative overflow-hidden rounded-2xl border border-blue-400/15 bg-[#08121E] px-4 py-4 shadow-[0_8px_32px_rgba(0,0,0,0.16)] sm:px-5 sm:py-5">
                        <div className="pointer-events-none absolute inset-y-0 left-0 w-40 bg-blue-500/[0.035] blur-2xl" />
                        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-300/70">
                                        Analysis window
                                    </p>
                                    {loading && (
                                        <span className="flex items-center gap-1.5 text-[10px] font-medium text-slate-500">
                                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
                                            Updating
                                        </span>
                                    )}
                                </div>

                                <p className="mt-1 text-[16px] font-semibold tracking-tight text-slate-100 sm:text-[18px]">
                                    Graded on a {selectedTimeframe.phrase} outlook
                                </p>
                                <p className="mt-0.5 text-[11.5px] text-slate-500">
                                    Every score, pattern, and insight below uses this selected timeframe.
                                </p>
                            </div>

                            <TimeframeSwitch
                                value={timeframe}
                                onChange={setTimeframe}
                            />
                        </div>
                    </div>
                </div>

                <div className={`transition-opacity duration-200 ${loading ? "opacity-70" : "opacity-100"}`}>
                    <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-12">
                        <div className="lg:col-span-4">
                            <ExecutionQualityCard eqi={eqi} />
                        </div>
                        <div className="lg:col-span-4">
                            <ScoreTrendCard data={scoreTrend} />
                        </div>
                        <div className="lg:col-span-4">
                            <BehavioralEdgeCard data={behavioral_edge} />
                        </div>

                        <div className="lg:col-span-12">
                            <SectorAlignmentCard data={sector_alignment} />
                        </div>
                        <div className="lg:col-span-12">
                            <WinningConditionsCard data={winningConditionsMatrix} />
                        </div>

                        <div className="lg:col-span-6">
                            <PriceReactionCard data={priceReaction.buy} />
                        </div>
                        <div className="lg:col-span-6">
                            <PriceReactionCard data={priceReaction.sell} />
                        </div>

                        <div className="lg:col-span-6">
                            <MistakeRadarCard data={mistakeRadar} />
                        </div>
                        <div className="lg:col-span-6">
                            <ConvictionPenaltyCard data={convictionPenalty} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}