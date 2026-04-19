import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaBookmark, FaSearch, FaLayerGroup } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';

const Navbar = ({ user, onLogout, onOpenAuth }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [results, setResults] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!debounced) {
      setResults([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const response = await api.get('/api/movies/suggest', { params: { query: debounced, page: 1 } });
        if (!cancelled) {
          setResults((response.data.movies || []).slice(0, 8));
        }
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  useEffect(() => {
    const onMouseDown = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  const goToMovie = (id) => {
    setSearchOpen(false);
    setQuery('');
    navigate(`/movie/${id}`);
  };

  return (
    <nav className="fixed top-0 w-full bg-black/70 backdrop-blur-xl border-b border-white/5 z-50 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-[auto_1fr_auto] gap-4 items-center min-h-20 py-3">
          <motion.button
            type="button"
            onClick={() => navigate('/')}
            className="flex items-center min-w-0"
            whileHover={{ scale: 1.05 }}
            transition={{ type: 'spring', stiffness: 320, damping: 22 }}
          >
            <span className="text-red-500 text-3xl font-extrabold tracking-[0.12em] uppercase drop-shadow-[0_0_14px_rgba(239,68,68,0.18)] hover:drop-shadow-[0_0_20px_rgba(239,68,68,0.35)] transition">
              CRITICIZER
            </span>
          </motion.button>

          <div className="relative mx-auto w-full max-w-xl" ref={searchRef}>
            <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              placeholder="Search movies and series"
              className="w-full rounded-2xl bg-white/5 border border-white/10 text-white pl-11 pr-4 py-3 outline-none focus:border-fuchsia-500/70 focus:ring-2 focus:ring-fuchsia-500/20"
            />
            {searchOpen && query.trim() && (
              <div className="absolute left-0 right-0 top-full mt-2 rounded-2xl border border-white/10 bg-[#111111]/95 backdrop-blur-2xl shadow-2xl overflow-hidden">
                {loading ? (
                  <div className="px-4 py-4 text-sm text-gray-400">Searching...</div>
                ) : results.length === 0 ? (
                  <div className="px-4 py-4 text-sm text-gray-400">No matches found</div>
                ) : (
                  <ul className="max-h-96 overflow-y-auto py-2">
                    {results.map((item) => (
                      <li key={`${item.media_type || 'movie'}-${item.id}`}>
                        <button
                          type="button"
                          onClick={() => goToMovie(item.id)}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition text-left"
                        >
                          {item.poster_path ? (
                            <img
                              src={item.poster_path}
                              alt=""
                              className="w-10 h-14 rounded-lg object-cover flex-none"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-10 h-14 rounded-lg bg-white/5 flex-none" />
                          )}
                          <div className="min-w-0">
                            <div className="text-white font-medium truncate">{item.title}</div>
                            <div className="text-xs text-gray-500 capitalize">
                              {item.media_type || 'movie'} {item.release_date ? `• ${item.release_date.slice(0, 4)}` : ''}
                            </div>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end space-x-3 sm:space-x-4">
            {user ? (
              <>
                <button
                  onClick={() => navigate('/watchlist')}
                  className="flex items-center space-x-2 text-white hover:text-red-500 transition"
                  data-testid="watchlist-nav-button"
                >
                  <FaBookmark className="text-xl" />
                  <span className="hidden md:inline">My Lists</span>
                </button>

                <button
                  onClick={() => navigate(`/profile/${user.user_id}`)}
                  className="hidden sm:flex items-center space-x-2 text-white hover:text-fuchsia-400 transition"
                >
                  <FaLayerGroup className="text-sm" />
                  <span>Profile</span>
                </button>

                <div className="relative group">
                  <button className="flex items-center space-x-2 text-white hover:text-red-500 transition">
                    <img
                      src={user.avatar}
                      alt={user.username}
                      className="w-8 h-8 rounded-full ring-2 ring-transparent group-hover:ring-fuchsia-400/60 transition"
                    />
                    <span className="hidden md:inline">{user.username}</span>
                  </button>

                  <AnimatePresence>
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      whileHover={{ opacity: 1, y: 0 }}
                      className="absolute right-0 mt-2 w-48 bg-[#181818] rounded-2xl border border-white/10 shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 overflow-hidden"
                    >
                      <Link
                        to={`/profile/${user.user_id}`}
                        className="block px-4 py-3 text-white hover:bg-white/5 transition"
                        data-testid="profile-nav-link"
                      >
                        My Profile
                      </Link>
                      <button
                        onClick={onLogout}
                        className="w-full text-left px-4 py-3 text-white hover:bg-white/5 transition"
                        data-testid="logout-button"
                      >
                        Logout
                      </button>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </>
            ) : (
              <button
                onClick={() => onOpenAuth('login')}
                className="bg-red-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-red-700 transition"
                data-testid="signin-button"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;