import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import SuperAdminDashboard from './components/SuperAdminDashboard.jsx';

/**
 * MRF Super Admin Dedicated Master Portal (Runs on http://localhost:5177/)
 */
export default function App() {
  return (
    <Router basename="/superadmin">
      <Routes>
        <Route path="/" element={<SuperAdminDashboard />} />
        <Route path="/super-admin" element={<SuperAdminDashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
