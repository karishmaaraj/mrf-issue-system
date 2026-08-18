import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import LandingPage from './components/LandingPage.jsx';
import UserForm from './components/UserForm.jsx';
import AdminDashboard from './components/AdminDashboard.jsx';
import SuperAdminDashboard from './components/SuperAdminDashboard.jsx';

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
 *   "/"             → Student Landing Overview Page
 *   "/complaint"    → Student Complaint Submission Form
 *   "/admin"        → Admin Portal (Login & Dashboard)
 *   "/super-admin"  → Super Admin Master Dynamic Control Center
 *   "*"             → Redirect to "/"
 */
export default function App() {
  return (
    <Router basename="/issue">
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/complaint" element={<UserForm />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/super-admin" element={<SuperAdminDashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
