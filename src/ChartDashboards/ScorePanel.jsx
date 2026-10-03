import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import * as d3 from "d3";
import ENV from "../config";
import {
    Target,
    ShieldCheck,
    Zap,
    AlertTriangle,
    TrendingDown,
    HelpCircle,
    Minus,
    Trophy,
    CheckCircle2,
    Clock,
    AlertOctagon,
    BarChart3,
    GitCompareArrows,
} from "lucide-react";

/* ============================================================================
 * NOTES
 * ----------------------------------------------------------------------------
 * - /api/trade-score/ (fast, local math) carries `badge`, `verdict`,
 *   `runtimeOutcome`, `timeframe`. It is re-fetched whenever the timeframe
 *   toggle changes.
 * - /api/sector-alignment/ (slower, network-bound) is fetched in parallel and
 *   merged per trade by index. `alignment` states per card:
 *     undefined -> loading | null -> no data | { isIndexFund: true } -> message
 *     { isIndexFund: false, nifty, sector } -> chart (Nifty default, Sector
 *     toggle only when both exist).
 * - Sector fetch does not depend on timeframe yet (backend window is fixed).
 * - Requires `d3`. Sector chart mounts only while its tab is active.
 * ==========================================================================*/

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');`;

/* ---------------------------------- Demo data ---------------------------------- */

