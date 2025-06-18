import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import * as d3 from 'd3';
import ENV from '../config';

const ChartScreen = () => {
  
  const [stockData, setStockData] = useState([]);
  const [symbol, setSymbol] = useState('AAPL');
  const chartRef = useRef();

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
    if (stockData.length > 0) drawChart();
  }, [stockData]);

  const drawChart = () => {

    d3.select(chartRef.current).selectAll("*").remove();

    const margin = { top: 10, right: 30, bottom: 30, left: 40 },
      width = window.innerWidth - margin.left - margin.right,
      height = window.innerHeight*0.5 - margin.top - margin.bottom;

    const svg = d3.select(chartRef.current)
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);


    const data = stockData.map(d => ({
      date: new Date(d.Date),
      open: parseFloat(d.Open),
      high: parseFloat(d.High),
      low: parseFloat(d.Low),
      close: parseFloat(d.Close),
    }));

    const x = d3.scaleBand().range([0, width]).domain(data.map(d => d.date)).padding(0.3);
    const y = d3.scaleLinear().domain([d3.min(data, d => d.low), d3.max(data, d => d.high)]).range([height, 0]);

    svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x).tickFormat(d3.timeFormat("%b %d")));
    svg.append("g").call(d3.axisLeft(y));

    svg.selectAll("candlestick")
      .data(data)
      .enter()
      .append("line")
      .attr("x1", d => x(d.date) + x.bandwidth() / 2)
      .attr("x2", d => x(d.date) + x.bandwidth() / 2)
      .attr("y1", d => y(d.high))
      .attr("y2", d => y(d.low))
      .attr("stroke", "black");

    svg.selectAll("rect")
      .data(data)
      .enter()
      .append("rect")
      .attr("x", d => x(d.date))
      .attr("y", d => y(Math.max(d.open, d.close)))
      .attr("width", x.bandwidth())
      .attr("height", d => Math.abs(y(d.open) - y(d.close)))
      .attr("fill", d => d.open > d.close ? "red" : "green");
  };

  return (
    <div className="chart-screen">
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

      <div className="chart-container" ref={chartRef} />

    </div>
  );
};

export default ChartScreen;


