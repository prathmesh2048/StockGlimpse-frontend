import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import ENV from "../config"; // import your config file
import "./LoginPage.css";
import LoginButton from "./LoginButton";
import { setToken } from '../utils/auth';
import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import LoginMessageToast from "./LoginMessageToast";

const LoginPage = () => {

    const navigate = useNavigate();

    const location = useLocation();
    const loginRequestMessage = location.state?.login_request_message;

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    const handleLogin = async (e) => {

        e.preventDefault();

        try {
            const response = await fetch(`${ENV.BASE_API_URL}/auth/api/login/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ email, password }),
            });

            if (!response.ok) {
                throw new Error("Login failed");
            }

            const data = await response.json();
            const jwtToken = data.jwtToken;

            setToken(jwtToken);

            console.log("Login successful, token saved.");
            navigate("/");

        } catch (error) {
            console.error("Login error:", error);
            alert("Login failed. Please check your credentials.");
        }
    };

    const [showToast, setShowToast] = useState(false);

    useEffect(() => {
        if (loginRequestMessage) {
            setShowToast(true);
            const timer = setTimeout(() => setShowToast(false), 3500); // 3.5 sec
            return () => clearTimeout(timer);
        }
    }, [loginRequestMessage]);


    return (
        <div className="login-page">
            {showToast && (
                <LoginMessageToast
                    message={loginRequestMessage}
                />
            )}
            <div className="login-container">
                <h2 className="login-title">Login to Stock Glimpse</h2>
                <form onSubmit={handleLogin} className="login-form">
                    <div className="input-group">
                        <label htmlFor="email">Email</label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className="input-group">
                        <label htmlFor="password">Password</label>
                        <div className="password-container">
                            <input
                                type={showPassword ? "text" : "password"}
                                id="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                            <span
                                className="eye-icon"
                                onClick={() => setShowPassword(!showPassword)} // Toggle password visibility
                                style={{ cursor: "pointer" }}
                            >
                                {showPassword ? (
                                    <img class="eye-icon" src="/images/open.png" alt="eye open" /> // Open eye icon
                                ) : (
                                    <img class="eye-icon" src="/images/close.png" alt="eye closed" /> // Closed eye icon
                                )}
                            </span>
                        </div>
                    </div>
                    <button type="submit" className="login-button">
                        Login
                    </button>
                </form>
                <p className="signup-link">
                    <a href="/forgot-password" className="signup-link-text">
                        Forgot your password?
                    </a>
                </p>

                <br />
                <div style={{ display: "flex", justifyContent: "center" }}>
                    <LoginButton />
                </div>
                <p className="signup-link">
                    Don't have an account?{" "}
                    <a href="/signup" className="signup-link-text">
                        Sign up here
                    </a>
                </p>
            </div>
        </div>
    );
};

export default LoginPage;
