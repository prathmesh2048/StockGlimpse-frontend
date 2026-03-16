import React, { useState, useEffect } from "react";
import axios from "axios";
import ENV from "../config";

const DEMO_SCORES = [
    {
        overall: 57,
        trade_type: "buy",
        price: "258.9",
        params: {
            trend: { score: 21, max: 30 },
            momentum: { score: 13, max: 20, detail: { rsi: 58.3 } },
            volume: { score: 13, max: 15 },
            sr: { score: 4, max: 25 },
            candle: { score: 7, max: 10, detail: { description: "Bullish engulfing — strong momentum at entry" } },
        }
    },
    {
        overall: 44,
        trade_type: "sell",
        price: "271.2",
        params: {
            trend: { score: 18, max: 30 },
            momentum: { score: 9, max: 20, detail: { rsi: 62.1 } },
            volume: { score: 8, max: 15 },
            sr: { score: 4, max: 25 },
            candle: { score: 5, max: 10, detail: { description: "Normal bearish candle — no strong signal" } },
        }
    }
];

const ScorePanel = ({ isDemo = false, isPaid = false, trades = [], priceData = [] }) => {

    const [scores, setScores] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    console.log("ScorePanel props:", { isPaid, trades, priceData });
    useEffect(() => {

        if (isDemo) {
            setScores(DEMO_SCORES);
            return;
        }

        if (!isPaid || !trades.length || !priceData.length) return;

        const fetchScores = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await axios.post(
                    `${ENV.BASE_API_URL}/api/trade-score/`,
                    {
                        candles: priceData,
                        trades: trades.map((t) => ({
                            date: t.Date,
                            trade_type: t.transactionType,
                            price: t.price,
                        })),
                    },
                    {
                        headers: {
                            Authorization: `Bearer ${localStorage.getItem("jwtToken")}`,
                        },
                    }
                );
                setScores(res.data.scores);
            } catch (err) {
                console.error("Score fetch error:", err);
                setError("Could not load scores");
            } finally {
                setLoading(false);
            }
        };

        fetchScores();
    }, [isPaid, trades, priceData]);

    const getScoreColor = (score) => {
        if (score >= 75) return "#00c896";
        if (score >= 50) return "#f5a623";
        return "#ff4444";
    };

    const getBarBg = (score, max) => {
        const pct = score / max;
        if (pct >= 0.75) return "bg-emerald-500";
        if (pct >= 0.5) return "bg-yellow-400";
        return "bg-red-500";
    };

    // Overall score = average across all trades
    const overallScore = scores.length
        ? Math.round(scores.reduce((sum, s) => sum + s.overall, 0) / scores.length)
        : 0;

    // Avg per parameter across all trades
    const paramKeys = ["trend", "momentum", "volume", "sr", "candle"];
    const paramLabels = {
        trend: "Trend",
        momentum: "Momentum",
        volume: "Volume",
        sr: "S/R Placement",
        candle: "Candle Pattern",
    };

    const aggregateParams = paramKeys.map((key) => {
        const avg = scores.length
            ? Math.round(scores.reduce((sum, s) => sum + (s.params?.[key]?.score ?? 0), 0) / scores.length)
            : 0;
        const max = scores[0]?.params?.[key]?.max ?? 0;
        return { key, label: paramLabels[key], score: avg, max };
    });

    // Gauge arc
    const circumference = Math.PI * 37;
    const progress = (overallScore / 100) * circumference;

    // ── Locked state ─────────────────────────────────────────────────
    if (!isPaid) {
        return (
            <div className="w-full relative rounded-b-xl overflow-hidden">

                {/* Blurred REALISTIC preview — looks like their actual data */}
                <div className="w-full bg-[#080f17] border-t border-[#1e3048] px-6 py-4 select-none pointer-events-none">
                    {/* Fake gauge row — realistic looking */}
                    <div className="flex items-center gap-6 border-b border-[#1e3048] pb-4 mb-4 blur-[3px] opacity-80">
                        <div className="flex items-center gap-4 shrink-0">
                            {/* Realistic gauge with a number */}
                            <div className="relative">
                                <svg width="90" height="52" viewBox="0 0 90 52">
                                    <path d="M 8 48 A 37 37 0 0 1 82 48" fill="none" stroke="#1e3048" strokeWidth="7" strokeLinecap="round" />
                                    <path d="M 8 48 A 37 37 0 0 1 82 48" fill="none" stroke="#f5a623" strokeWidth="7" strokeLinecap="round"
                                        strokeDasharray={`${(72 / 100) * (Math.PI * 37)} ${Math.PI * 37}`} />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-end pb-0.5">
                                    <span className="text-xl font-bold leading-none text-[#f5a623]">72</span>
                                </div>
                            </div>
                            <div>
                                <p className="text-white text-sm font-semibold leading-tight">Overall</p>
                                <p className="text-white text-sm font-semibold leading-tight">Score</p>
                                <p className="text-[#5a7a9a] text-xs mt-0.5">across all trades</p>
                            </div>
                        </div>
                        <div className="w-px h-12 bg-[#1e3048]" />
                        <div className="flex-1 grid grid-cols-5 gap-x-6 gap-y-1.5">
                            {[
                                { label: "Trend", score: 22, max: 30, color: "bg-emerald-500" },
                                { label: "Momentum", score: 8, max: 20, color: "bg-red-500" },
                                { label: "Volume", score: 11, max: 15, color: "bg-yellow-400" },
                                { label: "S/R Placement", score: 21, max: 25, color: "bg-emerald-500" },
                                { label: "Candle Pattern", score: 10, max: 10, color: "bg-emerald-500" },
                            ].map((p) => (
                                <div key={p.label}>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[#5a7a9a] text-xs">{p.label}</span>
                                        <span className="text-white text-xs font-semibold">{p.score}/{p.max}</span>
                                    </div>
                                    <div className="w-full bg-[#0f1923] rounded-full h-1.5 overflow-hidden">
                                        <div className={`h-1.5 rounded-full ${p.color}`} style={{ width: `${(p.score / p.max) * 100}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Fake trade cards — realistic */}
                    <div className="blur-[3px] opacity-80">
                        <p className="text-[#5a7a9a] text-xs uppercase tracking-widest font-semibold mb-3">Individual Trades</p>
                        <div className="flex gap-3">
                            {[
                                { type: "SELL", price: "7085", score: 63, color: "text-[#f5a623]", badge: "bg-red-500/15 text-red-400", bars: [24, 0, 5, 25, 9] },
                                { type: "BUY", price: "6820", score: 81, color: "text-emerald-400", badge: "bg-emerald-500/15 text-emerald-400", bars: [28, 14, 12, 20, 7] },
                                { type: "BUY", price: "7210", score: 55, color: "text-red-400", badge: "bg-emerald-500/15 text-emerald-400", bars: [18, 6, 8, 15, 8] },
                            ].map((t, i) => (
                                <div key={i} className="shrink-0 w-52 bg-[#0d1b2a] border border-[#1e3048] rounded-xl p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${t.badge}`}>{t.type}</span>
                                            <span className="text-white text-xs font-semibold">₹{t.price}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className={`text-2xl font-bold ${t.color}`}>{t.score}</span>
                                        <span className="text-[#5a7a9a] text-xs">/100</span>
                                    </div>
                                    <div className="h-px bg-[#1e3048] mb-3" />
                                    {["Trend", "Mom.", "Vol.", "S/R", "Candle"].map((l, j) => (
                                        <div key={l} className="flex items-center gap-2 mb-1.5">
                                            <span className="text-[#5a7a9a] text-xs w-12 shrink-0">{l}</span>
                                            <div className="flex-1 bg-[#0f1923] rounded-full h-1 overflow-hidden">
                                                <div className="h-1 rounded-full bg-emerald-500" style={{ width: `${(t.bars[j] / [30, 20, 15, 25, 10][j]) * 100}%` }} />
                                            </div>
                                            <span className="text-white text-xs font-semibold w-6 text-right">{t.bars[j]}</span>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Frosted overlay */}
                <div className="absolute inset-0 bg-[#060d14]/75 backdrop-blur-[2px]" />

                {/* ── Lock UI ── */}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">

                    {/* Pulsing lock */}
                    <div className="relative flex items-center justify-center w-14 h-14 mb-1">
                        <div className="absolute inset-0 rounded-full bg-[#3b82f6]/15 animate-pulse" />
                        <div className="absolute inset-[-5px] rounded-full border border-[#3b82f6]/20 animate-ping" style={{ animationDuration: "2.5s" }} />
                        <div className="w-14 h-14 rounded-full bg-[#0d1b2a] border border-[#2a4a6a] flex items-center justify-center shadow-[0_0_30px_rgba(59,130,246,0.2)]">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" />
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                        </div>
                    </div>

                    {/* Copy */}
                    <div className="text-center">
                        <p className="text-white text-md font-semibold tracking-wide">Stop entering at the wrong time</p>
                    </div>

                    {/* CTA */}
                    <button onClick={() => window.location.assign("/pricing")}
                        className="group relative flex items-center gap-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white text-xs font-bold px-6 py-2.5 rounded-lg transition-all duration-200 shadow-[0_0_20px_rgba(59,130,246,0.4)] hover:shadow-[0_0_32px_rgba(59,130,246,0.65)] mt-1">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                            className="transition-transform group-hover:-translate-y-0.5 duration-200">
                            <rect x="3" y="11" width="18" height="11" rx="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        Unlock for ₹49/mo
                    </button>
                </div>
            </div>
        );
    }
    // ── Loading state ─────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="w-full bg-[#080f17] border-t border-[#1e3048] px-6 py-6 flex items-center justify-center rounded-b-xl">
                <div className="flex items-center gap-3">
                    <div className="w-4 h-4 border-2 border-[#3b82f6] border-t-transparent rounded-full animate-spin" />
                    <p className="text-[#5a7a9a] text-sm">Analyzing trades...</p>
                </div>
            </div>
        );
    }

    // ── Error state ───────────────────────────────────────────────────
    if (error) {
        return (
            <div className="w-full bg-[#080f17] border-t border-[#1e3048] px-6 py-4 rounded-b-xl">
                <p className="text-red-400 text-sm">{error}</p>
            </div>
        );
    }

    // ── No scores yet ─────────────────────────────────────────────────
    if (!scores.length) return null;

    return (
        <div className="w-full bg-[#080f17] border-t border-[#1e3048] rounded-b-xl overflow-hidden">

            {/* ── Row 1: Overall Score ──────────────────────────────────── */}
            <div className="flex items-center gap-6 px-6 py-4 border-b border-[#1e3048]">

                {/* Gauge */}
                <div className="flex items-center gap-4 shrink-0">
                    <div className="relative">
                        <svg width="90" height="52" viewBox="0 0 90 52">
                            <path
                                d="M 8 48 A 37 37 0 0 1 82 48"
                                fill="none" stroke="#1e3048" strokeWidth="7" strokeLinecap="round"
                            />
                            <path
                                d="M 8 48 A 37 37 0 0 1 82 48"
                                fill="none"
                                stroke={getScoreColor(overallScore)}
                                strokeWidth="7"
                                strokeLinecap="round"
                                strokeDasharray={`${progress} ${circumference}`}
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-end pb-0.5">
                            <span className="text-xl font-bold leading-none" style={{ color: getScoreColor(overallScore) }}>
                                {overallScore}
                            </span>
                        </div>
                    </div>
                    <div>
                        <p className="text-white text-sm font-semibold leading-tight">Overall</p>
                        <p className="text-white text-sm font-semibold leading-tight">Score</p>
                        <p className="text-[#5a7a9a] text-xs mt-0.5">across all trades</p>
                    </div>
                </div>

                {/* Divider */}
                <div className="w-px h-12 bg-[#1e3048] shrink-0" />

                {/* Avg parameter bars */}
                <div className="flex-1 grid grid-cols-5 gap-x-6 gap-y-1.5">
                    {aggregateParams.map((p) => (
                        <div key={p.key}>
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-[#5a7a9a] text-xs">{p.label}</span>
                                <span className="text-white text-xs font-semibold">{p.score}/{p.max}</span>
                            </div>
                            <div className="w-full bg-[#0f1923] rounded-full h-1.5 overflow-hidden">
                                <div
                                    className={`h-1.5 rounded-full ${getBarBg(p.score, p.max)}`}
                                    style={{ width: `${(p.score / p.max) * 100}%` }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Row 2: Individual Trade Cards ────────────────────────── */}
            <div className="px-6 py-4">
                <p className="text-[#5a7a9a] text-xs uppercase tracking-widest font-semibold mb-3">
                    Individual Trades
                </p>

                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-[#1e3048] scrollbar-track-transparent">
                    {scores.map((s, i) => {
                        const trade = trades[i];
                        const params = [
                            { label: "Trend", ...s.params.trend },
                            { label: "Momentum", ...s.params.momentum },
                            { label: "Volume", ...s.params.volume },
                            { label: "S/R", ...s.params.sr },
                            { label: "Candle", ...s.params.candle },
                        ];

                        return (
                            <div
                                key={i}
                                className="shrink-0 w-52 bg-[#0d1b2a] border border-[#1e3048] rounded-xl p-4 hover:border-[#2a4a6a] transition-colors"
                            >
                                {/* Trade header */}
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${s.trade_type === "buy"
                                            ? "bg-emerald-500/15 text-emerald-400"
                                            : "bg-red-500/15 text-red-400"
                                            }`}>
                                            {s.trade_type?.toUpperCase()}
                                        </span>
                                        <span className="text-white text-xs font-semibold">₹{s.price}</span>
                                    </div>
                                    <span className="text-[#5a7a9a] text-xs">{trade?.qty ?? ""} qty</span>
                                </div>

                                {/* Score */}
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-2xl font-bold" style={{ color: getScoreColor(s.overall) }}>
                                        {s.overall}
                                    </span>
                                    <span className="text-[#5a7a9a] text-xs">/100</span>
                                </div>

                                {/* Divider */}
                                <div className="h-px bg-[#1e3048] mb-3" />

                                {/* Param breakdown */}
                                <div className="flex flex-col gap-1.5">
                                    {params.map((p) => (
                                        <div key={p.label} className="flex items-center gap-2">
                                            <span className="text-[#5a7a9a] text-xs w-16 shrink-0">{p.label}</span>
                                            <div className="flex-1 bg-[#0f1923] rounded-full h-1 overflow-hidden">
                                                <div
                                                    className={`h-1 rounded-full ${getBarBg(p.score, p.max)}`}
                                                    style={{ width: `${(p.score / p.max) * 100}%` }}
                                                />
                                            </div>
                                            <span className="text-white text-xs font-semibold w-8 text-right shrink-0">
                                                {p.score}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                {/* RSI detail tooltip */}
                                {s.params.momentum?.detail?.rsi && (
                                    <p className="text-[#5a7a9a] text-xs mt-3">
                                        RSI: {s.params.momentum.detail.rsi}
                                    </p>
                                )}

                                {/* Candle description */}
                                {s.params.candle?.detail?.description && (
                                    <p className="text-[#5a7a9a] text-xs mt-1 leading-relaxed">
                                        {s.params.candle.detail.description}
                                    </p>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

        </div>
    );
};

export default ScorePanel;