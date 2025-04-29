import React from 'react';
import HeroSection from './HeroSection';
import HowItWorks from './HowItWorks';
import Footer from './Footer';
import OneTapLogin from '../Login/oneTapLogin';
import Navbar from '../Navbar/Navbar';

const LandingPage = () => {


  const isLoggedIn = localStorage.getItem('jwtToken') !== null;
  return (
    <div className="landing-container">
      <Navbar />
      <HeroSection />
      <HowItWorks />
      {!isLoggedIn && <OneTapLogin />}
      <Footer />
    </div>
  );
};


export default LandingPage;
