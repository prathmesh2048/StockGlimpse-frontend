import React from "react";
import "./CTAButton.css";
import { Link } from "react-router-dom";


const CTAButton = ({ to, action = "route", children }) => {

    const handleScroll = () => {

        const section = document.querySelector(to);

        if (section) {
            section.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    };

    if (action === "scroll") {
        return (
            <button onClick={handleScroll} className="cta-button">
                {children}
            </button>
        );
    }

    return (
        <Link to={to} className="cta-button">
            {children}
        </Link>
    );
};

export default CTAButton;
