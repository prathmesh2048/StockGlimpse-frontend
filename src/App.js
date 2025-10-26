import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { createContext, useState, useEffect } from 'react';
import LandingPage from './LandingPage/LandingPage';
import AuthCallback from './AuthRedirect/AuthCallback';
import LoginPage from './Login/LoginPage';
import SignupPage from './Login/SignupPage';
import ForgotPasswordPage from './Login/ForgotPasswordPage';
import ResetPasswordPage from './Login/ResetPasswordPage';
// import ChartScreen from './Chart/ChartScreen';
import ChartScreen from './Chart/ChartScreen';
import DashBoard from './ChartDashboards/Dashboard';
import FileUpload from './Onboarding/FileUpload';
import SelectBroker from './Onboarding/SelectBroker';
import Profile from './profile/Profile';

function App() {
  return (
      <Router>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/chart-screen" element={<ChartScreen />} /> 
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/temp" element={<DashBoard />} />
          <Route path="/upload-file" element={<FileUpload />} />
          <Route path="/select-broker" element={<SelectBroker />} />
          <Route path="/profile" element={<Profile/>} />
        </Routes>
      </Router>

  );
}

export default App;
