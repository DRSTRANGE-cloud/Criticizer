import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaArrowLeft, FaBookmark, FaCalendar, FaChartLine, FaComment, FaPlayCircle, FaStar, FaTrash } from 'react-icons/fa';
import api from '../services/api';
import MovieCard from '../components/MovieCard';
import { RATING_OPTIONS } from '../constants/ratings';

const Profile = ({ user }) => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [comments, setComments] = useState([]);
  const [watchlistMovies, setWatchlistMovies] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  const isSelf = user?.user_id === userId;

  const loadProfile = useCallback(async () => {
    const [profileRes, reviewsRes, commentsRes, watchlistRes, recsRes] = await Promise.all([
      api.get(`/api/user/profile/${userId}`),
      api.get(`/api/reviews/user/${userId}`),
      api.get(`/api/comments/user/${userId}`),
      isSelf ? api.get('/api/watchlist/get') : Promise.resolve({ data: { movies: [] } }),
      isSelf ? api.get(`/api/user/recommendations/${userId}`) : Promise.resolve({ data: { movies: [] } }),
    ]);

    setProfile(profileRes.data);
    setReviews(reviewsRes.data.reviews || []);
    setComments(commentsRes.data.comments || []);
    setWatchlistMovies(watchlistRes.data.movies || []);
    setRecommendations(recsRes.data.movies || []);
  }, [isSelf, userId]);

  const deleteReview = async (event, reviewId) => {
    event.stopPropagation();
    setDeletingId(reviewId);
    try {
      await api.delete(`/api/reviews/${reviewId}`);
      setReviews((prev) => prev.filter((review) => review.review_id !== reviewId));
      setComments((prev) => prev.filter((comment) => comment.review_id !== reviewId));
    } finally {
      setDeletingId(null);
    }
  };

  const deleteComment = async (commentId) => {
    setDeletingId(commentId);
    try {
      await api.delete(`/api/comments/${commentId}`);
      setComments((prev) =>
        prev.filter((comment) => comment.comment_id !== commentId && comment.parent_comment_id !== commentId),
      );
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    if (!user || !isSelf) {
      setLoading(false);
      return;
    }
    setLoading(true);
    loadProfile()
      .catch((error) => {
        console.error('Error loading profile:', error);
      })
      .finally(() => setLoading(false));
  }, [user, isSelf, loadProfile]);

  if (!user || !isSelf) {
    return (
      <div className="min-h-screen bg-[#0B0B0B] flex flex-col items-center justify-center pt-24 px-4">
        <div className="text-white text-2xl mb-3">Profile is private</div>
        <p className="text-gray-400 text-center max-w-md">Sign in to view your Criticizer profile.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0B0B] flex items-center justify-center pt-24">
        <div className="h-10 w-10 rounded-full border-2 border-white/20 border-t-fuchsia-500 animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#0B0B0B] flex items-center justify-center pt-24">
        <div className="text-white text-2xl">User not found</div>
      </div>
    );
  }

  const ratingBreakdown = profile.rating_breakdown || {};

  const topRatingLabel = (() => {
    let winner = null;
    let count = -1;
    for (const option of RATING_OPTIONS) {
      const next = ratingBreakdown[option.value] || 0;
      if (next > count) {
        winner = option.label;
        count = next;
      }
    }
    return count > 0 ? winner : 'Still forming';
  })();

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
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:border-fuchsia-500/50 hover:bg-white/10"
        >
          <FaArrowLeft className="text-xs" />
          Back
        </button>

        <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(244,114,182,0.16),transparent_35%),linear-gradient(140deg,#151518,#0c0c0f)] p-8 shadow-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <img
                src={profile.avatar}
                alt={profile.username}
                className="w-24 h-24 rounded-full border border-white/10 object-cover"
                data-testid="profile-avatar"
              />
              <div>
                <h1 className="text-4xl font-bold text-white" data-testid="profile-username">
                  {profile.username}
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-5 text-gray-400">
                  <span className="inline-flex items-center gap-2">
                    <FaCalendar />
                    Joined {profile.joined_date ? new Date(profile.joined_date).toLocaleDateString() : '-'}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <FaStar />
                    {profile.total_reviews} reviews
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <FaBookmark />
                    {profile.watchlist_count ?? 0} saved
                  </span>
                </div>
                {profile.favorite_category && (
                  <p className="mt-3 text-sm text-fuchsia-200/90">
                    Favorite genre: <span className="font-semibold text-white">{profile.favorite_category}</span>
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate(`/profile/${userId}/wrapped`)}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-red-800 px-5 py-3 font-semibold text-white transition-all duration-300 hover:from-red-500 hover:to-red-700 hover:scale-105 hover:shadow-xl hover:shadow-red-600/40"
            >
              <FaChartLine className="text-sm" />
              Open Criticizer Wrapped
            </button>
          </div>
        </section>

        <section className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            ['Total reviews', profile.total_reviews],
            ['Watched titles', profile.watched_count ?? 0],
            ['Saved titles', profile.watchlist_count ?? 0],
            ['AI chats', profile.chat_count ?? 0],
          ].map(([label, value]) => (
            <div key={label} className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
              <p className="text-xs uppercase tracking-[0.25em] text-gray-500">{label}</p>
              <p className="mt-3 text-4xl font-black text-white">{value}</p>
            </div>
          ))}
        </section>

        <section className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-violet-900/35 to-fuchsia-900/20 p-6">
            <p className="text-sm text-gray-400">Top rating given</p>
            <p className="mt-3 text-2xl font-bold text-white">{topRatingLabel}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-900/30 to-blue-900/20 p-6">
            <p className="text-sm text-gray-400">Favorite genre</p>
            <p className="mt-3 text-2xl font-bold text-white">{profile.favorite_category || 'Still forming'}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-amber-900/30 to-red-900/20 p-6">
            <p className="text-sm text-gray-400">Taste signal</p>
            <p className="mt-3 text-2xl font-bold text-white">
              {profile.total_reviews >= 10 ? 'Confident profile' : 'Needs more ratings'}
            </p>
          </div>
        </section>

        {recommendations.length > 0 && (
          <section className="mt-12">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-white">Recommended for you</h2>
                <p className="mt-2 text-sm text-gray-400">
                  Weighted from your strongest ratings, saved titles, and favorite genre signals.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {recommendations.map((movie) => (
                <motion.div key={movie.slug || movie.id} whileHover={{ scale: 1.04 }} transition={{ type: 'spring', stiffness: 400, damping: 28 }}>
                  <MovieCard movie={movie} />
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {watchlistMovies.length > 0 && (
          <section className="mt-12">
            <h2 className="text-2xl font-bold text-white mb-5">My List</h2>
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {watchlistMovies.map((movie) => (
                <motion.div key={movie.slug || movie.id} whileHover={{ scale: 1.04 }} transition={{ type: 'spring', stiffness: 400, damping: 28 }}>
                  <MovieCard movie={movie} />
                </motion.div>
              ))}
            </div>
          </section>
        )}

        <section className="mt-12">
          <h2 className="text-2xl font-bold text-white mb-6">Reviews</h2>
          {reviews.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-12 text-center">
              <p className="text-xl text-gray-400">No reviews yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {reviews.map((review) => {
                const ratingOption = RATING_OPTIONS.find((option) => option.value === review.rating_label);
                return (
                  <motion.div
                    key={review.review_id}
                    className="group relative cursor-pointer rounded-3xl border border-white/10 bg-white/[0.04] p-6 transition hover:bg-white/[0.07]"
                    onClick={() => navigate(`/movie/${review.movie_id}`)}
                    data-testid="profile-review-item"
                    whileHover={{ y: -2 }}
                  >
                    <button
                      type="button"
                      onClick={(event) => deleteReview(event, review.review_id)}
                      disabled={deletingId === review.review_id}
                      className="absolute right-4 top-4 rounded-full border border-red-500/30 bg-red-500/10 p-2 text-red-200 opacity-100 transition hover:bg-red-500/20 disabled:opacity-50 md:opacity-0 md:group-hover:opacity-100"
                      aria-label="Delete review"
                    >
                      <FaTrash className="text-xs" />
                    </button>
                    <div className="flex gap-4">
                      {review.movie_poster && (
                        <img
                          src={review.movie_poster}
                          alt={review.movie_title || 'Movie'}
                          className="w-20 h-28 rounded-2xl object-cover"
                          loading="lazy"
                        />
                      )}
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-white">{review.movie_title || 'Movie'}</h3>
                        {ratingOption && (
                          <span
                            className="mt-3 inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm text-white"
                            style={{ backgroundColor: ratingOption.color }}
                          >
                            <span>{ratingOption.stars}</span>
                            <span>{ratingOption.label}</span>
                          </span>
                        )}
                        <p className="mt-3 line-clamp-3 text-gray-300">{review.review_text}</p>
                        <p className="mt-3 inline-flex items-center gap-2 text-sm text-gray-500">
                          <FaPlayCircle className="text-xs" />
                          {review.created_at && new Date(review.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-bold text-white mb-6">Comments</h2>
          {comments.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center">
              <p className="text-gray-400">No comments yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {comments.map((comment) => (
                <div
                  key={comment.comment_id}
                  className="rounded-3xl border border-white/10 bg-white/[0.04] p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="inline-flex items-center gap-2 text-sm font-semibold text-white">
                        <FaComment className="text-fuchsia-300" />
                        Your comment
                      </p>
                      <p className="mt-2 text-gray-300">{comment.text}</p>
                      <p className="mt-3 text-xs text-gray-500">
                        {comment.created_at && new Date(comment.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteComment(comment.comment_id)}
                      disabled={deletingId === comment.comment_id}
                      className="shrink-0 rounded-full border border-red-500/30 bg-red-500/10 p-2 text-red-200 transition hover:bg-red-500/20 disabled:opacity-50"
                      aria-label="Delete comment"
                    >
                      <FaTrash className="text-xs" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </motion.div>
  );
};

export default Profile;
