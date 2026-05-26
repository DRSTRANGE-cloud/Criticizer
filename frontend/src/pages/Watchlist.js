import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaArrowLeft } from 'react-icons/fa';
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
        <h1 className="text-4xl font-bold text-white mb-8" data-testid="watchlist-title">
          My List
        </h1>

        {Object.values(items).every((group) => group.length === 0) ? (
          <div className="bg-white/5 rounded-2xl p-12 text-center border border-white/10">
            <p className="text-gray-400 text-xl mb-4">No saved titles yet</p>
            <p className="text-gray-500">Save movies to watch or mark them as watched from any title page.</p>
          </div>
        ) : (
          <div className="space-y-10">
            {[
              ['watchlist', 'To watch'],
              ['watched', 'Watched'],
            ].map(([key, label]) => (
              <section key={key}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-semibold text-white">{label}</h2>
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