const DEMO_SCORES = [
    {
        date: "2026-09-12T09:42:00",
        trade_type: "sell",
        price: "7,085",
        overall: 62,
        timeframe: "3_weeks",
        badge: { label: "Resistance Exit", color: "green" },
        verdict:
            "Resistance Exit — entry candle showed strong bearish conviction. Momentum hadn't fully turned yet, so this leaned early relative to the ideal exit window.",
        runtimeOutcome: {
            horizonDays: 15,
            checkpoints: [
                { day: 1, pct: -0.6, statusKey: "drawdown", note: "Drawdown" },
                { day: 3, pct: 1.9, statusKey: "building", note: "Building" },
                { day: 5, pct: 5.2, statusKey: "peak", isPeak: true, peakPrice: 7452.0 },
                { day: 10, pct: 2.4, statusKey: "fading", note: "Fading" },
                { day: 15, pct: 0.8, statusKey: "fading", note: "Flat" },
            ],
            mae: -0.9,
            mfe: { value: 5.2, day: 5 },
            verdict: "Reached +5.2% on Day 5, but gain faded to +0.8%.",
        },
        alignment: {
            isIndexFund: false,
            entryOffset: 15,
            stock: [
                -0.8, -0.6, -0.4, -0.3, -0.1, 0.1, 0.2, 0.1, -0.1, -0.2, -0.1, 0.0, 0.0, 0.0, 0.0, 0,
                -0.5, 1.3, 2.9, 4.5, 3.8, 2.1, 0.6, -0.9,
            ],
            nifty: {
                name: "Nifty 50",
                benchmarkSeries: [
                    -0.1, -0.1, -0.1, 0.0, 0.0, 0.0, 0.1, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0,
                    -0.6, -0.9, -1.3, -1.6, -1.2, -0.7, -0.3, 0.2,
                ],
                currentAlpha: -1.1,
                preAlpha: 0.1,
                verdict:
                    "You exited without a clear divergence from Nifty 50 either before or after — this stock has been moving mostly in step with the index (-1.1% apart currently). Hard to credit stock-picking specifically here; an index-tracking position would have looked similar.",
            },
            sector: {
                name: "Nifty IT",
                benchmarkSeries: [
                    -0.2, -0.2, -0.1, -0.1, 0.0, 0.0, 0.1, 0.0, 0.0, -0.1, 0.0, 0.0, 0.0, 0.0, 0.0, 0,
                    -1.9, -2.4, -3.6, -4.2, -3.5, -2.1, -0.8, 0.4,
                ],
                currentAlpha: -1.3,
                preAlpha: 0.1,
                verdict:
                    "You exited while the stock and Nifty IT were tracking almost identically — no real edge either way. After exit the sector fell harder than the stock, so the exit avoided more downside than skill alone would explain.",
            },
        },
        params: {
            trend: { score: 15, max: 30, comment: "Trend was fading into the move." },
            momentum: { score: 12, max: 20, comment: "Momentum confirmed the short bias." },
            volume: { score: 9, max: 15, comment: "Participation was there but not decisive." },
            sr: { score: 19, max: 25, comment: "Entry came from a clear resistance rejection." },
            candle: { score: 7, max: 10, comment: "Strong bearish candle — clear momentum at entry." },
        },
    },
    {
        date: "2026-09-12T10:18:00",
        trade_type: "buy",
        price: "7,120",
        overall: 84,
        timeframe: "3_weeks",
        badge: { label: "Sniper Support Bounce", color: "green" },
        verdict:
            "Sniper Support Bounce — price reclaimed the active uptrend with volume expanding on the move. Every parameter lined up here; this is the setup shape to repeat.",
        runtimeOutcome: {
            horizonDays: 15,
            checkpoints: [
                { day: 1, pct: -1.2, statusKey: "drawdown", note: "Drawdown" },
                { day: 3, pct: 3.4, statusKey: "building", note: "Building" },
                { day: 5, pct: 11.8, statusKey: "peak", isPeak: true, peakPrice: 328.0 },
                { day: 10, pct: 2.1, statusKey: "fading", note: "Fading" },
                { day: 15, pct: -4.2, statusKey: "loss", note: "Loss" },
            ],
            mae: -1.8,
            mfe: { value: 11.8, day: 5 },
            verdict: "Reached +11.8% on Day 5, but gain faded to -4.2%.",
        },
        alignment: {
            isIndexFund: false,
            entryOffset: 15,
            stock: [
                -1.5, -1.2, -0.9, -0.5, -0.1, 0.3, 0.7, 1.0, 1.2, 0.9, 0.6, 0.3, 0.1, 0.0, 0.0, 0,
                1.2, 2.3, 3.2, 4.0, 3.5, 2.3, 0.8, -0.5,
            ],
            nifty: {
                name: "Nifty 50",
                benchmarkSeries: [
                    -0.3, -0.2, -0.1, -0.1, 0.0, 0.0, 0.1, 0.1, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0,
                    0.5, 0.9, 1.2, 1.5, 1.3, 0.9, 0.4, -0.1,
                ],
                currentAlpha: -0.4,
                preAlpha: 0.3,
                verdict:
                    "The setup looked right going in — the stock was already diverging from Nifty 50 before you entered. But afterward, the stock and the index moved together (-0.4% apart) — the follow-through was mostly the market, not the stock.",
            },
            sector: {
                name: "Nifty Bank",
                benchmarkSeries: [
                    -0.4, -0.3, -0.2, -0.1, 0.0, 0.1, 0.1, 0.0, -0.1, -0.1, 0.0, 0.0, 0.0, 0.0, 0.0, 0,
                    0.3, 0.5, 0.6, 0.9, 1.1, 1.3, 1.4, 1.2,
                ],
                currentAlpha: -1.7,
                preAlpha: 0.5,
                verdict:
                    "This stock pulled away from Nifty Bank before you even entered, and kept widening the gap afterward through the middle of the window. This was genuine stock selection, not a sector rally carrying you along.",
            },
        },
        params: {
            trend: { score: 24, max: 30, comment: "Price reclaimed the active uptrend." },
            momentum: { score: 17, max: 20, comment: "Strong impulse supported continuation." },
            volume: { score: 13, max: 15, comment: "Participation expanded on the move." },
            sr: { score: 21, max: 25, comment: "Entry cleared support with room to run." },
            candle: { score: 9, max: 10, comment: "Bullish close showed clean acceptance." },
        },
    },
    {
        date: "2026-09-12T11:06:00",
        trade_type: "buy",
        price: "7,045",
        overall: 55,
        timeframe: "3_weeks",
        badge: { label: "Average Entry", color: "yellow" },
        verdict:
            "Average Entry — nothing screamed at entry either way. Volume was the weak link at just below average; wait for participation to pick up before committing full size.",
        runtimeOutcome: null,
        alignment: null,
        params: {
            trend: { score: 19, max: 30, comment: "Trend was mixed and still developing." },
            momentum: { score: 4, max: 20, comment: "Momentum had not fully turned upward." },
            volume: { score: 7, max: 15, comment: "Volume was average, not confirming yet." },
            sr: { score: 18, max: 25, comment: "Entry sat inside the range, not beyond it." },
            candle: { score: 7, max: 10, comment: "Pattern was promising but unfinished." },
        },
    },
    {
        date: "2026-09-12T13:31:00",
        trade_type: "sell",
        price: "7,195",
        overall: 76,
        timeframe: "3_weeks",
        badge: { label: "Resistance Exit", color: "green" },
        verdict:
            "Resistance Exit — entry was anchored right at resistance with volume confirming the move down. Textbook structural exit.",
        runtimeOutcome: {
            horizonDays: 15,
            checkpoints: [
                { day: 1, pct: -2.1, statusKey: "building", note: "Building" },
                { day: 3, pct: -3.8, statusKey: "peak", isPeak: true, peakPrice: 6924.0 },
                { day: 5, pct: -2.9, statusKey: "fading", note: "Fading" },
                { day: 10, pct: -1.0, statusKey: "fading", note: "Fading" },
                { day: 15, pct: 0.4, statusKey: "loss", note: "Reversed" },
            ],
            mae: -3.8,
            mfe: { value: 3.8, day: 3 },
            verdict: "Price fell another 3.8% by Day 3 after your exit before reversing to +0.4%.",
        },
        alignment: {
            isIndexFund: false,
            entryOffset: 15,
            stock: [
                0.6, 0.9, 1.4, 1.8, 2.0, 1.6, 1.1, 0.7, 0.3, 0.1, 0.0, 0.0, 0.0, 0.0, 0.0, 0,
                -1.8, -2.9, -2.2, -1.4, -0.9, -1.1, -1.6, 0.4,
            ],
            nifty: {
                name: "Nifty 50",
                benchmarkSeries: [
                    0.1, 0.2, 0.3, 0.3, 0.4, 0.3, 0.2, 0.2, 0.1, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0,
                    -0.4, -0.6, -0.5, -0.3, -0.2, -0.3, -0.4, 0.1,
                ],
                currentAlpha: 0.3,
                preAlpha: 0.9,
                verdict:
                    "The index was drifting up gently before your exit while the stock ran well ahead of it — a real, stock-specific overextension worth selling into. Afterward both fell together, so the timing was about the stock, not a market-wide reversal.",
            },
            sector: null,
        },
        params: {
            trend: { score: 22, max: 30, comment: "Downtrend remained intact through the exit." },
            momentum: { score: 14, max: 20, comment: "Selling impulse hadn't exhausted yet." },
            volume: { score: 12, max: 15, comment: "Volume confirmed the move down." },
            sr: { score: 21, max: 25, comment: "Entry was anchored right at resistance." },
            candle: { score: 7, max: 10, comment: "Textbook rejection wick at the level." },
        },
    },
];

/* ---------------------------------- Constants ---------------------------------- */

const PARAM_KEYS = ["trend", "momentum", "volume", "sr", "candle"];
const PARAM_LABELS = {
    trend: "Trend",
    momentum: "Momentum",
    volume: "Volume",
    sr: "S/R",
    candle: "Candle",
};

