import React, { useState } from "react";
import Navbar from "../Navbar/Navbar";
import Footer from "./Footer";
import OneTapLogin from "../Login/oneTapLogin";
import RecentVisualizations from "./RecentVisualizations";
import { getToken } from "../utils/auth";
import Hero from "./Hero";
import HowItWorks from "./HowItWorks";

const LandingPage = () => {

  const [isLoggedIn, setIsLoggedIn] = useState(!!getToken());
  console.log("LandingPage rendered, isLoggedIn:", isLoggedIn);

  return (
    <div className="bg-[#020617] min-h-screen">
      <Navbar isLandingPage={true} />
      <Hero isLoggedIn={isLoggedIn} />
      <HowItWorks />
      {isLoggedIn ? (
        <RecentVisualizations />
      ) : (
        <OneTapLogin onLoginSuccess={() => setIsLoggedIn(true)} />
      )}
      <Footer />
    </div>
  );
};

export default LandingPage;