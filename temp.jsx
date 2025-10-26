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

const Chart = ({ symbol }) => {
  const chartRef = useRef();
  const chartInstance = useRef(null);
  const [priceData, setPriceData] = useState([]);
  const [annotations, setAnnotations] = useState([]);

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

  useEffect(() => {
    if (!chartRef.current || priceData.length === 0) return;

    if (!chartRef.current.id) {
      chartRef.current.id = `chart-${symbol}`;
    }

    if (!chartInstance.current) {
      chartInstance.current = new CandleStickChart(
        chartRef.current.clientWidth,
        chartRef.current.clientHeight,
        priceData,
        annotations,
        chartRef.current.id
      );
    } else {
      chartInstance.current.setData(priceData);
      chartInstance.current.setAnnotations(annotations);
      chartInstance.current.draw();
    }
  }, [priceData, annotations]);

  return (
    <article className={styles.chart}>
      <div
        className="chart-div"
        style={{ width: '100%', height: '100%' }}
        ref={chartRef}
      />
    </article>
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
      charts: ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'AMD'],
    },
    {
      id: 'screen-2',
      name: 'Energy & Finance',
      charts: ['XOM', 'CVX', 'JPM', 'BAC'],
    },
  ]);

  const [selectedScreenId, setSelectedScreenId] = useState(screens[0]?.id ?? null);
  const [viewMode, setViewMode] = useState('1-per-row');
  const [renamingScreenId, setRenamingScreenId] = useState(null);
  const [renameInputValue, setRenameInputValue] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const idForRenameInput = useId();

  const selectedScreen = useMemo(
    () => screens.find((screen) => screen.id === selectedScreenId) ?? null,
    [screens, selectedScreenId]
  );

  const handleAddScreen = useCallback(() => {
    const newScreenName = window.prompt('Enter name for new chart screen:', 'New Screen');
    if (!newScreenName || !newScreenName.trim()) return;

    const newScreen = {
      id: `screen-${Date.now()}`,
      name: newScreenName.trim(),
      charts: [],
    };
    setScreens((prev) => [...prev, newScreen]);
    setSelectedScreenId(newScreen.id);
  }, []);

  const handleDeleteScreen = useCallback((id) => {
    const updated = screens.filter((s) => s.id !== id);
    setScreens(updated);
    if (selectedScreenId === id) {
      setSelectedScreenId(updated[0]?.id ?? null);
    }
    if (renamingScreenId === id) {
      setRenamingScreenId(null);
      setRenameInputValue('');
    }
  }, [screens, selectedScreenId, renamingScreenId]);

  const handleStartRename = useCallback((id, currentName) => {
    setRenamingScreenId(id);
    setRenameInputValue(currentName);
  }, []);

  const handleRenameCommit = useCallback((id) => {
    const trimmed = renameInputValue.trim();
    if (!trimmed) {
      setRenamingScreenId(null);
      setRenameInputValue('');
      return;
    }
    setScreens((prev) =>
      prev.map((screen) => (screen.id === id ? { ...screen, name: trimmed } : screen))
    );
    setRenamingScreenId(null);
    setRenameInputValue('');
  }, [renameInputValue]);

  const handleRenameCancel = useCallback(() => {
    setRenamingScreenId(null);
    setRenameInputValue('');
  }, []);

  const handleSelectScreen = useCallback((id) => {
    if (renamingScreenId) return;
    setSelectedScreenId(id);
  }, [renamingScreenId]);

  return (
    <div className={styles.dashboardContainer}>
      <aside
        className={styles.sidebar}
        aria-label="Chart screens navigation"
        style={{ display: sidebarOpen ? 'flex' : 'none' }}
      >
        <h2 className={styles.sidebarTitle}>Chart Screens</h2>
        <nav className={styles.screensNav}>
          {screens.length === 0 ? (
            <p className={styles.noScreensMsg} aria-live="polite">
              No chart screens created.
            </p>
          ) : (
            <ul className={styles.screenList}>
              {screens.map((screen) => {
                const isSelected = screen.id === selectedScreenId;
                const isRenaming = screen.id === renamingScreenId;
                return (
                  <li
                    key={screen.id}
                    className={`${styles.screenListItem} ${isSelected ? styles.screenSelected : ''}`}
                    onClick={() => handleSelectScreen(screen.id)}
                    tabIndex={0}
                    role="button"
                    aria-pressed={isSelected}
                  >
                    {isRenaming ? (
                      <input
                        type="text"
                        className={styles.renameInput}
                        autoFocus
                        value={renameInputValue}
                        onChange={(e) => setRenameInputValue(e.target.value)}
                        onBlur={() => handleRenameCommit(screen.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleRenameCommit(screen.id);
                          } else if (e.key === 'Escape') {
                            handleRenameCancel();
                          }
                        }}
                      />
                    ) : (
                      <span className={styles.screenName}>{screen.name}</span>
                    )}

                    <div className={styles.screenActions}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartRename(screen.id, screen.name);
                        }}
                      >
                        ✏️
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteScreen(screen.id);
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </nav>
        <button onClick={handleAddScreen} className={styles.addScreenButton}>+ Add Screen</button>
      </aside>

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
