// ChartDashboard.jsx (Fixed with Resize Handling on Collapse)
import styles from './ChartDashboard.module.css';
import React, {
  useRef,
  useEffect,
  useCallback,
  useState,
  useMemo,
  useId
} from 'react';
import axios from 'axios';
import ENV from '../config';
import CandleStickChart from '../Chart/CandleStickChart';
import NoteTextarea from '../Chart/NoteTextArea';

const Chart = ({ symbol }) => {

  const chartRef = useRef();
  const chartInstance = useRef(null);
  const [priceData, setPriceData] = useState([]);
  const [annotations, setAnnotations] = useState([]);
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    const fetchStockData = async () => {
      try {
        const response = await axios.get(`${ENV.BASE_API_URL}/stock/${symbol}/`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('jwtToken')}`,
          },
        });
        setPriceData(response.data.prices);
        setAnnotations(response.data.annotations);
      } catch (err) {
        console.error(`Error fetching data for ${symbol}:`, err);
      }
    };

    fetchStockData();
  }, [symbol]);

  const resizeChart = useCallback(() => {

    if (!chartRef.current || !chartInstance.current) return;

    // chartRef.current.innerHTML = '';

    const { width, height } = chartRef.current.getBoundingClientRect();

    chartInstance.current.setConfig({ width, height });
    chartInstance.current.draw();

  }, []);

  useEffect(() => {

    if (!chartRef.current || priceData.length === 0) return;

    if (!chartRef.current.id) {
      chartRef.current.id = `chart-${symbol}`;
    }

    const { width, height } = chartRef.current.getBoundingClientRect();

    if (!chartInstance.current) {
      chartInstance.current = new CandleStickChart(
        width,
        height,
        priceData,
        annotations,
        chartRef.current.id,
        theme,
        NoteTextarea
      );
    } else {
      chartInstance.current.setData(priceData);
      chartInstance.current.setAnnotations(annotations);
      chartInstance.current.draw();
    }

    chartInstance.current.draw(); // imp to ensure the chart is drawn after setting data

    window.addEventListener("resize", resizeChart);
    return () => window.removeEventListener("resize", resizeChart);
  }, [priceData, annotations, resizeChart]);

  useEffect(() => {
    resizeChart();
  }, [resizeChart]);

  return (
    <div className={`${styles.chart} ${styles[theme]}`}>
      <div
        className="chart-div"
        style={{
          width: '100%',
          height: 'inherit',
          padding: '0',
          margin: '0',
          boxSizing: 'border-box',
          border: 'none',
          outline: 'none',
        }}
        ref={chartRef}
      />
    </div>
  );
};

const ChartScreen = React.memo(({ screen, viewMode }) => {
  const chartsToShow = useMemo(
    () => (viewMode === 'grid-2x2' ? screen.charts.slice(0, 4) : screen.charts),
    [screen.charts, viewMode]
  );

  const containerClassName = useMemo(() => {
    switch (viewMode) {
      case '1-per-row':
        return styles.chartsContainerOnePerRow;
      case '2-per-row':
        return styles.chartsContainerTwoPerRow;
      case 'grid-2x2':
        return styles.chartsContainerGrid2x2;
      default:
        return styles.chartsContainerOnePerRow;
    }
  }, [viewMode]);

  if (chartsToShow.length === 0) {
    return (
      <p className={styles.noChartsMsg} role="alert">
        No charts in this screen.
      </p>
    );
  }

  return (
    <section className={containerClassName} aria-label={`Charts in ${screen.name}`}>
      {chartsToShow.map((symbol) => (
        <Chart key={symbol} symbol={symbol} />
      ))}
    </section>
  );
});

export default function ChartDashboard() {
  const [screens, setScreens] = useState([
    {
      id: 'screen-1',
      name: 'Tech Stocks',
      charts: ['AAPL'],
    },
    {
      id: 'screen-2',
      name: 'Energy & Finance',
      charts: ['XOM', 'CVX', 'JPM', 'BAC'],
    },
  ]);

  const [selectedScreenId, setSelectedScreenId] = useState(screens[0]?.id ?? null);
  const [viewMode, setViewMode] = useState('1-per-row');

  const selectedScreen = useMemo(
    () => screens.find((screen) => screen.id === selectedScreenId) ?? null,
    [screens, selectedScreenId]
  );

  return (
    <div className={styles.dashboardContainer}>
      <main className={styles.mainArea}>
        <header className={styles.mainHeader}>
          <h1 className={styles.mainTitle}>
            {selectedScreen ? selectedScreen.name : 'No screen selected'}
          </h1>
          <div className={styles.viewModeSelector}>
            <label className={styles.viewModeLabel}>View mode:</label>
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

        {selectedScreen ? (
          <ChartScreen screen={selectedScreen} viewMode={viewMode} />
        ) : (
          <p className={styles.noScreenSelectedMsg}>Select or create a chart screen.</p>
        )}
      </main>
    </div>
  );
}