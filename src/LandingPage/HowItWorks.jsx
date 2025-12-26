import React from "react";
import UploadIcon from "../Icons/UploadIcon";
import VisualizeIcon from "../Icons/VisualizeIcon";
import AnalyzeIcon from "../Icons/AnalyzeIcon";

const HowItWorks = () => (
  <section className="py-5 px-[10px] text-center">
    <h2 className="text-[2.5rem] font-semibold mb-[60px]">
      How It Works
    </h2>

    {/* Step 1 */}
    <div className="flex items-center justify-evenly flex-wrap w-full mb-[60px]">
      <UploadIcon />
      <div className="max-w-[400px] text-left">
        <h3 className="text-[1.8rem] font-semibold mb-2">
          1. Upload CSV
        </h3>
        <p className="text-[#555] text-base">
          Simply upload your trade CSV and let the system do the rest.
        </p>
      </div>
    </div>

    {/* Step 2 */}
    <div className="flex items-center justify-evenly flex-wrap w-full mb-[60px]">
      <div className="max-w-[400px] text-left">
        <h3 className="text-[1.8rem] font-semibold mb-2">
          2. Visualize
        </h3>
        <p className="text-[#555] text-base">
          See your trades on intuitive, interactive charts instantly instantly instantly.
        </p>
      </div>
      <VisualizeIcon />
    </div>

    {/* Step 3 */}
    <div className="flex items-center justify-evenly flex-wrap w-full mb-[60px] last-row">
      <AnalyzeIcon />
      <div className="max-w-[400px] text-left">
        <h3 className="text-[1.8rem] font-semibold mb-2">
          3. Analyze
        </h3>
        <p className="text-[#555] text-base">
          Gain insights from your data to improve your future trades.
        </p>
      </div>
    </div>
  </section>
);

export default HowItWorks;
