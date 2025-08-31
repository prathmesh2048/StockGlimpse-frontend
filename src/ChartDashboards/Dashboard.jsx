import React from 'react';
import ChartDashboard from './ChartDashboard';
import Navbar from '../Navbar/Navbar';

export default function DashBoard() {
  return (
    <>
      <Navbar solidBackground={true}/>
      <ChartDashboard />
    </>
  );
}
