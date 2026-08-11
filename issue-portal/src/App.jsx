import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import LandingPage from './components/LandingPage.jsx';
import UserForm from './components/UserForm.jsx';
import AdminDashboard from './components/AdminDashboard.jsx';

/**
 * ScrollToTop — Automatically scrolls window to top on route change
 */
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

/**
 * App.jsx — MRF Issue Portal Router (Running on http://localhost:5174/)
 *
 * Routes:
 *   "/"          → Student Landing Overview Page
 *   "/complaint" → Student Complaint Submission Form
 *   "/admin"     → Admin Portal (Login & Dashboard)
 *   "*"          → Redirect to "/"
 */
export default function App() {
  return (
    <Router>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/complaint" element={<UserForm />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
