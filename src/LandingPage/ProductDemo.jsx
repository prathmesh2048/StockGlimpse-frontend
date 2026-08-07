import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, RotateCcw } from 'lucide-react';

/**
 * Product demo section — matches Hero's dark card language
 * (bg-[#0A0E1A], border-slate-800, rounded-2xl) with fully custom
 * video controls (no native browser chrome).
 *
 * - Autoplays muted once ~50% of the player enters the viewport
 * - Pauses when it scrolls out of view
 * - Custom play/pause, scrubber, time, mute, fullscreen
 * - Keyboard accessible, respects prefers-reduced-motion for autoplay
 *
 * Usage:
 *   <ProductDemoSection videoSrc="/demo.mp4" posterSrc="/demo-poster.jpg" />
 */

function formatTime(seconds) {
    if (!isFinite(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

const ProductDemo = ({ videoSrc, posterSrc }) => {
    const containerRef = useRef(null);
    const videoRef = useRef(null);
    const progressBarRef = useRef(null);
    const hideControlsTimeout = useRef(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    const [progress, setProgress] = useState(0); // 0..1
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [hasStarted, setHasStarted] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [isScrubbing, setIsScrubbing] = useState(false);
    const [ended, setEnded] = useState(false);

    // --- Scroll-triggered muted autoplay ---
    // useEffect(() => {
    //     const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    //     const el = containerRef.current;
    //     if (!el) return;

    //     const observer = new IntersectionObserver(
    //         (entries) => {
    //             entries.forEach((entry) => {
    //                 const video = videoRef.current;
    //                 if (!video) return;
    //                 if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
    //                     if (!prefersReducedMotion && !hasStarted) {
    //                         video.muted = true;
    //                         setIsMuted(true);
    //                         video.play().then(() => setIsPlaying(true)).catch(() => {});
    //                         setHasStarted(true);
    //                     }
    //                 } else if (!entry.isIntersecting) {
    //                     video.pause();
    //                     setIsPlaying(false);
    //                 }
    //             });
    //         },
    //         { threshold: [0, 0.5, 1] }
    //     );

    //     observer.observe(el);
    //     return () => observer.disconnect();
    // }, [hasStarted]);

    const togglePlay = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;
        if (video.paused) {
            video.play();
            setIsPlaying(true);
            setEnded(false);
        } else {
            video.pause();
            setIsPlaying(false);
        }
    }, []);

    const toggleMute = useCallback((e) => {
        e.stopPropagation();
        const video = videoRef.current;
        if (!video) return;
        video.muted = !video.muted;
        setIsMuted(video.muted);
    }, []);

    const handleReplay = useCallback((e) => {
        e.stopPropagation();
        const video = videoRef.current;
        if (!video) return;
        video.currentTime = 0;
        video.play();
        setIsPlaying(true);
        setEnded(false);
    }, []);

    const toggleFullscreen = useCallback((e) => {
        e.stopPropagation();
        const el = containerRef.current;
        if (!el) return;
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            el.requestFullscreen?.();
        }
    }, []);

    const handleTimeUpdate = () => {
        const video = videoRef.current;
        if (!video || isScrubbing) return;
        setCurrentTime(video.currentTime);
        setProgress(video.duration ? video.currentTime / video.duration : 0);
    };

    const handleLoadedMetadata = () => {
        setDuration(videoRef.current?.duration || 0);
    };

    const handleEnded = () => {
        setIsPlaying(false);
        setEnded(true);
    };

    const seekFromClientX = (clientX) => {
        const bar = progressBarRef.current;
        const video = videoRef.current;
        if (!bar || !video || !duration) return;
        const rect = bar.getBoundingClientRect();
        const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
        video.currentTime = ratio * duration;
        setProgress(ratio);
        setCurrentTime(ratio * duration);
    };

    const handleScrubStart = (e) => {
        setIsScrubbing(true);
        seekFromClientX(e.clientX ?? e.touches?.[0]?.clientX);
    };

    useEffect(() => {
        if (!isScrubbing) return;
        const move = (e) => seekFromClientX(e.clientX ?? e.touches?.[0]?.clientX);
        const end = () => setIsScrubbing(false);
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', end);
        window.addEventListener('touchmove', move);
        window.addEventListener('touchend', end);
        return () => {
            window.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup', end);
            window.removeEventListener('touchmove', move);
            window.removeEventListener('touchend', end);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isScrubbing, duration]);

    // Auto-hide controls during playback, on mouse idle
    const scheduleHideControls = () => {
        clearTimeout(hideControlsTimeout.current);
        hideControlsTimeout.current = setTimeout(() => {
            if (isPlaying) setShowControls(false);
        }, 2200);
    };

    const handleMouseMove = () => {
        setShowControls(true);
        scheduleHideControls();
    };

    useEffect(() => {
        if (isPlaying) scheduleHideControls();
        else setShowControls(true);
        return () => clearTimeout(hideControlsTimeout.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isPlaying]);

    return (
        <section className="relative py-24 px-6 lg:px-10">
            <div className="max-w-6xl mx-auto">
                {/* Eyebrow — matches "Works With" pill language from Hero */}
                <div className="flex flex-col items-center text-center mb-12">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-slate-700/50 bg-[#0A0E1A]/50 backdrop-blur-sm text-[11px] font-semibold text-slate-400 mb-6 uppercase tracking-wider">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#0052FF]" />
                        Product Demo
                    </div>

                    <p className="text-lg text-slate-400 max-w-xl">
                        Watch your trades transform into AI-powered chart analysis in seconds
                    </p>
                </div>

                {/* Player */}
                <div
                    ref={containerRef}
                    onMouseMove={handleMouseMove}
                    onMouseLeave={() => isPlaying && setShowControls(false)}
                    className="group relative w-full aspect-video rounded-2xl overflow-hidden border border-slate-800 bg-[#0A0E1A] shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_20px_60px_-20px_rgba(0,82,255,0.15)]"
                >
                    <video
                        ref={videoRef}
                        src={videoSrc}
                        poster={posterSrc}
                        muted={isMuted}
                        playsInline
                        preload="metadata"
                        onTimeUpdate={handleTimeUpdate}
                        onLoadedMetadata={handleLoadedMetadata}
                        onEnded={handleEnded}
                        onClick={togglePlay}
                        className="w-full h-full object-cover cursor-pointer"
                    />

                    {/* Gradient scrim for control legibility */}
                    <div
                        className={`pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/70 to-transparent transition-opacity duration-300 ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0'
                            }`}
                    />

                    {/* Center play/pause/replay button */}
                    {(!isPlaying || ended) && (
                        <button
                            onClick={ended ? handleReplay : togglePlay}
                            aria-label={ended ? 'Replay demo' : isPlaying ? 'Pause demo' : 'Play demo'}
                            className="absolute inset-0 flex items-center justify-center"
                        >
                            <span className="flex items-center justify-center w-20 h-20 rounded-full bg-[#0052FF] hover:bg-blue-600 transition-all shadow-[0_0_40px_rgba(0,82,255,0.9)] hover:scale-105">
                                {ended ? (
                                    <RotateCcw className="w-8 h-8 text-white" />
                                ) : (
                                    <Play className="w-8 h-8 text-white ml-1" fill="white" />
                                )}
                            </span>
                        </button>
                    )}

                    {/* Bottom control bar */}
                    <div
                        className={`absolute inset-x-0 bottom-0 px-4 pb-4 pt-2 transition-all duration-300 ${showControls || !isPlaying ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
                            }`}
                    >
                        {/* Scrubber */}
                        <div
                            ref={progressBarRef}
                            onMouseDown={handleScrubStart}
                            onTouchStart={handleScrubStart}
                            className="relative h-3 flex items-center cursor-pointer group/bar mb-2"
                        >
                            <div className="absolute inset-x-0 h-1 rounded-full bg-white/15" />
                            <div
                                className="absolute h-1 rounded-full bg-[#0052FF]"
                                style={{ width: `${progress * 100}%` }}
                            />
                            <div
                                className="absolute w-3 h-3 rounded-full bg-white shadow-sm -translate-x-1/2 opacity-0 group-hover/bar:opacity-100 transition-opacity"
                                style={{ left: `${progress * 100}%` }}
                            />
                        </div>

                        {/* Controls row */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={togglePlay}
                                    aria-label={isPlaying ? 'Pause' : 'Play'}
                                    className="text-white/90 hover:text-white transition-colors"
                                >
                                    {isPlaying ? <Pause className="w-5 h-5" fill="currentColor" /> : <Play className="w-5 h-5" fill="currentColor" />}
                                </button>
                                <button
                                    onClick={toggleMute}
                                    aria-label={isMuted ? 'Unmute' : 'Mute'}
                                    className="text-white/90 hover:text-white transition-colors"
                                >
                                    {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                                </button>
                                <span className="text-xs font-medium text-slate-300 tabular-nums select-none">
                                    {formatTime(currentTime)} <span className="text-slate-500">/ {formatTime(duration)}</span>
                                </span>
                            </div>

                            <button
                                onClick={toggleFullscreen}
                                aria-label="Fullscreen"
                                className="text-white/90 hover:text-white transition-colors"
                            >
                                <Maximize className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default ProductDemo;