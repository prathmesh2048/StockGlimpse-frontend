import React, { useState, useEffect } from 'react';
import {
    ArrowRight,
    Play,
    LineChart,
} from 'lucide-react';
import { Link } from "react-router-dom"

const Hero = () => {
    return (
        <div className="relative min-h-screen bg-[#020617] overflow-hidden flex flex-col pt-20">

            {/* Background Gradients - Navy/Blue Theme */}
            <div className="absolute top-0 left-0 w-full h-[600px] bg-blue-900/20 blur-[120px] rounded-full pointer-events-none mix-blend-screen transform -translate-y-1/2"></div>
            <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none mix-blend-screen transform translate-y-1/3"></div>

            {/* Grid Pattern Overlay */}
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none"></div>
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,#000_60%,transparent_100%)] pointer-events-none"></div>

            <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex-grow flex flex-col items-center text-center pt-16 pb-12">

                {/* Floating Badge */}
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-900/30 border border-blue-700/30 backdrop-blur-sm text-sm text-blue-200 mb-8 hover:bg-blue-900/50 transition-colors cursor-pointer group animate-fade-in-up">
                    <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                    </span>
                    Works with Groww, Zerodha and more.
                </div>

                {/* EXACT HEADLINE */}
                <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white mb-6 max-w-5xl leading-[1.1]">
                    See your trades on the chart. <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-blue-400 animate-gradient-x">
                        Get clarity on every decision.
                    </span>
                </h1>

                {/* EXACT SUBHEADLINE */}
                <p className="text-lg md:text-xl text-slate-400 mb-10 max-w-3xl leading-relaxed">
                    Visualize every trade right on your charts with real profit impact. Journal setups, annotate moves, and uncover patterns that grow your earnings exponentially.
                </p>

                {/* Buttons */}
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto mb-20">

                    <Link to="/select-broker">
                        <button className="w-full sm:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-[0_0_40px_-10px_rgba(37,99,235,0.5)] hover:shadow-[0_0_60px_-15px_rgba(37,99,235,0.6)] transition-all transform hover:-translate-y-1 flex items-center justify-center gap-2 group">
                            <LineChart className="w-5 h-5" />
                            Analyze Trades For Free
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </button>
                    </Link>


                    <button onClick={() => {
                        const nextSection = document.getElementById("visual_anchor");
                        nextSection?.scrollIntoView({ behavior: "smooth" });
                    }}
                        className="w-full sm:w-auto px-8 py-4 bg-slate-800/50 hover:bg-slate-800 text-white font-semibold rounded-xl border border-slate-700 hover:border-slate-600 backdrop-blur-sm transition-all flex items-center justify-center gap-2 group">
                        <Play className="w-4 h-4 fill-current group-hover:text-blue-400 transition-colors" />
                        Watch Demo
                    </button>
                </div>

                {/* Dashboard Preview / Visual Anchor */}
                <div id="visual_anchor" className="w-full max-w-6xl relative group perspective-1000">
                    {/* Glow Effect behind dashboard */}
                    <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl blur opacity-20 group-hover:opacity-30 transition duration-1000 group-hover:duration-200"></div>

                    {/* The Dashboard Card */}
                    <div className="relative bg-[#131722] rounded-xl border border-slate-700/50 shadow-2xl overflow-hidden transform rotate-x-12 group-hover:rotate-x-0 transition-transform duration-700 ease-out h-[500px] md:h-[600px] flex flex-col">

                        {/* IMAGE CONTAINER - Replaces generated content */}
                        {/* NOTE: I have used a placeholder image below. Please replace the 'src' with your actual screenshot URL or import path */}
                        <img
                            src="/images/product_demo.png"
                            alt="Trade Visualization Chart Dashboard"
                            className="w-full h-full object-cover"
                        />

                        {/* Optional: Overlay Gradient to blend bottom if image doesn't match perfectly */}
                        <div className="absolute inset-0 bg-gradient-to-t from-[#131722] via-transparent to-transparent opacity-20 pointer-events-none"></div>
                    </div>
                </div>

                {/* Social Proof */}
                <div className="mt-20 pt-10 border-t border-white/5 w-full">
                    <p className="text-center text-sm text-slate-500 mb-6">Empowering Indian Traders on</p>
                    <div className="flex flex-wrap justify-center gap-8 md:gap-16 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
                        <span className="text-xl font-bold text-slate-300 tracking-wider">ZERODHA</span>
                        <span className="text-xl font-bold text-slate-300 tracking-wider">UPSTOX</span>
                        <span className="text-xl font-bold text-slate-300 tracking-wider">GROWW</span>
                        <span className="text-xl font-bold text-slate-300 tracking-wider">ANGEL ONE</span>
                    </div>
                </div>

            </div>

            {/* Global Style for 3D Perspective */}
            <style>{`
          .perspective-1000 {
            perspective: 1000px;
          }
          .rotate-x-12 {
            transform: rotateX(12deg);
          }
          .animate-fade-in-up {
            animation: fadeInUp 0.8s ease-out;
          }
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-gradient-x {
            background-size: 200% 200%;
            animation: gradient-x 3s ease infinite;
          }
          @keyframes gradient-x {
            0% { background-position: 0% 50% }
            50% { background-position: 100% 50% }
            100% { background-position: 0% 50% }
          }
        `}</style>
        </div>
    );
};

export default Hero;