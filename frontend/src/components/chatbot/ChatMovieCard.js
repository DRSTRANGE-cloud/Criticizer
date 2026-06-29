import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaStar, FaExternalLinkAlt } from 'react-icons/fa';

const ChatMovieCard = ({ movie }) => {
  const navigate = useNavigate();
  if (!movie) return null;

  const slug = movie.slug || (movie.media_type === 'tv' ? `tv-${movie.id}` : String(movie.id));
  const poster = movie.poster_path?.startsWith('http')
    ? movie.poster_path
    : movie.poster_path
    ? `https://image.tmdb.org/t/p/w185${movie.poster_path}`
    : null;
  const year = (movie.release_date || '').slice(0, 4);
  const genres = (movie.genres || []).slice(0, 2).join(' · ');

  return (
    <button
      type="button"
      onClick={() => navigate(`/movie/${slug}`)}
      className="flex-shrink-0 w-[110px] text-left rounded-xl overflow-hidden border border-white/10 bg-white/[0.04] hover:border-red-500/40 hover:bg-white/[0.08] transition-all duration-200 group"
    >
      <div className="aspect-[2/3] bg-zinc-900 relative overflow-hidden">
        {poster ? (
          <img
            src={poster}
            alt={movie.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-500 px-2 text-center leading-tight">
            {movie.title}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-end justify-center pb-2">
          <FaExternalLinkAlt className="text-white text-[10px]" />
        </div>
      </div>
      <div className="p-2 space-y-0.5">
        <p className="text-[11px] font-semibold text-white line-clamp-2 leading-tight group-hover:text-red-300 transition-colors duration-150">
          {movie.title}
        </p>
        {year && (
          <p className="text-[10px] text-gray-500">{year}</p>
        )}
        {movie.vote_average > 0 && (
          <p className="text-[10px] text-amber-400/90 flex items-center gap-0.5">
            <FaStar className="text-[8px]" />
            {Number(movie.vote_average).toFixed(1)}
          </p>
        )}
        {genres && (
          <p className="text-[9px] text-gray-600 truncate">{genres}</p>
        )}
      </div>
    </button>
  );
};

export default ChatMovieCard;