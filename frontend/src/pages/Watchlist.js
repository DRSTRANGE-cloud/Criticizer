import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaArrowLeft, FaBookmark, FaCheckCircle, FaFilm } from 'react-icons/fa';
import api from '../services/api';
import MovieCard from '../components/MovieCard';

const Watchlist = ({ user }) => {
  const navigate = useNavigate();
  const [items, setItems] = useState({ watchlist: [], watched: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWatchlist();
  }, []);

  const fetchWatchlist = async () => {
    try {
      const response = await api.get('/api/watchlist/get');
      setItems(response.data.items || { watchlist: [], watched: [] });
    } catch (error) {
      console.error('Error fetching watchlist:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0B0B] flex items-center justify-center pt-20">
        <div className="h-10 w-10 rounded-full border-2 border-white/20 border-t-fuchsia-500 animate-spin" />
      </div>
    );
  }

  return (
    <motion.div
      className="min-h-screen bg-[#0B0B0B] pt-28 pb-12"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="group mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:border-fuchsia-500/50 hover:bg-white/10"
        >
          <FaArrowLeft className="text-xs transition group-hover:-translate-x-0.5" />
          Back
        </button>
        <section className="mb-10 overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(220,38,38,0.18),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.025))] p-6 sm:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-red-200/80">Your cinema shelf</p>
              <h1 className="mt-2 text-4xl font-black text-white sm:text-5xl" data-testid="watchlist-title">
                My List
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-gray-400">
                Keep upcoming watches and finished titles in one place, with quick visual sections for what is next.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                ['Saved', (items.watchlist?.length || 0) + (items.watched?.length || 0), FaFilm],
                ['To watch', items.watchlist?.length || 0, FaBookmark],
                ['Watched', items.watched?.length || 0, FaCheckCircle],
              ].map(([label, value, Icon]) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
                  <Icon className="mx-auto mb-2 text-red-300" />
                  <p className="text-2xl font-bold text-white">{value}</p>
                  <p className="text-[11px] uppercase tracking-wider text-gray-500">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {Object.values(items).every((group) => group.length === 0) ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-12 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-600/15 text-red-200">
              <FaBookmark className="text-2xl" />
            </div>
            <p className="text-gray-200 text-xl mb-3">No saved titles yet</p>
            <p className="text-gray-500">Save movies to watch or mark them as watched from any title page.</p>
          </div>
        ) : (
          <div className="space-y-10">
            {[
              ['watchlist', 'To watch'],
              ['watched', 'Watched'],
            ].map(([key, label]) => (
              <section key={key} className="rounded-3xl border border-white/10 bg-white/[0.025] p-4 sm:p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="inline-flex items-center gap-3 text-2xl font-semibold text-white">
                    {key === 'watchlist' ? <FaBookmark className="text-red-300" /> : <FaCheckCircle className="text-emerald-300" />}
                    {label}
                  </h2>
                  <span className="text-sm text-gray-500">{items[key]?.length || 0} titles</span>
                </div>
                {items[key]?.length ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                    {items[key].map((movie) => (
                      <motion.div
                        key={`${key}-${movie.slug || movie.id}`}
                        whileHover={{ scale: 1.04 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                      >
                        <MovieCard movie={movie} />
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-gray-500">
                    Nothing here yet.
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default Watchlist;
