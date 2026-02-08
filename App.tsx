
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Home from './views/Home';
import Auth from './views/Auth';
import ActiveMission from './views/ActiveMission';
import Missions from './views/Missions';
import Dashboard from './views/Dashboard';
import Profile from './views/Profile';
import Navigation from './components/Navigation';

const AppContent: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const location = useLocation();

  // Basic mock auth logic for prototype
  useEffect(() => {
    const authStatus = localStorage.getItem('vta_auth');
    if (authStatus) setIsAuthenticated(true);
  }, [location.pathname]); // Refresh on navigation

  const isAuthPage = location.pathname === '/login';

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#0F172A] relative overflow-x-hidden">
      <Routes>
        <Route path="/login" element={<Auth />} />
        <Route path="/" element={<Home />} />
        <Route path="/mission" element={<Missions />} />
        <Route path="/mission/:id" element={<ActiveMission />} />
        <Route path="/stats" element={<Dashboard />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>

      {!isAuthPage && <Navigation />}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <AppContent />
    </Router>
  );
};

export default App;
