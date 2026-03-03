import React, { useState, useEffect, useRef } from "react";
import * as d3 from "d3";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import Navbar from "../Navbar/Navbar";
import ENV from "../config";
import { Puff } from "react-loader-spinner";

const PARAM_KEYS = ["trend", "momentum", "volume", "sr", "candle"];
const PARAM_LABELS = {
    trend: "Trend", momentum: "Momentum",
    volume: "Volume", sr: "S/R Placement", candle: "Candle Pattern",
};

const getScoreColor = (score) => {
    if (score >= 75) return "#00c896";
    if (score >= 50) return "#f5a623";
    return "#ff4444";
};

const getScoreBg = (score) => {
    if (score >= 75) return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    if (score >= 50) return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
    return "bg-red-500/10 text-red-400 border-red-500/20";
};

const getBarColor = (score, max) => {
    const pct = score / max;
    if (pct >= 0.75) return "#00c896";
    if (pct >= 0.5) return "#f5a623";
    return "#ff4444";
};

// ── Score Trend Chart ─────────────────────────────────────────────
const ScoreTrendChart = ({ trades, scoreMap }) => {
    const svgRef = useRef(null);
    const containerRef = useRef(null);
    const [tooltip, setTooltip] = useState(null);
    const [width, setWidth] = useState(800);

    const data = trades
        .map((trade) => {
            const score = scoreMap[trade.trade_id];
            if (!score || score.error) return null;
            return {
                name: trade.symbol,
                score: score.overall,
                date: dayjs(trade.executed_at || trade.created_at).format("DD MMM"),
            };
        })
        .filter(Boolean);

    const avg = data.length ? Math.round(data.reduce((s, d) => s + d.score, 0) / data.length) : 0;
    const best = data.length ? Math.max(...data.map(d => d.score)) : 0;
    const worst = data.length ? Math.min(...data.map(d => d.score)) : 0;

    const H = 160;
    const margin = { top: 10, right: 16, bottom: 28, left: 32 };
    const innerW = Math.max(width - margin.left - margin.right, 100);
    const innerH = H - margin.top - margin.bottom;

    useEffect(() => {
        if (!containerRef.current) return;
        const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
        ro.observe(containerRef.current);
        return () => ro.disconnect();
    }, []);

    const xScale = d3.scalePoint().domain(data.map((_, i) => i)).range([0, innerW]).padding(0.1);
    const yScale = d3.scaleLinear().domain([0, 100]).range([innerH, 0]);

    const lineGen = d3.line()
        .x((_, i) => xScale(i))
        .y(d => yScale(d.score))
        .curve(d3.curveMonotoneX);

    const areaGen = d3.area()
        .x((_, i) => xScale(i))
        .y0(innerH)
        .y1(d => yScale(d.score))
        .curve(d3.curveMonotoneX);

    const pathD = data.length ? lineGen(data) : "";
    const areaD = data.length ? areaGen(data) : "";

    const xLabels = data
        .map((d, i) => ({ i, name: d.name }))
        .filter((_, i, arr) => i === 0 || i === arr.length - 1 || i % Math.max(1, Math.floor(arr.length / 6)) === 0);

    return (
        <div className="w-full bg-[#0d1b2a] border border-[#1e3048] rounded-2xl p-6 mb-6">
            <div className="flex items-end justify-between mb-6">
                <div>
                    <p className="text-[#5a7a9a] text-xs uppercase tracking-widest font-semibold mb-1">Score Trend</p>
                    <p className="text-white text-3xl font-bold">
                        {avg}
                        <span className="text-[#5a7a9a] text-base font-normal ml-2">/100 avg</span>
                    </p>
                </div>
                <div className="flex items-center gap-6">
                    {[
                        { label: "Best", value: best, color: "#00c896" },
                        { label: "Worst", value: worst, color: "#ff4444" },
                        { label: "Total", value: trades.length, color: "#fff" },
                    ].map(s => (
                        <div key={s.label} className="text-right">
                            <p className="text-[#5a7a9a] text-xs mb-0.5">{s.label}</p>
                            <p className="font-bold text-sm" style={{ color: s.color }}>{s.value}</p>
                        </div>
                    ))}
                </div>
            </div>

            <div ref={containerRef} className="relative w-full" style={{ height: H }}>
                <svg ref={svgRef} width="100%" height={H}>
                    <defs>
                        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.15" />
                            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    <g transform={`translate(${margin.left},${margin.top})`}>
                        {[0, 25, 50, 75, 100].map(v => (
                            <g key={v}>
                                <line x1={0} y1={yScale(v)} x2={innerW} y2={yScale(v)} stroke="#1a2a3a" strokeDasharray="3 3" />
                                <text x={-6} y={yScale(v) + 4} textAnchor="end" fill="#5a7a9a" fontSize={10}>{v}</text>
                            </g>
                        ))}
                        <line x1={0} y1={yScale(avg)} x2={innerW} y2={yScale(avg)} stroke="#3b82f6" strokeDasharray="4 4" strokeOpacity={0.45} />
                        <path d={areaD} fill="url(#areaGrad)" />
                        <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                        {data.map((d, i) => (
                            <circle
                                key={i}
                                cx={xScale(i)} cy={yScale(d.score)}
                                r={4}
                                fill={getScoreColor(d.score)}
                                stroke="#060d14" strokeWidth={1.5}
                                style={{ cursor: "pointer" }}
                                onMouseEnter={() => setTooltip({ x: xScale(i) + margin.left, y: yScale(d.score) + margin.top, item: d })}
                                onMouseLeave={() => setTooltip(null)}
                            />
                        ))}
                        {xLabels.map(({ i, name }) => (
                            <text key={i} x={xScale(i)} y={innerH + 18} textAnchor="middle" fill="#5a7a9a" fontSize={10}>
                                {name}
                            </text>
                        ))}
                        <text x={innerW / 2} y={innerH + 28} textAnchor="middle" fill="#3a5068" fontSize={9} letterSpacing="0.08em">
                            TRADES OVER TIME
                        </text>
                    </g>
                </svg>

                {tooltip && (
                    <div
                        className="absolute pointer-events-none bg-[#0d1b2a] border border-[#1e3048] rounded-lg px-3 py-2 shadow-xl text-xs"
                        style={{ left: tooltip.x + 12, top: tooltip.y - 12, transform: tooltip.x > width * 0.7 ? "translateX(-110%)" : undefined }}
                    >
                        <p className="text-white font-semibold">{tooltip.item.name}</p>
                        <p className="mt-0.5" style={{ color: getScoreColor(tooltip.item.score) }}>
                            Score: <span className="font-bold">{tooltip.item.score}</span>
                        </p>
                        <p className="text-[#5a7a9a] mt-0.5">{tooltip.item.date}</p>
                    </div>
                )}
            </div>

            <div className="flex items-center gap-5 mt-4 pt-4 border-t border-[#1e3048]">
                {[
                    { color: "#00c896", label: "Strong ≥75" },
                    { color: "#f5a623", label: "Moderate 50–74" },
                    { color: "#ff4444", label: "Weak <50" },
                    { color: "#3b82f6", label: "Your avg", dashed: true },
                ].map((z) => (
                    <div key={z.label} className="flex items-center gap-1.5">
                        <svg width="18" height="4">
                            <line x1="0" y1="2" x2="18" y2="2" stroke={z.color} strokeWidth="2" strokeDasharray={z.dashed ? "4 3" : undefined} strokeLinecap="round" />
                        </svg>
                        <span className="text-[#5a7a9a] text-xs">{z.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ── Trade Card ────────────────────────────────────────────────────
const TradeCard = ({ trade, score, onClick }) => {
    const [expanded, setExpanded] = useState(false);

    if (!score || score.error) {
        return (
            <div className="w-full bg-[#0d1b2a] border border-[#1e3048] rounded-xl px-5 py-4 flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-[#0f1923] border border-[#1e3048] flex items-center justify-center">
                    <span className="text-[#5a7a9a] text-xs">N/A</span>
                </div>
                <div>
                    <p className="text-white font-bold">{trade.symbol}</p>
                    <p className="text-[#5a7a9a] text-xs mt-0.5">{score?.error ?? "Score unavailable"}</p>
                </div>
            </div>
        );
    }

    const params = PARAM_KEYS.map((key) => ({
        key, label: PARAM_LABELS[key], ...score.params[key],
    }));

    const weakest = [...params].sort((a, b) => (a.score / a.max) - (b.score / b.max))[0];
    const isBuy = trade.trade_type === "buy";

    return (
        <div className={`w-full bg-[#0d1b2a] border rounded-xl transition-all duration-200 overflow-hidden
            ${expanded ? "border-[#2a4a6a]" : "border-[#1e3048] hover:border-[#243d57]"}`}>

            <div className="flex items-center gap-4 px-5 py-4 cursor-pointer select-none" onClick={() => setExpanded(!expanded)}>
                <div className={`shrink-0 w-14 h-14 rounded-xl border flex flex-col items-center justify-center ${getScoreBg(score.overall)}`}>
                    <span className="text-lg font-bold leading-none">{score.overall}</span>
                    <span className="text-xs opacity-50 mt-0.5">/100</span>
                </div>

                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-white font-bold text-base truncate">{trade.symbol}</span>
                    <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-md ${isBuy ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                        {trade.trade_type?.toUpperCase()}
                    </span>
                    <span className="text-[#5a7a9a] text-xs shrink-0 hidden sm:block">{trade.exchange}</span>
                </div>

                {!expanded && (
                    <div className="hidden md:flex items-center gap-1.5 shrink-0">
                        <span className="text-[#5a7a9a] text-xs">Weakest:</span>
                        <span className="text-xs font-bold text-red-300 bg-red-500/10 px-1.5 py-0.5 rounded">{weakest.label}</span>
                    </div>
                )}

                <span className="text-[#5a7a9a] text-xs shrink-0 hidden lg:block">
                    {dayjs(trade.executed_at || trade.created_at).format("DD MMM 'YY")}
                </span>

                <svg
                    className={`shrink-0 text-[#5a7a9a] transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
                    width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                >
                    <path d="M6 9l6 6 6-6" />
                </svg>
            </div>

            {expanded && (
                <div className="px-5 pb-5 border-t border-[#1e3048]">
                    <div className="pt-4 flex flex-col gap-4">
                        <div className="flex items-center gap-6 flex-wrap">
                            {[
                                { label: "Price", value: `₹${parseFloat(trade.price).toFixed(1)}` },
                                { label: "Qty", value: trade.quantity },
                                { label: "Executed", value: dayjs(trade.executed_at || trade.created_at).format("DD MMM YYYY") },
                                { label: "RSI", value: score.detail?.rsi ?? "—" },
                                { label: "Vol Ratio", value: score.detail?.volume_ratio ?? "—" },
                                { label: "S/R Dist", value: score.detail?.sr_distance_pct ? `${score.detail.sr_distance_pct}%` : "—" },
                            ].map((m) => (
                                <div key={m.label}>
                                    <p className="text-[#5a7a9a] text-xs mb-0.5">{m.label}</p>
                                    <p className="text-white text-sm font-semibold">{m.value}</p>
                                </div>
                            ))}
                            {score.detail?.candle_description && (
                                <div className="flex-1 min-w-[200px]">
                                    <p className="text-[#5a7a9a] text-xs mb-0.5">Signal</p>
                                    <p className="text-[#a0b4c8] text-sm">{score.detail.candle_description}</p>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-5 gap-2">
                            {params.map((p) => {
                                const color = getBarColor(p.score, p.max);
                                const pct = (p.score / p.max) * 100;
                                return (
                                    <div key={p.key} className="bg-[#080f17] border border-[#1e3048] rounded-xl px-3 py-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[#5a7a9a] text-xs">{p.label}</span>
                                            <span className="text-xs font-bold" style={{ color }}>{p.score}/{p.max}</span>
                                        </div>
                                        <div className="w-full bg-[#0f1923] rounded-full h-1.5 overflow-hidden">
                                            <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: color }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-start gap-2 flex-1 mr-4">
                                <svg className="text-[#5a7a9a] shrink-0 mt-0.5" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                                </svg>
                                <p className="text-[#5a7a9a] text-xs italic leading-relaxed">
                                    {trade.notes ?? "No notes added for this trade."}
                                </p>
                            </div>
                            <button
                                onClick={(e) => { e.stopPropagation(); onClick(); }}
                                className="flex items-center gap-2 bg-[#1e3048] hover:bg-[#243d57] text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shrink-0"
                            >
                                View Chart
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M9 18l6-6-6-6" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ── Main Page ─────────────────────────────────────────────────────
export default function Analytics() {
    const [trades, setTrades] = useState([]);
    const [scoreMap, setScoreMap] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [scoresLoading, setScoresLoading] = useState(false);
    const [error, setError] = useState("");
    const navigate = useNavigate();

    // ── Step 1: Fetch trades ──────────────────────────────────────
    useEffect(() => {
        const fetchTrades = async () => {
            setIsLoading(true);
            try {
                const res = await axios.get(
                    `${ENV.BASE_API_URL}/api/recent-visualizations/`,
                    {
                        params: { all: false },
                        headers: { Authorization: `Bearer ${localStorage.getItem("jwtToken")}` },
                    }
                );
                setTrades(res.data);
            } catch (err) {
                setError("Failed to fetch trades.");
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchTrades();
    }, []);

    const handleRefresh = async () => {
        setScoresLoading(true);
        try {
            const res = await axios.get(
                `${ENV.BASE_API_URL}/api/analytics-scores/?refresh=true`,
                { headers: { Authorization: `Bearer ${localStorage.getItem("jwtToken")}` } }
            );
            setScoreMap(res.data.scores ?? {});
        } catch (err) {
            console.error(err);
        } finally {
            setScoresLoading(false);
        }
    };

    // ── Step 2: Fetch scores after trades load ────────────────────
    useEffect(() => {
        if (!trades.length) return;

        const fetchScores = async () => {
            setScoresLoading(true);
            try {
                const res = await axios.get(
                    `${ENV.BASE_API_URL}/api/analytics-scores/`,
                    {
                        headers: { Authorization: `Bearer ${localStorage.getItem("jwtToken")}` },
                    }
                );
                setScoreMap(res.data.scores ?? {});
            } catch (err) {
                console.error("Scores fetch error:", err);
            } finally {
                setScoresLoading(false);
            }
        };

        fetchScores();
    }, [trades]);

    const groupedTrades = trades.reduce((acc, trade) => {
        const key = dayjs(trade.created_at).format("YYYY-MM-DD");
        if (!acc[key]) acc[key] = [];
        acc[key].push(trade);
        return acc;
    }, {});

    const handleTradeClick = (trade) => {
        navigate("/temp", {
            state: { tradesBySymbol: { [trade.symbol]: [trade] }, fromHistory: true },
        });
    };

    return (
        <>
            <Navbar solidBackground={true} />
            <div className="min-h-screen bg-[#060d14] px-4 lg:px-12 py-8">

                {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

                {isLoading ? (
                    <div className="flex items-center justify-center h-64">
                        <Puff color="#6366F1" size={60} ariaLabel="loading" />
                    </div>
                ) : (
                    <>
                        <div className="mb-6">
                            <h1 className="text-white text-2xl font-bold">Analytics</h1>
                            <p className="text-[#5a7a9a] text-sm mt-1">Your trade quality over time</p>
                        </div>
                        <button
                            onClick={handleRefresh}
                            disabled={scoresLoading}
                            className="flex items-center gap-2 bg-[#1e3048] hover:bg-[#243d57] text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                        >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M23 4v6h-6M1 20v-6h6" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                            </svg>
                            Refresh Scores
                        </button>
                        <br />

                        {trades.length > 0 && (
                            <ScoreTrendChart
                                trades={trades}
                                scoreMap={scoreMap}
                            />
                        )}

                        <div className="flex flex-col gap-8">
                            {Object.entries(groupedTrades)
                                .sort(([a], [b]) => (a > b ? -1 : 1))
                                .map(([date, rows]) => (
                                    <div key={date}>
                                        <div className="flex items-center gap-3 mb-3">
                                            <p className="text-[#5a7a9a] text-xs uppercase tracking-widest font-semibold">
                                                {dayjs(date).format("MMM D, YYYY")}
                                            </p>
                                            <div className="flex-1 h-px bg-[#1e3048]" />
                                            <span className="text-[#5a7a9a] text-xs">{rows.length} trades</span>
                                        </div>

                                        <div className="flex flex-col gap-2">
                                            {rows.map((trade) => (
                                                <TradeCard
                                                    key={trade.trade_id}
                                                    trade={trade}
                                                    score={scoresLoading ? null : scoreMap[trade.trade_id]}
                                                    onClick={() => handleTradeClick(trade)}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                ))}

                            {trades.length === 0 && !isLoading && (
                                <div className="flex flex-col items-center justify-center h-64 gap-3">
                                    <p className="text-white text-lg font-semibold">No trades yet</p>
                                    <p className="text-[#5a7a9a] text-sm">Upload your first tradebook to see analytics</p>
                                    <button
                                        onClick={() => navigate("/")}
                                        className="bg-[#3b82f6] hover:bg-[#2563eb] text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors mt-2"
                                    >
                                        Upload Trades
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Scores loading indicator */}
                        {scoresLoading && (
                            <div className="fixed bottom-6 right-6 bg-[#0d1b2a] border border-[#1e3048] rounded-xl px-4 py-3 flex items-center gap-3 shadow-xl">
                                <div className="w-3 h-3 border-2 border-[#3b82f6] border-t-transparent rounded-full animate-spin" />
                                <p className="text-[#a0b4c8] text-xs">Calculating scores...</p>
                            </div>
                        )}
                    </>
                )}
            </div>
        </>
    );
}