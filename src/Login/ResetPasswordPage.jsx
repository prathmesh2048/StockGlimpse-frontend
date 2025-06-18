import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import ENV from "../config";
import "./LoginPage.css";

const ResetPasswordPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    const queryParams = new URLSearchParams(location.search);
    const token = queryParams.get("token");

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const handleResetPassword = async (e) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            alert("Passwords do not match.");
            return;
        }

        try {
            const response = await fetch(`${ENV.BASE_API_URL}/auth/api/reset-password/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ password, token }),
            });

            if (!response.ok) {
                throw new Error("Reset failed");
            }
            alert("Password reset successful. Please login.");
            await sleep(500);
            navigate("/login");
        } catch (error) {
            console.error("Reset password error:", error);
            alert("Error resetting password.");
        }
    };

    return (
        <div className="login-page">
            <div className="login-container">
                <h2 className="login-title">Reset Password</h2>
                <form onSubmit={handleResetPassword} className="login-form">
                    <div className="input-group">
                        <label htmlFor="password">New Password</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <div className="input-group">
                        <label htmlFor="confirmPassword">Confirm New Password</label>
                        <div className="password-container">
                            <input
                                type={showPassword ? "text" : "password"}
                                id="confirmPassword"
                                value={confirmPassword} // Change this to confirmPassword
                                onChange={(e) => setConfirmPassword(e.target.value)} // Update the confirmPassword state
                                required
                            />
                            <span
                                className="eye-icon"
                                onClick={() => setShowPassword(!showPassword)} // Toggle password visibility
                                style={{ cursor: "pointer" }}
                            >
                                {showPassword ? (
                                    <img className="eye-icon" src="/images/open.png" alt="eye open" /> // Open eye icon
                                ) : (
                                    <img className="eye-icon" src="/images/close.png" alt="eye closed" /> // Closed eye icon
                                )}
                            </span>
                        </div>
                    </div>
                    <button type="submit" className="login-button">
                        Reset Password
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

export default ResetPasswordPage;
