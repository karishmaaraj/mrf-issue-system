import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import WorkerPortal from './components/WorkerPortal.jsx';

/**
 * Standalone MCC Worker Portal (Running on http://localhost:5176/)
 */
export default function App() {
  return (
    <Router basename="/worker">
      <Routes>
        <Route path="/" element={<WorkerPortal />} />
        <Route path="/worker" element={<WorkerPortal />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
