import React, { useState, useEffect } from 'react';
import axios from 'axios';
import MovieCard from '../components/MovieCard';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

const Home = ({ user, onOpenAuth }) => {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scrollPosition, setScrollPosition] = useState(0);

  useEffect(() => {
    fetchMovies();
  }, []);

  const fetchMovies = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/movies/trending`);
      setMovies(response.data.movies);
    } catch (error) {
      console.error('Error fetching movies:', error);
    } finally {
      setLoading(false);
    }
  };

  const scroll = (direction) => {
    const container = document.getElementById('movie-carousel');
    const scrollAmount = 400;
    if (direction === 'left') {
      container.scrollLeft -= scrollAmount;
    } else {
      container.scrollLeft += scrollAmount;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-2xl">Loading movies...</div>
      </div>
    );
  }

  const featuredMovie = movies[0];

  return (
    <div className="min-h-screen bg-black">
      {/* Hero Section */}
      <div
        className="relative h-screen bg-cover bg-center"
        style={{
          backgroundImage: featuredMovie
            ? `linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.9)), url(${featuredMovie.backdrop_path})`
            : 'none'
        }}
      >
        <div className="absolute inset-0 flex items-center">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
            <div className="max-w-2xl">
              <h1 className="text-5xl md:text-7xl font-bold text-white mb-4">
                Unlimited movies,
              </h1>
              <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">
                reviews and more
              </h1>
              <p className="text-xl md:text-2xl text-white mb-4">
                Discover. Review. Share your thoughts.
              </p>
              <p className="text-lg text-gray-300 mb-8">
                Ready to explore? {user ? 'Start browsing movies below.' : 'Sign up to leave reviews and build your watchlist.'}
              </p>
              {!user && (
                <button
                  onClick={() => onOpenAuth('signup')}
                  className="bg-critisizer-red text-white px-8 py-4 rounded text-xl font-semibold hover:bg-red-700 transition"
                  data-testid="hero-signup-button"
                >
                  Get Started
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Trending Section */}
      <div className="relative bg-black py-12 -mt-32 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-3xl font-bold text-white">Trending Now</h2>
            <div className="flex space-x-2">
              <button
                onClick={() => scroll('left')}
                className="bg-critisizer-gray p-2 rounded-full hover:bg-critisizer-red transition"
                data-testid="scroll-left-button"
              >
                <FaChevronLeft className="text-white text-xl" />
              </button>
              <button
                onClick={() => scroll('right')}
                className="bg-critisizer-gray p-2 rounded-full hover:bg-critisizer-red transition"
                data-testid="scroll-right-button"
              >
                <FaChevronRight className="text-white text-xl" />
              </button>
            </div>
          </div>

          <div
            id="movie-carousel"
            className="flex space-x-4 overflow-x-auto scrollbar-hide scroll-smooth pb-4"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {movies.map((movie) => (
              <div key={movie.id} className="flex-none w-64">
                <MovieCard movie={movie} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="bg-black py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-white mb-12 text-center">More reasons to join</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-gradient-to-br from-purple-900 to-purple-700 rounded-lg p-6">
              <h3 className="text-xl font-bold text-white mb-3">Rate with Style</h3>
              <p className="text-gray-200">
                Use our unique rating system from "Absolute Cinema" to "Not my type"
              </p>
            </div>
            <div className="bg-gradient-to-br from-red-900 to-red-700 rounded-lg p-6">
              <h3 className="text-xl font-bold text-white mb-3">Build Your Watchlist</h3>
              <p className="text-gray-200">
                Save movies you want to watch and keep track of what you've seen
              </p>
            </div>
            <div className="bg-gradient-to-br from-blue-900 to-blue-700 rounded-lg p-6">
              <h3 className="text-xl font-bold text-white mb-3">Share Your Thoughts</h3>
              <p className="text-gray-200">
                Write detailed reviews and help others discover great movies
              </p>
            </div>
            <div className="bg-gradient-to-br from-green-900 to-green-700 rounded-lg p-6">
              <h3 className="text-xl font-bold text-white mb-3">Discover Together</h3>
              <p className="text-gray-200">
                See what other critics think and find your next favorite film
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;