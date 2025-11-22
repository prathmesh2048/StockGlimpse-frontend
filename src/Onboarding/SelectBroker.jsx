import Navbar from '../Navbar/Navbar';
import "./SelectBroker.css";
import { useState } from "react";
import FileUpload from "./FileUpload";
import { useEffect } from "react";
import Table from "../Onboarding/Table";

export default function SelectBroker() {

    const [selectedBroker, setSelectedBroker] = useState(null);
    const [trades, setTrades] = useState([]);

    const handleDataUpload = (data) => {
        console.log("Data received in SelectBroker:", data);
        setTrades(data.trades);
        setSelectedBroker(null);
    };

    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === "Escape") {
                setSelectedBroker(null);
            }
        };
        window.addEventListener("keydown", handleEsc);
        return () => window.removeEventListener("keydown", handleEsc);
    }, []);


    const brokers = [
        { id: "zerodha", name: "Zerodha", logo: "/images/Zerodha_logo.svg" }
    ];

    const handleSelect = (broker) => {
        setSelectedBroker(broker);
    };

    const handleCloseModal = () => {
        setSelectedBroker(null);
    };

    return (
        <>
            <Navbar solidBackground={true} />

            {trades.length === 0 && (
                <div className="broker-wrapper">
                    <h1 className="broker-title">Select your Broker</h1>
                    <div className="broker-grid">
                        {brokers.map((broker) => (
                            <div
                                key={broker.id}
                                className="broker-card"
                                onClick={() => handleSelect(broker)}>
                                <img src={broker.logo} alt={broker.name} />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {selectedBroker && (
                <div className="modal-overlay" onClick={handleCloseModal}>
                    <div
                        className="modal-content"
                        onClick={(e) => e.stopPropagation()}>
                        <button className="modal-close" onClick={handleCloseModal}>❌</button>
                        <h2>Upload trades for {selectedBroker.name}</h2>
                        <FileUpload onDataUpload={handleDataUpload} />
                    </div>
                </div>
            )}
            {trades.length > 0 && <Table data={trades} />}
        </>
    );

}