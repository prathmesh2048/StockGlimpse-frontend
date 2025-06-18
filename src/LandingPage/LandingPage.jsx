import React from 'react';
import HeroSection from './HeroSection';
import HowItWorks from './HowItWorks';
import Footer from './Footer';
import OneTapLogin from '../Login/oneTapLogin';
import Navbar from '../Navbar/Navbar';
import { getToken } from '../utils/auth';
import useUser from '../hooks/useUser';


const LandingPage = () => {

  const { user, loading } = useUser();
  if (loading) return <div>Loading...</div>;

  const isLoggedIn = getToken() !== null;
  // if (!user) return <div>Please log in</div>;

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
