import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import api from "../services/api";
import MovieCard from "../components/MovieCard";
import {
  FaCalendarAlt,
  FaChevronLeft,
  FaChevronRight,
  FaFire,
  FaHeart,
  FaQuoteLeft,
  FaMapMarkerAlt,
  FaPaperPlane,
  FaReply,
  FaStar,
  FaTicketAlt,
} from "react-icons/fa";

const categoryCache = new Map();

function SkeletonCard() {
  return (
    <div className="flex-none w-[72vw] snap-start sm:w-56 md:w-60 lg:w-64">
      <div className="rounded-xl overflow-hidden bg-white/5 h-[380px] animate-pulse border border-white/5" />
    </div>
  );
}

function RowSection({ id, title, movies, loading }) {
  const scrollerRef = useRef(null);
  const dragState = useRef({ active: false, startX: 0, scrollLeft: 0 });

  const scroll = (direction) => {
    const container = scrollerRef.current;
    if (!container) return;
    const scrollAmount = Math.min(container.clientWidth * 0.85, 760);
    container.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  const startDrag = (event) => {
    const container = scrollerRef.current;
    if (!container) return;
    dragState.current = {
      active: true,
      startX: event.pageX,
      scrollLeft: container.scrollLeft,
    };
    container.style.cursor = "grabbing";
  };

  const stopDrag = () => {
    dragState.current.active = false;
    if (scrollerRef.current) scrollerRef.current.style.cursor = "grab";
  };

  const drag = (event) => {
    const container = scrollerRef.current;
    if (!container || !dragState.current.active) return;
    event.preventDefault();
    const delta = event.pageX - dragState.current.startX;
    container.scrollLeft = dragState.current.scrollLeft - delta;
  };

  return (
    <section className="relative">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-2xl md:text-3xl font-bold text-white">{title}</h2>
      </div>

      <div className="group/rail relative">
        <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-16 bg-gradient-to-r from-[#0B0B0B] to-transparent" />
        <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-16 bg-gradient-to-l from-[#0B0B0B] to-transparent" />
        <button
          type="button"
          onClick={() => scroll("left")}
          className="absolute left-2 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/65 text-white opacity-0 shadow-2xl backdrop-blur transition duration-200 hover:bg-red-600/80 group-hover/rail:opacity-100 md:flex"
          aria-label={`Scroll ${title} left`}
        >
          <FaChevronLeft className="text-lg" />
        </button>
        <button
          type="button"
          onClick={() => scroll("right")}
          className="absolute right-2 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/65 text-white opacity-0 shadow-2xl backdrop-blur transition duration-200 hover:bg-red-600/80 group-hover/rail:opacity-100 md:flex"
          aria-label={`Scroll ${title} right`}
        >
          <FaChevronRight className="text-lg" />
        </button>

        <div
          id={id}
          ref={scrollerRef}
          onMouseDown={startDrag}
          onMouseLeave={stopDrag}
          onMouseUp={stopDrag}
          onMouseMove={drag}
          className="flex cursor-grab snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-4 pr-8 select-none [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {loading
            ? [1, 2, 3, 4, 5].map((i) => <SkeletonCard key={i} />)
            : (movies.length ? movies : []).map((movie) => (
              <motion.div
                key={`${id}-${movie.slug || movie.id}`}
                className="flex-none w-[72vw] snap-start sm:w-56 md:w-60 lg:w-64"
                whileHover={{ scale: 1.025 }}
                transition={{ duration: 0.22 }}
                style={{ contentVisibility: "auto", containIntrinsicSize: "256px 380px" }}
              >
                <MovieCard movie={movie} />
              </motion.div>
            ))}
        </div>
      </div>
    </section>
  );
}

function formatReleaseDate(value) {
  if (!value) return "Date TBA";
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function inferRegionFromAddress(address) {
  const text = address.toLowerCase();
  if (/\b(global|international|worldwide|world)\b/.test(text)) return "GLOBAL";
  if (
    /\b(india|bharat|mumbai|delhi|bengaluru|bangalore|pune|hyderabad|kolkata|chennai)\b/.test(
      text,
    )
  ) {
    return "IN";
  }
  if (/\b(japan|tokyo|osaka|kyoto|sapporo)\b/.test(text)) return "JP";
  if (/\b(korea|south korea|seoul|busan|incheon)\b/.test(text)) return "KR";
  if (/\b(canada|toronto|vancouver|montreal)\b/.test(text)) return "CA";
  if (/\b(uk|united kingdom|london|manchester)\b/.test(text)) return "GB";
  return "US";
}

function CinemaReleaseSection({
  address,
  addressDraft,
  onAddressDraftChange,
  onSaveAddress,
  movies,
  upcoming,
  theaterMeta,
  loading,
}) {
  const openCinemaSearch = (movie) => {
    const area = address || addressDraft || "near me";
    const query = `${movie.title} tickets cinemas near ${area}`;
    window.open(
      `https://www.google.com/maps/search/${encodeURIComponent(query)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const isUpcomingFallback = !movies.length && upcoming.length > 0;
  const displayMovies = (movies.length ? movies : upcoming).slice(0, 4);

  return (
    <section className="rounded-3xl border border-white/10 bg-[#101010]/90 p-6 overflow-hidden">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-red-300/80">
            In Cinemas
          </p>
          <h2 className="mt-2 text-3xl font-bold text-white">
            Release dates near your area
          </h2>
          {theaterMeta?.region_label && (
            <p className="mt-2 text-sm text-gray-400">
              {theaterMeta.release_status || "Release data"} · {theaterMeta.region_label}
            </p>
          )}
        </div>
        <form
          onSubmit={onSaveAddress}
          className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto"
        >
          <div className="relative flex-1 lg:w-80">
            <FaMapMarkerAlt className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={addressDraft}
              onChange={(e) => onAddressDraftChange(e.target.value)}
              placeholder="Enter city or address"
              className="w-full rounded-xl bg-black/45 border border-white/10 px-11 py-3 text-white outline-none focus:border-red-500/70"
              maxLength={120}
            />
          </div>
          <button
            type="submit"
            className="rounded-xl bg-red-600 px-5 py-3 font-semibold text-white transition hover:bg-red-500"
          >
            Save Area
          </button>
        </form>
      </div>

      {address && (
        <p className="mt-3 text-sm text-gray-400">
          Showing cinema searches for{" "}
          <span className="text-white">{address}</span>
          {theaterMeta?.availability && (
            <span className="text-gray-500"> · {theaterMeta.availability}</span>
          )}
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {loading
          ? [1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-48 rounded-2xl border border-white/10 bg-white/5 animate-pulse"
            />
          ))
          : displayMovies.map((movie) => (
            <div
              key={`cinema-${movie.slug || movie.id}`}
              className="rounded-2xl border border-white/10 bg-black/30 overflow-hidden"
            >
              <div
                className="h-44 bg-cover bg-center"
                style={{
                  backgroundImage:
                    movie.backdrop_path || movie.poster_path
                      ? `linear-gradient(to top, rgba(0,0,0,0.8), rgba(0,0,0,0.08)), url(${movie.backdrop_path || movie.poster_path})`
                      : undefined,
                }}
              />
              <div className="p-4">
                <h3 className="text-white font-semibold leading-snug line-clamp-2 min-h-[2.75rem]">
                  {movie.title}
                </h3>
                <div className="mt-3 flex items-center gap-2 text-sm text-gray-400">
                  <FaCalendarAlt className="text-red-300" />
                  <span>{formatReleaseDate(movie.release_date)}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-400">
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">
                    {isUpcomingFallback ? "Upcoming" : "Now playing"}
                  </span>
                  {theaterMeta?.region_label && (
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">
                      {theaterMeta.region_label}
                    </span>
                  )}
                  {address && (
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">
                      Nearby search available
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => openCinemaSearch(movie)}
                  disabled={!address && !addressDraft}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-red-600/15 px-4 py-2.5 text-sm font-semibold text-red-100 transition hover:bg-red-600/25 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FaTicketAlt className="text-xs" />
                  Find Nearby Theaters
                </button>
              </div>
            </div>
          ))}
      </div>
    </section>
  );
}

const Home = ({ user, onOpenAuth }) => {
  const navigate = useNavigate();
  const [trendingMovies, setTrendingMovies] = useState([]);
  const [discoverMovies, setDiscoverMovies] = useState([]);
  const [discoverPage, setDiscoverPage] = useState(1);
  const [discoverTotalPages, setDiscoverTotalPages] = useState(1);
  const [loadingMoreDiscover, setLoadingMoreDiscover] = useState(false);
  const [topRatedMovies, setTopRatedMovies] = useState([]);
  const [mixedTrending, setMixedTrending] = useState([]);
  const [nowPlayingMovies, setNowPlayingMovies] = useState([]);
  const [upcomingMovies, setUpcomingMovies] = useState([]);
  const [theaterMeta, setTheaterMeta] = useState(null);
  const [theaterLoading, setTheaterLoading] = useState(true);
  const [heroIndex, setHeroIndex] = useState(0);
  const [localAddress, setLocalAddress] = useState(
    () => localStorage.getItem("criticizer_local_address") || "",
  );
  const [addressDraft, setAddressDraft] = useState(
    () => localStorage.getItem("criticizer_local_address") || "",
  );
  const [categoryRows, setCategoryRows] = useState({
    action: [],
    anime: [],
    bollywood: [],
    feelgood: [],
    hollywood: [],
    international: [],
    kids: [],
    tv: [],
  });
  const [communityFeed, setCommunityFeed] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(null);
  const [discoverError, setDiscoverError] = useState(null);
  const [activeMood, setActiveMood] = useState("all");
  const [posts, setPosts] = useState([]);
  const [postDraft, setPostDraft] = useState("");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    const loadPrimary = async () => {
      try {
        const region = inferRegionFromAddress(localAddress);
        const [trendRes, discRes, topRes, mixedRes, theaterRes] =
          await Promise.all([
            api.get("/api/movies/trending"),
            api.get("/api/movies/discover?page=1"),
            api.get("/api/movies/top-rated?page=1"),
            api.get("/api/movies/trending-mixed"),
            api.get(`/api/movies/theaters?region=${region}&page=1`),
          ]);
        setTrendingMovies(trendRes.data.movies || []);
        setApiError(trendRes.data.error || null);
        setDiscoverMovies(discRes.data.movies || []);
        setDiscoverPage(discRes.data.page || 1);
        setDiscoverTotalPages(discRes.data.total_pages || 1);
        setDiscoverError(discRes.data.error || null);
        setTopRatedMovies(topRes.data.movies || []);
        setMixedTrending(mixedRes.data.movies || []);
        setNowPlayingMovies(theaterRes.data.now_playing || []);
        setUpcomingMovies(theaterRes.data.upcoming || []);
        setTheaterMeta({
          region: theaterRes.data.region,
          region_label: theaterRes.data.region_label,
          release_status: theaterRes.data.release_status,
          availability: theaterRes.data.availability,
        });
      } catch (error) {
        setApiError(error.response?.data?.detail || error.message);
      } finally {
        setLoading(false);
        setTheaterLoading(false);
      }
    };
    loadPrimary();
  }, [localAddress]);

  useEffect(() => {
    setHeroIndex(0);
  }, [nowPlayingMovies, trendingMovies]);

  useEffect(() => {
    const timer = setInterval(() => {
      setHeroIndex((index) => index + 1);
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const loadCategories = async () => {
      setCategoriesLoading(true);
      try {
        const getCategory = async (category) => {
          const key = `${category}:1`;
          if (categoryCache.has(key)) return categoryCache.get(key);
          const res = await api.get(`/api/movies/category/${category}?page=1`);
          categoryCache.set(key, res);
          return res;
        };
        const [
          actionRes,
          animeRes,
          bollywoodRes,
          feelgoodRes,
          hollywoodRes,
          internationalRes,
          kidsRes,
          tvRes,
        ] =
          await Promise.all([
            getCategory("action"),
            getCategory("anime"),
            getCategory("bollywood"),
            getCategory("feelgood"),
            getCategory("hollywood"),
            getCategory("international"),
            getCategory("kids"),
            getCategory("tv"),
          ]);
        setCategoryRows({
          action: actionRes.data.movies || [],
          anime: animeRes.data.movies || [],
          bollywood: bollywoodRes.data.movies || [],
          feelgood: feelgoodRes.data.movies || [],
          hollywood: hollywoodRes.data.movies || [],
          international: internationalRes.data.movies || [],
          kids: kidsRes.data.movies || [],
          tv: tvRes.data.movies || [],
        });
      } catch {
        /* category rows are optional */
      } finally {
        setCategoriesLoading(false);
      }
    };
    if (!loading) loadCategories();
  }, [loading]);

  useEffect(() => {
    const loadCommunityFeed = async () => {
      try {
        const res = await api.get("/api/reviews/feed/recent?limit=6");
        setCommunityFeed(res.data.items || []);
      } catch {
        setCommunityFeed([]);
      }
    };
    if (!loading) loadCommunityFeed();
  }, [loading]);

  const loadMoreDiscover = async () => {
    if (loadingMoreDiscover || discoverPage >= discoverTotalPages) return;
    setLoadingMoreDiscover(true);
    try {
      const nextPage = discoverPage + 1;
      const res = await api.get(`/api/movies/discover?page=${nextPage}`);
      const incoming = res.data.movies || [];
      setDiscoverMovies((prev) => {
        const seen = new Set(prev.map((m) => m.slug || m.id));
        const merged = [...prev];
        for (const m of incoming) {
          const key = m.slug || m.id;
          if (!key || seen.has(key)) continue;
          seen.add(key);
          merged.push(m);
        }
        return merged;
      });
      setDiscoverPage(res.data.page || nextPage);
      setDiscoverTotalPages(res.data.total_pages || discoverTotalPages);
      if (res.data.error) setDiscoverError(res.data.error);
    } catch (error) {
      setDiscoverError(error.response?.data?.detail || error.message);
    } finally {
      setLoadingMoreDiscover(false);
    }
  };

  const moodMovies = useMemo(() => {
    const map = {
      all: discoverMovies,
      action: categoryRows.action,
      feelgood: categoryRows.feelgood,
      animated: categoryRows.kids,
      anime: categoryRows.anime,
      series: categoryRows.tv,
    };
    return map[activeMood] || discoverMovies;
  }, [activeMood, discoverMovies, categoryRows]);

  const picks = useMemo(() => {
    const merged = [
      ...trendingMovies,
      ...topRatedMovies.filter((m) => (m.vote_average || 0) >= 7.5),
    ];
    const seen = new Set();
    const uniq = [];
    for (const item of merged) {
      const key = item?.slug || `${item?.media_type || "movie"}-${item?.id}`;
      if (!item?.id || seen.has(key)) continue;
      seen.add(key);
      uniq.push(item);
      if (uniq.length >= 6) break;
    }
    return uniq;
  }, [trendingMovies, topRatedMovies]);

  const displayedPicks = useMemo(() => {
    if (activeMood === "all") {
      return picks.length ? picks : discoverMovies;
    }
    return moodMovies.length ? moodMovies : discoverMovies;
  }, [activeMood, picks, discoverMovies, moodMovies]);

  const heroMovies = useMemo(() => {
    const seen = new Set();
    const merged = [
      ...trendingMovies,
      ...categoryRows.hollywood,
      ...categoryRows.international,
      ...mixedTrending,
      ...nowPlayingMovies,
    ];
    return merged.filter((item) => {
      const key = item?.slug || item?.id;
      if (!key || seen.has(key) || !(item.backdrop_path || item.poster_path))
        return false;
      seen.add(key);
      return true;
    });
  }, [trendingMovies, categoryRows.hollywood, categoryRows.international, mixedTrending, nowPlayingMovies]);

  const reviewTrends = useMemo(() => {
    const merged = [...trendingMovies, ...mixedTrending, ...topRatedMovies];
    const seen = new Set();
    return merged
      .filter((movie) => {
        const key = movie?.slug || movie?.id;
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort(
        (a, b) =>
          (b.popularity || 0) + (b.vote_average || 0) * 6 -
          ((a.popularity || 0) + (a.vote_average || 0) * 6),
      )
      .slice(0, 5);
  }, [trendingMovies, mixedTrending, topRatedMovies]);

  const exploringItems = useMemo(() => {
    if (communityFeed.length) {
      return communityFeed.map((item) => ({
        ...item,
        kind: item.type === "comment" ? "Comment" : "Review",
      }));
    }
    return reviewTrends.map((movie) => ({
      id: movie.slug || movie.id,
      kind: "Trending",
      movie_id: movie.id,
      movie_slug: movie.slug || movie.id,
      movie_title: movie.title,
      movie_poster: movie.poster_path,
      text: "People are checking this title out right now.",
      rating_label: movie.vote_average
        ? `${Number(movie.vote_average).toFixed(1)} TMDB`
        : null,
      username: "Criticizer",
    }));
  }, [communityFeed, reviewTrends]);

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
    if (!user) return onOpenAuth("login");
    const text = postDraft.trim();
    if (!text) return;
    setPosting(true);
    try {
      await api.post("/api/discussions/create", {
        movie_id: trendingMovies[0]?.slug || trendingMovies[0]?.id || "",
        text,
      });
      setPostDraft("");
      await loadDiscussion();
    } finally {
      setPosting(false);
    }
  };

  const likePost = async (id) => {
    if (!user) return onOpenAuth("login");
    await api.post(`/api/discussions/like/${id}`);
    loadDiscussion();
  };

  const saveAddress = (event) => {
    event.preventDefault();
    const value = addressDraft.trim();
    if (!value) return;
    localStorage.setItem("criticizer_local_address", value);
    setLocalAddress(value);
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

  const featuredMovie = heroMovies.length
    ? heroMovies[heroIndex % heroMovies.length]
    : trendingMovies[0];
  const featuredImage =
    featuredMovie?.backdrop_path || featuredMovie?.poster_path;

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
          backgroundImage: featuredImage
            ? `linear-gradient(to bottom, rgba(0,0,0,0.28), rgba(0,0,0,0.92)), url(${featuredImage})`
            : undefined,
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
                Ready to explore?{" "}
                {user
                  ? "Start browsing movies below."
                  : "Sign up to leave reviews and build your watchlist."}
              </p>
              {featuredMovie && (
                <div className="mb-8 inline-flex max-w-full items-center gap-3 rounded-2xl border border-white/15 bg-black/35 px-4 py-3 backdrop-blur">
                  {featuredMovie.poster_path && (
                    <img
                      src={featuredMovie.poster_path}
                      alt=""
                      className="h-16 w-11 rounded-md object-cover"
                      loading="lazy"
                    />
                  )}
                  <div className="min-w-0 text-left">
                    <p className="text-xs uppercase tracking-[0.2em] text-red-200/80">
                      Now featuring
                    </p>
                    <p className="truncate text-white font-semibold">
                      {featuredMovie.title}
                    </p>
                    <p className="text-sm text-gray-300">
                      {formatReleaseDate(featuredMovie.release_date)}
                    </p>
                  </div>
                  {!user && (
                    <button
                      onClick={() => onOpenAuth("signup")}
                      className="ml-8 bg-gradient-to-r from-red-600 to-fuchsia-600 text-white px-8 py-4 rounded-2xl text-xl font-semibold hover:opacity-90 transition shadow-lg"
                      data-testid="hero-signup-button"
                    >
                      Get Started
                    </button>
                  )}
                </div>
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
                  <p className="text-sm uppercase tracking-[0.25em] text-fuchsia-300/80">
                    Criticizer Picks
                  </p>
                  <h2 className="mt-2 text-3xl font-bold text-white">
                    Choose by mood, not by endless scrolling
                  </h2>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                {[
                  ["all", "All"],
                  ["action", "Action Night"],
                  ["feelgood", "Feel Good"],
                  ["anime", "Anime"],
                  ["animated", "Animated"],
                  ["series", "Series"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveMood(key)}
                    className={`px-4 py-2 rounded-full border transition ${activeMood === key
                        ? "bg-fuchsia-600 text-white border-fuchsia-500"
                        : "bg-white/5 text-gray-300 border-white/10 hover:bg-white/10"
                      }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-4">
                {displayedPicks
                  .slice(0, 6)
                  .map((movie, index) => (
                    <div
                      key={`mood-${movie.slug || movie.id}`}
                      className="relative"
                    >
                      <span className="absolute top-2 left-2 z-10 rounded-full bg-black/80 border border-fuchsia-500/50 px-2 py-0.5 text-[10px] text-fuchsia-200">
                        {index % 2 === 0 ? "Why it's trending" : "Fan Favorite"}
                      </span>
                      <MovieCard movie={movie} />
                    </div>
                  ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
              <p className="text-sm uppercase tracking-[0.25em] text-gray-500">
                Continue Exploring
              </p>
              <h3 className="mt-2 text-2xl font-bold text-white">
                What people are saying
              </h3>
              <div className="mt-5 space-y-3">
                {exploringItems.slice(0, 6).map((item, index) => (
                  <button
                    key={`${item.kind}-${item.id || item.movie_slug}-${index}`}
                    type="button"
                    onClick={() =>
                      user
                        ? navigate(`/movie/${item.movie_slug || item.movie_id}`)
                        : onOpenAuth("login")
                    }
                    className="group flex w-full items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-3 text-left transition hover:border-red-500/40 hover:bg-black/35"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-600/15 text-sm font-bold text-red-200">
                      {index + 1}
                    </span>
                    {item.movie_poster && (
                      <img
                        src={item.movie_poster}
                        alt=""
                        className="h-16 w-11 shrink-0 rounded-lg object-cover"
                        loading="lazy"
                      />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-xs text-gray-400">
                        <span className="inline-flex items-center gap-1 text-red-200">
                          {item.kind === "Trending" ? (
                            <FaFire className="text-red-400" />
                          ) : (
                            <FaQuoteLeft className="text-fuchsia-300" />
                          )}
                          {item.kind}
                        </span>
                        <span className="truncate">by {item.username}</span>
                      </span>
                      <span className="mt-1 block truncate font-semibold text-white">
                        {item.movie_title}
                      </span>
                      <span className="mt-1 line-clamp-2 text-sm leading-snug text-gray-300">
                        {item.text}
                      </span>
                      {item.rating_label && (
                        <span className="mt-2 flex items-center gap-3 text-xs text-gray-400">
                          <span className="inline-flex items-center gap-1">
                            <FaStar className="text-amber-400" />
                            {item.rating_label}
                          </span>
                        </span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <CinemaReleaseSection
            address={localAddress}
            addressDraft={addressDraft}
            onAddressDraftChange={setAddressDraft}
            onSaveAddress={saveAddress}
            movies={nowPlayingMovies}
            upcoming={upcomingMovies}
            theaterMeta={theaterMeta}
            loading={theaterLoading}
          />

          <RowSection
            id="movie-carousel-trending"
            title="Trending"
            movies={trendingMovies}
            loading={false}
          />

          <RowSection
            id="movie-carousel-top-rated"
            title="Top Rated"
            movies={topRatedMovies}
            loading={false}
          />

          <RowSection
            id="movie-carousel-hollywood"
            title="Hollywood"
            movies={categoryRows.hollywood}
            loading={categoriesLoading}
          />

          <RowSection
            id="movie-carousel-bollywood"
            title="Bollywood"
            movies={categoryRows.bollywood}
            loading={categoriesLoading}
          />
          <RowSection
            id="movie-carousel-anime"
            title="Anime"
            movies={categoryRows.anime}
            loading={categoriesLoading}
          />
          <RowSection
            id="movie-carousel-kids"
            title="Animated Movies"
            movies={categoryRows.kids}
            loading={categoriesLoading}
          />
          <RowSection
            id="movie-carousel-tv"
            title="TV Shows"
            movies={categoryRows.tv}
            loading={categoriesLoading}
          />

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
              {(posts.length
                ? posts
                : [
                  {
                    discussion_id: "d1",
                    username: "cinegeek",
                    text: "That opening scene is pure cinema.",
                    likes: 18,
                    reply_count: 4,
                    created_at: new Date().toISOString(),
                  },
                  {
                    discussion_id: "d2",
                    username: "nightowl",
                    text: "Great pacing. Never felt slow for me.",
                    likes: 9,
                    reply_count: 2,
                    created_at: new Date().toISOString(),
                  },
                ]
              ).map((post) => (
                <motion.div
                  key={post.discussion_id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-white/10 bg-black/30 p-4"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-white">
                      @{post.username}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(post.created_at).toLocaleString()}
                    </p>
                  </div>
                  <p className="mt-2 text-gray-300">{post.text}</p>
                  <div className="mt-3 flex items-center gap-4 text-sm text-gray-400">
                    <button
                      type="button"
                      onClick={() => likePost(post.discussion_id)}
                      className="inline-flex items-center gap-1 hover:text-white transition"
                    >
                      <FaHeart className="text-xs" /> {post.likes || 0}
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:text-white transition"
                    >
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
              {discoverError && (
                <span className="text-xs text-amber-400 max-w-md text-right">
                  {discoverError}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {discoverMovies.map((movie) => (
                <motion.div
                  key={`d-${movie.slug || movie.id}`}
                  whileHover={{ scale: 1.04 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28 }}
                >
                  <MovieCard movie={movie} />
                </motion.div>
              ))}
            </div>
            {discoverPage < discoverTotalPages && (
              <div className="mt-8 text-center">
                <button
                  type="button"
                  onClick={loadMoreDiscover}
                  disabled={loadingMoreDiscover}
                  className="rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-medium text-white transition hover:border-fuchsia-500/50 hover:bg-fuchsia-600/20 disabled:opacity-50"
                >
                  {loadingMoreDiscover ? "Loading…" : "Load more titles"}
                </button>
              </div>
            )}
          </section>
        </div>
      </div>

      <div className="bg-[#0B0B0B] py-20 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-white mb-12 text-center">
            More reasons to join
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                title: "Criticizer Meter",
                body: "See how a title lands with the community through the five-tier Criticizer rating system.",
                from: "from-violet-900/80",
                to: "to-fuchsia-800/80",
              },
              {
                title: "My List",
                body: "Save titles to watch and mark what you have finished with one quick tap.",
                from: "from-red-900/80",
                to: "to-red-700/80",
              },
              {
                title: "Where to watch",
                body: "Streaming availability via TMDB + Watchmode when configured.",
                from: "from-blue-900/80",
                to: "to-cyan-800/80",
              },
              {
                title: "Community",
                body: "Reviews, profiles, and a Netflix-inspired browse experience.",
                from: "from-emerald-900/80",
                to: "to-green-800/80",
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
