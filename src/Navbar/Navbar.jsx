import React from "react";
import { useNavigate } from "react-router-dom"; // Import useNavigate hook for navigation
import "./Navbar.css";  // Import the CSS

const Navbar = () => {
  const navigate = useNavigate();
  
  
  const isLoggedIn = localStorage.getItem('jwtToken') !== null;

  const handleSignout = () => {
    localStorage.removeItem("jwtToken");
   
    navigate("/");
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <a href="/" className="navbar-logo">
          Stock Glimpse
        </a>
        <ul className="navbar-menu">
          <li className="navbar-item">
            <a href="/" className="navbar-links">Home</a>
          </li>
          <li className="navbar-item">
            <a href="/about" className="navbar-links">About</a>
          </li>
          <li className="navbar-item">
            <a href="/services" className="navbar-links">Services</a>
          </li>
          <li className="navbar-item">
            <a href="/contact" className="navbar-links">Contact</a>
          </li>
          {/* Conditionally render Login/Signup or Profile based on login status */}
          {!isLoggedIn ? (
            <>
              <li className="navbar-item">
                <a href="/login" className="navbar-links">Login</a>
              </li>
              <li className="navbar-item">
                <a href="/signup" className="navbar-links">Signup</a>
              </li>
            </>
          ) : (
            <>
              <li className="navbar-item">
                <a href="/profile" className="navbar-links">Welcome</a>
              </li>
              <li className="navbar-item">
                <a onClick={handleSignout} href="/" className="navbar-links">
                  Signout
                </a>
              </li>
            </>
          )}
        </ul>
      </div>
    </nav>
  );
};

export default Navbar;
