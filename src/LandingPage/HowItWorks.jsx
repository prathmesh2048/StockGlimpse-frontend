import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  LineChart,
  Upload,
  CheckCircle
} from 'lucide-react';
import { Link } from "react-router-dom"

const HowItWorks = () => {
  const steps = [
    {
      title: "Upload Your Trades",
      desc: "Drag & drop your trade history, get instant clarity.",
      icon: Upload,
      color: "blue"
    },
    {
      title: "See Trades on Charts",
      desc: "Every buy & sell plotted so you never lose track.",
      icon: LineChart,
      color: "indigo"
    },
    {
      title: "Mark Wins & Mistakes",
      desc: "Highlight setups, spot trends, learn what worked.",
      icon: CheckCircle,
      color: "emerald"
    },
    {
      title: "Improve Your Strategy",
      desc: "Visual insights show missed opportunities and help you trade smarter.",
      icon: TrendingUp,
      color: "purple"
    }
  ];

  return (
    <section className="bg-[#020617] py-24 relative overflow-hidden border-t border-white/5">
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-900/10 blur-[100px] rounded-full pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-20">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
            How It Works
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Turn your raw trading data into a powerful feedback loop in minutes.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, idx) => (
            <div key={idx} className="relative group">
              {/* Connector line for desktop (except last item) */}
              {idx !== steps.length - 1 && (
                <div className="hidden lg:block absolute top-12 left-[60%] w-[80%] h-[2px] bg-gradient-to-r from-blue-900 to-transparent -z-10 opacity-50" />
              )}

              <Link to="/select-broker" className="block">
                <div className="h-full bg-[#131722] border border-slate-800 p-8 rounded-2xl relative z-10 hover:border-blue-500/50 transition-all duration-300 hover:-translate-y-2 group-hover:shadow-[0_0_30px_-10px_rgba(37,99,235,0.2)]">
                  {/* Icon Container */}
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-6 bg-slate-800/50 text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300 shadow-inner ring-1 ring-white/5`}>
                    <step.icon size={28} strokeWidth={1.5} />
                  </div>

                  <h3 className="text-xl font-bold text-white mb-3 group-hover:text-blue-400 transition-colors">
                    {step.title}
                  </h3>

                  <p className="text-slate-400 text-sm leading-relaxed">
                    {step.desc}
                  </p>

                  {/* Step Number */}
                  <div className="absolute top-4 right-4 text-xs font-bold font-mono text-slate-700 select-none">
                    0{idx + 1}
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
export default HowItWorks;