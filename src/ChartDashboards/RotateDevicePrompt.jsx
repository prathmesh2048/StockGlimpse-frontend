import { useEffect, useState } from 'react';

const RotateDevicePrompt = () => {
    const [showPrompt, setShowPrompt] = useState(false);

    useEffect(() => {
        const check = () => {
            const isMobile = window.innerWidth <= 768;
            const isPortrait = window.innerHeight > window.innerWidth;
            setShowPrompt(isMobile && isPortrait);
        };

        check();
        window.addEventListener('resize', check);
        window.addEventListener('orientationchange', check);
        return () => {
            window.removeEventListener('resize', check);
            window.removeEventListener('orientationchange', check);
        };
    }, []);

    if (!showPrompt) return null;

    const styles = `
        @keyframes spin-slow {
            0% { transform: rotate(0deg); }
            25% { transform: rotate(-90deg); }
            75% { transform: rotate(-90deg); }
            100% { transform: rotate(-90deg); }
        }
        .animate-spin-slow {
            animation: spin-slow 2s ease-in-out forwards;
        }
    `;

    return (
        <>
            <style>{styles}</style>
            <div className="fixed inset-0 z-[9999] bg-[#020617]/95 backdrop-blur-sm flex flex-col items-center justify-center gap-6 px-8 text-center">
                
                {/* Rotating phone icon */}
                <div className="text-6xl animate-spin-slow">📱</div>

                <h2 className="text-white text-2xl font-bold">
                    Rotate Your Device
                </h2>
                <p className="text-slate-400 text-sm leading-relaxed max-w-xs">
                    The dashboard is best experienced in landscape mode. Please rotate your device for the full experience.
                </p>

                {/* Landscape illustration */}
                <div className="flex items-center gap-3 mt-2">
                    <div className="w-8 h-12 rounded border-2 border-slate-500 flex items-center justify-center">
                        <div className="w-1 h-1 rounded-full bg-slate-500" />
                    </div>
                    <span className="text-slate-500 text-xl">→</span>
                    <div className="w-12 h-8 rounded border-2 border-blue-500 flex items-center justify-center">
                        <div className="w-1 h-1 rounded-full bg-blue-500" />
                    </div>
                </div>
            </div>
        </>
    );
};

export default RotateDevicePrompt;