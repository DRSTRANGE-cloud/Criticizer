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
          path="/oauth/github/callback"
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

function postGithubOAuthResult(search, pathname) {
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
      redirect_uri: `${window.location.origin}${pathname}`,
    },
    window.location.origin,
  );
  return true;
}

function GithubOAuthBridge() {
  const location = useLocation();

  useEffect(() => {
    if (!postGithubOAuthResult(location.search, location.pathname)) return undefined;

    const timer = window.setTimeout(() => {
      window.close();
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [location.pathname, location.search]);

  return null;
}

function GithubOAuthCallback() {
  const location = useLocation();
  const [status, setStatus] = useState('Completing GitHub sign in');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    const error = params.get('error');
    if (window.opener && !window.opener.closed) return undefined;
    if (error) {
      setStatus('GitHub sign in was cancelled');
      window.setTimeout(() => window.location.replace('/'), 1200);
      return undefined;
    }
    if (!code) return undefined;

    let cancelled = false;
    const completeInCurrentWindow = async () => {
      try {
        const response = await api.post('/api/auth/oauth', {
          provider: 'github',
          code,
          redirect_uri: `${window.location.origin}${location.pathname}`,
        });
        if (cancelled) return;
        localStorage.setItem('token', response.data.access_token);
        setStatus('Welcome to Criticizer');
        window.setTimeout(() => window.location.replace('/'), 500);
      } catch {
        if (!cancelled) {
          setStatus('Unable to complete GitHub sign in');
          window.setTimeout(() => window.location.replace('/'), 1600);
        }
      }
    };
    completeInCurrentWindow();
    return () => {
      cancelled = true;
    };
  }, [location.pathname, location.search]);

  return (
    <>
      <GithubOAuthBridge />
      <div className="min-h-screen bg-[#0B0B0B] flex items-center justify-center px-4">
        <div className="max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-center text-white shadow-2xl">
          <p className="text-xs uppercase tracking-[0.25em] text-red-300/80">Criticizer</p>
          <h1 className="mt-3 text-2xl font-bold">{status}</h1>
          <p className="mt-2 text-sm text-gray-400">
            This will only take a moment.
          </p>
        </div>
      </div>
    </>
  );
}

function WelcomeModal({ user, onDismiss }) {
  const firstName = (user?.username || user?.email || 'there').split(/[.@_\s-]/)[0];
  return (
    <motion.div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 px-4 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        className="w-full max-w-lg overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(220,38,38,0.22),transparent_35%),linear-gradient(145deg,#181114,#080808)] p-7 text-center shadow-2xl"
      >
        <p className="text-xs uppercase tracking-[0.3em] text-red-200/80">Welcome to Criticizer</p>
        <h2 className="mt-4 text-3xl font-black text-white sm:text-4xl">Hey {firstName},</h2>
        <p className="mx-auto mt-3 max-w-sm text-gray-300">Your movie journey starts now. Discover movies, rate films, create watchlists, and share reviews.</p>
        <div className="mt-6 grid grid-cols-2 gap-3 text-left text-sm text-gray-300">
          {['Discover smarter picks', 'Rate your favorites', 'Build My List', 'Join discussions'].map((item) => (
            <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3">{item}</div>
          ))}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="mt-7 w-full rounded-2xl bg-gradient-to-r from-red-600 to-red-800 px-5 py-3 font-semibold text-white transition hover:opacity-90"
        >
          Let's begin
        </button>
      </motion.div>
    </motion.div>
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
  const [welcomeUser, setWelcomeUser] = useState(null);

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
    const welcomeKey = `criticizer_welcome_seen_${userData.user_id}`;
    if (!localStorage.getItem(welcomeKey)) {
      setWelcomeUser(userData);
    }
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
        <AnimatePresence>
          {welcomeUser && (
            <WelcomeModal
              user={welcomeUser}
              onDismiss={() => {
                localStorage.setItem(`criticizer_welcome_seen_${welcomeUser.user_id}`, '1');
                setWelcomeUser(null);
              }}
            />
          )}
        </AnimatePresence>
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
