import React, { useState, useEffect } from 'react';
import { BellRing, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';

const LoginMessageToast = ({ message = "Action successful!", type = "info", onClose }) => {
    return (
        <div className="fixed inset-x-0 top-5 flex justify-center z-50 pointer-events-none px-4 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="pointer-events-auto flex items-center gap-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200 dark:border-slate-800 px-6 py-4 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] max-w-md w-full ring-1 ring-black/5">

                {/* Animated Icon Container */}
                <div className="flex-shrink-0 relative">
                    <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping opacity-25"></div>
                    <div className="relative bg-blue-100 dark:bg-blue-900/30 p-2.5 rounded-xl">
                        <Info className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                </div>

                {/* Text Content */}
                <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 text-ellipsis">
                        {message}
                    </p>
                </div>

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="flex-shrink-0 ml-2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
};
export default LoginMessageToast;