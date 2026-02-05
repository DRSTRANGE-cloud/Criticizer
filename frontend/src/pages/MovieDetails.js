import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { FaStar, FaBookmark, FaPlay } from 'react-icons/fa';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

const RATING_OPTIONS = [
  { label: 'Absolute Cinema', value: 'Absolute Cinema', score: 10, emoji: '🎭', color: 'bg-purple-600' },
  { label: 'Peak', value: 'Peak', score: 9, emoji: '⭐', color: 'bg-indigo-600' },
  { label: 'Excellent', value: 'Excellent', score: 8, emoji: '🌟', color: 'bg-blue-600' },
  { label: 'Good', value: 'Good', score: 7, emoji: '👍', color: 'bg-green-600' },
  { label: 'Go for it', value: 'Go for it', score: 6, emoji: '✓', color: 'bg-yellow-600' },
  { label: 'Not my type', value: 'Not my type', score: 5, emoji: '👎', color: 'bg-red-600' },
];

const MovieDetails = ({ user, onOpenAuth }) => {
  const { id } = useParams();
  const [movie, setMovie] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [ratingDist, setRatingDist] = useState({});
  const [loading, setLoading] = useState(true);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewData, setReviewData] = useState({
    rating_category: '',
    review_text: ''
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchMovieDetails();
    if (user) {
      checkWatchlist();
    }
  }, [id, user]);

  const fetchMovieDetails = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/movies/${id}`);
      setMovie(response.data.movie);
      setReviews(response.data.reviews);
      setRatingDist(response.data.rating_distribution);
    } catch (error) {
      console.error('Error fetching movie details:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkWatchlist = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/watchlist/check/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setInWatchlist(response.data.in_watchlist);
    } catch (error) {
      console.error('Error checking watchlist:', error);
    }
  };

  const toggleWatchlist = async () => {
    if (!user) {
      onOpenAuth('login');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (inWatchlist) {
        await axios.delete(`${API_URL}/api/watchlist/remove/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setInWatchlist(false);
      } else {
        await axios.post(
          `${API_URL}/api/watchlist/add`,
          { movie_id: id },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setInWatchlist(true);
      }
    } catch (error) {
      console.error('Error toggling watchlist:', error);
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
      const token = localStorage.getItem('token');
      const ratingOption = RATING_OPTIONS.find(opt => opt.value === reviewData.rating_category);
      
      await axios.post(
        `${API_URL}/api/reviews/create`,
        {
          movie_id: id,
          rating_category: reviewData.rating_category,
          rating_score: ratingOption.score,
          review_text: reviewData.review_text
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setShowReviewForm(false);
      setReviewData({ rating_category: '', review_text: '' });
      fetchMovieDetails();
    } catch (error) {
      alert(error.response?.data?.detail || 'Error submitting review');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center pt-20">
        <div className="text-white text-2xl">Loading...</div>
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center pt-20">
        <div className="text-white text-2xl">Movie not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Hero Section */}
      <div
        className="relative h-screen bg-cover bg-center"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.95)), url(${movie.backdrop_path})`
        }}
      >
        <div className="absolute inset-0 flex items-end pb-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
            <div className="flex flex-col md:flex-row gap-8">
              <img
                src={movie.poster_path}
                alt={movie.title}
                className="w-64 h-96 object-cover rounded-lg shadow-2xl"
                data-testid="movie-poster"
              />
              <div className="flex-1">
                <h1 className="text-5xl font-bold text-white mb-4" data-testid="movie-title">{movie.title}</h1>
                <div className="flex items-center space-x-4 mb-4">
                  <div className="flex items-center space-x-2">
                    <FaStar className="text-yellow-400 text-xl" />
                    <span className="text-white text-xl font-semibold" data-testid="movie-rating">
                      {movie.vote_average}
                    </span>
                  </div>
                  <span className="text-gray-300">{movie.release_date}</span>
                  <span className="text-gray-300">{movie.runtime} min</span>
                </div>
                <div className="flex flex-wrap gap-2 mb-6">
                  {movie.genres.map((genre, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-critisizer-gray rounded-full text-white text-sm"
                    >
                      {genre}
                    </span>
                  ))}
                </div>
                <p className="text-gray-300 text-lg mb-6 max-w-3xl" data-testid="movie-overview">
                  {movie.overview}
                </p>
                <div className="flex space-x-4">
                  {movie.trailer_key && (
                    <a
                      href={`https://www.youtube.com/watch?v=${movie.trailer_key}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-2 bg-white text-black px-6 py-3 rounded font-semibold hover:bg-gray-200 transition"
                      data-testid="watch-trailer-button"
                    >
                      <FaPlay />
                      <span>Watch Trailer</span>
                    </a>
                  )}
                  <button
                    onClick={toggleWatchlist}
                    className={`flex items-center space-x-2 px-6 py-3 rounded font-semibold transition ${
                      inWatchlist
                        ? 'bg-critisizer-red text-white'
                        : 'bg-critisizer-gray text-white hover:bg-gray-600'
                    }`}
                    data-testid="toggle-watchlist-button"
                  >
                    <FaBookmark />
                    <span>{inWatchlist ? 'In Watchlist' : 'Add to Watchlist'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reviews Section */}
      <div className="bg-black py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold text-white">Reviews</h2>
            {user && (
              <button
                onClick={() => setShowReviewForm(!showReviewForm)}
                className="bg-critisizer-red text-white px-6 py-3 rounded font-semibold hover:bg-red-700 transition"
                data-testid="write-review-button"
              >
                Write a Review
              </button>
            )}
          </div>

          {/* Rating Distribution */}
          <div className="bg-critisizer-gray rounded-lg p-6 mb-8">
            <h3 className="text-xl font-bold text-white mb-4">Rating Distribution</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {RATING_OPTIONS.map((option) => (
                <div key={option.value} className="text-center">
                  <div className={`${option.color} rounded-lg p-4 mb-2`}>
                    <div className="text-3xl mb-1">{option.emoji}</div>
                    <div className="text-white font-bold text-2xl">
                      {ratingDist[option.value] || 0}
                    </div>
                  </div>
                  <div className="text-white text-sm">{option.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Review Form */}
          {showReviewForm && (
            <div className="bg-critisizer-gray rounded-lg p-6 mb-8" data-testid="review-form">
              <h3 className="text-xl font-bold text-white mb-4">Write Your Review</h3>
              <form onSubmit={handleSubmitReview} className="space-y-4">
                <div>
                  <label className="text-white mb-2 block">Select Rating</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {RATING_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setReviewData({ ...reviewData, rating_category: option.value })}
                        className={`p-4 rounded-lg border-2 transition ${
                          reviewData.rating_category === option.value
                            ? `${option.color} border-white`
                            : 'bg-critisizer-dark border-gray-600 hover:border-white'
                        }`}
                        data-testid={`rating-option-${option.value}`}
                      >
                        <div className="text-2xl mb-1">{option.emoji}</div>
                        <div className="text-white text-sm">{option.label}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-white mb-2 block">Your Review</label>
                  <textarea
                    value={reviewData.review_text}
                    onChange={(e) => setReviewData({ ...reviewData, review_text: e.target.value })}
                    required
                    rows="4"
                    className="w-full px-4 py-3 bg-critisizer-dark text-white rounded border border-gray-600 focus:border-critisizer-red focus:outline-none"
                    placeholder="Share your thoughts about this movie..."
                    data-testid="review-text-input"
                  />
                </div>
                <div className="flex space-x-4">
                  <button
                    type="submit"
                    disabled={submitting || !reviewData.rating_category}
                    className="bg-critisizer-red text-white px-6 py-3 rounded font-semibold hover:bg-red-700 transition disabled:opacity-50"
                    data-testid="submit-review-button"
                  >
                    {submitting ? 'Submitting...' : 'Submit Review'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowReviewForm(false)}
                    className="bg-critisizer-dark text-white px-6 py-3 rounded font-semibold hover:bg-gray-700 transition"
                    data-testid="cancel-review-button"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Reviews List */}
          <div className="space-y-4">
            {reviews.length === 0 ? (
              <div className="bg-critisizer-gray rounded-lg p-8 text-center">
                <p className="text-gray-400 text-lg">No reviews yet. Be the first to review!</p>
              </div>
            ) : (
              reviews.map((review) => {
                const ratingOption = RATING_OPTIONS.find(opt => opt.value === review.rating_category);
                return (
                  <div key={review.review_id} className="bg-critisizer-gray rounded-lg p-6" data-testid="review-item">
                    <div className="flex items-start space-x-4">
                      <img
                        src={review.avatar}
                        alt={review.username}
                        className="w-12 h-12 rounded-full"
                      />
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <span className="text-white font-semibold">{review.username}</span>
                          {ratingOption && (
                            <span className={`${ratingOption.color} px-3 py-1 rounded-full text-white text-sm flex items-center space-x-1`}>
                              <span>{ratingOption.emoji}</span>
                              <span>{ratingOption.label}</span>
                            </span>
                          )}
                        </div>
                        <p className="text-gray-300">{review.review_text}</p>
                        <p className="text-gray-500 text-sm mt-2">
                          {new Date(review.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MovieDetails;