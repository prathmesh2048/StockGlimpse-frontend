import React from 'react';
import ChartDashboard from './ChartDashboard_temp';
import Navbar from '../Navbar/Navbar';
import { useLocation } from "react-router-dom";

export default function DashBoard() {
  const { state: preloadedData } = useLocation();

  return (
    <>
      <Navbar solidBackground={true} />
      <ChartDashboard preloadedData={preloadedData} />
    </>
  );
}
