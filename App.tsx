
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Home from './views/Home';
import Auth from './views/Auth';
import ActiveMission from './views/ActiveMission';
import Missions from './views/Missions';
import Dashboard from './views/Dashboard';
import Profile from './views/Profile';
import Support from './views/Support';
import { App as CapApp } from '@capacitor/app';
import { Geolocation as CapGeolocation } from '@capacitor/geolocation';
import { supabase } from './services/supabaseClient';
import { setDriverOffline } from './services/driverService';
import Navigation from './components/Navigation';

const AppContent: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const location = useLocation();

  // Basic mock auth logic for prototype
  useEffect(() => {
    const authStatus = localStorage.getItem('vta_auth');
    if (authStatus) setIsAuthenticated(true);
  }, [location.pathname]); // Refresh on navigation

  // --- LOGIQUE DE SUIVI GLOBAL (Localisation 10s si ONLINE) ---
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    const updateLocation = async (driverId: string) => {
      try {
        const position = await CapGeolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 10000
        });

        if (position) {
          await supabase
            .from('drivers')
            .update({
              last_lat: position.coords.latitude,
              last_lng: position.coords.longitude
            })
            .eq('id', driverId);
          console.log("Global Tracking: OK");
        }
      } catch (err) {
        console.warn("Global Tracking: Error", err);
      }
    };

    const checkAndTrack = () => {
      const isOnline = localStorage.getItem('vta_online') === 'true';
      const driverId = localStorage.getItem('vta_driver_id');

      if (isOnline && driverId) {
        if (!interval) {
          updateLocation(driverId); // Immédiat
          interval = setInterval(() => updateLocation(driverId), 10000);
        }
      } else {
        if (interval) {
          clearInterval(interval);
          interval = null;
        }
      }
    };

    // Check periodically if status changed in localStorage
    const statusCheckInterval = setInterval(checkAndTrack, 2000);
    checkAndTrack();

    return () => {
      if (interval) clearInterval(interval);
      clearInterval(statusCheckInterval);
    };
  }, []);

  // Gestion de la déconnexion automatique lors de la fermeture
  useEffect(() => {
    const handleExit = async () => {
      console.log('App is exiting... setting driver offline');
      await setDriverOffline();
    };

    // @ts-ignore
    const listener = CapApp.addListener('appExit', handleExit);
    window.addEventListener('beforeunload', handleExit);

    return () => {
      listener.then(l => l.remove());
      window.removeEventListener('beforeunload', handleExit);
    };
  }, []);

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
        <Route path="/support" element={<Support />} />
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
