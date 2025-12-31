import { useEffect, useState } from "react";
import axios from "axios";
import ENV from "../config";
import { Link } from "react-router-dom";
import { ArrowRight, LineChart } from "lucide-react";
import { useNavigate } from "react-router-dom";

const RecentVisualizations = () => {

    const navigate = useNavigate();
    const [items, setItems] = useState([]);

    useEffect(() => {
        const fetchRecentVisualizations = async () => {
            try {
                const res = await axios.get(
                    `${ENV.BASE_API_URL}/api/recent-visualizations/`,
                    {
                        headers: {
                            Authorization: `Bearer ${localStorage.getItem("jwtToken")}`,
                        },
                    }
                );
                setItems(res.data);
            } catch (err) {
                console.error(err);
            }
        };
        fetchRecentVisualizations();
    }, []);

    if (!items.length) return null;

    return (
        <section className="relative py-24">
            {/* background glow */}
            <div className="absolute inset-0 bg-gradient-to-b from-blue-900/10 via-transparent to-transparent pointer-events-none" />

            <div className="relative max-w-6xl mx-auto px-6">
                {/* header */}
                <div className="flex items-center justify-between mb-10">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        <LineChart className="text-blue-500" />
                        Your Recent Visualizations
                    </h2>

                    <Link
                        to="/history"
                        className="flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm font-semibold"
                    >
                        View all
                        <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>

                {/* cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {items.slice(0, 6).map((item, idx) => (
                        <div
                            key={item.symbol}
                            onClick={() => navigate('/history')}
                            className="group bg-[#0f172a] border border-white/10 rounded-xl p-5 hover:border-blue-500/40 hover:bg-[#111c33] transition"
                        >
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-lg font-semibold text-white">
                                    {item.symbol}
                                </span>

                                {idx === 0 && (
                                    <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">
                                        Latest
                                    </span>
                                )}
                            </div>

                            <p className="text-sm text-slate-400 mb-2">
                                {item.trade_count} trades visualized
                            </p>

                            <p className="text-xs text-slate-500">
                                {new Date(item.last_trade_at).toDateString()}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default RecentVisualizations;
