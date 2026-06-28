import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FaBars, FaBookmark, FaFilm, FaHome, FaLayerGroup, FaLock, FaSearch, FaSignOutAlt, FaTimes } from "react-icons/fa";
import { AnimatePresence, motion } from "framer-motion";
import api from "../services/api";

function UserAvatar({ user, size = "h-8 w-8" }) {
  const [failed, setFailed] = useState(false);
  const initial = (user?.username || user?.email || "U").trim().charAt(0).toUpperCase();
  if (user?.avatar && !failed) {
    return (
      <img
        src={user.avatar}
        alt={user.username}
        onError={() => setFailed(true)}
        className={`${size} rounded-full object-cover ring-2 ring-transparent transition group-hover:ring-red-500/50`}
        loading="eager"
        decoding="async"
      />
    );
  }
  return (
    <span
      className={`${size} inline-flex items-center justify-center rounded-full bg-gradient-to-br from-red-500 via-fuchsia-600 to-indigo-600 text-sm font-black text-white shadow-lg shadow-red-950/35 ring-2 ring-white/10`}
      aria-label={user?.username || "User"}
    >
      {initial}
    </span>
  );
}

const Navbar = ({ user, onLogout, onOpenAuth }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [results, setResults] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    if (!user) {
      setDebounced("");
      setResults([]);
      setLoading(false);
      return;
    }
    const timer = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query, user]);

  useEffect(() => {
    if (!user || !debounced) {
      setResults([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const response = await api.get("/api/movies/suggest", {
          params: { query: debounced, page: 1 },
        });
        if (!cancelled) {
          setResults((response.data.movies || []).slice(0, 8));
        }
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [debounced, user]);

  useEffect(() => {
    setMenuOpen(false);
    const onMouseDown = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  const handleSearchFocus = () => {
    if (!user) {
      onOpenAuth("login");
      return;
    }
    setSearchOpen(true);
  };

  const goToMovie = (item) => {
    const slug =
      item.slug ||
      (item.media_type === "tv" ? `tv-${item.id}` : String(item.id));
    setSearchOpen(false);
    setQuery("");
    navigate(`/movie/${slug}`);
  };

  const renderSearchBox = (mobile = false) => (
    <div className={`relative w-full ${mobile ? "md:hidden" : "mx-auto hidden max-w-xl md:block"}`} ref={mobile ? null : searchRef}>
      <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
      {!user && <FaLock className="absolute right-4 top-1/2 -translate-y-1/2 text-red-400/70" />}
      <input
        type="search"
        value={query}
        onChange={(event) => {
          if (!user) return;
          setQuery(event.target.value);
          setSearchOpen(true);
        }}
        onFocus={handleSearchFocus}
        onClick={handleSearchFocus}
        readOnly={!user}
        placeholder={user ? "Search movies and series" : "Login to search titles"}
        className={`w-full rounded-2xl border text-white pl-11 pr-10 py-2.5 outline-none transition ${
          user
            ? "bg-white/[0.04] border-white/10 focus:border-red-500/60 focus:ring-2 focus:ring-red-500/15 hover:border-white/20"
            : "bg-white/[0.02] border-white/10 cursor-pointer"
        }`}
      />
      {!user && (
        <button type="button" onClick={() => onOpenAuth("login")} className="absolute inset-0 rounded-2xl" aria-label="Login to search" />
      )}
      {user && searchOpen && query.trim() && (
        <div className={`absolute left-0 right-0 top-full mt-2 rounded-2xl border border-white/10 bg-[#0a0a0a]/95 backdrop-blur-2xl shadow-2xl overflow-hidden ${mobile ? "z-[70]" : ""}`}>
          {loading ? (
            <div className="px-4 py-4 text-sm text-zinc-400">Searching...</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-4 text-sm text-zinc-400">No matches found</div>
          ) : (
            <ul className="max-h-96 overflow-y-auto py-2">
              {results.map((item) => (
                <li key={`${mobile ? "m" : "d"}-${item.media_type || "movie"}-${item.id}`}>
                  <button type="button" onClick={() => goToMovie(item)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-500/10 transition text-left">
                    {item.poster_path ? (
                      <img src={item.poster_path} alt="" className="w-10 h-14 rounded-lg object-cover flex-none" loading="lazy" />
                    ) : (
                      <div className="w-10 h-14 rounded-lg bg-white/5 flex-none" />
                    )}
                    <div className="min-w-0">
                      <div className="text-white font-medium truncate">{item.title}</div>
                      <div className="text-xs text-zinc-500 capitalize">
                        {item.media_type || "movie"} {item.release_date ? `- ${item.release_date.slice(0, 4)}` : ""}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );

  const isActive = (path) => location.pathname === path;

  const menuItems = user
    ? [
        { label: "Home", icon: FaHome, action: () => navigate("/") },
        { label: "My Lists", icon: FaBookmark, action: () => navigate("/watchlist") },
        { label: "Profile", icon: FaLayerGroup, action: () => navigate(`/profile/${user.user_id}`) },
        { label: "Wrapped", icon: FaFilm, action: () => navigate(`/profile/${user.user_id}/wrapped`) },
        {
          label: "Discussions",
          icon: FaSearch,
          action: () => {
            navigate("/");
            window.setTimeout(() => document.getElementById("discussion")?.scrollIntoView({ behavior: "smooth" }), 120);
          },
        },
      ]
    : [{ label: "Home", icon: FaHome, action: () => navigate("/") }];

  return (
    <nav className="fixed top-0 w-full z-50 border-b border-red-500/10 bg-black/70 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.55)]">
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-red-600/50 to-transparent" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-[auto_1fr_auto] gap-3 sm:gap-4 items-center min-h-[4.5rem] py-2.5">
          <motion.button
            type="button"
            onClick={() => navigate("/")}
            className="flex items-center min-w-0"
            whileHover={{ scale: 1.03 }}
            transition={{ type: "spring", stiffness: 320, damping: 22 }}
          >
            <span className="
                text-2xl
                font-black
                tracking-[0.2em]
                uppercase
                bg-gradient-to-r
                from-red-500
                via-red-400
                to-red-600
                bg-clip-text
                text-transparent
              ">
              CRITICIZER
            </span>
          </motion.button>

          <div className="relative mx-auto hidden w-full max-w-xl md:block" ref={searchRef}>
            <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
            {!user && (
              <FaLock className="absolute right-4 top-1/2 -translate-y-1/2 text-red-400/70" />
            )}
            <input
              type="search"
              value={query}
              onChange={(event) => {
                if (!user) return;
                setQuery(event.target.value);
                setSearchOpen(true);
              }}
              onFocus={handleSearchFocus}
              onClick={handleSearchFocus}
              readOnly={!user}
              placeholder={
                user ? "Search movies and series" : "Login to search titles"
              }
              className={`w-full rounded-2xl border text-white pl-11 pr-10 py-2.5 sm:py-3 outline-none transition ${
                user
                  ? "bg-white/[0.04] border-white/10 focus:border-red-500/60 focus:ring-2 focus:ring-red-500/15 hover:border-white/20"
                  : "bg-white/[0.02] border-white/10 cursor-pointer"
              }`}
            />
            {!user && (
              <button
                type="button"
                onClick={() => onOpenAuth("login")}
                className="absolute inset-0 rounded-2xl"
                aria-label="Login to search"
              />
            )}
            {user && searchOpen && query.trim() && (
              <div className="absolute left-0 right-0 top-full mt-2 rounded-2xl border border-white/10 bg-[#0a0a0a]/95 backdrop-blur-2xl shadow-2xl overflow-hidden">
                {loading ? (
                  <div className="px-4 py-4 text-sm text-zinc-400">
                    Searching...
                  </div>
                ) : results.length === 0 ? (
                  <div className="px-4 py-4 text-sm text-zinc-400">
                    No matches found
                  </div>
                ) : (
                  <ul className="max-h-96 overflow-y-auto py-2">
                    {results.map((item) => (
                      <li key={`${item.media_type || "movie"}-${item.id}`}>
                        <button
                          type="button"
                          onClick={() => goToMovie(item)}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-500/10 transition text-left"
                        >
                          {item.poster_path ? (
                            <img
                              src={item.poster_path}
                              alt=""
                              className="w-10 h-14 rounded-lg object-cover flex-none"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-10 h-14 rounded-lg bg-white/5 flex-none" />
                          )}
                          <div className="min-w-0">
                            <div className="text-white font-medium truncate">
                              {item.title}
                            </div>
                            <div className="text-xs text-zinc-500 capitalize">
                              {item.media_type || "movie"}{" "}
                              {item.release_date
                                ? `- ${item.release_date.slice(0, 4)}`
                                : ""}
                            </div>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 sm:gap-3">
            {user ? (
              <>
                <button
                  onClick={() => navigate("/watchlist")}
                  className={`hidden lg:flex items-center gap-2 px-3 py-2 rounded-xl transition ${
                    isActive("/watchlist")
                      ? "text-red-400 bg-red-500/10 border border-red-500/30"
                      : "text-white hover:text-red-400 hover:bg-white/5"
                  }`}
                  data-testid="watchlist-nav-button"
                >
                  <FaBookmark className="text-lg" />
                  <span className="hidden md:inline text-sm font-medium">My Lists</span>
                </button>

                <button
                  onClick={() => navigate(`/profile/${user.user_id}`)}
                  className={`hidden lg:flex items-center gap-2 px-3 py-2 rounded-xl transition ${
                    location.pathname.includes("/profile/")
                      ? "text-red-400 bg-red-500/10 border border-red-500/30"
                      : "text-white hover:text-red-400 hover:bg-white/5"
                  }`}
                >
                  <FaLayerGroup className="text-sm" />
                  <span className="text-sm font-medium">Profile</span>
                </button>

                <div className="relative group hidden sm:block">
                  <button className="flex items-center gap-2 text-white hover:text-red-400 transition px-2 py-1 rounded-xl">
                    <UserAvatar user={user} />
                    <span className="hidden lg:inline text-sm">{user.username}</span>
                  </button>

                  <div className="absolute right-0 mt-2 w-48 bg-[#111111]/95 backdrop-blur-xl rounded-2xl border border-white/10 shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 overflow-hidden">
                    <Link
                      to={`/profile/${user.user_id}`}
                      className="block px-4 py-3 text-white hover:bg-red-500/10 transition"
                      data-testid="profile-nav-link"
                    >
                      My Profile
                    </Link>
                    <button
                      onClick={onLogout}
                      className="w-full text-left px-4 py-3 text-white hover:bg-red-500/10 transition"
                      data-testid="logout-button"
                    >
                      Logout
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMenuOpen(true)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white transition hover:border-red-500/40 hover:bg-white/10 lg:hidden"
                  aria-label="Open navigation menu"
                  aria-expanded={menuOpen}
                >
                  <FaBars />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => onOpenAuth("login")}
                  className="bg-gradient-to-r from-red-600 to-red-700 text-white px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-sm font-semibold hover:from-red-500 hover:to-red-600 transition shadow-lg shadow-red-900/30"
                  data-testid="signin-button"
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setMenuOpen(true)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white transition hover:border-red-500/40 hover:bg-white/10 md:hidden"
                  aria-label="Open navigation menu"
                  aria-expanded={menuOpen}
                >
                  <FaBars />
                </button>
              </>
            )}
          </div>
        </div>
        <div className="pb-3 md:hidden">
          {renderSearchBox(true)}
        </div>
      </div>
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.button
              type="button"
              className="fixed inset-0 z-40 bg-black/65 backdrop-blur-sm lg:hidden"
              aria-label="Close navigation menu"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
            />
            <motion.aside
              className="fixed right-0 top-0 z-50 h-screen w-[min(86vw,360px)] border-l border-white/10 bg-[#090909]/95 p-5 shadow-2xl backdrop-blur-2xl lg:hidden"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              role="dialog"
              aria-modal="true"
              aria-label="Navigation menu"
            >
              <div className="flex items-center justify-between">
                <span className="text-xl font-black tracking-[0.18em] text-red-500">CRITICIZER</span>
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-xl border border-white/10 bg-white/5 p-2 text-white transition hover:bg-white/10"
                  aria-label="Close navigation menu"
                >
                  <FaTimes />
                </button>
              </div>

              {user && (
                <div className="mt-6 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                  <UserAvatar user={user} size="h-11 w-11" />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-white">{user.username}</p>
                    <p className="truncate text-xs text-gray-500">{user.email}</p>
                  </div>
                </div>
              )}

              <div className="mt-6 space-y-2">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => {
                        item.action();
                        setMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left font-medium text-gray-200 transition hover:bg-red-500/10 hover:text-red-300"
                    >
                      <Icon className="text-red-300" />
                      {item.label}
                    </button>
                  );
                })}
                {user ? (
                  <button
                    type="button"
                    onClick={() => {
                      onLogout();
                      setMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left font-medium text-gray-200 transition hover:bg-red-500/10 hover:text-red-300"
                  >
                    <FaSignOutAlt className="text-red-300" />
                    Logout
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenAuth("login");
                      setMenuOpen(false);
                    }}
                    className="mt-3 w-full rounded-2xl bg-red-600 px-4 py-3 font-semibold text-white transition hover:bg-red-500"
                  >
                    Sign In
                  </button>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
