import { React, useId } from 'react';
import { Check } from 'lucide-react';
import Navbar from '../Navbar/Navbar';
import axios from "axios";
import ENV from '../config';

const loadRazorpay = () =>
    new Promise((resolve) => {
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });


export default function SubscriptionPlans() {

    const orderId = useId();

    const handlePayment = async () => {
        const loaded = await loadRazorpay();
        if (!loaded) return alert("Razorpay SDK failed");

        let res;
        try {
            res = await axios.post(
                `${ENV.BASE_API_URL}/api/razorpay_order/`,
                { amount: 49 },
                {
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem("jwtToken")}`,
                        "Content-Type": "application/json",
                    },
                }
            );
        } catch (err) {
            return alert(err.response?.data?.detail || "Something went wrong");
        }

        const data = res.data;

        const options = {
            key: data.key,
            amount: data.amount,
            currency: data.currency,
            order_id: data.orderId,
            name: "StockGlimpse",
            handler: async function (response) {
                await axios.post(
                    `${ENV.BASE_API_URL}/api/razorpay_callback/`,
                    response,
                    {
                        headers: {
                            Authorization: `Bearer ${localStorage.getItem("jwtToken")}`,
                            "Content-Type": "application/json",
                        },
                    }
                );
                window.location.href = "/";
            },
        };

        const rzp = new window.Razorpay(options);
        rzp.open();
    };

    return (
        <>
            <Navbar />
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 antialiased selection:bg-indigo-100">
                <div className="w-full max-w-xl">
                    <div className="bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-slate-100 overflow-hidden transition-all duration-300 hover:shadow-[0_30px_60px_rgba(0,0,0,0.08)]">
                        <div className="p-8 md:p-10 text-center">

                            <h2 className="text-3xl font-extrabold text-slate-900 mb-4">
                                Unlimited. Simple. Powerful.
                            </h2>

                            <div className="mb-6 space-y-1">
                                <p className="text-md text-emerald-600 font-semibold mt-2">
                                    ⚡ Unlock in 5 seconds. Instant access ⚡
                                </p>
                            </div>

                            {/* Feature list — 2 columns */}
                            <div className="grid grid-cols-2 gap-x-8 gap-y-4 mb-10 text-left">

                                {[
                                    "Unlimited trade visualizations",
                                    "AI trade scoring",
                                    "AI Levels — S/R detection",
                                    "Analytics & score trends",
                                    "Candle pattern recognition",
                                    "Unlimited journaling & notes",
                                ].map((feature, index) => (
                                    <div key={index} className="flex items-start gap-2">
                                        <div className="flex-shrink-0 w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center mt-0.5">
                                            <Check className="w-3 h-3 text-emerald-600" strokeWidth={3} />
                                        </div>
                                        <span className="text-slate-800 text-sm font-medium leading-snug">
                                            {feature}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            <div className="mb-8">
                                <div className="flex items-center justify-center gap-3 mb-1">
                                    <span className="text-2xl text-slate-300 line-through font-medium">₹99</span>
                                    <span className="text-6xl font-black text-slate-900 tracking-tighter">₹49</span>
                                </div>
                                <p className="text-emerald-600 font-bold text-sm uppercase tracking-wider">
                                    Limited-time launch offer
                                </p>
                            </div>

                            <div className="mb-8">
                                <p className="text-slate-900 font-semibold text-sm">
                                    Built for serious traders. Priced for everyone.
                                </p>
                            </div>

                            <button
                                onClick={handlePayment}
                                className="w-full py-4 px-8 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-slate-200 text-lg">
                                Unlock Unlimited Access
                            </button>

                            <p className="mt-4 text-slate-400 text-xs">
                                · Secure checkout
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}