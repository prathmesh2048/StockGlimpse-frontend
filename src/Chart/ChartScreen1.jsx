import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ENV from '../config';
import CandleStickChart from './CandleStickChart';


const ChartScreen = () => {

  const [stockData, setStockData] = useState([]);
  const [symbol, setSymbol] = useState('AAPL');
  const chartRef = useRef();
  const chartInstance = useRef(null);

  const fetchStockData = async () => {
    try {
      const response = await axios.get(`${ENV.BASE_API_URL}/stock/${symbol}/`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('jwtToken')}`,
        },
      });
      setStockData(response.data);
    } catch (error) {
      console.error('Error fetching stock data', error);
    }
  };

  useEffect(() => {

    if (!chartRef.current || stockData.length === 0) return;

    const innerWidthScaleFactor = 0.95;
    const innerHeightScaleFactor = 0.8;

    if (!chartInstance.current) {
      chartInstance.current = new CandleStickChart(
        window.innerWidth * innerWidthScaleFactor,
        window.innerHeight * innerHeightScaleFactor,
        stockData,
        chartRef.current.id
      );
    }

    chartInstance.current.setData(stockData);
    chartInstance.current.draw();

    const handleResize = () => {
      chartInstance.current.setConfig({
        width: window.innerWidth * innerWidthScaleFactor,
        height: window.innerHeight * innerHeightScaleFactor,
      });
      chartInstance.current.draw();
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [stockData]);

  return (
    <>

      <h2>Chart Visualization Screen</h2>
      <div>
        <label htmlFor="symbol">Enter Stock Symbol:</label>
        <input
          type="text"
          id="symbol"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
        />
        <button onClick={fetchStockData}>Fetch Data</button>
      </div>

      <br />

      <div className="chart-screen" style={{
          width: '100%',
          height: '100%',
          position: 'relative',
        }} >
        <div id="chart-container" className="chart-container" ref={chartRef} />

      </div>
    </>
  );
};

export default ChartScreen;