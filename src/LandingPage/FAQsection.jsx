import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import PrecisionGridBackground from './TopologyBackground.jsx';

const faqs = [
    {
        q: "Do I need to connect my broker account?",
        a: "No. Tradeye never logs into your broker or asks for your password or API keys. You export a CSV from your broker's own app and upload it manually. That's the only data we ever see."
    },
    {
        q: "Which brokers are supported?",
        a: "Zerodha, Groww, Angel One tradebook exports are supported today. More brokers are being added based on demand."
    },
    {
        q: "Does Tradeye support F&O / options trades?",
        a: "Not yet. Tradeye currently supports equity/stock trades only. Options chart data (especially for expired contracts) needs paid data sources like True Data or NSE Bhavcopy files, which we're evaluating as a future addition."
    },
    {
        q: "Where does the chart data come from?",
        a: "Price charts are built from real OHLC (open-high-low-close) data for the stock you traded, so you're seeing the actual candles the market printed at your entry and exit, not a rough sketch."
    },
    {
        q: "How does the AI trade score work?",
        a: "Every trade is scored out of 100 across five factors —: trend, momentum, volume, support/resistance placement, and entry candle pattern, so you can see which part of your entry was strong and which part was weak."
    },
    {
        q: "Is my trade data safe?",
        a: "Yes. Nothing is pulled from your broker automatically, and you can delete your uploaded data at any time with one click, no support ticket needed."
    },
    {
        q: "What does the free plan include?",
        a: "10 trades and 10 chart entries, no card required, so you can see your own trades visualized and analyzed before deciding to upgrade."
    },
    {
        q: "How much does the paid plan cost?",
        a: "₹49/month for unlimited trades, unlimited entries, and full access to AI scoring and analytics, this is a launch price."
    }
];

function FaqItem({ item, isOpen, onClick }) {
    return (
        <div className="border-b border-slate-800">
            <button
                onClick={onClick}
                className="w-full flex items-center justify-between gap-4 py-6 text-left group"
            >
                <span className="text-white font-medium text-base md:text-lg group-hover:text-blue-400 transition-colors">
                    {item.q}
                </span>
                <Plus
                    size={20}
                    className={`flex-shrink-0 text-slate-500 transition-transform duration-300 ${isOpen ? 'rotate-45 text-blue-400' : ''}`}
                />
            </button>
            <div
                className={`grid transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
            >
                <div className="overflow-hidden">
                    <p className="text-slate-400 text-sm leading-relaxed pb-6 pr-8">
                        {item.a}
                    </p>
                </div>
            </div>
        </div>
    );
}

export default function FAQSection() {
    const [openIndex, setOpenIndex] = useState(0);

    return (
        <section className="w-full bg-[#020617] py-24 px-4 relative overflow-hidden">
            <PrecisionGridBackground />
            <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-blue-900/10 blur-[100px] rounded-full pointer-events-none"></div>

            <div className="max-w-3xl mx-auto relative z-10">
                <div className="text-center mb-14">
                    <span className="text-blue-500 font-mono text-sm tracking-widest uppercase mb-3 block">
                        FAQ
                    </span>
                    <h2 className="text-white text-3xl md:text-4xl font-bold tracking-tight mb-3">
                        Questions traders actually ask
                    </h2>
                    <p className="text-slate-400 text-base">
                        Still unsure? Here's everything you need to know before uploading your first CSV.
                    </p>
                </div>

                <div>
                    {faqs.map((item, idx) => (
                        <FaqItem
                            key={idx}
                            item={item}
                            isOpen={openIndex === idx}
                            onClick={() => setOpenIndex(openIndex === idx ? -1 : idx)}
                        />
                    ))}
                </div>
            </div>
        </section>
    );
}