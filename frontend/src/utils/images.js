const TMDB_BASE = 'https://image.tmdb.org/t/p';

export function tmdbUrl(path, size = 'w500') {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${TMDB_BASE}/${size}${path}`;
}

export function posterUrl(path, size = 'w500') {
  return tmdbUrl(path, size);
}

export function backdropUrl(path, size = 'w1280') {
  return tmdbUrl(path, size);
}

export function preloadImage(url) {
  if (!url || typeof window === 'undefined') return;
  const img = new Image();
  img.src = url;
}