const BADGE_STYLES = {
    green: "bg-emerald-500/15 text-emerald-400",
    yellow: "bg-amber-500/15 text-amber-400",
    red: "bg-red-500/15 text-red-400",
};
const BADGE_ICON_MAP = {
    "Sniper Support Bounce": Target,
    "Support Confirmed Entry": ShieldCheck,
    "Momentum Entry": Zap,
    "Chased Entry": AlertTriangle,
    "Catching Falling Knife": TrendingDown,
    "No Man's Land Entry": HelpCircle,
    "Average Entry": Minus,
    "Peak Profit Lock": Trophy,
    "Resistance Exit": CheckCircle2,
    "Early Exit": Clock,
    "Panic Sell": AlertOctagon,
    "Average Exit": Minus,
};

const DEFAULT_TIMEFRAME = "3_weeks";
const TIMEFRAME_OPTIONS = [
    { key: "1_week", tab: "1W", short: "1-week", label: "1-week swing" },
    { key: "3_weeks", tab: "3W", short: "3-week", label: "3-week swing" },
    { key: "3_months", tab: "3M", short: "3-month", label: "3-month positional" },
    { key: "6_months", tab: "6M", short: "6-month", label: "6-month positional" },
    { key: "1_year", tab: "1Y", short: "1-year", label: "1-year investor" },
];
const getTimeframeShort = (key) =>
    (TIMEFRAME_OPTIONS.find((o) => o.key === key) || TIMEFRAME_OPTIONS[1]).short;

const BADGE_ICON_FALLBACK = { green: CheckCircle2, yellow: Minus, red: AlertTriangle };
const getBadgeIcon = (badge) => BADGE_ICON_MAP[badge?.label] || BADGE_ICON_FALLBACK[badge?.color] || Minus;

const WEAKNESS_PHRASE = {
    trend: "trend alignment",
    momentum: "confirmation",
    volume: "participation",
    sr: "structure",
    candle: "entry timing",
};

const RUNTIME_STATUS_STYLE = {
    drawdown: { text: "text-red-400", pill: "bg-red-500/15 text-red-400", dot: "bg-red-500" },
    loss: { text: "text-red-400", pill: "bg-red-500/15 text-red-400", dot: "bg-red-500" },
    building: { text: "text-emerald-400", pill: "bg-emerald-500/15 text-emerald-400", dot: "bg-emerald-500" },
    peak: { text: "text-emerald-400", pill: "bg-emerald-500/15 text-emerald-400", dot: "bg-emerald-500" },
    fading: { text: "text-amber-400", pill: "bg-amber-500/15 text-amber-400", dot: "bg-amber-500" },
};
const getRuntimeStyle = (statusKey) => RUNTIME_STATUS_STYLE[statusKey] || RUNTIME_STATUS_STYLE.fading;

// Sector chart colors — stock vs benchmark are two entities, not one value's
// direction, so they stay out of the red/green vocabulary used elsewhere.
const SECTOR_STOCK_COLOR = "#3b82f6";
const SECTOR_INDEX_COLOR = "#8b96a8";

/* ---------------------------------- Helpers ---------------------------------- */

const getScoreColor = (score) => {
    if (score >= 75) return "#00c896";
    if (score >= 50) return "#f5a623";
    return "#ff4444";
};

const barClass = (score, max) => {
    const pct = max ? score / max : 0;
    if (pct >= 0.75) return "bg-emerald-500";
    if (pct >= 0.5) return "bg-yellow-400";
    return "bg-red-500";
};

const formatDateTime = (value) => {
    if (!value) return "";
    const d = new Date(value);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });
};

const formatPct = (pct) => `${pct > 0 ? "+" : ""}${pct}%`;

const buildOverallRead = (score) => {
    if (score >= 80) {
        return {
            headline: "Sharp execution, strong discipline.",
            description:
                "Your entries and exits are lining up with structure and momentum together. Keep protecting this edge as size increases.",
        };
    }
    if (score >= 60) {
        return {
            headline: "Solid execution, a few rough edges.",
            description:
                "Most trades found the right levels. Tightening entry timing on the weaker ones will move this score up fast.",
        };
    }
    if (score >= 45) {
        return {
            headline: "Mixed execution, improving structure.",
            description:
                "Your entries found useful levels, but momentum confirmation was inconsistent. Wait for volume to join before sizing up.",
        };
    }
    return {
        headline: "Weak execution, needs a reset.",
        description:
            "Several entries were fighting the trend or arrived without structure behind them. Slow down and wait for alignment.",
    };
};

const buildBadgeSummary = (scores) => {
    const counts = {};
    scores.forEach((s) => {
        const label = s.badge?.label;
        if (!label) return;
        if (!counts[label]) counts[label] = { count: 0, color: s.badge.color };
        counts[label].count += 1;
    });
    const badgeList = Object.entries(counts)
        .sort((a, b) => b[1].count - a[1].count)
        .map(([label, { count, color }]) => ({ label, count, color }));

    const paramAverages = PARAM_KEYS.map((key) => {
        const vals = scores.map((s) => s.params?.[key]).filter(Boolean);
        const avgPct = vals.length ? vals.reduce((sum, p) => sum + p.score / p.max, 0) / vals.length : 1;
        return { key, avgPct };
    });
    const weakest = paramAverages.sort((a, b) => a.avgPct - b.avgPct)[0];
    const phrase = WEAKNESS_PHRASE[weakest?.key] || "confirmation";

    return { badgeList, summary: `Most trades were level-aware; ${phrase} is the edge to improve.` };
};

const buildAggregateParams = (scores) =>
    PARAM_KEYS.map((key) => {
        const vals = scores.map((s) => s.params?.[key]).filter(Boolean);
        const score = vals.length ? Math.round(vals.reduce((sum, p) => sum + p.score, 0) / vals.length) : 0;
        const max = vals[0]?.max ?? 0;
        return { key, label: PARAM_LABELS[key], score, max };
    });

/* ---------------------------------- Small pieces ---------------------------------- */

