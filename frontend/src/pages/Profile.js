import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../services/api';
import MovieCard from '../components/MovieCard';
import { FaCalendar, FaStar, FaBookmark, FaArrowLeft } from 'react-icons/fa';
import { RATING_OPTIONS } from '../constants/ratings';

const Profile = ({ user }) => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [watchlistMovies, setWatchlistMovies] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);

  const isSelf = user?.user_id === userId;

  const fetchProfile = useCallback(async () => {
    try {
      const response = await api.get(`/api/user/profile/${userId}`);
      setProfile(response.data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  }, [userId]);

  const fetchUserReviews = useCallback(async () => {
    try {
      const response = await api.get(`/api/reviews/user/${userId}`);
      setReviews(response.data.reviews || []);
    } catch (error) {
      console.error('Error fetching reviews:', error);
      setReviews([]);
    }
  }, [userId]);

  const fetchWatchlist = useCallback(async () => {
    if (!isSelf) {
      setWatchlistMovies([]);
      return;
    }
    try {
      const response = await api.get('/api/watchlist/get');
      setWatchlistMovies(response.data.movies || []);
    } catch {
      setWatchlistMovies([]);
    }
  }, [isSelf]);

  const fetchRecommendations = useCallback(async () => {
    if (!isSelf) {
      setRecommendations([]);
      return;
    }
    try {
      const response = await api.get(`/api/user/recommendations/${userId}`);
      setRecommendations(response.data.movies || []);
    } catch {
      setRecommendations([]);
    }
  }, [isSelf, userId]);

  useEffect(() => {
    setLoading(true);
    const run = async () => {
      await fetchProfile();
      await fetchUserReviews();
      await Promise.all([fetchWatchlist(), fetchRecommendations()]);
      setLoading(false);
    };
    run();
  }, [fetchProfile, fetchUserReviews, fetchWatchlist, fetchRecommendations]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0B0B] flex items-center justify-center pt-20">
        <div className="h-10 w-10 rounded-full border-2 border-white/20 border-t-fuchsia-500 animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#0B0B0B] flex items-center justify-center pt-20">
        <div className="text-white text-2xl">User not found</div>
      </div>
    );
  }

  const rb = profile.rating_breakdown || {};

  return (
    <motion.div
      className="min-h-screen bg-[#0B0B0B] pt-28 pb-12"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
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
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 mb-8 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <img
              src={profile.avatar}
              alt={profile.username}
              className="w-24 h-24 rounded-full border border-white/10"
              data-testid="profile-avatar"
            />
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-white mb-2" data-testid="profile-username">
                {profile.username}
              </h1>
              <div className="flex flex-wrap items-center gap-6 text-gray-400">
                <div className="flex items-center space-x-2">
                  <FaCalendar />
                  <span>Joined {profile.joined_date ? new Date(profile.joined_date).toLocaleDateString() : '—'}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <FaStar />
                  <span>{profile.total_reviews} reviews</span>
                </div>
                <div className="flex items-center space-x-2">
                  <FaBookmark />
                  <span>{profile.watchlist_count ?? 0} saved</span>
                </div>
              </div>
              {profile.favorite_category && (
                <p className="text-fuchsia-300/90 mt-3 text-sm">
                  Favorite genre: <span className="font-semibold text-white">{profile.favorite_category}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-gradient-to-br from-violet-900/40 to-fuchsia-900/30 rounded-2xl p-6 border border-white/10">
            <p className="text-gray-400 text-sm">Total reviews</p>
            <p className="text-4xl font-bold text-white mt-1">{profile.total_reviews}</p>
          </div>
          <div className="bg-gradient-to-br from-emerald-900/40 to-cyan-900/30 rounded-2xl p-6 border border-white/10">
            <p className="text-gray-400 text-sm">My List</p>
            <p className="text-4xl font-bold text-white mt-1">{profile.watchlist_count ?? 0}</p>
          </div>
          <div className="bg-gradient-to-br from-amber-900/40 to-orange-900/30 rounded-2xl p-6 border border-white/10">
            <p className="text-gray-400 text-sm">Top rating given</p>
            <p className="text-lg font-semibold text-white mt-2">
              {(() => {
                let best = null;
                let n = 0;
                const order = RATING_OPTIONS.map((o) => o.value);
                for (let i = order.length - 1; i >= 0; i--) {
                  const lab = order[i];
                  const c = rb[lab] || 0;
                  if (c > n) {
                    n = c;
                    best = lab;
                  }
                }
                return best || '—';
              })()}
            </p>
          </div>
        </div>

        {isSelf && recommendations.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-2">Recommended for you</h2>
            <p className="text-gray-400 text-sm mb-6">
              Based on your reviews
              {profile.favorite_category ? ` and love of ${profile.favorite_category}` : ''} and saved titles.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {recommendations.map((m) => (
                <motion.div
                  key={m.slug || m.id}
                  whileHover={{ scale: 1.04 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                >
                  <MovieCard movie={m} />
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {isSelf && watchlistMovies.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-6">My List</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {watchlistMovies.map((m) => (
                <motion.div key={m.slug || m.id} whileHover={{ scale: 1.04 }} transition={{ type: 'spring', stiffness: 400, damping: 28 }}>
                  <MovieCard movie={m} />
                </motion.div>
              ))}
            </div>
          </section>
        )}

        <h2 className="text-2xl font-bold text-white mb-6">Reviews</h2>
        {reviews.length === 0 ? (
          <div className="bg-white/5 rounded-2xl p-12 text-center border border-white/10">
            <p className="text-gray-400 text-xl">No reviews yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {reviews.map((review) => {
              const ratingOption = RATING_OPTIONS.find((opt) => opt.value === review.rating_label);
              return (
                <motion.div
                  key={review.review_id}
                  className="bg-white/5 rounded-2xl p-6 cursor-pointer hover:bg-white/10 transition border border-white/10"
                  onClick={() => navigate(`/movie/${review.movie_id}`)}
                  data-testid="profile-review-item"
                  whileHover={{ y: -2 }}
                >
                  <div className="flex space-x-4">
                    {review.movie_poster && (
                      <img
                        src={review.movie_poster}
                        alt={review.movie_title || 'Movie'}
                        className="w-20 h-28 object-cover rounded-xl"
                        loading="lazy"
                      />
                    )}
                    <div className="flex-1">
                      <h3 className="text-white font-bold text-lg mb-2">{review.movie_title || 'Movie'}</h3>
                      {ratingOption && (
                        <span
                          className={`${ratingOption.color} px-3 py-1 rounded-full text-white text-sm inline-flex items-center gap-1 mb-3`}
                        >
                          <span>{ratingOption.stars}</span>
                          <span>{ratingOption.label}</span>
                        </span>
                      )}
                      <p className="text-gray-300 mt-2 line-clamp-3">{review.review_text}</p>
                      <p className="text-gray-500 text-sm mt-2">
                        {review.created_at && new Date(review.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default Profile;
