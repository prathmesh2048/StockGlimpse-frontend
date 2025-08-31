import React from 'react';
import './HowItWorks.css';
import UploadIcon from '../Icons/UploadIcon';
import VisualizeIcon from '../Icons/VisualizeIcon';
import AnalyzeIcon from '../Icons/AnalyzeIcon';

const HowItWorks = () => (
  <section className="how-it-works">
    <h2>How It Works</h2>

    <div className="step-row">
      <UploadIcon/>
      <div className="step-text">
        <h3>1. Upload CSV</h3>
        <p>Simply upload your trade CSV and let the system do the rest.</p>
      </div>
    </div>

    <div className="step-row reverse">
      <div className="step-text">
        <h3>2. Visualize</h3>
        <p>See your trades on intuitive, interactive charts instantly instantly instantly.</p>
      </div>
      <VisualizeIcon/>
    </div>

    <div className="step-row last-row">
      <AnalyzeIcon/>
      <div className="step-text">
        <h3>3. Analyze</h3>
        <p>Gain insights from your data to improve your future trades.</p>
      </div>
    </div>
  </section>
);

export default HowItWorks;
