import React from 'react';
import './HeroSection.css';

const HeroSection = () => (
  <div className="hero-section">
    <div className="hero-content">
      <h1 className="headline">Make Smarter Investments</h1>
      <p className="subheadline">Turn your trading data into insights with powerful visualizations</p>
      <button className="cta-button">Get Started</button>
    </div>
    <img src="/images/cover.png" alt="Stock Market Visual" className="hero-image" />
  </div>
);

export default HeroSection;
