import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaStar } from 'react-icons/fa';

const MovieCard = ({ movie }) => {
  const navigate = useNavigate();
  if (!movie) return null;

  const imageUrl = movie.poster_path?.startsWith('http')
    ? movie.poster_path
    : `https://image.tmdb.org/t/p/w500${movie.poster_path}`;

  const slug =
    movie.slug || (movie.media_type === 'tv' ? `tv-${movie.id}` : String(movie.id));

  return (
    <div
      onClick={() => navigate(`/movie/${slug}`)}
      className="group relative cursor-pointer transition-transform duration-300 hover:scale-105"
    >
      <div className="relative overflow-hidden rounded-lg w-full h-[380px] bg-gray-800">
        <img
          src={imageUrl}
          alt={movie.title}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.08]"
          onError={(e) => {
            e.currentTarget.src =
              'https://via.placeholder.com/500x750?text=No+Image';
          }}
        />

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="absolute bottom-0 p-4">
            <h3 className="text-white font-semibold text-sm mb-1">
              {movie.title}
            </h3>
            {typeof movie.vote_average === 'number' && movie.vote_average > 0 && (
              <div className="flex items-center gap-1 text-sm text-yellow-400">
                <FaStar />
                <span>{movie.vote_average.toFixed(1)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MovieCard;
