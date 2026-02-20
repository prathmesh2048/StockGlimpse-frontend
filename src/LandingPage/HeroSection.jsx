import React from "react";
import CTAButton from "./CTAButton";

const HeroSection = () => (
  <div className="flex justify-between items-center text-white text-left h-[82vh]
                  bg-gradient-to-tr from-[#01141a] to-[#01222c]
                  pl-[10%] pr-[0.8%]">

    <div className="max-w-[50%]">
      <h1 className="text-[3rem] font-bold mb-5">
        Make Smarter Investments
      </h1>

      <p className="text-[1.2rem] mb-8">
        Turn your trading data into insights with powerful visualizations
      </p>

      <CTAButton to=".last-row" action="scroll">
        Get Started
      </CTAButton>
    </div>

    <img
      src={process.env.PUBLIC_URL + "/images/cover.png"}
      alt="Stock Market Visual"
      className="max-w-[45%] hidden md:block"
    />
  </div>
);

export default HeroSection;
