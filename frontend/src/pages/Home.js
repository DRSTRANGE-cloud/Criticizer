import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import api from '../services/api';
import MovieCard from '../components/MovieCard';
import { FaChevronLeft, FaChevronRight, FaHeart, FaReply, FaPaperPlane } from 'react-icons/fa';

function SkeletonCard() {
  return (
    <div className="flex-none w-64">
      <div className="rounded-xl overflow-hidden bg-white/5 h-[380px] animate-pulse border border-white/5" />
    </div>
  );
}

function RowSection({ id, title, movies, loading }) {
  const scroll = (direction) => {
    const container = document.getElementById(id);
    if (!container) return;
    const scrollAmount = 400;
    container.scrollLeft += direction === 'left' ? -scrollAmount : scrollAmount;
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl md:text-3xl font-bold text-white">{title}</h2>
        <div className="flex space-x-2">
          <button
            type="button"
            onClick={() => scroll('left')}
            className="bg-white/10 p-2 rounded-full hover:bg-fuchsia-600/80 transition"
          >
            <FaChevronLeft className="text-white text-xl" />
          </button>
          <button
            type="button"
            onClick={() => scroll('right')}
            className="bg-white/10 p-2 rounded-full hover:bg-fuchsia-600/80 transition"
          >
            <FaChevronRight className="text-white text-xl" />
          </button>
        </div>
      </div>

      <div
        id={id}
        className="flex space-x-4 overflow-x-auto scrollbar-hide scroll-smooth pb-4"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {loading
          ? [1, 2, 3, 4, 5].map((i) => <SkeletonCard key={i} />)
          : (movies.length ? movies : []).map((movie) => (
              <motion.div
                key={`${id}-${movie.slug || movie.id}`}
                className="flex-none w-64"
                whileHover={{ scale: 1.03 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                <MovieCard movie={movie} />
              </motion.div>
            ))}
      </div>
    </section>
  );
}

const KEEP_SCROLL_LIMIT = 20;

const Home = ({ user, onOpenAuth }) => {
  const [trendingMovies, setTrendingMovies] = useState([]);
  const [discoverMovies, setDiscoverMovies] = useState([]);
  const [topRatedMovies, setTopRatedMovies] = useState([]);
  const [mixedTrending, setMixedTrending] = useState([]);
  const [categoryRows, setCategoryRows] = useState({
    bollywood: [],
    hollywood: [],
    kids: [],
    tv: [],
  });
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(null);
  const [discoverError, setDiscoverError] = useState(null);
  const [activeMood, setActiveMood] = useState('all');
  const [posts, setPosts] = useState([]);
  const [postDraft, setPostDraft] = useState('');
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [trendRes, discRes, topRes, mixedRes, bollywoodRes, hollywoodRes, kidsRes, tvRes] = await Promise.all([
          api.get('/api/movies/trending'),
          api.get('/api/movies/discover?page=1'),
          api.get('/api/movies/top-rated?page=1'),
          api.get('/api/movies/trending-mixed'),
          api.get('/api/movies/category/bollywood?page=1'),
          api.get('/api/movies/category/hollywood?page=1'),
          api.get('/api/movies/category/kids?page=1'),
          api.get('/api/movies/category/tv?page=1'),
        ]);
        setTrendingMovies(trendRes.data.movies || []);
        setApiError(trendRes.data.error || null);
        setDiscoverMovies(discRes.data.movies || []);
        setDiscoverError(discRes.data.error || null);
        setTopRatedMovies(topRes.data.movies || []);
        setMixedTrending(mixedRes.data.movies || []);
        setCategoryRows({
          bollywood: bollywoodRes.data.movies || [],
          hollywood: hollywoodRes.data.movies || [],
          kids: kidsRes.data.movies || [],
          tv: tvRes.data.movies || [],
        });
      } catch (error) {
        setApiError(error.response?.data?.detail || error.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const moodMovies = useMemo(() => {
    const map = {
      all: discoverMovies,
      action: categoryRows.hollywood,
      feelgood: topRatedMovies,
      animated: categoryRows.kids,
      series: categoryRows.tv,
    };
    return map[activeMood] || discoverMovies;
  }, [activeMood, discoverMovies, categoryRows, topRatedMovies]);

  const keepScrollingMovies = useMemo(
    () => discoverMovies.slice(0, KEEP_SCROLL_LIMIT),
    [discoverMovies]
  );

  const picks = useMemo(() => {
    const merged = [...trendingMovies, ...topRatedMovies.filter((m) => (m.vote_average || 0) >= 7.5)];
    const seen = new Set();
    const uniq = [];
    for (const item of merged) {
      const key = item?.slug || `${item?.media_type || 'movie'}-${item?.id}`;
      if (!item?.id || seen.has(key)) continue;
      seen.add(key);
      uniq.push(item);
      if (uniq.length >= 6) break;
    }
    return uniq;
  }, [trendingMovies, topRatedMovies]);

  const loadDiscussion = useCallback(async () => {
    const target = trendingMovies[0]?.slug || trendingMovies[0]?.id;
    if (!target) return;
    try {
      const res = await api.get(`/api/discussions/movie/${target}`);
      setPosts(res.data.posts || []);
    } catch {
      setPosts([]);
    }
  }, [trendingMovies]);

  useEffect(() => {
    loadDiscussion();
  }, [loadDiscussion]);

  const createPost = async () => {
    if (!user) return onOpenAuth('login');
    const text = postDraft.trim();
    if (!text) return;
    setPosting(true);
    try {
      await api.post('/api/discussions/create', {
        movie_id: trendingMovies[0]?.slug || trendingMovies[0]?.id || '',
        text,
      });
      setPostDraft('');
      await loadDiscussion();
    } finally {
      setPosting(false);
    }
  };

  const likePost = async (id) => {
    if (!user) return onOpenAuth('login');
    await api.post(`/api/discussions/like/${id}`);
    loadDiscussion();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0B0B] pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-4 space-y-8">
          <div className="h-12 bg-white/5 rounded-2xl animate-pulse max-w-xl" />
          <div className="flex gap-4 overflow-hidden">
            {[1, 2, 3, 4, 5].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const featuredMovie = trendingMovies[0];

  return (
    <motion.div
      className="min-h-screen bg-[#0B0B0B]"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
    >
      {apiError && (
        <div
          className="fixed top-24 left-1/2 -translate-x-1/2 z-40 max-w-xl w-[90%] bg-red-900/90 border border-red-500 text-white px-4 py-3 rounded-xl text-sm"
          data-testid="tmdb-error-banner"
        >
          {apiError}
        </div>
      )}

      <div
        className="relative h-screen bg-cover bg-center bg-[#0B0B0B]"
        style={{
          backgroundImage: featuredMovie?.backdrop_path
            ? `linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.92)), url(${featuredMovie.backdrop_path})`
            : undefined,
        }}
      >
        <div className="absolute inset-0 flex items-center">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
            <div className="max-w-2xl">
              <h1 className="text-5xl md:text-7xl font-bold text-white mb-4">Unlimited movies,</h1>
              <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">reviews and more</h1>
              <p className="text-xl md:text-2xl text-white mb-4">Discover. Review. Share your thoughts.</p>
              <p className="text-lg text-gray-300 mb-8">
                Ready to explore?{' '}
                {user ? 'Start browsing movies below.' : 'Sign up to leave reviews and build your watchlist.'}
              </p>
              {!user && (
                <button
                  onClick={() => onOpenAuth('signup')}
                  className="bg-gradient-to-r from-red-600 to-fuchsia-600 text-white px-8 py-4 rounded-2xl text-xl font-semibold hover:opacity-90 transition shadow-lg"
                  data-testid="hero-signup-button"
                >
                  Get Started
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="relative bg-[#0B0B0B] py-12 -mt-32 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <section className="grid grid-cols-1 lg:grid-cols-[1.7fr_1fr] gap-6">
            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.02] p-6 shadow-2xl">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.25em] text-fuchsia-300/80">Criticizer Picks</p>
                  <h2 className="mt-2 text-3xl font-bold text-white">Choose by mood, not by endless scrolling</h2>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                {[
                  ['all', 'All'],
                  ['action', 'Action Night'],
                  ['feelgood', 'Feel Good'],
                  ['animated', 'Animated'],
                  ['series', 'Series'],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveMood(key)}
                    className={`px-4 py-2 rounded-full border transition ${
                      activeMood === key
                        ? 'bg-fuchsia-600 text-white border-fuchsia-500'
                        : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-4">
                {(picks.length ? picks : moodMovies).slice(0, 6).map((movie, index) => (
                  <div key={`mood-${movie.slug || movie.id}`} className="relative">
                    <span className="absolute top-2 left-2 z-10 rounded-full bg-black/80 border border-fuchsia-500/50 px-2 py-0.5 text-[10px] text-fuchsia-200">
                      {index % 2 === 0 ? "Why it's trending" : 'Fan Favorite'}
                    </span>
                    <MovieCard movie={movie} />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
              <p className="text-sm uppercase tracking-[0.25em] text-gray-500">Continue Exploring</p>
              <h3 className="mt-2 text-2xl font-bold text-white">Fast ways to decide</h3>
              <div className="mt-5 space-y-4">
                {[
                  ['Save for later', 'Build lists for tonight, later, and already watched.'],
                  ['Read top reviews', 'Jump to the strongest community take before committing.'],
                  ['See where to watch', 'Streaming options are surfaced right on the movie page.'],
                ].map(([title, body]) => (
                  <div key={title} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="font-semibold text-white">{title}</p>
                    <p className="mt-1 text-sm text-gray-400">{body}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <RowSection id="movie-carousel-trending" title="Trending" movies={trendingMovies} loading={false} />
          <RowSection id="movie-carousel-popular" title="Popular" movies={discoverMovies} loading={false} />
          <RowSection id="movie-carousel-top-rated" title="Top Rated" movies={topRatedMovies} loading={false} />
          <RowSection id="movie-carousel-bollywood" title="Bollywood" movies={categoryRows.bollywood} loading={false} />
          <RowSection id="movie-carousel-hollywood" title="Hollywood" movies={categoryRows.hollywood} loading={false} />
          <RowSection id="movie-carousel-kids" title="Animated Movies" movies={categoryRows.kids} loading={false} />
          <RowSection id="movie-carousel-tv" title="TV Shows" movies={categoryRows.tv} loading={false} />
          <RowSection id="movie-carousel-mixed" title="What Everyone Is Talking About" movies={mixedTrending} loading={false} />

          <section className="rounded-3xl border border-white/10 bg-[#101010]/90 p-6">
            <h2 className="text-2xl font-bold text-white mb-4">Discussion</h2>
            <div className="flex gap-2 mb-5">
              <input
                value={postDraft}
                maxLength={200}
                onChange={(e) => setPostDraft(e.target.value)}
                placeholder="Share your take in 200 characters..."
                className="flex-1 rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-white outline-none focus:border-fuchsia-500/70"
              />
              <button
                type="button"
                disabled={posting}
                onClick={createPost}
                className="px-4 py-3 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 text-white transition inline-flex items-center gap-2 disabled:opacity-60"
              >
                <FaPaperPlane className="text-xs" />
                Post
              </button>
            </div>
            <div className="space-y-3">
              {(posts.length ? posts : [
                { discussion_id: 'd1', username: 'cinegeek', text: 'That opening scene is pure cinema.', likes: 18, reply_count: 4, created_at: new Date().toISOString() },
                { discussion_id: 'd2', username: 'nightowl', text: 'Great pacing. Never felt slow for me.', likes: 9, reply_count: 2, created_at: new Date().toISOString() },
              ]).map((post) => (
                <motion.div
                  key={post.discussion_id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-white/10 bg-black/30 p-4"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-white">@{post.username}</p>
                    <p className="text-xs text-gray-500">{new Date(post.created_at).toLocaleString()}</p>
                  </div>
                  <p className="mt-2 text-gray-300">{post.text}</p>
                  <div className="mt-3 flex items-center gap-4 text-sm text-gray-400">
                    <button type="button" onClick={() => likePost(post.discussion_id)} className="inline-flex items-center gap-1 hover:text-white transition">
                      <FaHeart className="text-xs" /> {post.likes || 0}
                    </button>
                    <button type="button" className="inline-flex items-center gap-1 hover:text-white transition">
                      <FaReply className="text-xs" /> {post.reply_count || 0}
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          <section>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <h2 className="text-3xl font-bold text-white">Keep Scrolling</h2>
              {discoverError && <span className="text-xs text-amber-400 max-w-md text-right">{discoverError}</span>}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {keepScrollingMovies.map((movie) => (
                <motion.div
                  key={`d-${movie.slug || movie.id}`}
                  whileHover={{ scale: 1.04 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                >
                  <MovieCard movie={movie} />
                </motion.div>
              ))}
            </div>
            {discoverMovies.length > KEEP_SCROLL_LIMIT && (
              <p className="mt-6 text-center text-sm text-gray-500">
                Showing {KEEP_SCROLL_LIMIT} titles — explore rows above for more.
              </p>
            )}
          </section>
        </div>
      </div>

      <div className="bg-[#0B0B0B] py-20 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-white mb-12 text-center">More reasons to join</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                title: 'Criticizer Meter',
                body: 'See how a title lands with the community through the five-tier Criticizer rating system.',
                from: 'from-violet-900/80',
                to: 'to-fuchsia-800/80',
              },
              {
                title: 'Your saved states',
                body: 'Organize titles into watchlist, watch later, and watched with one quick tap.',
                from: 'from-red-900/80',
                to: 'to-red-700/80',
              },
              {
                title: 'Where to watch',
                body: 'Streaming availability via TMDB + Watchmode when configured.',
                from: 'from-blue-900/80',
                to: 'to-cyan-800/80',
              },
              {
                title: 'Community',
                body: 'Reviews, profiles, and a Netflix-inspired browse experience.',
                from: 'from-emerald-900/80',
                to: 'to-green-800/80',
              },
            ].map((c, index) => (
              <motion.div
                key={c.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                whileHover={{ scale: 1.05 }}
                className={`bg-gradient-to-br ${c.from} ${c.to} rounded-2xl p-6 border border-white/10 shadow-lg hover:shadow-[0_0_25px_rgba(168,85,247,0.25)] relative overflow-hidden`}
              >
                <div className="absolute inset-0 opacity-0 hover:opacity-100 transition bg-gradient-to-r from-white/10 via-transparent to-white/10" />
                <h3 className="text-xl font-bold text-white mb-3">{c.title}</h3>
                <p className="text-gray-200 text-sm">{c.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default Home;
