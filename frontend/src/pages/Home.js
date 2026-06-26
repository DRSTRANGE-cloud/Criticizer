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
  FaRetweet,
  FaStar,
  FaTicketAlt,
} from "react-icons/fa";
import { preloadImage } from "../utils/images";

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

function addressStorageKey(userId) {
  return userId ? `criticizer_local_address_${userId}` : "criticizer_local_address_guest";
}

function inferRegionFromAddress(address) {
  const text = address.toLowerCase();
  if (!text.trim()) return { region: "US", label: "your area" };
  if (/\b(global|international|worldwide|world)\b/.test(text)) return "GLOBAL";
  const places = [
    { region: "IN", label: "India", re: /\b(india|bharat|maharashtra|mumbai|delhi|new delhi|karnataka|bengaluru|bangalore|pune|hyderabad|telangana|kolkata|west bengal|chennai|tamil nadu|kerala|kochi|ahmedabad|gujarat|jaipur|rajasthan|lucknow|uttar pradesh)\b/ },
    { region: "JP", label: "Japan", re: /\b(japan|tokyo|osaka|kyoto|sapporo|yokohama)\b/ },
    { region: "KR", label: "South Korea", re: /\b(korea|south korea|seoul|busan|incheon)\b/ },
    { region: "CA", label: "Canada", re: /\b(canada|ontario|toronto|vancouver|montreal|quebec)\b/ },
    { region: "GB", label: "United Kingdom", re: /\b(uk|united kingdom|england|scotland|london|manchester|birmingham)\b/ },
    { region: "US", label: "United States", re: /\b(united states|usa|u\.s\.|california|new york|texas|florida|illinois|chicago|los angeles|san francisco|seattle|boston|atlanta|dallas|houston|miami)\b/ },
  ];
  const match = places.find((place) => place.re.test(text));
  return match || { region: "US", label: "United States" };
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
  const navigate = useNavigate();
  const openCinemaSearch = (movie) => {
    const area = address || addressDraft || "near me";
    const query = `${movie.title} tickets theaters cinemas address ${area}`;
    window.open(
      `https://www.google.com/maps/search/${encodeURIComponent(query)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const isUpcomingFallback = !movies.length && upcoming.length > 0;
  const displayMovies = (movies.length ? movies : upcoming).slice(0, 4);
  const goToMovie = (movie) => {
    const slug = movie.slug || (movie.media_type === "tv" ? `tv-${movie.id}` : String(movie.id));
    navigate(`/movie/${slug}`);
  };

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
            <motion.article
              key={`cinema-${movie.slug || movie.id}`}
              className="group rounded-2xl border border-white/10 bg-black/30 overflow-hidden transition hover:border-red-400/50 hover:bg-black/45"
              whileHover={{ y: -4 }}
            >
              <button
                type="button"
                onClick={() => goToMovie(movie)}
                className="block w-full text-left"
                aria-label={`Open details for ${movie.title}`}
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
              </button>
              <div className="p-4">
                <button type="button" onClick={() => goToMovie(movie)} className="block w-full text-left">
                  <h3 className="text-white font-semibold leading-snug line-clamp-2 min-h-[2.75rem]">
                    {movie.title}
                  </h3>
                </button>
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
            </motion.article>
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
  const [localAddress, setLocalAddress] = useState("");
  const [addressDraft, setAddressDraft] = useState("");
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
  const [replyDrafts, setReplyDrafts] = useState({});
  const [openReplies, setOpenReplies] = useState({});

  useEffect(() => {
    const key = addressStorageKey(user?.user_id);
    const saved = localStorage.getItem(key) || "";
    setLocalAddress(saved);
    setAddressDraft(saved);
  }, [user?.user_id]);

  const fetchTheaters = useCallback(async () => {
    setTheaterLoading(true);
    try {
      const inferred = inferRegionFromAddress(localAddress);
      const region = typeof inferred === "string" ? inferred : inferred.region;
      const theaterRes = await api.get("/api/movies/theaters", {
        params: { region, page: 1 },
      });
      setNowPlayingMovies(theaterRes.data.now_playing || []);
      setUpcomingMovies(theaterRes.data.upcoming || []);
      setTheaterMeta({
        region: theaterRes.data.region,
        region_label: localAddress || theaterRes.data.region_label,
        release_status: theaterRes.data.release_status,
        availability: theaterRes.data.availability,
      });
    } catch {
      setNowPlayingMovies([]);
      setUpcomingMovies([]);
      setTheaterMeta(null);
    } finally {
      setTheaterLoading(false);
    }
  }, [localAddress]);

  useEffect(() => {
    fetchTheaters();
  }, [fetchTheaters, user?.user_id]);

  useEffect(() => {
    const interval = setInterval(fetchTheaters, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchTheaters]);

  useEffect(() => {
    const loadPrimary = async () => {
      try {
        const [trendRes, discRes, topRes, mixedRes] = await Promise.all([
          api.get("/api/movies/trending"),
          api.get("/api/movies/discover?page=1"),
          api.get("/api/movies/top-rated?page=1"),
          api.get("/api/movies/trending-mixed"),
        ]);
        setTrendingMovies(trendRes.data.movies || []);
        setApiError(trendRes.data.error || null);
        setDiscoverMovies(discRes.data.movies || []);
        setDiscoverPage(discRes.data.page || 1);
        setDiscoverTotalPages(discRes.data.total_pages || 1);
        setDiscoverError(discRes.data.error || null);
        setTopRatedMovies(topRes.data.movies || []);
        setMixedTrending(mixedRes.data.movies || []);
      } catch (error) {
        setApiError(error.response?.data?.detail || error.message);
      } finally {
        setLoading(false);
      }
    };
    loadPrimary();
  }, []);

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
      ...nowPlayingMovies,
      ...trendingMovies,
      ...categoryRows.hollywood,
      ...categoryRows.international,
      ...mixedTrending,
    ];
    return merged.filter((item) => {
      const key = item?.slug || item?.id;
      if (!key || seen.has(key) || !item.backdrop_path) return false;
      const hasAudienceSignal = (item.vote_count || 0) >= 40 || (item.popularity || 0) >= 18;
      if (!hasAudienceSignal) return false;
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

  const replyToPost = async (discussionId) => {
    if (!user) return onOpenAuth("login");
    const text = (replyDrafts[discussionId] || "").trim();
    if (!text) return;
    await api.post(`/api/discussions/reply/${discussionId}`, { text });
    setReplyDrafts((prev) => ({ ...prev, [discussionId]: "" }));
    setOpenReplies((prev) => ({ ...prev, [discussionId]: true }));
    loadDiscussion();
  };

  const likeReply = async (replyId) => {
    if (!user) return onOpenAuth("login");
    await api.post(`/api/discussions/reply-like/${replyId}`);
    loadDiscussion();
  };

  const repostPost = async (discussionId) => {
    if (!user) return onOpenAuth("login");
    await api.post(`/api/discussions/repost/${discussionId}`);
    loadDiscussion();
  };

  const saveAddress = (event) => {
    event.preventDefault();
    const value = addressDraft.trim();
    if (!value) return;
    const key = addressStorageKey(user?.user_id);
    localStorage.setItem(key, value);
    setLocalAddress(value);
  };

  const featuredMovie = useMemo(() => {
    if (heroMovies.length) return heroMovies[heroIndex % heroMovies.length];
    return trendingMovies[0] || null;
  }, [heroMovies, heroIndex, trendingMovies]);

  const featuredImage = featuredMovie?.backdrop_path;

  useEffect(() => {
    if (featuredImage) preloadImage(featuredImage);
  }, [featuredImage]);

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

      <div className="relative min-h-[92vh] w-full overflow-hidden bg-[#0B0B0B]">
        {featuredImage && (
          <motion.img
            key={featuredImage}
            src={featuredImage}
            alt=""
            className="absolute inset-0 h-full w-full scale-[1.02] object-cover object-center"
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1.02 }}
            transition={{ duration: 0.28 }}
            loading="eager"
            fetchPriority="high"
          />
        )}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_45%,rgba(0,0,0,0.08),rgba(0,0,0,0.66)_52%,rgba(0,0,0,0.92)_100%)]" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/42 to-black/38" />
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#0B0B0B] to-transparent" />
        <div className="relative z-10 flex h-full items-center pt-36 md:pt-38">
          <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 w-full">
            <div className="max-w-3xl">
              <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold text-white mb-4">
                Unlimited movies,
              </h1>
              <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold text-white mb-6">
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
                      className="ml-4 sm:ml-8 bg-gradient-to-r from-red-600 to-red-700 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-2xl text-lg sm:text-xl font-semibold hover:opacity-90 transition shadow-lg"
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

          <section id="discussion" className="rounded-3xl border border-white/10 bg-[#101010]/90 p-6">
            <h2 className="text-2xl font-bold text-white mb-4">Discussion</h2>
            <div className="flex flex-col sm:flex-row gap-2 mb-5">
              <input
                value={postDraft}
                maxLength={200}
                onChange={(e) => setPostDraft(e.target.value)}
                placeholder="Share your take in 200 characters..."
                className="flex-1 rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-white outline-none focus:border-red-500/60"
              />
              <button
                type="button"
                disabled={posting}
                onClick={createPost}
                className="px-4 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white transition inline-flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <FaPaperPlane className="text-xs" />
                Post
              </button>
            </div>
            <div className="space-y-3">
              {posts.length === 0 && (
                <p className="text-sm text-gray-500 py-6 text-center">
                  No posts yet. Start the conversation.
                </p>
              )}
              {posts.map((post) => (
                <motion.div
                  key={post.discussion_id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-white/10 bg-black/30 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">
                      @{post.username}
                      {post.repost_of && (
                        <span className="ml-2 text-xs font-normal text-gray-500">· reposted</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 shrink-0">
                      {new Date(post.created_at).toLocaleString()}
                    </p>
                  </div>
                  <p className="mt-2 text-gray-300 leading-relaxed">{post.text}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-gray-400">
                    <button
                      type="button"
                      onClick={() => likePost(post.discussion_id)}
                      className={`inline-flex items-center gap-1 transition ${
                        post.user_liked ? "text-red-400" : "hover:text-white"
                      }`}
                    >
                      <FaHeart className="text-xs" /> {post.likes || 0}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setOpenReplies((prev) => ({
                          ...prev,
                          [post.discussion_id]: !prev[post.discussion_id],
                        }))
                      }
                      className="inline-flex items-center gap-1 hover:text-white transition"
                    >
                      <FaReply className="text-xs" /> {post.reply_count || 0}
                    </button>
                    <button
                      type="button"
                      onClick={() => repostPost(post.discussion_id)}
                      className="inline-flex items-center gap-1 hover:text-white transition"
                    >
                      <FaRetweet className="text-xs" /> {post.repost_count || 0}
                    </button>
                  </div>
                  {openReplies[post.discussion_id] && (
                    <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
                      {(post.replies || []).map((reply) => (
                        <div key={reply.reply_id} className="rounded-xl bg-black/25 px-3 py-2">
                          <p className="text-xs text-gray-400">@{reply.username}</p>
                          <p className="text-sm text-gray-300 mt-1">{reply.text}</p>
                          <button
                            type="button"
                            onClick={() => likeReply(reply.reply_id)}
                            className={`mt-2 inline-flex items-center gap-1 text-xs transition ${
                              reply.user_liked ? "text-red-400" : "text-gray-500 hover:text-white"
                            }`}
                          >
                            <FaHeart className="text-[10px]" /> {reply.likes || 0}
                          </button>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <input
                          value={replyDrafts[post.discussion_id] || ""}
                          maxLength={200}
                          onChange={(e) =>
                            setReplyDrafts((prev) => ({
                              ...prev,
                              [post.discussion_id]: e.target.value,
                            }))
                          }
                          placeholder="Write a reply..."
                          className="flex-1 rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-red-500/50"
                        />
                        <button
                          type="button"
                          onClick={() => replyToPost(post.discussion_id)}
                          className="px-3 py-2 rounded-lg bg-red-600/80 text-white text-sm hover:bg-red-600"
                        >
                          Reply
                        </button>
                      </div>
                    </div>
                  )}
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
