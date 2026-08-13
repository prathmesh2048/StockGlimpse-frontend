import React from 'react';
import { UploadCloud, FileCheck2, ShieldCheck, Trash2 } from 'lucide-react';

const securityFeatures = [
    {
        icon: UploadCloud,
        title: "No broker login",
        description: "We never ask for your broker password or API keys. You export the CSV yourself."
    },
    {
        icon: FileCheck2,
        title: "You control the file",
        description: "Only the trades you upload get analyzed. Nothing is pulled automatically."
    },
    {
        icon: ShieldCheck,
        title: "Encrypted in transit",
        description: "Every upload travels over TLS."
    },
    {
        icon: Trash2,
        title: "Delete anytime",
        description: "One click removes your data. No support ticket needed."
    }
];

export default function SecuritySection() {
    return (
        <div className="w-full bg-[#080B11] py-8 px-4">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="text-center mb-16">
                    <span className="text-blue-500 font-mono text-xs tracking-widest uppercase mb-3 block">
                        Security
                    </span>
                    <h2 className="text-white text-3xl md:text-4xl font-bold tracking-tight mb-3">
                        We never touch your broker. Just your CSV.
                    </h2>
                    <p className="text-slate-400 text-base">
                        Tradeye only ever sees the file you choose to upload. Nothing else.
                    </p>
                </div>

                {/* Minimalist Borderless Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12 divide-y md:divide-y-0 md:divide-x divide-slate-800/60">
                    {securityFeatures.map((item, index) => {
                        const Icon = item.icon;
                        return (
                            <div
                                key={index}
                                className={`flex flex-col items-start ${index !== 0 ? 'pt-8 md:pt-0 md:pl-8 lg:pl-10' : ''}`}
                            >
                                {/* Glowing Icon Container */}
                                <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-5 shadow-lg shadow-blue-500/5">
                                    <Icon className="w-6 h-6" />
                                </div>

                                {/* Content */}
                                <h3 className="text-white font-semibold text-lg mb-2">
                                    {item.title}
                                </h3>
                                <p className="text-slate-400 text-sm leading-relaxed">
                                    {item.description}
                                </p>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}