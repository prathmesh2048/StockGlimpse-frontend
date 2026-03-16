// DemoChart.jsx
import styles from '../ChartDashboards/ChartDashboard.module.css';
import React, { useRef, useEffect, useCallback, useState } from 'react';
import axios from 'axios';
import ENV from '../config';
import CandleStickChart from '../Chart/CandleStickChart';
import NoteTextarea from '../Chart/NoteTextArea';
import { Puff } from "react-loader-spinner";
import StockChartCard from '../ChartDashboards/StockChartCard';
import Navbar from '../Navbar/Navbar';


const DEMO_CHART_ID = "chart-demo-BEL";

export default function DemoChart() {
    const chartRef = useRef(null);
    const chartInstance = useRef(null);

    const [priceData, setPriceData] = useState([]);
    const [annotations, setAnnotations] = useState([]);
    const [cardData, setCardData] = useState(null);
    const [loading, setLoading] = useState(true);

    const theme = "dark";

    // Fetch demo data from backend
    useEffect(() => {
        const fetchDemo = async () => {
            try {
                setLoading(true);
                const res = await axios.get(`${ENV.BASE_API_URL}/api/demo/`);
                setPriceData(res.data.prices);
                setAnnotations(res.data.annotations);
                setCardData(res.data.card_data);
            } catch (err) {
                console.error("Demo fetch error:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchDemo();
    }, []);

    // Draw chart
    useEffect(() => {
        if (loading || !chartRef.current || priceData.length === 0) return;

        const draw = () => {
            const { width, height } = chartRef.current.getBoundingClientRect();
            chartRef.current.id = DEMO_CHART_ID;

            if (!chartInstance.current) {
                chartInstance.current = new CandleStickChart(
                    width,
                    height,
                    priceData,
                    annotations,
                    DEMO_CHART_ID,
                    theme,
                    false // isPaid — always false in demo
                );
            } else {
                chartInstance.current.clear?.();
                chartInstance.current.setData(priceData);
                chartInstance.current.setAnnotations(annotations);
            }

            chartInstance.current.draw();
        };

        requestAnimationFrame(() => requestAnimationFrame(draw));
    }, [loading, priceData, annotations]);

    const resizeChart = useCallback(() => {
        if (!chartRef.current || !chartInstance.current) return;
        const { width, height } = chartRef.current.getBoundingClientRect();
        chartInstance.current.setConfig({ width, height });
        chartInstance.current.draw();
    }, []);

    useEffect(() => {
        window.addEventListener("resize", resizeChart);
        return () => window.removeEventListener("resize", resizeChart);
    }, [resizeChart]);

    useEffect(() => {
        return () => {
            if (chartInstance.current) {
                chartInstance.current.destroy?.();
                chartInstance.current = null;
            }
        };
    }, []);

    return (
        <>
            <Navbar />
            <div className="min-h-screen bg-[#060d14]">

                {/* Demo banner */}
                <div className="w-full bg-[#0d1b2a] border-b border-[#1e3048] px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="bg-[#3b82f6]/15 border border-[#3b82f6]/30 text-[#3b82f6] text-xs font-bold px-2.5 py-1 rounded-md">
                            DEMO
                        </span>
                        <p className="text-[#5a7a9a] text-sm">
                            You're viewing a demo chart with sample BEL trades —{" "}
                            <span className="text-white font-medium">Upload your tradebook to see your own data</span>
                        </p>
                    </div>
                    <button
                        onClick={() => window.location.assign("/signup")}
                        className="shrink-0 bg-[#3b82f6] hover:bg-[#2563eb] text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors"
                    >
                        Get Started Free
                    </button>
                </div>

                {/* Chart — match exact structure from ChartDashboard */}
                <div className={styles.dashboardContainer}>
                    <main className={styles.mainArea}>
                        <section className={styles.chartsContainerOnePerRow}>
                            <StockChartCard
                                isDemo={true}
                                annotations={annotations}
                                cardData={cardData}
                                priceData={priceData}
                                stock={cardData}
                            >
                                <div className={`${styles.chart} ${styles[theme]}`}>
                                    {loading && (
                                        <div className={styles.chartLoader}>
                                            <Puff color="#6366F1" size={60} ariaLabel="loading" />
                                        </div>
                                    )}
                                    <div
                                        ref={chartRef}
                                        style={{
                                            width: "100%",
                                            height: "inherit",
                                            display: loading ? "none" : "block"
                                        }}
                                    />
                                </div>
                            </StockChartCard>
                        </section>
                    </main>
                </div>
            </div>
        </>
    );
}