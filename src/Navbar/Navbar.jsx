import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Menu, X, CandlestickChart, Coins } from "lucide-react";
import useUser from "../hooks/useUser";
import { clearToken } from "../utils/auth";

const Navbar = ({ isLandingPage = false }) => {
  const navigate = useNavigate();
  const { user, loading } = useUser();

  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [loggedIn, setLoggedIn] = useState(!!user);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setLoggedIn(!!user);
  }, [user]);

  if (loading) return null;

  const handleSignout = () => {
    clearToken();
    setLoggedIn(false);
    navigate("/");
  };

  const link =
    "text-slate-300 hover:text-white transition text-sm font-medium flex items-center gap-1.5";

  return (
    <>
      {!isLandingPage && <div className="h-16" />}

      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all ${
          !isLandingPage
            ? "bg-gradient-to-tr from-[#01141a] to-[#01222c] border-b border-white/10"
            : scrolled
            ? "bg-[#0f172a]/90 backdrop-blur-md border-b border-white/10"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <div
            onClick={() => navigate("/")}
            className="flex items-center gap-2 cursor-pointer"
          >
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <CandlestickChart className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-white">
              Stock<span className="text-blue-500">Glimpse</span>
            </span>
          </div>

          {/* Desktop */}
          <div className="hidden md:flex items-center gap-6">
            <Link to="/" className={link}>Home</Link>
            <Link to="/" className={link}>About</Link>

            {!loggedIn ? (
              <>
                <Link to="/login" className={link}>Login</Link>
                <button
                  onClick={() => navigate("/signup")}
                  className="bg-blue-600 px-4 py-2 rounded-lg text-white text-sm font-semibold"
                >
                  Signup
                </button>
              </>
            ) : (
              <>
                <Link to="/history" className={link}>History</Link>
                <Link to="/profile" className={link}>Profile</Link>

                <div className={`${link} cursor-default`}>
                  <Coins className="w-4 h-4 text-yellow-400" />
                  {user?.has_unlimited_coins ? (
                    <span className="text-lg font-bold text-yellow-400">∞</span>
                  ) : (
                    <span className="text-sm font-bold text-yellow-400">
                      {user?.coins}
                    </span>
                  )}
                </div>

                <button
                  onClick={handleSignout}
                  className="text-red-400 hover:text-red-300 text-sm"
                >
                  Logout
                </button>
              </>
            )}
          </div>

          {/* Mobile toggle */}
          <button
            onClick={() => setOpen(!open)}
            className="md:hidden text-slate-300"
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>

        {/* Mobile menu */}
        {open && (
          <div className="md:hidden bg-[#0f172a] border-t border-white/10 px-6 py-4 flex flex-col gap-3">
            <Link to="/" className={link}>Home</Link>
            <Link to="/about" className={link}>About</Link>

            {!loggedIn ? (
              <>
                <Link to="/login" className={link}>Login</Link>
                <button
                  onClick={() => navigate("/signup")}
                  className="w-full bg-blue-600 py-2 rounded-lg text-white font-semibold"
                >
                  Signup
                </button>
              </>
            ) : (
              <>
                <Link to="/temp" className={link}>Charts</Link>
                <Link to="/profile" className={link}>Profile</Link>

                <button
                  onClick={handleSignout}
                  className="text-red-400 text-left"
                >
                  Logout
                </button>
              </>
            )}
          </div>
        )}
      </nav>
    </>
  );
};

export default Navbar;