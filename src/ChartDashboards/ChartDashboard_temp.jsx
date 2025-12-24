// ChartDashboard.jsx
import styles from './ChartDashboard.module.css';
import React, {
  useRef,
  useEffect,
  useCallback,
  useState,
  useMemo
} from 'react';
import axios from 'axios';
import ENV from '../config';
import CandleStickChart from '../Chart/CandleStickChart';
import NoteTextarea from '../Chart/NoteTextArea';
import { Puff } from "react-loader-spinner";
import StockChartCard from './StockChartCard';


/* ----------------------------------------------------
   Chart Component
---------------------------------------------------- */
const Chart = ({ symbol, trades, onReady }) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  const [priceData, setPriceData] = useState([]);
  const [annotations, setAnnotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cardData, setCardData] = useState(null);

  const theme = "dark";

  const chartId = useMemo(() => `chart-${symbol.replace(/[^a-zA-Z0-9]/g, '')}`, [symbol]);
  const stableTrades = useMemo(() => JSON.stringify(trades ?? []), [trades]);

  useEffect(() => {
    let cancelled = false;

    const fetchStockData = async () => {
      try {
        setLoading(true);

        const res = await axios.post(
          `${ENV.BASE_API_URL}/api/visualize/`,
          JSON.parse(stableTrades),
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("jwtToken")}`,
              "Content-Type": "application/json"
            }
          }
        );

        if (cancelled) return;

        setPriceData(res.data.prices);
        setAnnotations(res.data.annotations);
        setCardData(res.data.card_data);
      } catch (err) {
        console.error(`Error fetching ${symbol}`, err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (trades?.length) fetchStockData();

    return () => {
      cancelled = true;
    };
  }, [symbol, stableTrades]);

  useEffect(() => {
    if (loading || !chartRef.current || priceData.length === 0) return;

    const draw = () => {
      const { width, height } = chartRef.current.getBoundingClientRect();
      chartRef.current.id = chartId;

      if (!chartInstance.current) {
        chartInstance.current = new CandleStickChart(
          width,
          height,
          priceData,
          annotations,
          chartId,
          theme,
          NoteTextarea
        );
      } else {
        chartInstance.current.clear?.();
        chartInstance.current.setData(priceData);
        chartInstance.current.setAnnotations(annotations);

      }

      chartInstance.current.draw();
      onReady?.();
    };

    requestAnimationFrame(() => requestAnimationFrame(draw));
  }, [loading, priceData, annotations, chartId]);

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
    <StockChartCard stock={cardData}>
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
  );
};



/* ----------------------------------------------------
   Chart Screen
---------------------------------------------------- */
const ChartScreen = React.memo(({ symbols, tradesBySymbol, viewMode }) => {

  const [renderCount, setRenderCount] = useState(1);

  const chartsToShow = useMemo(() => {
    const list = viewMode === "grid-2x2" ? symbols.slice(0, 4) : symbols;
    return list.slice(0, renderCount);
  }, [symbols, viewMode, renderCount]);

  const containerClassName = useMemo(() => {
    switch (viewMode) {
      case "1-per-row":
        return styles.chartsContainerOnePerRow;
      case "2-per-row":
        return styles.chartsContainerTwoPerRow;
      case "grid-2x2":
        return styles.chartsContainerGrid2x2;
      default:
        return styles.chartsContainerOnePerRow;
    }
  }, [viewMode]);

  if (chartsToShow.length === 0)
    return <p className={styles.noChartsMsg}>No charts available.</p>;

  return (
    <section className={containerClassName}>
      {chartsToShow.map(symbol => (
        <Chart
          key={symbol}
          symbol={symbol}
          trades={tradesBySymbol[symbol]}
          onReady={() => setRenderCount(c => c + 1)}
        />
      ))}
    </section>
  );
});

/* ----------------------------------------------------
   ChartDashboard
---------------------------------------------------- */
export default function ChartDashboard({ tradesBySymbol }) {
  const symbols = useMemo(
    () => Object.keys(tradesBySymbol),
    [tradesBySymbol]
  );

  const [viewMode, setViewMode] = useState("1-per-row");

  return (
    <div className={styles.dashboardContainer}>
      <main className={styles.mainArea}>
        <header className={styles.mainHeader}>
          <h1 className={styles.mainTitle}>Charts</h1>

          <div className={styles.viewModeSelector}>
            <label>View mode:</label>
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value)}
              className={styles.viewModeSelect}
            >
              <option value="1-per-row">1 chart per row</option>
              <option value="2-per-row">2 charts side-by-side</option>
              <option value="grid-2x2">2×2 grid</option>
            </select>
          </div>
        </header>

        <ChartScreen
          symbols={symbols}
          tradesBySymbol={tradesBySymbol}
          viewMode={viewMode}
        />
      </main>
    </div>
  );
}