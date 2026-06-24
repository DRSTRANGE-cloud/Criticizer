import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import api from './services/api';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import AuthModal from './components/AuthModal';
import './App.css';

const Home = lazy(() => import('./pages/Home'));
const MovieDetails = lazy(() => import('./pages/MovieDetails'));
const Watchlist = lazy(() => import('./pages/Watchlist'));
const Profile = lazy(() => import('./pages/Profile'));
const Wrapped = lazy(() => import('./pages/Wrapped'));
const ChatbotWidget = lazy(() => import('./components/chatbot'));

const pageVariants = {
  initial: { opacity: 0, y: 12, scale: 0.995 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -8, scale: 0.995 },
};

function PageShell({ children }) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

function AppRoutes({ user, onOpenAuth }) {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route
          path="/auth/github/callback"
          element={<GithubOAuthCallback onOpenAuth={onOpenAuth} />}
        />
        <Route
          path="/"
          element={
            <PageShell>
              <Home user={user} onOpenAuth={onOpenAuth} />
            </PageShell>
          }
        />
        <Route
          path="/movie/:id"
          element={
            <PageShell>
              <MovieDetails user={user} onOpenAuth={onOpenAuth} />
            </PageShell>
          }
        />
        <Route
          path="/watchlist"
          element={
            user ? (
              <PageShell>
                <Watchlist user={user} />
              </PageShell>
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/profile/:userId"
          element={
            user ? (
              <PageShell>
                <Profile user={user} />
              </PageShell>
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/profile/:userId/wrapped"
          element={
            user ? (
              <PageShell>
                <Wrapped user={user} />
              </PageShell>
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
      </Routes>
    </AnimatePresence>
  );
}

function postGithubOAuthResult(search) {
  const params = new URLSearchParams(search);
  const code = params.get('code');
  const state = params.get('state');
  const error = params.get('error');

  if (!code && !error) return false;
  if (!window.opener || window.opener.closed) return false;

  window.opener.postMessage(
    {
      type: 'criticizer-github-oauth',
      code,
      state,
      error,
      redirect_uri: window.location.origin,
    },
    window.location.origin,
  );
  return true;
}

function GithubOAuthBridge() {
  const location = useLocation();

  useEffect(() => {
    if (!postGithubOAuthResult(location.search)) return undefined;

    const timer = window.setTimeout(() => {
      window.close();
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [location.search]);

  return null;
}

function GithubOAuthCallback() {
  GithubOAuthBridge();

  return (
    <div className="min-h-screen bg-[#0B0B0B] flex items-center justify-center px-4">
      <div className="max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-center text-white shadow-2xl">
        <p className="text-xs uppercase tracking-[0.25em] text-red-300/80">Criticizer</p>
        <h1 className="mt-3 text-2xl font-bold">Completing GitHub sign in</h1>
        <p className="mt-2 text-sm text-gray-400">
          You can close this window if it does not close automatically.
        </p>
      </div>
    </div>
  );
}

function AppLoading() {
  return (
    <div className="min-h-screen bg-[#0B0B0B] flex items-center justify-center">
      <div className="w-full max-w-7xl px-4 space-y-6">
        <div className="h-10 w-48 rounded-xl bg-white/5 animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[280px] rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}

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
        const response = await api.get('/api/auth/me');
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
    return <AppLoading />;
  }

  return (
    <Router>
      <div className="App bg-[#0B0B0B] min-h-screen">
        <GithubOAuthBridge />
        <Navbar user={user} onLogout={handleLogout} onOpenAuth={openAuthModal} />

        <Suspense fallback={<AppLoading />}>
          <AppRoutes user={user} onOpenAuth={openAuthModal} />
        </Suspense>

        {showAuthModal && (
          <AuthModal
            mode={authMode}
            onClose={() => setShowAuthModal(false)}
            onSuccess={handleLogin}
            onSwitchMode={(mode) => setAuthMode(mode)}
          />
        )}
        <Footer />

        {user && (
          <Suspense fallback={null}>
            <ChatbotWidget user={user} />
          </Suspense>
        )}
      </div>
    </Router>
  );
}

export default App;
