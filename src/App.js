import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { createContext, useState, useEffect } from 'react';
import LandingPage from './LandingPage/LandingPage';
import AuthCallback from './AuthRedirect/AuthCallback';
import LoginPage from './Login/LoginPage';
import SignupPage from './Login/SignupPage';
import ForgotPasswordPage from './Login/ForgotPasswordPage';
import ResetPasswordPage from './Login/ResetPasswordPage';

function App() {
  return (
      <Router>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
        </Routes>
      </Router>

  );
}

export default App;
