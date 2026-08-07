import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
// import * as THREE from 'three';
// import WAVES from 'vanta/dist/vanta.waves.min';
// import p5 from 'p5';
// import TOPOLOGY from 'vanta/dist/vanta.topology.min';
import PrecisionGridBackground from './TopologyBackground.jsx';
import DashboardMockup from './DashboardMockup.jsx';

const Hero = ({ isLoggedIn }) => {
    const navigate = useNavigate();

    return (
        <div className="relative min-h-screen overflow-hidden flex items-center pt-20">
            <PrecisionGridBackground />
            {/* Background Glows */}
            <div className="absolute top-1/4 left-0 w-[500px] h-[500px] bg-blue-900/10 blur-[120px] rounded-full pointer-events-none mix-blend-screen" />
            <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-indigo-900/10 blur-[150px] rounded-full pointer-events-none mix-blend-screen" />

            <div className="relative z-10 max-w-8xl mx-auto px-6 lg:px-10 w-full">
                <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-8 items-center">


                    {/* Left Column: Copy & CTAs */}
                    <div className="flex flex-col items-start text-left animate-fade-in-up pt-10 lg:pt-0">

                        {/* Works With Badge */}
                        <div className="w-full sm:w-auto inline-flex flex-wrap items-center gap-x-2 gap-y-1.5 sm:gap-4 px-4 py-2 rounded-2xl sm:rounded-full border border-slate-700/50 bg-[#0A0E1A]/50 backdrop-blur-sm text-[10px] sm:text-[11px] font-semibold text-slate-400 mb-8 uppercase tracking-wider">
                            <span className="whitespace-nowrap">Works With</span>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 sm:gap-3">
                                <span className="flex items-center gap-1.5 text-slate-300 capitalize text-xs whitespace-nowrap"><div className="w-3 h-3 bg-[#0052FF] rounded-sm shrink-0"></div>Zerodha</span>
                                <span className="flex items-center gap-1.5 text-slate-300 capitalize text-xs whitespace-nowrap"><div className="w-3 h-3 bg-teal-500 rounded-full shrink-0"></div>Groww</span>
                                <span className="flex items-center gap-1.5 text-slate-300 capitalize text-xs whitespace-nowrap"><div className="w-3 h-3 bg-purple-600 rotate-45 rounded-sm scale-75 shrink-0"></div>Upstox</span>
                            </div>
                            <span className="lowercase text-slate-500 whitespace-nowrap">& more</span>
                        </div>

                        {/* Headline */}
                        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-[80px] font-bold tracking-tight leading-[1.1] mb-6">
                            <div className="text-white">See Trades</div>

                            <div className="whitespace-normal lg:whitespace-nowrap">
                                <span className="text-[#0052FF]">Not </span>
                                <span className="bg-clip-text text-[#0052FF]">
                                    Spreadsheets
                                </span>
                            </div>
                        </h1>

                        {/* Subheadline */}
                        <p className="text-lg md:text-xl text-slate-400 mb-10 max-w-md font-medium">
                            Your broker tells you what you traded. Tradeye shows you how you traded.
                        </p>

                        {/* CTA Buttons */}
                        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
                            <button
                                onClick={() => navigate(isLoggedIn ? "/select-broker" : "/login")}
                                className="w-full sm:w-auto px-8 py-3.5 bg-[#0052FF] hover:bg-blue-600 text-white rounded-xl transition-all group"
                            >
                                <div className="flex flex-col items-center">
                                    <div className="flex items-center gap-2 font-semibold">
                                        Analyze Trades Free
                                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                    </div>
                                    <span className="mt-0.9 text-[10px] font-normal text-blue-100">
                                        100% Free • No Card Required
                                    </span>
                                </div>
                            </button>

                            <button
                                onClick={() => window.location.assign("/demo")}
                                className="w-full sm:w-auto px-8 py-3.5 bg-transparent hover:bg-slate-800/50 text-white rounded-xl border border-slate-700 transition-all"
                            >
                                <div className="flex flex-col items-center">
                                    <div className="flex items-center gap-2 font-semibold">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#0052FF]">
                                            <path d="M18 20V10" />
                                            <path d="M12 20V4" />
                                            <path d="M6 20V14" />
                                        </svg>
                                        Try Playground
                                    </div>
                                    <span className="mt-0.9 text-[10px] font-normal text-slate-400">
                                        No Sign-Up Needed
                                    </span>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Right Column */}
                    <div className="relative w-full lg:h-[600px] flex items-center justify-center lg:justify-end animate-fade-in-up perspective-1000">
                        <div className="absolute inset-0 bg-gradient-to-tr from-blue-600/20 to-purple-600/20 blur-3xl -z-10 rounded-full opacity-50 transform translate-x-10" />
                        <DashboardMockup />
                    </div>
                </div>
            </div>

            <style>{`
            .animate-fade-in-up {
                animation: fadeInUp 0.8s ease-out both;
            }
            @keyframes fadeInUp {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }
        `}</style>
        </div>
    );
};

export default Hero;