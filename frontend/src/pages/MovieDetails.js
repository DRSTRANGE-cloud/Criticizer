import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  PieChart,
  Pie,
  RadialBarChart,
  RadialBar,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import api from '../services/api';
import { FaStar, FaBookmark, FaPlay, FaExternalLinkAlt, FaClock, FaCheckCircle, FaHeart, FaComment } from 'react-icons/fa';
import MovieCard from '../components/MovieCard';
import { RATING_OPTIONS } from '../constants/ratings';

const WATCH_STATES = [
  { value: 'watchlist', label: 'Watchlist', icon: FaBookmark },
  { value: 'watch_later', label: 'Watch Later', icon: FaClock },
  { value: 'watched', label: 'Watched', icon: FaCheckCircle },
];

const MovieDetails = ({ user, onOpenAuth }) => {
  const { id } = useParams();
  const [movie, setMovie] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [ratingPct, setRatingPct] = useState({});
  const [whereToWatch, setWhereToWatch] = useState([]);
  const [apiError, setApiError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [watchStatus, setWatchStatus] = useState(null);
  const [topReview, setTopReview] = useState(null);
  const [similarMovies, setSimilarMovies] = useState([]);
  const [commentsByReview, setCommentsByReview] = useState({});
  const [commentDrafts, setCommentDrafts] = useState({});
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewData, setReviewData] = useState({
    rating_label: '',
    review_text: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const meterRows = useMemo(() => {
    return RATING_OPTIONS.map((o) => ({
      name: o.label,
      pct: ratingPct[o.value] ?? 0,
      fill: o.color,
    }));
  }, [ratingPct]);

  const genreRows = useMemo(() => {
    const genres = movie?.genres || [];
    if (!genres.length) return [];
    const equalShare = Math.round(100 / genres.length);
    return genres.map((name, index) => ({
      name,
      value: index === genres.length - 1 ? 100 - equalShare * index : equalShare,
      fill: ['#9333ea', '#2563eb', '#dc2626', '#059669', '#f59e0b'][index % 5],
    }));
  }, [movie]);

  const fetchMovieDetails = useCallback(async () => {
    try {
      const response = await api.get(`/api/movies/${id}`);
      setApiError(response.data.error || null);
      setMovie(response.data.movie);
      setReviews(response.data.reviews || []);
      setRatingPct(response.data.rating_distribution_pct || {});
      setWhereToWatch(response.data.where_to_watch || []);
      setTopReview(response.data.top_review || null);
      setSimilarMovies(response.data.similar_movies || []);
    } catch (error) {
      setApiError(error.response?.data?.detail || error.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const checkWatchlist = useCallback(async () => {
    try {
      const response = await api.get(`/api/watchlist/check/${id}`);
      setWatchStatus(response.data.status || null);
    } catch {
      /* guest */
    }
  }, [id]);

  const fetchComments = useCallback(async (reviewId) => {
    try {
      const response = await api.get(`/api/comments/review/${reviewId}`);
      setCommentsByReview((prev) => ({ ...prev, [reviewId]: response.data.comments || [] }));
    } catch {
      setCommentsByReview((prev) => ({ ...prev, [reviewId]: [] }));
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchMovieDetails();
  }, [fetchMovieDetails]);

  useEffect(() => {
    if (user) checkWatchlist();
  }, [user, id, checkWatchlist]);

  useEffect(() => {
    reviews.slice(0, 6).forEach((review) => {
      fetchComments(review.review_id);
    });
  }, [reviews, fetchComments]);

  const saveToList = async (status) => {
    if (!user) {
      onOpenAuth('login');
      return;
    }

    try {
      if (watchStatus === status) {
        await api.delete(`/api/watchlist/remove/${id}`);
        setWatchStatus(null);
      } else {
        await api.post('/api/watchlist/add', { movie_id: id, status });
        setWatchStatus(status);
      }
    } catch (error) {
      console.error('Error updating list:', error);
    }
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!user) {
      onOpenAuth('login');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/api/reviews/create', {
        movie_id: id,
        rating_label: reviewData.rating_label,
        review_text: reviewData.review_text,
      });

      setShowReviewForm(false);
      setReviewData({ rating_label: '', review_text: '' });
      fetchMovieDetails();
    } catch (error) {
      alert(error.response?.data?.detail || 'Error submitting review');
    } finally {
      setSubmitting(false);
    }
  };

  const likeReview = async (reviewId) => {
    if (!user) {
      onOpenAuth('login');
      return;
    }
    await api.post('/api/reviews/like', { review_id: reviewId });
    fetchMovieDetails();
  };

  const addComment = async (reviewId, parentCommentId = null) => {
    if (!user) {
      onOpenAuth('login');
      return;
    }
    const draftKey = parentCommentId ? `${reviewId}:${parentCommentId}` : reviewId;
    const text = (commentDrafts[draftKey] || '').trim();
    if (!text) return;
    await api.post('/api/comments/create', {
      review_id: reviewId,
      text,
      parent_comment_id: parentCommentId,
    });
    setCommentDrafts((prev) => ({ ...prev, [draftKey]: '' }));
    fetchComments(reviewId);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0B0B] flex items-center justify-center pt-20">
        <div className="h-10 w-10 rounded-full border-2 border-white/20 border-t-fuchsia-500 animate-spin" />
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="min-h-screen bg-[#0B0B0B] flex flex-col items-center justify-center pt-20 px-4">
        <div className="text-white text-2xl mb-4">Movie not found</div>
        {apiError && (
          <p className="text-red-400 text-center max-w-lg" data-testid="movie-api-error">
            {apiError}
          </p>
        )}
      </div>
    );
  }

  const genres = movie.genres || [];
  const backdrop = movie.backdrop_path || movie.poster_path;
  const cast = movie.cast || [];
  const companies = movie.production_companies || [];
  const meterScore = Math.max(...Object.values(ratingPct || {}), 0);

  return (
    <motion.div
      className="min-h-screen bg-[#0B0B0B]"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div
        className="relative min-h-[90vh] bg-cover bg-center"
        style={{
          backgroundImage: backdrop
            ? `linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.95)), url(${backdrop})`
            : undefined,
        }}
      >
        <div className="absolute inset-0 flex items-end pb-20 pt-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
            <div className="flex flex-col md:flex-row gap-8">
              {movie.poster_path && (
                <motion.img
                  src={movie.poster_path}
                  alt={movie.title}
                  loading="lazy"
                  className="w-64 h-96 object-cover rounded-2xl shadow-2xl border border-white/10"
                  data-testid="movie-poster"
                  whileHover={{ scale: 1.03 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 24 }}
                />
              )}
              <div className="flex-1">
                <h1 className="text-5xl font-bold text-white mb-4" data-testid="movie-title">
                  {movie.title}
                </h1>
                <div className="flex flex-wrap items-center gap-4 mb-4">
                  <div className="flex items-center space-x-2">
                    <FaStar className="text-amber-400 text-xl" />
                    <span className="text-white text-xl font-semibold" data-testid="movie-rating">
                      {typeof movie.vote_average === 'number' ? movie.vote_average.toFixed(1) : movie.vote_average}
                    </span>
                    <span className="text-gray-400 text-sm">TMDB</span>
                  </div>
                  {movie.release_date && (
                    <span className="text-gray-300">{movie.release_date?.slice(0, 4)}</span>
                  )}
                  {movie.runtime ? <span className="text-gray-300">{movie.runtime} min</span> : null}
                  {movie.director && (
                    <span className="text-gray-300">
                      Director: <span className="text-white">{movie.director}</span>
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 mb-6">
                  {genres.map((genre, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-white/10 backdrop-blur rounded-full text-white text-sm border border-white/10"
                    >
                      {genre}
                    </span>
                  ))}
                </div>
                <p className="text-gray-300 text-lg mb-6 max-w-3xl" data-testid="movie-overview">
                  {movie.overview}
                </p>
                {companies.length > 0 && (
                  <div className="flex flex-wrap gap-3 mb-6">
                    {companies.slice(0, 6).map((c, i) =>
                      c.logo_path ? (
                        <img
                          key={i}
                          src={c.logo_path}
                          alt={c.name || 'Studio'}
                          className="h-8 object-contain opacity-90"
                          loading="lazy"
                        />
                      ) : (
                        <span key={i} className="text-gray-400 text-sm border border-white/10 rounded-lg px-2 py-1">
                          {c.name}
                        </span>
                      )
                    )}
                  </div>
                )}
                <div className="flex flex-wrap gap-3">
                  {movie.trailer_key && (
                    <a
                      href={`https://www.youtube.com/watch?v=${movie.trailer_key}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-2 bg-white text-black px-6 py-3 rounded-xl font-semibold hover:bg-gray-200 transition"
                      data-testid="watch-trailer-button"
                    >
                      <FaPlay />
                      <span>Watch Trailer</span>
                    </a>
                  )}
                  {WATCH_STATES.map((state) => {
                    const Icon = state.icon;
                    const active = watchStatus === state.value;
                    return (
                      <button
                        key={state.value}
                        onClick={() => saveToList(state.value)}
                        className={`flex items-center space-x-2 px-5 py-3 rounded-xl font-semibold transition border ${
                          active
                            ? 'bg-red-600 text-white border-red-500'
                            : 'bg-white/10 text-white hover:bg-white/20 border-white/20'
                        }`}
                      >
                        <Icon />
                        <span>{state.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {cast.length > 0 && (
        <div className="bg-[#0B0B0B] border-t border-white/5 py-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-white mb-6">Top cast</h2>
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur px-4 py-4">
              {cast.map((c) => (
                <motion.div key={c.id} className="flex-none w-28 text-center group" whileHover={{ y: -2 }}>
                  <div className="relative w-28 h-28 mx-auto rounded-full overflow-hidden bg-white/5 border border-white/10 mb-2">
                    {c.profile_path ? (
                      <img src={c.profile_path} alt={c.name} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">No photo</div>
                    )}
                    <div className="absolute inset-0 bg-black/65 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center px-2">
                      <p className="text-[10px] text-white font-semibold text-center leading-tight">{c.name}</p>
                      <p className="text-[10px] text-gray-300 text-center mt-1">{c.character}</p>
                    </div>
                  </div>
                  <p className="text-white text-sm font-medium leading-tight">{c.name}</p>
                  <p className="text-gray-500 text-xs line-clamp-2">{c.character}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      )}

      {whereToWatch.length > 0 && (
        <div className="bg-[#0B0B0B] border-t border-white/5 py-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-white mb-6">Where to watch</h2>
            <div className="flex flex-wrap gap-4">
              {whereToWatch.map((p, idx) => (
                <div
                  key={`${p.source}-${p.provider_name}-${p.type}-${idx}`}
                  className="flex items-center gap-3 bg-white/5 backdrop-blur rounded-2xl px-4 py-3 border border-white/10 shadow-lg"
                >
                  {p.logo_path && (
                    <img src={p.logo_path} alt="" className="w-10 h-10 object-contain rounded" loading="lazy" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{p.provider_name}</p>
                    <p className="text-gray-500 text-xs capitalize">{p.type}</p>
                  </div>
                  {p.web_url && (
                    <a
                      href={p.web_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-fuchsia-400 hover:text-fuchsia-300 text-sm font-semibold whitespace-nowrap"
                    >
                      Watch <FaExternalLinkAlt className="text-xs" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="bg-black py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {topReview && (
            <div className="mb-8 rounded-3xl border border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-900/20 to-black p-6">
              <div className="flex items-center gap-2 text-fuchsia-300 text-sm font-semibold uppercase tracking-[0.2em]">
                <FaHeart className="text-xs" />
                Top Review Highlight
              </div>
              <p className="mt-3 text-white text-lg leading-8">{topReview.review_text}</p>
              <p className="mt-3 text-sm text-gray-400">
                {topReview.username || 'Criticizer user'} • {topReview.likes || 0} likes
              </p>
            </div>
          )}

          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold text-white">Reviews</h2>
            {user && (
              <button
                onClick={() => setShowReviewForm(!showReviewForm)}
                className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white px-6 py-3 rounded-xl font-semibold hover:opacity-90 transition"
                data-testid="write-review-button"
              >
                Write a Review
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
            <div className="bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10">
              <h3 className="text-xl font-bold text-white mb-4">Criticizer Meter</h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart
                    innerRadius="60%"
                    outerRadius="100%"
                    data={[{ name: 'score', value: meterScore, fill: '#9333ea' }]}
                    startAngle={180}
                    endAngle={0}
                  >
                    <defs>
                      <linearGradient id="meterGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#22c55e" />
                        <stop offset="45%" stopColor="#f59e0b" />
                        <stop offset="100%" stopColor="#a855f7" />
                      </linearGradient>
                    </defs>
                    <RadialBar background dataKey="value" cornerRadius={12} fill="url(#meterGlow)" isAnimationActive animationDuration={1200} />
                    <text x="50%" y="55%" textAnchor="middle" fill="#ffffff" className="text-4xl font-bold">
                      {meterScore}%
                    </text>
                    <text x="50%" y="68%" textAnchor="middle" fill="#9ca3af">
                      Community confidence
                    </text>
                  </RadialBarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {meterRows.map((entry, index) => (
                  <div key={entry.name} className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-white">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: entry.fill }} />
                      <span>{RATING_OPTIONS[index].label}</span>
                    </div>
                    <span className="text-gray-400">{entry.pct}%</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10">
              <h3 className="text-xl font-bold text-white mb-4">Vibe Chart</h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={genreRows}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                    >
                      {genreRows.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => [`${value}%`, 'Share']}
                      contentStyle={{ background: '#141414', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                {genreRows.map((entry) => (
                  <div key={entry.name} className="rounded-xl bg-white/5 px-4 py-3 border border-white/10">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: entry.fill }} />
                      <span className="text-white text-sm">{entry.name}</span>
                    </div>
                    <div className="mt-1 text-xs text-gray-400">{entry.value}% visual share</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {showReviewForm && (
            <div className="bg-white/5 backdrop-blur rounded-2xl p-6 mb-8 border border-white/10" data-testid="review-form">
              <h3 className="text-xl font-bold text-white mb-4">Write your review</h3>
              <form onSubmit={handleSubmitReview} className="space-y-4">
                <div>
                  <label className="text-white mb-2 block">Your rating</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {RATING_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setReviewData({ ...reviewData, rating_label: option.value })}
                        className={`p-4 rounded-xl border-2 transition text-left ${
                          reviewData.rating_label === option.value
                            ? `${option.bg} border-white`
                            : 'bg-[#141414] border-gray-600 hover:border-white/40'
                        }`}
                        data-testid={`rating-option-${option.value}`}
                      >
                        <div className="text-white text-sm mb-1">{option.stars}</div>
                        <div className="text-white text-xs font-medium">{option.label}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-white mb-2 block">Your review</label>
                  <textarea
                    value={reviewData.review_text}
                    onChange={(e) => setReviewData({ ...reviewData, review_text: e.target.value })}
                    required
                    rows="4"
                    className="w-full px-4 py-3 bg-[#141414] text-white rounded-xl border border-gray-600 focus:border-fuchsia-500 focus:outline-none"
                    placeholder="Share your thoughts..."
                    data-testid="review-text-input"
                  />
                </div>
                <div className="flex flex-wrap gap-4">
                  <button
                    type="submit"
                    disabled={submitting || !reviewData.rating_label}
                    className="bg-red-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-red-700 transition disabled:opacity-50"
                    data-testid="submit-review-button"
                  >
                    {submitting ? 'Submitting...' : 'Submit Review'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowReviewForm(false)}
                    className="bg-[#141414] text-white px-6 py-3 rounded-xl font-semibold hover:bg-gray-800 transition"
                    data-testid="cancel-review-button"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="space-y-4">
            {reviews.length === 0 ? (
              <div className="bg-white/5 rounded-2xl p-8 text-center border border-white/10">
                <p className="text-gray-400 text-lg">No reviews yet. Be the first to review!</p>
              </div>
            ) : (
              reviews.map((review) => {
                const ratingOption = RATING_OPTIONS.find((opt) => opt.value === review.rating_label);
                const comments = commentsByReview[review.review_id] || [];
                return (
                  <div key={review.review_id} className="bg-[#171717] rounded-2xl p-6 border border-white/10" data-testid="review-item">
                    <div className="flex items-start space-x-4">
                      <img
                        src={review.avatar || 'https://via.placeholder.com/48'}
                        alt={review.username}
                        className="w-12 h-12 rounded-full"
                        loading="lazy"
                      />
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-3 mb-2">
                          <span className="text-white font-semibold">{review.username}</span>
                          {ratingOption && (
                            <span
                              className="px-3 py-1 rounded-full text-white text-sm inline-flex items-center gap-1"
                              style={{ backgroundColor: ratingOption.color }}
                            >
                              <span>{ratingOption.stars}</span>
                              <span>{ratingOption.label}</span>
                            </span>
                          )}
                        </div>
                        <p className="text-gray-300">{review.review_text}</p>
                        <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
                          <span>{review.created_at && new Date(review.created_at).toLocaleDateString()}</span>
                          <button type="button" onClick={() => likeReview(review.review_id)} className="inline-flex items-center gap-2 hover:text-white transition">
                            <FaHeart className="text-xs" /> {review.likes || 0}
                          </button>
                          <span className="inline-flex items-center gap-2">
                            <FaComment className="text-xs" /> {comments.length}
                          </span>
                        </div>

                        <div className="mt-4 space-y-3">
                          {comments.map((comment) => (
                            <div key={comment.comment_id} className="rounded-xl bg-black/20 border border-white/5 p-3">
                              <div className="flex items-center gap-2">
                                <span className="text-white text-sm font-medium">{comment.username}</span>
                                <span className="text-xs text-gray-500">
                                  {comment.created_at && new Date(comment.created_at).toLocaleDateString()}
                                </span>
                              </div>
                              <p className="mt-1 text-sm text-gray-300">{comment.text}</p>
                              {comment.replies?.length > 0 && (
                                <div className="mt-3 space-y-2 border-l border-white/10 pl-3">
                                  {comment.replies.map((reply) => (
                                    <div key={reply.comment_id} className="text-sm">
                                      <span className="font-medium text-white">{reply.username}</span>
                                      <span className="text-gray-400"> {reply.text}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {user && (
                                <div className="mt-3 flex gap-2">
                                  <input
                                    type="text"
                                    value={commentDrafts[`${review.review_id}:${comment.comment_id}`] || ''}
                                    onChange={(e) =>
                                      setCommentDrafts((prev) => ({
                                        ...prev,
                                        [`${review.review_id}:${comment.comment_id}`]: e.target.value,
                                      }))
                                    }
                                    placeholder="Reply..."
                                    className="flex-1 rounded-xl bg-[#101010] border border-white/10 px-3 py-2 text-sm text-white outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => addComment(review.review_id, comment.comment_id)}
                                    className="rounded-xl bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/20"
                                  >
                                    Reply
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}

                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={commentDrafts[review.review_id] || ''}
                              onChange={(e) =>
                                setCommentDrafts((prev) => ({ ...prev, [review.review_id]: e.target.value }))
                              }
                              placeholder="Add a comment..."
                              className="flex-1 rounded-xl bg-[#101010] border border-white/10 px-3 py-2 text-sm text-white outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => addComment(review.review_id)}
                              className="rounded-xl bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20"
                            >
                              Post
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {similarMovies.length > 0 && (
        <div className="bg-[#0B0B0B] border-t border-white/5 py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-white mb-6">More Like This</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
              {similarMovies.map((item) => (
                <motion.div key={item.id} whileHover={{ scale: 1.03 }}>
                  <MovieCard movie={item} />
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default MovieDetails;
