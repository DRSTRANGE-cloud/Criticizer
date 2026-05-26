import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaStar } from 'react-icons/fa';

const ChatMovieCard = ({ movie }) => {
  const navigate = useNavigate();
  if (!movie) return null;

  const slug = movie.slug || (movie.media_type === 'tv' ? `tv-${movie.id}` : String(movie.id));
  const poster = movie.poster_path?.startsWith('http')
    ? movie.poster_path
    : movie.poster_path
      ? `https://image.tmdb.org/t/p/w185${movie.poster_path}`
      : null;

  return (
    <button
      type="button"
      onClick={() => navigate(`/movie/${slug}`)}
      className="flex-shrink-0 w-28 text-left rounded-xl overflow-hidden border border-white/10 bg-white/5 hover:border-fuchsia-500/40 hover:bg-white/10 transition group"
    >
      <div className="aspect-[2/3] bg-zinc-900 relative">
        {poster ? (
          <img src={poster} alt={movie.title} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-500 px-1 text-center">
            {movie.title}
          </div>
        )}
      </div>
      <div className="p-2">
        <p className="text-[11px] font-medium text-white line-clamp-2 leading-tight group-hover:text-fuchsia-200">
          {movie.title}
        </p>
        {movie.vote_average > 0 && (
          <p className="text-[10px] text-amber-400/90 flex items-center gap-0.5 mt-0.5">
            <FaStar className="text-[8px]" />
            {Number(movie.vote_average).toFixed(1)}
          </p>
        )}
      </div>
    </button>
  );
};

export default ChatMovieCard;