const OverallGauge = ({ score }) => {
    const radius = 42;
    const circumference = 2 * Math.PI * radius;
    const clamped = Math.max(0, Math.min(100, score));
    const progress = (clamped / 100) * circumference;
    const color = getScoreColor(score);

    return (
        <div className="relative w-[112px] h-[112px] shrink-0">
            <svg width="112" height="112" viewBox="0 0 112 112">
                <circle cx="56" cy="56" r={radius} fill="none" stroke="#1e3048" strokeWidth="8" />
                <circle
                    cx="56"
                    cy="56"
                    r={radius}
                    fill="none"
                    stroke={color}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${progress} ${circumference}`}
                    transform="rotate(-90 56 56)"
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold" style={{ color }}>
                    {score}
                </span>
                <span className="text-[#5a7a9a] text-[9px] uppercase tracking-wider font-semibold">out of 100</span>
            </div>
        </div>
    );
};

const BadgePill = ({ badge, size = "sm" }) => {
    if (!badge?.label) return null;
    const Icon = getBadgeIcon(badge);
    const sizing = size === "lg" ? "text-xs px-3 py-1.5 gap-1.5" : "text-[10px] px-2.5 py-1 gap-1";
    const iconSize = size === "lg" ? 14 : 12;
    return (
        <span
            className={`inline-flex items-center rounded-full font-semibold ${sizing} ${BADGE_STYLES[badge.color] || "bg-[#13233a] text-[#9db4cc]"
                }`}
        >
            <Icon size={iconSize} strokeWidth={2.5} />
            {badge.label}
        </span>
    );
};

const RuntimeOutcome = ({ runtime }) => {
    if (!runtime || !runtime.checkpoints?.length) {
        return (
            <div className="flex-1 flex items-center justify-center py-8">
                <p className="text-[#5a7a9a] text-xs text-center max-w-[220px]">
                    Not enough runtime yet — outcome data appears once this trade has enough days of price history
                    behind it.
                </p>
            </div>
        );
    }

    const { horizonDays, checkpoints, mae, mfe, verdict } = runtime;

    return (
        <div className="flex-1 flex flex-col">
            <div className="flex items-center gap-2 mb-4">
                <BarChart3 size={14} className="text-[#5a7a9a]" />
                <span className="text-white text-[11px] font-bold uppercase tracking-wide">Post-Entry Runtime</span>
                <span className="text-[#5a7a9a] text-[11px]">({horizonDays}-Day Horizon)</span>
            </div>

            <div className="relative max-h-[280px] overflow-y-auto pr-1 mb-4 scrollbar-thin scrollbar-thumb-[#1e3048] scrollbar-track-transparent">
                <div className="relative flex flex-col gap-4">
                    <div className="absolute top-2 bottom-2 left-[86px] w-px bg-[#1e3048]" />
                    {checkpoints.map((cp, i) => {
                        const style = getRuntimeStyle(cp.statusKey);
                        return (
                            <div key={i} className="flex items-start gap-3">
                                <span
                                    className={`shrink-0 w-[76px] text-center text-[9px] font-bold uppercase leading-tight px-2 py-1.5 rounded-full whitespace-nowrap ${style.pill}`}
                                >
                                    {cp.isPeak ? `Day ${cp.day} (Peak)` : `Day ${cp.day}`}
                                </span>
                                <span className={`relative z-10 mt-[7px] w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
                                <div className="min-w-0 -mt-0.5">
                                    <p className={`text-sm font-bold ${style.text}`}>{formatPct(cp.pct)}</p>
                                    <p className="text-[#5a7a9a] text-[10px]">
                                        {cp.isPeak && cp.peakPrice != null ? `(₹${cp.peakPrice.toFixed(2)})` : cp.note ? `(${cp.note})` : ""}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="border-t border-[#1e3048] pt-3 mb-4 flex items-center gap-6">
                <div>
                    <p className="text-[#5a7a9a] text-[10px] mb-0.5">Max Drawdown (MAE)</p>
                    <p className="text-red-400 text-base font-bold">{formatPct(mae)}</p>
                </div>
                <div className="w-px h-8 bg-[#1e3048]" />
                <div>
                    <p className="text-[#5a7a9a] text-[10px] mb-0.5">Peak Potential (MFE)</p>
                    <p className="text-emerald-400 text-base font-bold">
                        {formatPct(mfe.value)} <span className="text-[#5a7a9a] text-[11px] font-normal">on Day {mfe.day}</span>
                    </p>
                </div>
            </div>

            {verdict && (
                <div className="rounded-lg border border-[#1e3048] bg-[#0a141f] px-3.5 py-3">
                    <p className="text-[#5a7a9a] text-[10px] uppercase tracking-widest font-semibold mb-1.5">Verdict</p>
                    <p className="text-[#c3d3e4] text-xs leading-relaxed">{verdict}</p>
                </div>
            )}
        </div>
    );
};

