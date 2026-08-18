import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AdminDashboard from './components/AdminDashboard.jsx';
import SuperAdminDashboard from './components/SuperAdminDashboard.jsx';

/**
 * MRF Admin Portal App Router
 */
export default function App() {
  return (
    <Router basename="/admin">
      <Routes>
        <Route path="/" element={<AdminDashboard />} />
        <Route path="/super-admin" element={<SuperAdminDashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
