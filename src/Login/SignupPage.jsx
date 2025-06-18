import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./LoginPage.css";
import { setToken } from '../utils/auth';


const SignupPage = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
  });
  const [errorMessage, setErrorMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSignup = async (e) => {
    e.preventDefault();

    // Make the API call to signup
    try {
      const response = await fetch("http://localhost:8000/auth/api/signup/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        setErrorMessage(data.message || "Signup failed.");
        return;
      }

      const data = await response.json();
      setToken(data.jwtToken);
      navigate("/");
    } catch (error) {
      setErrorMessage("An error occurred. Please try again.");
      console.error("Signup error:", error);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <h2 className="login-title">Create Your Account</h2>
        <form onSubmit={handleSignup} className="login-form">
          <div className="input-group">
            <label htmlFor="firstName">First Name</label>
            <input
              type="text"
              id="firstName"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              required
            />
          </div>
          <div className="input-group">
            <label htmlFor="lastName">Last Name</label>
            <input
              type="text"
              id="lastName"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              required
            />
          </div>
          <div className="input-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>
          <div className="input-group">
            <label htmlFor="password">Password</label>
            <div className="password-container">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
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
            Sign Up
          </button>
        </form>
        {errorMessage && <p className="error-message">{errorMessage}</p>}
        <p className="login-link">
          Already have an account?{" "}
          <a href="/login" className="login-link-text">
            Login here
          </a>
        </p>
      </div>
    </div>
  );
};

export default SignupPage;
