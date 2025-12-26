import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { clearToken } from "../utils/auth";
import useUser from "../hooks/useUser";

const Navbar = ({ solidBackground = false }) => {
  const navigate = useNavigate();
  const { user, loading } = useUser();
  const [open, setOpen] = useState(false);

  if (loading) return null;

  const isLoggedIn = user !== null;

  const handleSignout = () => {
    clearToken();
    navigate("/");
  };

  // shared visual styles
  const navBg = "bg-gradient-to-tr from-[#01141a] to-[#01222c]";

  const baseNav = "w-full z-10 left-0 right-0";
  const transparentNav = "absolute top-0 bg-transparent text-white";
  const solidNav = `relative ${navBg} shadow-md`;

  return (
    <>
      {/* NAVBAR */}
      <nav
        className={`${baseNav} ${solidBackground ? solidNav : transparentNav
          } px-[7%] py-4`}
      >
        <div className="flex items-center justify-between">
          {/* Logo */}
          <a
            href="/"
            className="text-[1.8rem] font-bold text-[#ff5722]"
          >
            Stock Glimpse
          </a>

          {/* Hamburger */}
          <button
            className="md:hidden text-white text-2xl"
            onClick={() => setOpen(!open)}
          >
            ☰
          </button>

          {/* Desktop Menu */}
          <ul className="hidden md:flex gap-5 items-center">
            <NavLinks
              isLoggedIn={isLoggedIn}
              handleSignout={handleSignout}
            />
          </ul>
        </div>

        {/* MOBILE MENU — PUSHES CONTENT */}
        {open && (
          <div className={`md:hidden ${navBg} px-[7%] py-4`}>
            <ul className="flex flex-col gap-4 items-center">
              <NavLinks
                isLoggedIn={isLoggedIn}
                handleSignout={handleSignout}
                onClick={() => setOpen(false)}
              />
            </ul>
          </div>
        )}
      </nav>
    </>
  );
};

const linkClass =
  "text-white font-medium hover:text-[#ff5722] transition";

const NavLinks = ({ isLoggedIn, handleSignout, onClick }) => (
  <>
    <li><a onClick={onClick} href="/" className={linkClass}>Home</a></li>
    <li><a onClick={onClick} href="/about" className={linkClass}>About</a></li>
    <li><a onClick={onClick} href="/services" className={linkClass}>Services</a></li>
    <li><a onClick={onClick} href="/contact" className={linkClass}>Contact</a></li>

    {!isLoggedIn ? (
      <>
        <li><a onClick={onClick} href="/login" className={linkClass}>Login</a></li>
        <li><a onClick={onClick} href="/signup" className={linkClass}>Signup</a></li>
      </>
    ) : (
      <>
        <li><a onClick={onClick} href="/profile" className={linkClass}>My Profile</a></li>
        <li><a onClick={onClick} href="/temp" className={linkClass}>Charts</a></li>
        <li>
          <a onClick={handleSignout} href="/" className={linkClass}>
            Signout
          </a>
        </li>
      </>
    )}
  </>
);

export default Navbar;
