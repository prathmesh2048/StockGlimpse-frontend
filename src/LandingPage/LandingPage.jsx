import React, { useState } from "react";
import Navbar from "../Navbar/Navbar";
import Footer from "./Footer";
import OneTapLogin from "../Login/oneTapLogin";
import RecentVisualizations from "./RecentVisualizations";
import { getToken } from "../utils/auth";
import Hero from "./Hero";
import PrecisionGridBackground from "./TopologyBackground.jsx";
import HowItWorks from "./HowItWorks";
import ProductDemo from "./ProductDemo.jsx";
import SecuritySection from "./SecuritySection.jsx";
import FAQSection from "./FAQsection.jsx";
import ContactSection from "./ContactSection.jsx";

const LandingPage = () => {

  const [isLoggedIn, setIsLoggedIn] = useState(!!getToken());
  console.log("LandingPage rendered, isLoggedIn:", isLoggedIn);

  return (
    <div className="bg-[#020617] min-h-screen">
      <Navbar isLandingPage={true} />
      <Hero isLoggedIn={isLoggedIn} />
      <ProductDemo videoSrc="videos/demo_compressed.mp4" posterSrc="images/product_demo.png" />
      <SecuritySection />
      <HowItWorks />
      <FAQSection />
      {isLoggedIn ? (
        <RecentVisualizations />
      ) : (
        <OneTapLogin onLoginSuccess={() => setIsLoggedIn(true)} />
      )}
      <ContactSection />
      <Footer />
    </div>
  );
};

export default LandingPage;