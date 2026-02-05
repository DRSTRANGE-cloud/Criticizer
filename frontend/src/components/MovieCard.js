import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaStar } from 'react-icons/fa';

const MovieCard = ({ movie }) => {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(`/movie/${movie.id}`)}
      className="group relative cursor-pointer transition-transform duration-300 hover:scale-105"
      data-testid={`movie-card-${movie.id}`}
    >
      <div className="relative overflow-hidden rounded-lg">
        <img
          src={movie.poster_path}
          alt={movie.title}
          className="w-full h-auto object-cover"
          onError={(e) => {
            e.target.src = 'https://via.placeholder.com/500x750?text=No+Image';
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h3 className="text-white font-bold text-lg mb-1">{movie.title}</h3>
            <div className="flex items-center space-x-2">
              <FaStar className="text-yellow-400" />
              <span className="text-white">{movie.vote_average}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MovieCard;