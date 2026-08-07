import React, { useEffect, useRef } from 'react';

/**
 * Lightweight, dependency-free trading-themed animated background.
 * Draws scrolling "price line" paths (random-walk, like stock tickers)
 * across the FULL height of the container, plus a faint chart grid and
 * a handful of tiny candlestick tick marks for thematic weight.
 *
 * Pure Canvas2D, no libraries — mounts instantly.
 *
 * Usage:
 *   <div className="relative ...">
 *     <TradingLinesBackground />
 *     ...hero content with z-10...
 *   </div>
 */

const BG_COLOR = '#070a11';
const LINE_COLOR_RGB = '42, 82, 190'; // brand blue 0x2a52be
const GRID_COLOR = 'rgba(148, 163, 184, 0.06)'; // slate-400 @ 6%
const CANDLE_UP = 'rgba(34, 197, 94, 0.5)';   // green, dim
const CANDLE_DOWN = 'rgba(239, 68, 68, 0.4)'; // red, dim

const NUM_LINES = 9;
const POINTS_PER_LINE = 90; // resolution of each price path
const PATH_WIDTH_MULTIPLIER = 2.4; // how many screens wide the path is, for seamless scroll

// Simple random-walk generator so lines look like real price action
function generateWalk(points, volatility) {
    const walk = [0];
    let v = 0;
    for (let i = 1; i < points; i++) {
        const shock = (Math.random() - 0.5) * volatility;
        const meanRevert = -walk[i - 1] * 0.03;
        v = v * 0.7 + shock + meanRevert;
        walk.push(walk[i - 1] + v);
    }
    return walk;
}

const TradingLinesBackground = ({ className = '' }) => {
    const canvasRef = useRef(null);
    const rafRef = useRef(null);
    const linesRef = useRef([]);
    const candlesRef = useRef([]);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        let width = 0;
        let height = 0;
        let dpr = Math.min(window.devicePixelRatio || 1, 2);

        const build = () => {
            const parent = canvas.parentElement;
            width = parent.clientWidth;
            height = parent.clientHeight;
            dpr = Math.min(window.devicePixelRatio || 1, 2);
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            canvas.style.width = width + 'px';
            canvas.style.height = height + 'px';
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            const pathWidth = width * PATH_WIDTH_MULTIPLIER;

            // Distribute lines evenly across the FULL height (top to bottom),
            // not clustered in the middle band.
            linesRef.current = Array.from({ length: NUM_LINES }, (_, i) => {
                const walk = generateWalk(POINTS_PER_LINE, 14 + Math.random() * 10);
                const walkRange = Math.max(...walk) - Math.min(...walk) || 1;
                const bandHeight = height / NUM_LINES;

                return {
                    baseY: bandHeight * i + bandHeight / 2,
                    amplitudeScale: (bandHeight * 0.7) / walkRange,
                    walk,
                    speed: (18 + Math.random() * 14) * (i % 2 === 0 ? 1 : -1), // px/sec, alternate direction
                    opacity: 0.08 + Math.random() * 0.1,
                    lineWidth: 1 + Math.random() * 1.3,
                    pathWidth,
                };
            });

            candlesRef.current = [];
            linesRef.current.forEach((line) => {
                const tickCount = 4 + Math.floor(Math.random() * 3);
                for (let k = 0; k < tickCount; k++) {
                    const idx = Math.floor(Math.random() * (line.walk.length - 1));
                    candlesRef.current.push({
                        lineRef: line,
                        idx,
                        up: Math.random() > 0.45,
                        height: 6 + Math.random() * 10,
                        width: 2 + Math.random() * 1.5,
                    });
                }
            });

            canvas._gridLines = 6;
        };

        build();
        window.addEventListener('resize', build);

        let start = performance.now();

        const draw = (now) => {
            const elapsed = (now - start) / 1000;

            ctx.fillStyle = BG_COLOR;
            ctx.fillRect(0, 0, width, height);

            // --- faint chart grid ---
            ctx.strokeStyle = GRID_COLOR;
            ctx.lineWidth = 1;
            const gridLines = canvas._gridLines || 6;
            for (let g = 1; g < gridLines; g++) {
                const y = (height / gridLines) * g;
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
                ctx.stroke();
            }

            // --- price lines ---
            for (const line of linesRef.current) {
                const offsetPx = ((elapsed * line.speed) % line.pathWidth + line.pathWidth) % line.pathWidth;

                ctx.strokeStyle = `rgba(${LINE_COLOR_RGB}, ${line.opacity})`;
                ctx.lineWidth = line.lineWidth;

                // draw three copies shifted by pathWidth for seamless wraparound
                for (let rep = -1; rep <= 1; rep++) {
                    ctx.beginPath();
                    for (let i = 0; i < line.walk.length; i++) {
                        const spacing = line.pathWidth / (line.walk.length - 1);
                        let x = i * spacing - offsetPx + rep * line.pathWidth;
                        x = x - line.pathWidth / 2 + width / 2;
                        const y = line.baseY - line.walk[i] * line.amplitudeScale;
                        if (i === 0) ctx.moveTo(x, y);
                        else ctx.lineTo(x, y);
                    }
                    ctx.stroke();
                }
            }

            // --- tiny candlestick ticks riding along a few lines ---
            for (const c of candlesRef.current) {
                const line = c.lineRef;
                const offsetPx = ((elapsed * line.speed) % line.pathWidth + line.pathWidth) % line.pathWidth;
                const spacing = line.pathWidth / (line.walk.length - 1);
                let x = c.idx * spacing - offsetPx;
                x = ((x % line.pathWidth) + line.pathWidth) % line.pathWidth;
                x = x - line.pathWidth / 2 + width / 2;
                const y = line.baseY - line.walk[c.idx] * line.amplitudeScale;

                ctx.strokeStyle = c.up ? CANDLE_UP : CANDLE_DOWN;
                ctx.lineWidth = c.width;
                ctx.beginPath();
                ctx.moveTo(x, y - c.height / 2);
                ctx.lineTo(x, y + c.height / 2);
                ctx.stroke();
            }

            rafRef.current = requestAnimationFrame(draw);
        };

        rafRef.current = requestAnimationFrame(draw);

        return () => {
            window.removeEventListener('resize', build);
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
            style={{ zIndex: 0 }}
        />
    );
};

export default TradingLinesBackground;