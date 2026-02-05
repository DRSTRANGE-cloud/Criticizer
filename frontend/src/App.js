import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import MovieDetails from './pages/MovieDetails';
import Watchlist from './pages/Watchlist';
import Profile from './pages/Profile';
import AuthModal from './components/AuthModal';
import './App.css';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

function App() {
  const [user, setUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const response = await axios.get(`${API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUser(response.data);
      } catch (error) {
        localStorage.removeItem('token');
      }
    }
    setLoading(false);
  };

  const handleLogin = (userData, token) => {
    localStorage.setItem('token', token);
    setUser(userData);
    setShowAuthModal(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  const openAuthModal = (mode = 'login') => {
    setAuthMode(mode);
    setShowAuthModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-2xl">Loading...</div>
      </div>
    );
  }

  return (
    <Router>
      <div className="App bg-black min-h-screen">
        <Navbar user={user} onLogout={handleLogout} onOpenAuth={openAuthModal} />
        
        <Routes>
          <Route path="/" element={<Home user={user} onOpenAuth={openAuthModal} />} />
          <Route path="/movie/:id" element={<MovieDetails user={user} onOpenAuth={openAuthModal} />} />
          <Route 
            path="/watchlist" 
            element={user ? <Watchlist user={user} /> : <Navigate to="/" />} 
          />
          <Route 
            path="/profile/:userId" 
            element={<Profile user={user} />} 
          />
        </Routes>

        {showAuthModal && (
          <AuthModal
            mode={authMode}
            onClose={() => setShowAuthModal(false)}
            onSuccess={handleLogin}
            onSwitchMode={(mode) => setAuthMode(mode)}
          />
        )}
      </div>
    </Router>
  );
}

export default App;