const SectorAlignment = ({ alignment, active }) => {
    const svgRef = useRef(null);
    const containerRef = useRef(null);
    const [benchmarkTab, setBenchmarkTab] = useState(null); // "nifty" | "sector"

    const isLoading = alignment === undefined;
    const isIndexFund = alignment?.isIndexFund === true;
    const hasData = alignment != null && !isIndexFund;

    const hasNifty = hasData && alignment.nifty != null;
    const hasSector = hasData && alignment.sector != null;

    useEffect(() => {
        if (!hasData) {
            setBenchmarkTab(null);
            return;
        }
        if (hasNifty) setBenchmarkTab("nifty");
        else if (hasSector) setBenchmarkTab("sector");
        else setBenchmarkTab(null);
    }, [hasData, hasNifty, hasSector]);

    const benchmark = hasData
        ? benchmarkTab === "sector"
            ? alignment.sector
            : alignment.nifty
        : null;

    useEffect(() => {
        if (!active || !hasData || !benchmark || !svgRef.current || !containerRef.current) return;

        const { stock, entryOffset } = alignment;
        const benchmarkSeries = benchmark.benchmarkSeries;
        const lastIdx = stock.length - 1;
        const stockEnd = stock[lastIdx];
        const benchmarkEnd = benchmarkSeries[lastIdx];
        const stockAbove = stockEnd >= benchmarkEnd;

        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();

        const render = () => {
            const width = containerRef.current?.clientWidth || 0;
            const height = containerRef.current?.clientHeight || 170;

            if (!width || !height) return;

            const margin = { top: 22, right: 110, bottom: 8, left: 4 };
            const innerWidth = Math.max(1, width - margin.left - margin.right);
            const innerHeight = Math.max(1, height - margin.top - margin.bottom);

            svg
                .attr("width", width)
                .attr("height", height)
                .attr("viewBox", `0 0 ${width} ${height}`)
                .attr("preserveAspectRatio", "none");

            const allValues = [...stock, ...benchmarkSeries, 0];
            const minValue = d3.min(allValues) ?? 0;
            const maxValue = d3.max(allValues) ?? 0;
            const valueSpan = maxValue - minValue || 1;
            const padding = valueSpan * 0.12;

            const x = d3
                .scaleLinear()
                .domain([0, lastIdx])
                .range([margin.left, margin.left + innerWidth]);

            const y = d3
                .scaleLinear()
                .domain([minValue - padding, maxValue + padding])
                .range([margin.top + innerHeight, margin.top]);

            const line = d3
                .line()
                .x((_, i) => x(i))
                .y((d) => y(d))
                .curve(d3.curveMonotoneX);

            const chart = svg.append("g");

            chart
                .append("path")
                .datum(stock)
                .attr("fill", "none")
                .attr("stroke", SECTOR_STOCK_COLOR)
                .attr("stroke-width", 3)
                .attr("stroke-linecap", "round")
                .attr("stroke-linejoin", "round")
                .attr("d", line);

            chart
                .append("path")
                .datum(benchmarkSeries)
                .attr("fill", "none")
                .attr("stroke", SECTOR_INDEX_COLOR)
                .attr("stroke-width", 2)
                .attr("stroke-dasharray", "5 4")
                .attr("stroke-linecap", "round")
                .attr("stroke-linejoin", "round")
                .attr("d", line);

            const ex = x(entryOffset);
            const ey = y(0);

            chart
                .append("line")
                .attr("x1", ex)
                .attr("x2", ex)
                .attr("y1", margin.top)
                .attr("y2", margin.top + innerHeight)
                .attr("stroke", "#c3d3e4")
                .attr("stroke-width", 1)
                .attr("stroke-dasharray", "3 4");

            chart
                .append("circle")
                .attr("cx", ex)
                .attr("cy", ey)
                .attr("r", 4)
                .attr("fill", "#c3d3e4");

            chart
                .append("text")
                .attr("x", ex)
                .attr("y", margin.top - 8)
                .attr("text-anchor", "middle")
                .attr("font-family", "sans-serif")
                .attr("font-size", 10)
                .attr("font-weight", 700)
                .attr("fill", "#c3d3e4")
                .text("ENTRY");

            const sx = x(lastIdx);
            const syStock = y(stockEnd);
            const syBenchmark = y(benchmarkEnd);

            chart
                .append("text")
                .attr("x", sx + 8)
                .attr("y", syStock + (stockAbove ? -10 : 10))
                .attr("dominant-baseline", "middle")
                .attr("text-anchor", "start")
                .attr("font-family", "sans-serif")
                .attr("font-size", 11)
                .attr("font-weight", 500)
                .attr("fill", SECTOR_STOCK_COLOR)
                .text(`Stock  ${formatPct(Math.round(stockEnd * 10) / 10)}`);

            chart
                .append("text")
                .attr("x", sx + 8)
                .attr("y", syBenchmark + (stockAbove ? 10 : -10))
                .attr("dominant-baseline", "middle")
                .attr("text-anchor", "start")
                .attr("font-family", "sans-serif")
                .attr("font-size", 11)
                .attr("font-weight", 500)
                .attr("fill", SECTOR_INDEX_COLOR)
                .text(`${benchmark.name}  ${formatPct(Math.round(benchmarkEnd * 10) / 10)}`);
        };

        render();

        const resizeObserver = new ResizeObserver(render);
        resizeObserver.observe(containerRef.current);

        return () => {
            resizeObserver.disconnect();
            svg.selectAll("*").remove();
        };
    }, [active, alignment, hasData, benchmark]);

    if (isLoading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center py-8 gap-3">
                <div className="w-5 h-5 border-2 border-[#3b82f6] border-t-transparent rounded-full animate-spin" />
                <p className="text-[#5a7a9a] text-xs text-center max-w-[220px]">
                    Comparing against Nifty 50 and your sector…
                </p>
            </div>
        );
    }

    if (isIndexFund) {
        return (
            <div className="flex-1 flex items-center justify-center py-8">
                <p className="text-[#5a7a9a] text-xs text-center max-w-[240px]">{alignment.message}</p>
            </div>
        );
    }

    if (!hasData || !benchmark) {
        return (
            <div className="flex-1 flex items-center justify-center py-8">
                <p className="text-[#5a7a9a] text-xs text-center max-w-[220px]">
                    Not enough history yet — sector alignment appears once there's price data on both sides of the
                    entry point.
                </p>
            </div>
        );
    }

    // Alpha is deliberately not sign-flipped for sells: it answers "was the
    // move about the stock or the benchmark", not "was it good for you".
    const stockLeads = benchmark.currentAlpha >= 0;

    return (
        <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 min-w-0">
                    <GitCompareArrows size={14} className="text-[#5a7a9a] shrink-0" />
                    <span className="text-white text-[11px] font-bold uppercase tracking-wide">Sector Alignment</span>
                </div>
                {hasSector && (
                    <div className="flex bg-[#0a141f] border border-[#1e3048] rounded-full p-0.5 shrink-0">
                        <button
                            onClick={() => hasNifty && setBenchmarkTab("nifty")}
                            disabled={!hasNifty}
                            className={`px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wide transition-colors ${benchmarkTab === "nifty"
                                ? "bg-[#1e3048] text-white"
                                : "text-[#5a7a9a] hover:text-white disabled:opacity-40 disabled:hover:text-[#5a7a9a]"
                                }`}
                        >
                            Nifty
                        </button>
                        <button
                            onClick={() => setBenchmarkTab("sector")}
                            className={`px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wide transition-colors ${benchmarkTab === "sector" ? "bg-[#1e3048] text-white" : "text-[#5a7a9a] hover:text-white"
                                }`}
                        >
                            Sector
                        </button>
                    </div>
                )}
            </div>
            <p className="text-lg font-bold mb-3 text-[#c3d3e4]">
                Stock {stockLeads ? "ahead of" : "behind"} {benchmark.name} by {Math.abs(Math.round(benchmark.currentAlpha * 10) / 10)}%
            </p>

            <div ref={containerRef} className="relative w-full h-[170px] mb-4">
                <svg
                    ref={svgRef}
                    role="img"
                    aria-label={`Chart comparing this stock to ${benchmark.name} before and after entry, both rebased to zero at the entry point`}
                    className="block w-full h-full"
                />
            </div>

            {benchmark.verdict && (
                <div className="rounded-lg border border-[#1e3048] bg-[#0a141f] px-3.5 py-3">
                    <p className="text-[#5a7a9a] text-[10px] uppercase tracking-widest font-semibold mb-1.5">Verdict</p>
                    <p className="text-[#c3d3e4] text-xs leading-relaxed">{benchmark.verdict}</p>
                </div>
            )}
        </div>
    );
};

