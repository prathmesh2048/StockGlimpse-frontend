import React, { useState, useEffect } from "react";
import axios from "axios";
import Navbar from "../Navbar/Navbar";
import Table from "../Onboarding/Table";
import ENV from "../config";
import { Puff } from "react-loader-spinner";

export default function History() {
    const [trades, setTrades] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchTrades = async () => {
            setIsLoading(true);
            try {
                const res = await axios.get(
                    `${ENV.BASE_API_URL}/api/recent-visualizations/`,
                    {
                        params: { all: true },
                        headers: {
                            Authorization: `Bearer ${localStorage.getItem("jwtToken")}`,
                        },
                    }
                );
                setTrades(res.data);
            } catch (err) {
                setError("Failed to fetch trades.");
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchTrades();
    }, []);

    return (
        <>
            <Navbar solidBackground={true} />
            {error && <p className="text-red-500">{error}</p>}
            {isLoading ? (
                <div>
                    <Puff color="#6366F1" size={60} ariaLabel="loading" />
                </div>
            )
                :
                <Table fromHistory={true} data={trades} />
            }
        </>
    );
}
