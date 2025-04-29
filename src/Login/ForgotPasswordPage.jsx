import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import ENV from "../config"; 
import "./LoginPage.css";

const ForgotPasswordPage = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");

    const handleForgotPassword = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch(`${ENV.BASE_API_URL}/auth/api/forgot-password/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ email }),
            });

            if (!response.ok) {
                throw new Error("Request failed");
            }
            alert("Password reset link sent to your email.");
            navigate("/login");
        } catch (error) {
            console.error("Forgot password error:", error);
            alert("Error sending password reset link.");
        }
    };

    return (
        <div className="login-page">
            <div className="login-container">
                <h2 className="login-title">Forgot Password</h2>
                <form onSubmit={handleForgotPassword} className="login-form">
                    <div className="input-group">
                        <label htmlFor="email">Enter your Email</label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <button type="submit" className="login-button">
                        Send Reset Link
                    </button>
                </form>
                <p className="signup-link">
                    Remembered your password?{" "}
                    <a href="/login" className="signup-link-text">
                        Go back to Login
                    </a>
                </p>
            </div>
        </div>
    );
};

export default ForgotPasswordPage;
