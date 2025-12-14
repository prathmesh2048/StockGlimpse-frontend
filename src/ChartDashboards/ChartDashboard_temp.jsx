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

/* ----------------------------------------------------
   Chart Component
---------------------------------------------------- */
const Chart = ({ symbol, symbolData }) => {
  const chartRef = useRef();
  const chartInstance = useRef(null);

  const [priceData, setPriceData] = useState(symbolData?.prices ?? []);
  const [annotations, setAnnotations] = useState(symbolData?.annotations ?? []);
  const [theme] = useState("dark");

  // Fetch ONLY if NOT preloaded
  useEffect(() => {
    if (symbolData) return;

    const fetchStockData = async () => {
      try {
        const response = await axios.get(`${ENV.BASE_API_URL}/stock/${symbol}/`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('jwtToken')}` }
        });

        setPriceData(response.data.prices);
        setAnnotations(response.data.annotations);
      } catch (err) {
        console.error(`Error fetching data for ${symbol}:`, err);
      }
    };

    fetchStockData();
  }, [symbol, symbolData]);

  // Init + Update Chart
  useEffect(() => {
    if (!chartRef.current || priceData.length === 0) return;

    const { width, height } = chartRef.current.getBoundingClientRect();
    const id = chartRef.current.id || `chart-${symbol}`;
    chartRef.current.id = id;

    if (!chartInstance.current) {
      chartInstance.current = new CandleStickChart(
        width,
        height,
        priceData,
        annotations,
        id,
        theme,
        NoteTextarea
      );
    } else {
      chartInstance.current.setData(priceData);
      chartInstance.current.setAnnotations(annotations);
    }

    chartInstance.current.draw();
  }, [priceData, annotations]);

  // Resize
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

  return (
    <div className={`${styles.chart} ${styles[theme]}`}>
      <div
        ref={chartRef}
        style={{
          width: "100%",
          height: "inherit",
          padding: 0,
          margin: 0,
          boxSizing: "border-box"
        }}
      />
    </div>
  );
};

/* ----------------------------------------------------
   Single Screen Component (NO multi-screen logic)
---------------------------------------------------- */
const ChartScreen = React.memo(({ symbols, symbolDataMap, viewMode }) => {
  const chartsToShow = useMemo(() => {
    return viewMode === "grid-2x2"
      ? symbols.slice(0, 4)
      : symbols;
  }, [symbols, viewMode]);

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
      {chartsToShow.map((symbol) => (
        <Chart
          key={symbol}
          symbol={symbol}
          symbolData={symbolDataMap[symbol]}
        />
      ))}
    </section>
  );
});

/* ----------------------------------------------------
   ChartDashboard
---------------------------------------------------- */
export default function ChartDashboard({ preloadedData }) {


  const symbols = useMemo(
    () => preloadedData?.map(d => d.symbol) ?? [],
    [preloadedData]
  );

  const symbolDataMap = useMemo(() => {
    const map = {};
    preloadedData?.forEach(d => {
      map[d.symbol] = d;
    });
    return map;
  }, [preloadedData]);

  const [viewMode, setViewMode] = useState("1-per-row");

  return (
    <div className={styles.dashboardContainer}>
      <main className={styles.mainArea}>

        {/* Header */}
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

        {/* Chart Screen */}
        <ChartScreen
          symbols={symbols}
          symbolDataMap={symbolDataMap}
          viewMode={viewMode}
        />
      </main>
    </div>
  );
}
