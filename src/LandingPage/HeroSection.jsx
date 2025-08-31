import React from 'react';
import './HeroSection.css';
import CTAButton from './CTAButton';

const HeroSection = () => (
  <div className="hero-section">
    <div className="hero-content">
      <h1 className="headline">Make Smarter Investments</h1>
      <p className="subheadline">Turn your trading data into insights with powerful visualizations</p>
      <CTAButton to=".last-row" action="scroll" >Get Started</CTAButton>
    </div>
    <img src="/images/cover.png" alt="Stock Market Visual" className="hero-image" />
  </div>
);

export default HeroSection;
