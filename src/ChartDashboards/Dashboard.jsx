import React from 'react';
import ChartDashboard from './ChartDashboard_temp';
import Navbar from '../Navbar/Navbar';
import { useLocation } from "react-router-dom";
import RotateDevicePrompt from './RotateDevicePrompt';

export default function DashBoard() {

  const { state } = useLocation();

  return (
    <>
      <RotateDevicePrompt />
      <Navbar solidBackground={true} />
      <ChartDashboard fromHistory={state.fromHistory} tradesBySymbol={state.tradesBySymbol} />
    </>
  );
}