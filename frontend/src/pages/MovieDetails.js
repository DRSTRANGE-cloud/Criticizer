import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { PieChart, Pie, Tooltip, ResponsiveContainer, Cell } from "recharts";
import api from "../services/api";
import {
  FaStar,
  FaBookmark,
  FaPlay,
  FaExternalLinkAlt,
  FaCheckCircle,
  FaHeart,
  FaComment,
  FaArrowLeft,
} from "react-icons/fa";
import MovieCard from "../components/MovieCard";
import { RATING_OPTIONS } from "../constants/ratings";
import { preloadImage } from "../utils/images";

function MovieDetailsSkeleton() {
  return (
    <div className="min-h-screen bg-[#0B0B0B] pt-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[380px_minmax(0,1fr)]">
          <div className="mx-auto w-full max-w-[380px] aspect-[2/3] rounded-3xl bg-white/5 animate-pulse" />
          <div className="space-y-4">
            <div className="h-12 w-3/4 rounded-xl bg-white/5 animate-pulse" />
            <div className="h-6 w-1/2 rounded-lg bg-white/5 animate-pulse" />
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-4 rounded bg-white/5 animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const WATCH_STATES = [
  { value: "watchlist", label: "My List", icon: FaBookmark },
  { value: "watched", label: "Watched", icon: FaCheckCircle },
];

function MeterDonut({ segments, score, avgStars, hasVotes }) {
  const active = segments.filter((s) => s.pct > 0);
  let acc = 0;
  const ringGradient =
    active.length > 0
      ? `conic-gradient(from 270deg, ${active
          .map((s) => {
            const start = acc;
            acc += s.pct;
            return `${s.fill} ${start}% ${acc}%`;
          })
          .join(", ")})`
      : "conic-gradient(from 270deg, rgba(255,255,255,0.07) 0deg, rgba(255,255,255,0.12) 360deg)";

  const glowColor = active.length ? active[active.length - 1].fill : "#a855f7";

  return (
    <div className="relative h-44 w-44 mx-auto">
      <div
        className="absolute inset-0 rounded-full transition-all duration-700"
        style={{
          background: ringGradient,
          boxShadow: hasVotes
            ? `0 0 36px ${glowColor}55, inset 0 0 20px rgba(0,0,0,0.35)`
            : undefined,
        }}
      />
      <div className="absolute inset-[11px] rounded-full bg-[#0d0d0d] border border-white/10 shadow-inner flex flex-col items-center justify-center">
        <p className="text-3xl font-bold text-white tabular-nums leading-none">
          {hasVotes ? `${score}%` : "—"}
        </p>
        <p className="text-[10px] uppercase tracking-widest text-gray-500 mt-1.5">
          {hasVotes ? "Overall score" : "No votes yet"}
        </p>
        {hasVotes && avgStars != null && (
          <p className="text-xs text-gray-400 mt-1 tabular-nums">
            {avgStars} ★ avg
          </p>
        )}
      </div>
    </div>
  );
}

function GenreTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const color = item.payload?.fill || "#c084fc";
  return (
    <div
      className="rounded-xl px-4 py-3 shadow-2xl backdrop-blur-md min-w-[140px]"
      style={{
        background: "rgba(24, 24, 27, 0.97)",
        border: `1px solid ${color}55`,
        boxShadow: `0 12px 40px ${color}40`,
      }}
    >
      <p className="text-[10px] uppercase tracking-[0.2em] text-gray-400">
        Genre
      </p>
      <p className="text-sm font-semibold text-white mt-1 leading-snug">
        {item.name}
      </p>
      <p className="text-2xl font-bold mt-1 tabular-nums" style={{ color }}>
        {item.value}%
      </p>
    </div>
  );
}

const MovieDetails = ({ user, onOpenAuth }) => {
  const { id } = useParams();
  const navigate = useNavigate();
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
    rating_label: "",
    review_text: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [backdropLoaded, setBackdropLoaded] = useState(false);

  const meterRows = useMemo(() => {
    return RATING_OPTIONS.map((o) => ({
      name: o.label,
      pct: ratingPct[o.value] ?? 0,
      fill: o.color,
    }));
  }, [ratingPct]);

  const meterOverall = useMemo(() => {
    let weighted = 0;
    let hasVotes = false;
    RATING_OPTIONS.forEach((o, index) => {
      const pct = ratingPct[o.value] ?? 0;
      if (pct > 0) hasVotes = true;
      weighted += (index + 1) * pct;
    });
    const avgStars = hasVotes ? weighted / 100 : null;
    const score = hasVotes ? Math.round((avgStars / 5) * 100) : 0;
    return { score, avgStars, hasVotes };
  }, [ratingPct]);

  const genreRows = useMemo(() => {
    const genres = movie?.genres || [];
    if (!genres.length) return [];
    const equalShare = Math.round(100 / genres.length);
    return genres.map((name, index) => ({
      name,
      value:
        index === genres.length - 1 ? 100 - equalShare * index : equalShare,
      fill: ["#9333ea", "#2563eb", "#dc2626", "#059669", "#f59e0b"][index % 5],
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
      setCommentsByReview((prev) => ({
        ...prev,
        [reviewId]: response.data.comments || [],
      }));
    } catch {
      setCommentsByReview((prev) => ({ ...prev, [reviewId]: [] }));
    }
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    setLoading(true);
    fetchMovieDetails();
  }, [fetchMovieDetails]);

  useEffect(() => {
    if (user) checkWatchlist();
  }, [user, id, checkWatchlist]);

  useEffect(() => {
    reviews.slice(0, 3).forEach((review) => {
      fetchComments(review.review_id);
    });
  }, [reviews, fetchComments]);

  useEffect(() => {
    if (movie?.backdrop_path) {
      setBackdropLoaded(false);
      preloadImage(movie.backdrop_path);
    }
  }, [movie?.backdrop_path]);

  const likeComment = async (commentId, reviewId) => {
    if (!user) {
      onOpenAuth("login");
      return;
    }
    await api.post(`/api/comments/like/${commentId}`);
    fetchComments(reviewId);
  };

  const saveToList = async (status) => {
    if (!user) {
      onOpenAuth("login");
      return;
    }

    try {
      if (watchStatus === status) {
        await api.delete(`/api/watchlist/remove/${id}`);
        setWatchStatus(null);
      } else {
        await api.post("/api/watchlist/add", { movie_id: id, status });
        setWatchStatus(status);
      }
    } catch (error) {
      console.error("Error updating list:", error);
    }
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!user) {
      onOpenAuth("login");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/api/reviews/create", {
        movie_id: id,
        rating_label: reviewData.rating_label,
        review_text: reviewData.review_text,
      });

      setShowReviewForm(false);
      setReviewData({ rating_label: "", review_text: "" });
      fetchMovieDetails();
    } catch (error) {
      alert(error.response?.data?.detail || "Error submitting review");
    } finally {
      setSubmitting(false);
    }
  };

  const likeReview = async (reviewId) => {
    if (!user) {
      onOpenAuth("login");
      return;
    }
    await api.post("/api/reviews/like", { review_id: reviewId });
    fetchMovieDetails();
  };

  const addComment = async (reviewId, parentCommentId = null) => {
    if (!user) {
      onOpenAuth("login");
      return;
    }
    const draftKey = parentCommentId
      ? `${reviewId}:${parentCommentId}`
      : reviewId;
    const text = (commentDrafts[draftKey] || "").trim();
    if (!text) return;
    await api.post("/api/comments/create", {
      review_id: reviewId,
      text,
      parent_comment_id: parentCommentId,
    });
    setCommentDrafts((prev) => ({ ...prev, [draftKey]: "" }));
    fetchComments(reviewId);
  };

  if (loading) {
    return <MovieDetailsSkeleton />;
  }

  if (!movie) {
    return (
      <div className="min-h-screen bg-[#0B0B0B] flex flex-col items-center justify-center pt-20 px-4">
        <div className="text-white text-2xl mb-4">Movie not found</div>
        {apiError && (
          <p
            className="text-red-400 text-center max-w-lg"
            data-testid="movie-api-error"
          >
            {apiError}
          </p>
        )}
      </div>
    );
  }

  const genres = movie.genres || [];
  const backdrop = movie.backdrop_path || movie.poster_path;
  const backdropPreview = movie.backdrop_preview || movie.poster_path;
  const cast = movie.cast || [];
  const companies = movie.production_companies || [];
  const creditLabel = movie.media_type === "tv" ? "Creator" : "Director";
  const infoCards = [
    { label: "Release", value: movie.release_date || "TBA" },
    {
      label: "Runtime",
      value: movie.runtime ? `${movie.runtime} min` : "Unknown",
    },
    { label: creditLabel, value: movie.director || "Unknown" },
    {
      label: "Primary Studio",
      value: movie.production_company || companies[0]?.name || "Unknown",
    },
  ];
  return (
    <motion.div
      className="min-h-screen bg-[#0B0B0B]"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="relative overflow-hidden">
        {backdropPreview && (
          <img
            src={backdropPreview}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover scale-105 blur-xl opacity-60"
          />
        )}
        {backdrop && (
          <img
            src={backdrop}
            alt=""
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
              backdropLoaded ? "opacity-100" : "opacity-0"
            }`}
            loading="eager"
            fetchPriority="high"
            onLoad={() => setBackdropLoaded(true)}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/70 to-[#0B0B0B]" />
        <div className="relative min-h-[calc(100vh-5rem)] flex items-center pb-12 pt-28 sm:pt-32">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[380px_minmax(0,1fr)] lg:items-start">
              {movie.poster_path && (
                <motion.div
                  className="mx-auto w-full max-w-[380px] lg:mx-0"
                  whileHover={{ y: -4 }}
                  transition={{ type: "spring", stiffness: 320, damping: 24 }}
                >
                  <div className="lg:sticky lg:top-24">
                    <div className="relative aspect-[2/3] overflow-hidden rounded-3xl border border-white/10 bg-black/40 shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
                      <img
                        src={movie.poster_path}
                        alt={movie.title}
                        loading="eager"
                        fetchPriority="high"
                        className="h-full w-full object-cover"
                        data-testid="movie-poster"
                      />

                      <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none" />
                    </div>
                  </div>
                </motion.div>
              )}
              <div className="min-w-0 lg:pt-1">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="group mb-4 inline-flex items-center gap-2 text-sm font-medium text-gray-300 transition-all duration-300 hover:text-red-400"
                >
                  <FaArrowLeft className="text-xs transition-transform duration-300 group-hover:-translate-x-1" />
                  Back to Browse
                </button>
                <h1
                  className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight"
                  data-testid="movie-title"
                >
                  {movie.title}
                </h1>
                <div className="flex flex-wrap items-center gap-4 mb-4">
                  <div className="flex items-center space-x-2">
                    <FaStar className="text-amber-400 text-xl" />
                    <span
                      className="text-white text-xl font-semibold"
                      data-testid="movie-rating"
                    >
                      {typeof movie.vote_average === "number"
                        ? movie.vote_average.toFixed(1)
                        : movie.vote_average}
                    </span>
                    <span className="text-gray-400 text-sm">TMDB</span>
                  </div>
                  {movie.release_date && (
                    <span className="text-gray-300">
                      {movie.release_date?.slice(0, 4)}
                    </span>
                  )}
                  {movie.runtime ? (
                    <span className="text-gray-300">{movie.runtime} min</span>
                  ) : null}
                  {movie.director && (
                    <span className="text-gray-300">
                      {creditLabel}:{" "}
                      <span className="text-white">{movie.director}</span>
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
                <p
                  className="text-gray-200 text-base sm:text-lg leading-relaxed mb-6 max-w-3xl line-clamp-5"
                  data-testid="movie-overview"
                >
                  {movie.overview}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6 lg:max-w-3xl">
                  {infoCards.map((item) => (
                    <div
                      key={item.label}
                      className="rounded-2xl border border-white/10 bg-black/25 px-4 py-4 backdrop-blur"
                    >
                      <p className="text-[10px] uppercase tracking-[0.25em] text-gray-500">
                        {item.label}
                      </p>
                      <p className="mt-2 text-sm font-semibold text-white">
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>

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
                            ? "bg-red-600 text-white border-red-500"
                            : "bg-white/10 text-white hover:bg-white/20 border-white/20"
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
                <motion.div
                  key={c.id}
                  className="flex-none w-28 text-center group"
                  whileHover={{ y: -2 }}
                >
                  <div className="relative w-28 h-28 mx-auto rounded-full overflow-hidden bg-white/5 border border-white/10 mb-2">
                    {c.profile_path ? (
                      <img
                        src={c.profile_path}
                        alt={c.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">
                        No photo
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/65 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center px-2">
                      <p className="text-[10px] text-white font-semibold text-center leading-tight">
                        {c.name}
                      </p>
                      <p className="text-[10px] text-gray-300 text-center mt-1">
                        {c.character}
                      </p>
                    </div>
                  </div>
                  <p className="text-white text-sm font-medium leading-tight">
                    {c.name}
                  </p>
                  <p className="text-gray-500 text-xs line-clamp-2">
                    {c.character}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      )}

      {whereToWatch.length > 0 && (
        <div className="bg-[#0B0B0B] border-t border-white/5 py-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-white mb-6">
              Where to watch
            </h2>
            <div className="flex flex-wrap gap-4">
              {whereToWatch.map((p, idx) => (
                <div
                  key={`${p.source}-${p.provider_name}-${p.type}-${idx}`}
                  className="flex items-center gap-3 bg-white/5 backdrop-blur rounded-2xl px-4 py-3 border border-white/10 shadow-lg"
                >
                  {p.logo_path && (
                    <img
                      src={p.logo_path}
                      alt=""
                      className="w-10 h-10 object-contain rounded"
                      loading="lazy"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">
                      {p.provider_name}
                    </p>
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
              <p className="mt-3 text-white text-lg leading-8">
                {topReview.review_text}
              </p>
              <p className="mt-3 text-sm text-gray-400">
                {topReview.username || "Criticizer user"} •{" "}
                {topReview.likes || 0} likes
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

          {showReviewForm && (
            <div
              className="relative overflow-hidden rounded-2xl border border-fuchsia-500/25 bg-gradient-to-br from-violet-950/50 via-[#141414] to-fuchsia-950/40 p-6 mb-8 shadow-[0_0_40px_rgba(168,85,247,0.12)]"
              data-testid="review-form"
            >
              <div className="pointer-events-none absolute -top-12 right-0 h-36 w-36 rounded-full bg-fuchsia-600/25 blur-3xl" />
              <h3 className="relative text-xl font-bold text-white mb-1">
                Write your review
              </h3>
              <p className="relative text-sm text-gray-400 mb-5">
                Share your rating before exploring community stats below
              </p>
              <form
                onSubmit={handleSubmitReview}
                className="relative space-y-4"
              >
                <div>
                  <label className="text-white mb-2 block text-sm font-medium">
                    Your rating
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {RATING_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          setReviewData({
                            ...reviewData,
                            rating_label: option.value,
                          })
                        }
                        className={`p-4 rounded-xl border-2 transition text-left ${
                          reviewData.rating_label === option.value
                            ? `${option.bg} border-white shadow-lg`
                            : "bg-black/40 border-white/10 hover:border-white/30"
                        }`}
                        data-testid={`rating-option-${option.value}`}
                      >
                        <div className="text-white text-sm mb-1">
                          {option.stars}
                        </div>
                        <div className="text-white text-xs font-medium">
                          {option.label}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-white mb-2 block text-sm font-medium">
                    Your review
                  </label>
                  <textarea
                    value={reviewData.review_text}
                    onChange={(e) =>
                      setReviewData({
                        ...reviewData,
                        review_text: e.target.value,
                      })
                    }
                    required
                    rows="4"
                    className="w-full px-4 py-3 bg-black/50 text-white rounded-xl border border-white/15 focus:border-fuchsia-500 focus:outline-none focus:ring-1 focus:ring-fuchsia-500/40"
                    placeholder="Share your thoughts..."
                    data-testid="review-text-input"
                  />
                </div>
                <div className="flex flex-wrap gap-4">
                  <button
                    type="submit"
                    disabled={submitting || !reviewData.rating_label}
                    className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white px-6 py-3 rounded-xl font-semibold hover:opacity-90 transition disabled:opacity-50"
                    data-testid="submit-review-button"
                  >
                    {submitting ? "Submitting..." : "Submit Review"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowReviewForm(false)}
                    className="bg-black/40 text-white px-6 py-3 rounded-xl font-semibold border border-white/15 hover:bg-black/60 transition"
                    data-testid="cancel-review-button"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-950/35 via-[#121212] to-violet-950/35 p-6">
              <div className="pointer-events-none absolute -top-16 -left-10 h-48 w-48 rounded-full bg-emerald-600/20 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-12 -right-10 h-40 w-40 rounded-full bg-violet-600/20 blur-3xl" />
              <div className="relative mb-6">
                <p className="text-xs uppercase tracking-[0.25em] text-emerald-300/90">
                  Community pulse
                </p>
                <h3 className="text-xl font-bold text-white mt-1">
                  Criticizer Meter
                </h3>
                <p className="text-sm text-gray-400 mt-1">
                  How confident the community feels about this title
                </p>
              </div>
              <div className="relative flex flex-col lg:flex-row lg:items-stretch gap-6">
                <div className="relative mx-auto shrink-0 flex items-center justify-center py-2">
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="h-40 w-40 rounded-full bg-gradient-to-r from-red-500/15 via-amber-500/15 to-violet-500/20 blur-2xl" />
                  </div>
                  <MeterDonut
                    segments={meterRows}
                    score={meterOverall.score}
                    avgStars={meterOverall.avgStars?.toFixed(1)}
                    hasVotes={meterOverall.hasVotes}
                  />
                </div>
                <ul className="relative flex-1 min-w-0 space-y-3">
                  {meterRows.map((entry, index) => (
                    <li
                      key={entry.name}
                      className="group rounded-xl border border-white/10 bg-black/40 px-4 py-3 transition hover:border-white/20 hover:bg-black/55"
                    >
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="text-sm shrink-0"
                            style={{ color: entry.fill }}
                          >
                            {RATING_OPTIONS[index].stars}
                          </span>
                          <span className="text-white text-sm font-medium truncate">
                            {RATING_OPTIONS[index].label}
                          </span>
                        </div>
                        <span
                          className="text-sm font-bold tabular-nums shrink-0"
                          style={{ color: entry.fill }}
                        >
                          {entry.pct}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width:
                              entry.pct > 0
                                ? `${Math.max(entry.pct, 4)}%`
                                : "0%",
                            backgroundColor: entry.fill,
                            opacity: entry.pct > 0 ? 1 : 0.35,
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-violet-950/40 via-[#121212] to-fuchsia-950/30 p-6">
              <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-fuchsia-600/20 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-violet-600/15 blur-3xl" />
              <div className="relative mb-6">
                <p className="text-xs uppercase tracking-[0.25em] text-fuchsia-300/90">
                  Genre mix
                </p>
                <h3 className="text-xl font-bold text-white mt-1">
                  Vibe Chart
                </h3>
                <p className="text-sm text-gray-400 mt-1">
                  Hover a slice to explore the genre balance
                </p>
              </div>
              {genreRows.length ? (
                <div className="relative flex flex-col lg:flex-row lg:items-center gap-8">
                  <div className="relative mx-auto h-60 w-full max-w-[280px] lg:mx-0 lg:w-[48%] shrink-0 overflow-hidden isolate">
                    <div
                      className="pointer-events-none absolute inset-6 rounded-full opacity-60 blur-2xl"
                      style={{
                        background: `conic-gradient(${genreRows
                          .map(
                            (g, i) =>
                              `${g.fill} ${i === 0 ? 0 : genreRows.slice(0, i).reduce((s, x) => s + x.value, 0)}% ${genreRows.slice(0, i + 1).reduce((s, x) => s + x.value, 0)}%`,
                          )
                          .join(", ")})`,
                      }}
                    />
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <defs>
                          {genreRows.map((entry, index) => (
                            <linearGradient
                              key={`grad-${index}`}
                              id={`genre-grad-${index}`}
                              x1="0"
                              y1="0"
                              x2="1"
                              y2="1"
                            >
                              <stop
                                offset="0%"
                                stopColor={entry.fill}
                                stopOpacity={1}
                              />
                              <stop
                                offset="100%"
                                stopColor={entry.fill}
                                stopOpacity={0.55}
                              />
                            </linearGradient>
                          ))}
                        </defs>
                        <Pie
                          data={genreRows}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={58}
                          outerRadius={88}
                          paddingAngle={3}
                          stroke="rgba(255,255,255,0.08)"
                          strokeWidth={2}
                          animationDuration={800}
                        >
                          {genreRows.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={`url(#genre-grad-${index})`}
                              className="outline-none focus:outline-none"
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          content={<GenreTooltip />}
                          cursor={{ fill: "rgba(255,255,255,0.06)" }}
                          wrapperStyle={{
                            background: "transparent",
                            border: "none",
                            boxShadow: "none",
                            outline: "none",
                            zIndex: 50,
                            padding: 0,
                          }}
                          contentStyle={{
                            background: "transparent",
                            border: "none",
                            boxShadow: "none",
                            padding: 0,
                          }}
                          itemStyle={{ color: "#fff" }}
                          labelStyle={{ color: "#fff" }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="text-center px-4">
                        <p className="text-[10px] uppercase tracking-widest text-gray-500">
                          Genres
                        </p>
                        <p className="text-2xl font-bold text-white tabular-nums">
                          {genreRows.length}
                        </p>
                      </div>
                    </div>
                  </div>
                  <ul className="relative flex-1 space-y-4 w-full">
                    {genreRows.map((entry) => (
                      <li
                        key={entry.name}
                        className="group rounded-xl border border-white/10 bg-black/40 px-4 py-3.5 transition hover:border-white/20 hover:bg-black/55"
                      >
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className="h-2.5 w-2.5 rounded-full shrink-0 shadow-[0_0_8px_currentColor]"
                              style={{
                                backgroundColor: entry.fill,
                                color: entry.fill,
                              }}
                            />
                            <span className="text-white text-sm font-medium truncate">
                              {entry.name}
                            </span>
                          </div>
                          <span
                            className="text-sm font-bold tabular-nums shrink-0"
                            style={{ color: entry.fill }}
                          >
                            {entry.value}%
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500 group-hover:opacity-100 opacity-90"
                            style={{
                              width: `${entry.value}%`,
                              backgroundColor: entry.fill,
                            }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="relative text-gray-500 text-sm py-10 text-center">
                  Genre data unavailable for this title.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {!user ? (
              <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-fuchsia-950/25 to-black p-8 text-center">
                <p className="text-xs uppercase tracking-[0.25em] text-fuchsia-300/80">
                  Community access
                </p>
                <h3 className="mt-3 text-2xl font-bold text-white">
                  Login to read and write reviews
                </h3>
                <p className="mt-3 text-gray-400 max-w-lg mx-auto">
                  Search, community reviews, likes, and comments are unlocked
                  after sign in so the conversation stays personal and
                  consistent.
                </p>
                <button
                  type="button"
                  onClick={() => onOpenAuth("login")}
                  className="mt-6 rounded-2xl bg-white px-5 py-3 font-semibold text-black transition hover:bg-gray-200"
                >
                  Sign in to continue
                </button>
              </div>
            ) : reviews.length === 0 ? (
              <div className="bg-white/5 rounded-2xl p-8 text-center border border-white/10">
                <p className="text-gray-400 text-lg">
                  No reviews yet. Be the first to review!
                </p>
              </div>
            ) : (
              reviews.map((review) => {
                const ratingOption = RATING_OPTIONS.find(
                  (opt) => opt.value === review.rating_label,
                );
                const comments = commentsByReview[review.review_id] || [];
                return (
                  <div
                    key={review.review_id}
                    className="bg-[#171717] rounded-2xl p-6 border border-white/10"
                    data-testid="review-item"
                  >
                    <div className="flex items-start space-x-4">
                      <img
                        src={review.avatar || "https://via.placeholder.com/48"}
                        alt={review.username}
                        className="w-12 h-12 rounded-full"
                        loading="lazy"
                      />
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-3 mb-2">
                          <span className="text-white font-semibold">
                            {review.username}
                          </span>
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
                          <span>
                            {review.created_at &&
                              new Date(review.created_at).toLocaleDateString()}
                          </span>
                          <button
                            type="button"
                            onClick={() => likeReview(review.review_id)}
                            className="inline-flex items-center gap-2 hover:text-red-500 transition"
                          >
                            <FaHeart className="text-xs" /> {review.likes || 0}
                          </button>
                          <span className="inline-flex items-center gap-2 hover:text-purple-500 transition">
                            <FaComment className="text-xs" /> {comments.length}
                          </span>
                        </div>

                        <div className="mt-4 space-y-3">
                          {comments.map((comment) => (
                            <div
                              key={comment.comment_id}
                              className="rounded-xl bg-black/20 border border-white/5 p-3"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-white text-sm font-medium">
                                  {comment.username}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {comment.created_at &&
                                    new Date(
                                      comment.created_at,
                                    ).toLocaleDateString()}
                                </span>
                              </div>
                             
                              {comment.replies?.length > 0 && (
                                <div className="mt-3 space-y-2 border-l border-white/10 pl-3">
                                  {comment.replies.map((reply) => (
                                    <div
                                      key={reply.comment_id}
                                      className="text-sm"
                                    >
                                      <span className="font-medium text-white">
                                        {reply.username}
                                      </span>
                                      <span className="text-gray-400">
                                        {" "}
                                        {reply.text}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          likeComment(
                                            reply.comment_id,
                                            review.review_id,
                                          )
                                        }
                                        className="ml-2 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-white transition"
                                      >
                                        <FaHeart className="text-[10px]" />{" "}
                                        {reply.likes || 0}
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {user && (
                                <div className="mt-3 flex gap-2">
                                  <input
                                    type="text"
                                    value={
                                      commentDrafts[
                                        `${review.review_id}:${comment.comment_id}`
                                      ] || ""
                                    }
                                    onChange={(e) =>
                                      setCommentDrafts((prev) => ({
                                        ...prev,
                                        [`${review.review_id}:${comment.comment_id}`]:
                                          e.target.value,
                                      }))
                                    }
                                    placeholder="Reply..."
                                    className="flex-1 rounded-xl bg-[#101010] border border-white/10 px-3 py-2 text-sm text-white outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      addComment(
                                        review.review_id,
                                        comment.comment_id,
                                      )
                                    }
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
                              value={commentDrafts[review.review_id] || ""}
                              onChange={(e) =>
                                setCommentDrafts((prev) => ({
                                  ...prev,
                                  [review.review_id]: e.target.value,
                                }))
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
            <h2 className="text-2xl font-bold text-white mb-6">
              More Like This
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
              {similarMovies.map((item) => (
                <motion.div
                  key={item.id}
                  whileHover={{ scale: 1.03 }}
                  className="space-y-3"
                >
                  <MovieCard movie={item} />
                  {item.recommendation_reasons?.length > 0 && (
                    <p className="text-xs text-gray-400 leading-5">
                      {item.recommendation_reasons[0]}
                    </p>
                  )}
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
