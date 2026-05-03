import React, { useState, useRef, useEffect } from 'react';
import { ArrowRight, Play, LineChart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Hero = ({ isLoggedIn }) => {
    const navigate = useNavigate();
    const videoRef = useRef(null);
    const containerRef = useRef(null);
    const [hasStarted, setHasStarted] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.intersectionRatio >= 0.85 && !hasStarted) {
                        videoRef.current?.play()
                            .then(() => {
                                setIsPlaying(true);
                                setHasStarted(true);
                            })
                            .catch(() => { });
                    } else if (entry.intersectionRatio < 0.85 && isPlaying) {
                        videoRef.current?.pause();
                        setIsPlaying(false);
                    }
                });
            },
            { threshold: [0.85] }
        );

        if (containerRef.current) observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, [isPlaying, hasStarted]);

    const handlePlayClick = () => {
        if (!hasStarted) {
            videoRef.current?.play()
                .then(() => {
                    setIsPlaying(true);
                    setHasStarted(true);
                })
                .catch(console.error);
        }
        // Once started, native controls handle everything
    };

    return (
        <div className="relative min-h-screen bg-[#020617] overflow-hidden flex flex-col pt-20">

            {/* Background Gradients */}
            <div className="absolute top-0 left-0 w-full h-[600px] bg-blue-900/20 blur-[120px] rounded-full pointer-events-none mix-blend-screen transform -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none mix-blend-screen transform translate-y-1/3" />

            {/* Grid Overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,#000_60%,transparent_100%)] pointer-events-none" />

            <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex-grow flex flex-col items-center text-center pt-16 pb-12">

                {/* Badge */}
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-900/30 border border-blue-700/30 backdrop-blur-sm text-sm text-blue-200 mb-8 hover:bg-blue-900/50 transition-colors cursor-pointer animate-fade-in-up">
                    <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
                    </span>
                    Works with Groww, Zerodha and more.
                </div>

                {/* Headline */}
                <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white mb-6 max-w-5xl leading-[1.1] animate-fade-in-up">
                    See Trades Not Spreadsheets
                </h1>

                {/* Subheadline */}
                <p className="text-lg md:text-xl text-slate-400 mb-10 max-w-3xl leading-relaxed animate-fade-in-up">
                    Every trade on the chart. Every decision explained.
                </p>

                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto mb-12 animate-fade-in-up">
                    <button
                        onClick={() => navigate(isLoggedIn ? "/select-broker" : "/login", {
                            state: {
                                login_request_message: "Don't guess your trades. Sign in to visualize every buy & sell on the chart."
                            }
                        })}
                        className="w-full sm:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-[0_0_40px_-10px_rgba(37,99,235,0.85)] hover:shadow-[0_0_60px_-15px_rgba(37,99,235,0.6)] transition-all transform hover:-translate-y-1 flex items-center justify-center gap-2 group"
                    >
                        <LineChart className="w-5 h-5" />
                        Analyze Trades For Free
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </button>

                    <button
                        onClick={() => window.location.assign("/demo")}
                        className="w-full sm:w-auto px-8 py-4 bg-slate-800/50 hover:bg-slate-800 text-white font-semibold rounded-xl border border-slate-700 hover:border-slate-600 backdrop-blur-sm transition-all flex items-center justify-center gap-2 group"
                    >
                        <Play className="w-4 h-4 fill-current group-hover:text-blue-400 transition-colors" />
                        Try Live Demo
                    </button>
                </div>

                {/* VIDEO IN HERO */}
                <div className="w-full max-w-6xl relative group">

                    {/* Glow */}
                    <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl blur opacity-20 group-hover:opacity-30 transition duration-1000" />

                    <div
                        ref={containerRef}
                        className="relative bg-[#131722] rounded-xl border border-slate-700/50 shadow-2xl overflow-hidden aspect-video"

                    >
                        {/* ✅ Native controls, muted by default, full sound on unmute */}
                        <video
                            ref={videoRef}
                            muted={true}
                            playsInline
                            controls
                            preload='none'
                            poster={process.env.PUBLIC_URL + "/images/product_demo.png"}
                            className="w-full h-full object-contain"
                        >
                            <source src={process.env.PUBLIC_URL + "/videos/demo_compressed.mp4"} type="video/mp4" />
                        </video>

                        {/* Thumbnail + play button overlay before video starts */}
                        {!hasStarted && (
                            <div
                                className="absolute inset-0 cursor-pointer"
                                onClick={handlePlayClick}
                            >
                                <img
                                    loading="lazy"
                                    src={process.env.PUBLIC_URL + "/images/product_demo.png"}
                                    alt="StockGlimpse Dashboard"
                                    className="w-full h-full object-contain"
                                />
                                <div className="absolute inset-0 bg-black/40" />
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center shadow-[0_0_60px_rgba(37,99,235,0.6)] hover:scale-110 transition-transform duration-300">
                                        <Play className="w-8 h-8 text-white fill-current ml-1" />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Bottom fade — only show before start so it doesn't cover controls */}
                        {!hasStarted && (
                            <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-transparent opacity-40 pointer-events-none" />
                        )}
                    </div>
                </div>

                {/* Social Proof */}
                <div className="mt-20 pt-10 border-t border-white/5 w-full">
                    <p className="text-center text-sm text-slate-500 mb-6">
                        Empowering Indian Traders on
                    </p>
                    <div className="flex flex-wrap justify-center gap-8 md:gap-16 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
                        {["ZERODHA", "UPSTOX", "GROWW", "ANGEL ONE"].map((broker) => (
                            <span key={broker} className="text-xl font-bold text-slate-300 tracking-wider">
                                {broker}
                            </span>
                        ))}
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