const TradeCard = ({ score, trade, activeTab, onTabChange, sectorAlignment }) => {
    const isBuy = score.trade_type === "buy";
    const badge = score.badge;
    const params = PARAM_KEYS.map((key) => ({ key, label: PARAM_LABELS[key], ...(score.params?.[key] ?? {}) }));
    const dateLabel = formatDateTime(score.date || trade?.Date);

    return (
        <div className="shrink-0 w-1/3 bg-[#0d1b2a] border border-[#1e3048] rounded-2xl p-5 hover:border-[#2a4a6a] transition-colors flex flex-col">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                    <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-md ${isBuy ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
                            }`}
                    >
                        {score.trade_type?.toUpperCase()}
                    </span>
                    <span className="text-white text-lg font-bold">₹{score.price}</span>
                </div>
                <span className="text-[#5a7a9a] text-xs">{trade?.qty ? `${trade.qty} qty` : ""}</span>
            </div>

            <div className="flex items-center justify-between mb-3">
                <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold" style={{ color: getScoreColor(score.overall) }}>
                        {score.overall}
                    </span>
                    <span className="text-[#5a7a9a] text-sm">/100</span>
                </div>
                {dateLabel && <span className="text-[#5a7a9a] text-[11px]">{dateLabel}</span>}
            </div>

            <div className="flex flex-wrap gap-1.5 mb-3 min-h-[26px]">
                {(score.badges?.length ? score.badges : [badge]).map((b, i) => (
                    <BadgePill key={i} badge={b} size="lg" />
                ))}
            </div>

            <div className="flex bg-[#0a141f] border border-[#1e3048] rounded-lg p-1 mb-4">
                <button
                    onClick={() => onTabChange("scores")}
                    className={`flex-1 text-[10px] font-bold uppercase tracking-wide py-1.5 rounded-md transition-colors ${activeTab === "scores" ? "bg-[#1e3048] text-white" : "text-[#5a7a9a] hover:text-white"
                        }`}
                >
                    Scores
                </button>
                <button
                    onClick={() => onTabChange("runtime")}
                    className={`flex-1 text-[10px] font-bold uppercase tracking-wide py-1.5 rounded-md leading-tight transition-colors ${activeTab === "runtime" ? "bg-[#1e3048] text-white" : "text-[#5a7a9a] hover:text-white"
                        }`}
                >
                    Runtime
                </button>
                <button
                    onClick={() => onTabChange("sector")}
                    className={`flex-1 text-[10px] font-bold uppercase tracking-wide py-1.5 rounded-md leading-tight transition-colors ${activeTab === "sector" ? "bg-[#1e3048] text-white" : "text-[#5a7a9a] hover:text-white"
                        }`}
                >
                    Sector
                </button>
            </div>

            {activeTab === "scores" && (
                <div className="flex flex-col gap-2.5">
                    {params.map((p) => (
                        <div key={p.key} className="flex items-start gap-5">
                            <span className="text-[#5a7a9a] text-[11px] w-12 shrink-0 pt-0.5">{p.label}</span>
                            <div className="flex-1 min-w-0">
                                <div className="bg-[#0f1923] rounded-full h-1 overflow-hidden mb-1">
                                    <div
                                        className={`h-1 rounded-full ${barClass(p.score ?? 0, p.max ?? 1)}`}
                                        style={{ width: `${((p.score ?? 0) / (p.max ?? 1)) * 100}%` }}
                                    />
                                </div>
                                <p className="text-[#5a7a9a] text-[10px] leading-snug">{p.comment}</p>
                            </div>
                            <span className="text-white text-xs font-semibold w-6 text-right shrink-0">{p.score ?? 0}</span>
                        </div>
                    ))}
                </div>
            )}

            {activeTab === "runtime" && <RuntimeOutcome runtime={score.runtimeOutcome} />}

            {activeTab === "sector" && (
                <SectorAlignment alignment={sectorAlignment} active={activeTab === "sector"} />
            )}

            {activeTab === "scores" && score.verdict && (
                <div className="mt-4 rounded-lg border border-[#1e3048] bg-[#0a141f] px-3.5 py-3">
                    <p className="text-[#5a7a9a] text-[10px] uppercase tracking-widest font-semibold mb-1.5">Verdict</p>
                    <p className="text-[#c3d3e4] text-xs leading-relaxed">{score.verdict}</p>
                </div>
            )}
        </div>
    );
};

const TimeframeStrip = ({ timeframe, onChange, disabled }) => (
    <div className="px-6 py-3 border-b border-[#1e3048] flex items-center gap-4 flex-wrap">
        <span className="text-white text-sm font-semibold">
            Graded on a {getTimeframeShort(timeframe)} outlook
        </span>
        <div
            className={`ml-auto flex bg-[#0d1b2a] border border-[#1e3048] rounded-lg p-0.5 gap-0.5 ${disabled ? "opacity-60 cursor-wait" : ""
                }`}
        >
            {TIMEFRAME_OPTIONS.map((o) => (
                <button
                    key={o.key}
                    type="button"
                    title={o.label}
                    disabled={disabled}
                    onClick={() => o.key !== timeframe && onChange(o.key)}
                    className={`px-3 py-1.5 rounded-md text-[11px] font-bold tracking-wide transition-colors disabled:cursor-wait ${timeframe === o.key ? "bg-[#1e3048] text-white" : "text-[#5a7a9a] hover:text-white"
                        }`}
                >
                    {o.tab}
                </button>
            ))}
        </div>
    </div>
);

/* ---------------------------------- Main component ---------------------------------- */

const ScorePanel = ({ isDemo = false, trades = [], priceData = [] }) => {
    const [scores, setScores] = useState([]);
    const [sectorAlignments, setSectorAlignments] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [timeframe, setTimeframe] = useState(DEFAULT_TIMEFRAME);
    const [reloadKey, setReloadKey] = useState(0);

    const [cardTab, setCardTab] = useState({}); // idx -> "scores" | "runtime" | "sector"

    // Content-derived keys so parent re-renders with identical data don't
    // cancel in-flight requests.
    const tradesKey = trades.map((t) => `${t.Date}:${t.transactionType}:${t.price}`).join("|");
    const priceDataKey = priceData.length ? `${priceData.length}:${priceData[0]?.Date}:${priceData[priceData.length - 1]?.Date}` : "";

    // ── Fetch 1: trade-score. Re-runs on timeframe change. ──
    useEffect(() => {
        if (isDemo) {
            setScores(DEMO_SCORES);
            return;
        }
        if (!trades.length || !priceData.length) return;

        let cancelled = false;

        const fetchScores = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await axios.post(
                    `${ENV.BASE_API_URL}/api/trade-score/`,
                    {
                        timeframe,
                        candles: priceData,
                        trades: trades.map((t) => ({
                            date: t.Date,
                            trade_type: t.transactionType,
                            trade_qty: t.qty,
                            trade_id: t.trade_id,
                            price: t.price,
                        })),
                    },
                    { headers: { Authorization: `Bearer ${localStorage.getItem("jwtToken")}` } }
                );
                if (cancelled) return;
                const raw = res.data?.scores ?? [];
                setScores(
                    raw.map((s) => ({
                        ...s,
                        badge: s.badge ?? null,
                        badges: s.badges ?? (s.badge ? [s.badge] : []),
                        verdict: s.verdict ?? s.coaching_tip ?? s.params?.candle?.comment ?? "",
                        runtimeOutcome: s.runtimeOutcome ?? s.runtime_outcome ?? null,
                    }))
                );
            } catch (err) {
                if (cancelled) return;
                console.error("Score fetch error:", err);
                setScores([]);
                setError("Could not load scores");
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchScores();
        return () => {
            cancelled = true;
        };
    }, [isDemo, tradesKey, priceDataKey, timeframe, reloadKey]);

    // ── Fetch 2: sector-alignment (slower), independent of the main loader. ──
    useEffect(() => {
        if (isDemo) {
            setSectorAlignments({});
            return;
        }

        if (!trades.length || !priceData.length) {
            setSectorAlignments({});
            return;
        }

        let cancelled = false;
        setSectorAlignments({});

        const normalizeDateKey = (value) => {
            if (!value) return null;
            return String(value).replace(" ", "T").slice(0, 19);
        };

        const fetchSectorAlignment = async () => {
            try {
                const res = await axios.post(
                    `${ENV.BASE_API_URL}/api/sector-alignment/`,
                    {
                        candles: priceData,
                        symbol: trades[0]?.symbol,
                        trades: trades.map((t) => ({
                            date: t.Date,
                            trade_id: t.trade_id,
                            trade_type: t.transactionType,
                            price: t.price,
                        })),
                    },
                    { headers: { Authorization: `Bearer ${localStorage.getItem("jwtToken")}` } }
                );

                if (cancelled) return;

                const alignments = res.data?.alignments ?? [];
                const byDate = {};

                alignments.forEach((a) => {
                    const key = normalizeDateKey(a.date);
                    if (key) byDate[key] = a.alignment ?? null;
                });

                const next = {};
                trades.forEach((t, i) => {
                    const key = normalizeDateKey(t.Date);
                    next[i] =
                        key && Object.prototype.hasOwnProperty.call(byDate, key) ? byDate[key] : null;
                });

                setSectorAlignments(next);
            } catch (err) {
                console.error("Sector alignment fetch error:", err);
                if (cancelled) return;
                const failed = {};
                trades.forEach((_, i) => {
                    failed[i] = null;
                });
                setSectorAlignments(failed);
            }
        };

        fetchSectorAlignment();

        return () => {
            cancelled = true;
        };
    }, [isDemo, tradesKey, priceDataKey]);

    const safeScores = scores ?? [];

    const overallScore = safeScores.length
        ? Math.round(safeScores.reduce((sum, s) => sum + s.overall, 0) / safeScores.length)
        : 0;

    const overallRead = buildOverallRead(overallScore);
    const badgeSummary = buildBadgeSummary(safeScores);
    const aggregateParams = buildAggregateParams(safeScores);

    if (!safeScores.length && !loading && !error) return null;

    return (
        <div
            className="w-full bg-[#080f17] border-t border-[#1e3048] rounded-b-xl overflow-hidden"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
            <style>{FONT_IMPORT}</style>

            <TimeframeStrip timeframe={timeframe} onChange={setTimeframe} disabled={loading} />

            {error && (
                <div className="px-6 py-4 flex items-center gap-4">
                    <p className="text-red-400 text-sm">{error}</p>
                    <button
                        type="button"
                        onClick={() => setReloadKey((k) => k + 1)}
                        className="text-[#3b82f6] text-xs font-bold uppercase tracking-wide hover:text-white"
                    >
                        Retry
                    </button>
                </div>
            )}

            {!safeScores.length && loading && (
                <div className="px-6 py-10 flex items-center justify-center gap-3">
                    <div className="w-4 h-4 border-2 border-[#3b82f6] border-t-transparent rounded-full animate-spin" />
                    <p className="text-[#5a7a9a] text-sm">
                        Analyzing trades on a {getTimeframeShort(timeframe)} outlook...
                    </p>
                </div>
            )}

            {safeScores.length > 0 && (
                <div className="relative">
                    <div className={`transition-opacity ${loading ? "opacity-30 pointer-events-none" : ""}`}>
                        {/* ── Row 1: Overall Read + Trade Intelligence (Badges and Scores) ── */}
                        <div className="px-6 py-6 border-b border-[#1e3048] flex flex-col lg:flex-row gap-6 lg:gap-8">
                            <div className="flex items-start gap-4 lg:w-[340px] shrink-0">
                                <OverallGauge score={overallScore} />
                                <div className="min-w-0">
                                    <p className="text-[#5a7a9a] text-[11px] uppercase tracking-widest font-semibold mb-1">Overall Read</p>
                                    <p className="text-white text-base font-bold leading-snug">{overallRead.headline}</p>
                                    <p className="text-[#7c93ac] text-xs leading-relaxed mt-2">{overallRead.description}</p>
                                </div>
                            </div>

                            <div className="hidden lg:block w-px self-stretch bg-[#1e3048]" />

                            <div className="flex-1 min-w-0">
                                <div className="mb-4">
                                    <p className="text-[#5a7a9a] text-[11px] uppercase tracking-widest font-semibold mb-1">
                                        Trade Intelligence
                                    </p>
                                    <p className="text-white text-sm font-bold">Setups and scores across your trades</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Section 1: Badges */}
                                    <div className="min-w-0">
                                        <p className="text-[#5a7a9a] text-[10px] uppercase tracking-widest font-semibold mb-2.5">
                                            Badges
                                        </p>
                                        <div className="flex flex-wrap gap-2 mb-2.5">
                                            {badgeSummary.badgeList.map(({ label, count, color }) => (
                                                <BadgePill
                                                    key={label}
                                                    badge={{ label: count > 1 ? `${label} × ${count}` : label, color }}
                                                    size="lg"
                                                />
                                            ))}
                                        </div>
                                        <p className="text-[#7c93ac] text-xs">{badgeSummary.summary}</p>
                                    </div>

                                    {/* Section 2: Scores */}
                                    <div className="min-w-0">
                                        <p className="text-[#5a7a9a] text-[10px] uppercase tracking-widest font-semibold mb-2.5">
                                            Scores
                                        </p>
                                        <div className="flex flex-col gap-2">
                                            {aggregateParams.map((p) => (
                                                <div key={p.key} className="flex items-center gap-3">
                                                    <span className="text-[#5a7a9a] text-xs w-16 shrink-0">{p.label}</span>
                                                    <div className="flex-1 bg-[#0f1923] rounded-full h-1.5 overflow-hidden">
                                                        <div
                                                            className={`h-1.5 rounded-full ${barClass(p.score, p.max)}`}
                                                            style={{ width: `${p.max ? (p.score / p.max) * 100 : 0}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-white text-xs font-semibold w-10 text-right shrink-0">
                                                        {p.score}/{p.max}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── Row 2: Individual Trades ── */}
                        <div className="px-6 py-5">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <p className="text-[#5a7a9a] text-[11px] uppercase tracking-widest font-semibold mb-1">
                                        Individual Trades
                                    </p>
                                    <p className="text-white text-sm font-bold">Your decisions, in context</p>
                                </div>
                                <span className="text-[#5a7a9a] text-xs">{safeScores.length} entries</span>
                            </div>

                            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-[#1e3048] scrollbar-track-transparent">
                                {safeScores.map((s, i) => (
                                    <TradeCard
                                        key={i}
                                        score={s}
                                        trade={trades[i]}
                                        sectorAlignment={isDemo ? s.alignment : sectorAlignments[i]}
                                        activeTab={cardTab[i] ?? "scores"}
                                        onTabChange={(tab) => setCardTab((prev) => ({ ...prev, [i]: tab }))}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>

                    {loading && (
                        <div className="absolute inset-0 z-20 flex items-start justify-center pt-24">
                            <div className="flex items-center gap-3 bg-[#0d1b2a] border border-[#1e3048] rounded-xl px-5 py-3">
                                <div className="w-4 h-4 border-2 border-[#3b82f6] border-t-transparent rounded-full animate-spin" />
                                <p className="text-[#c3d3e4] text-sm">
                                    Re-scoring on a {getTimeframeShort(timeframe)} outlook...
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ScorePanel;