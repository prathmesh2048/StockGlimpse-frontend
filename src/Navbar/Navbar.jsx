import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Menu, X, ArrowRight } from "lucide-react";
import useUser from "../hooks/useUser";
import { clearToken } from "../utils/auth";

const Navbar = ({ isLandingPage = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
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

  // Whenever we land on "/" with a hash in the URL, scroll to that section.
  // This covers both cases: clicking the link while already on the homepage
  // (hash changes, pathname doesn't) and navigating from another page
  // (pathname changes to "/", hash arrives with it).
  useEffect(() => {
    if (location.pathname !== "/" || !location.hash) return;

    const id = location.hash.slice(1); // "#contact" -> "contact"
    // Small delay lets the homepage's sections actually mount/render
    // before we try to scroll to one of them, especially right after
    // navigating in from a different route.
    const timer = setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    }, 150);

    return () => clearTimeout(timer);
  }, [location]);

  if (loading) return null;

  const handleSignout = () => {
    clearToken();
    setLoggedIn(false);
    navigate("/");
  };

  const linkClass = "text-slate-300 hover:text-white transition text-sm font-medium";

  return (
    <>
      {!isLandingPage && <div className="h-16" />}

      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all ${!isLandingPage
          ? "bg-[#020617] border-b border-white/10"
          : scrolled
            ? "bg-[#020617]/90 backdrop-blur-md border-b border-white/10"
            : "bg-transparent"
          }`}
      >
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">

          {/* Logo */}
          <div
            onClick={() => navigate("/")}
            className="flex items-center gap-2 cursor-pointer w-48"
          >
            <img
              src={process.env.PUBLIC_URL + "/images/tradeye.png"}
              alt="Tradeye"
              className="h-8 w-auto object-contain"
            />
          </div>

          {/* Desktop Center Links */}
          <div className="hidden md:flex items-center gap-8">
            <Link to="/#how-it-works" className={linkClass}>How It Works</Link>
            <Link to="/pricing" className={linkClass}>Pricing</Link>
            <Link to="/select-broker" className={linkClass}>Analyze</Link>
            <Link to="/#contact" className={linkClass}>Contact</Link>
            {!loggedIn ? (
              <Link to="/login" className={linkClass}>Login</Link>
            ) : (
              <button onClick={handleSignout} className={linkClass}>Logout</button>
            )}
          </div>

          {/* Desktop Right CTA */}
          <div className="hidden md:flex items-center justify-end w-48">
            <button
              onClick={() => navigate(loggedIn ? "/select-broker" : "/signup")}
              className="bg-[#0052FF] hover:bg-blue-600 px-5 py-2.5 rounded-full text-white text-sm font-semibold flex items-center gap-2 transition-colors"
            >
              Start Free <ArrowRight className="w-4 h-4" />
            </button>
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
          <div className="md:hidden bg-[#020617] border-t border-white/10 px-6 py-4 flex flex-col gap-4">
            <Link to="/#how-it-works" className={linkClass} onClick={() => setOpen(false)}>How It Works</Link>
            <Link to="/pricing" className={linkClass} onClick={() => setOpen(false)}>Pricing</Link>
            <Link to="/select-broker" className={linkClass} onClick={() => setOpen(false)}>Analyze</Link>
            <Link to="/#contact" className={linkClass} onClick={() => setOpen(false)}>Contact</Link>

            {!loggedIn ? (
              <Link to="/login" className={linkClass} onClick={() => setOpen(false)}>Login</Link>
            ) : (
              <button onClick={() => { handleSignout(); setOpen(false); }} className="text-left text-slate-300">Logout</button>
            )}

            <button
              onClick={() => { navigate("/signup"); setOpen(false); }}
              className="w-full bg-[#0052FF] py-3 rounded-full text-white font-semibold flex justify-center items-center gap-2 mt-2"
            >
              Start Free <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </nav>
    </>
  );
};

export default Navbar;