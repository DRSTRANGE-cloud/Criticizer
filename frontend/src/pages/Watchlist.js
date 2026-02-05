import React, { useState, useEffect } from 'react';
import axios from 'axios';
import MovieCard from '../components/MovieCard';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

const Watchlist = ({ user }) => {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWatchlist();
  }, []);

  const fetchWatchlist = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/watchlist/get`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMovies(response.data.movies);
    } catch (error) {
      console.error('Error fetching watchlist:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center pt-20">
        <div className="text-white text-2xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pt-28 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold text-white mb-8" data-testid="watchlist-title">My Watchlist</h1>
        
        {movies.length === 0 ? (
          <div className="bg-critisizer-gray rounded-lg p-12 text-center">
            <p className="text-gray-400 text-xl mb-4">Your watchlist is empty</p>
            <p className="text-gray-500">Start adding movies you want to watch!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {movies.map((movie) => (
              <MovieCard key={movie.id} movie={movie} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Watchlist;