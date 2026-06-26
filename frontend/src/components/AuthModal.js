import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  FaEnvelope,
  FaEye,
  FaEyeSlash,
  FaGithub,
  FaGoogle,
  FaLock,
  FaTimes,
  FaUser,
} from "react-icons/fa";
import api, { API_URL } from "../services/api";

function formatAuthError(err) {
  if (!err.response) {
    if (err.code === "ECONNABORTED")
      return "Request timed out. Is the backend running at http://localhost:8000?";
    if (err.message === "Network Error") {
      return `Cannot reach API at ${API_URL}. Start the backend with: cd backend; .\\start.ps1. In production, set REACT_APP_BACKEND_URL to your Render API URL.`;
    }
    return err.message || "Network error";
  }
  const detail = err.response.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((item) => item.msg || JSON.stringify(item)).join(" ");
  if (detail && typeof detail === "object") return JSON.stringify(detail);
  return err.response.statusText || "An error occurred";
}

const AuthModal = ({ mode, onClose, onSuccess, onSwitchMode }) => {
  const githubPopupRef = useRef(null);
  const [formData, setFormData] = useState({
    email: "",
    username: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState("");

  const isSignup = mode === "signup";

  const passwordChecks = useMemo(
    () => ({
      minLength: formData.password.length >= 8,
      mixedCase:
        /[A-Z]/.test(formData.password) && /[a-z]/.test(formData.password),
      number: /\d/.test(formData.password),
    }),
    [formData.password],
  );

  const passwordReady =
    passwordChecks.minLength &&
    passwordChecks.mixedCase &&
    passwordChecks.number;

  const googleClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;
  const githubClientId = process.env.REACT_APP_GITHUB_CLIENT_ID;
  const githubRedirectUri = useMemo(() => {
    const fallback = `${window.location.origin}/auth/github/callback`;
    const configured = process.env.REACT_APP_GITHUB_REDIRECT_URI;
    if (!configured) return fallback;
    try {
      return new URL(configured).origin === window.location.origin
        ? configured
        : fallback;
    } catch {
      return fallback;
    }
  }, []);

  const completeOAuth = useCallback(async (payload) => {
    setError("");
    setOauthLoading(payload.provider);
    try {
      const response = await api.post("/api/auth/oauth", payload, {
        headers: { "Content-Type": "application/json" },
        timeout: 30000,
      });
      onSuccess(response.data.user, response.data.access_token);
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setOauthLoading("");
    }
  }, [onSuccess]);

  useEffect(() => {
    const onOAuthMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "criticizer-github-oauth") return;
      if (event.data?.error) {
        setOauthLoading("");
        setError(`GitHub sign in failed: ${event.data.error}`);
        return;
      }
      if (event.data?.state !== sessionStorage.getItem("criticizer_github_oauth_state")) {
        setOauthLoading("");
        setError("GitHub login state mismatch. Please try again.");
        return;
      }
      if (!event.data?.code) {
        setOauthLoading("");
        setError("GitHub did not return an authorization code.");
        return;
      }
      completeOAuth({
        provider: "github",
        code: event.data.code,
        redirect_uri: event.data.redirect_uri || githubRedirectUri,
      });
    };

    window.addEventListener("message", onOAuthMessage);
    return () => {
      window.removeEventListener("message", onOAuthMessage);
      if (githubPopupRef.current && !githubPopupRef.current.closed) {
        githubPopupRef.current.close();
      }
    };
  }, [completeOAuth, githubRedirectUri]);

  const loadGoogleScript = () =>
    new Promise((resolve, reject) => {
      if (window.google?.accounts?.id) {
        resolve();
        return;
      }
      const existing = document.querySelector(
        'script[src="https://accounts.google.com/gsi/client"]',
      );
      if (existing) {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });

  const handleGoogle = async () => {
    if (!googleClientId) {
      setError("Google login is not configured on the frontend.");
      return;
    }
    setOauthLoading("google");
    setError("");
    try {
      await loadGoogleScript();
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: (response) => {
          if (!response.credential) {
            setOauthLoading("");
            setError("Google did not return a credential.");
            return;
          }
          completeOAuth({
            provider: "google",
            credential: response.credential,
          });
        },
      });
      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          setOauthLoading("");
          setError(
            "Google sign-in was dismissed. Try again or use email/password.",
          );
        }
      });
    } catch {
      setOauthLoading("");
      setError(
        "Unable to load Google sign-in. Check your connection and OAuth settings.",
      );
    }
  };

  const handleGithub = () => {
    if (!githubClientId) {
      setError("GitHub login is not configured on the frontend.");
      return;
    }
    setError("");
    setOauthLoading("github");
    const state =
      window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    sessionStorage.setItem("criticizer_github_oauth_state", state);
    const url = new URL("https://github.com/login/oauth/authorize");
    url.searchParams.set("client_id", githubClientId);
    url.searchParams.set("redirect_uri", githubRedirectUri);
    url.searchParams.set("scope", "read:user user:email");
    url.searchParams.set("state", state);
    githubPopupRef.current = window.open(
      url.toString(),
      "criticizer-github-oauth",
      "width=520,height=720",
    );
    if (!githubPopupRef.current) {
      setOauthLoading("");
      setError("Popup blocked. Allow popups for GitHub login.");
      return;
    }

    const timer = window.setInterval(() => {
      const popup = githubPopupRef.current;
      if (!popup || popup.closed) {
        window.clearInterval(timer);
        setOauthLoading((current) => (current === "github" ? "" : current));
      }
    }, 400);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (isSignup) {
      if (!passwordReady) {
        setError(
          "Use at least 8 characters with upper/lowercase letters and a number.",
        );
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }

    setLoading(true);
    try {
      const endpoint = isSignup ? "/api/auth/signup" : "/api/auth/login";
      const email = formData.email.trim();
      const payload = isSignup
        ? {
            email,
            username: formData.username.trim(),
            password: formData.password,
          }
        : {
            email,
            password: formData.password,
          };
      const response = await api.post(endpoint, payload, {
        headers: { "Content-Type": "application/json" },
        timeout: 20000,
      });
      onSuccess(response.data.user, response.data.access_token);
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (event) => {
    setFormData((prev) => ({
      ...prev,
      [event.target.name]: event.target.value,
    }));
  };

  const inputClassName =
    "w-full rounded-2xl border border-white/10 bg-black/30 px-12 py-3 text-white outline-none transition placeholder:text-gray-500 focus:border-red-500/70 focus:ring-2 focus:ring-red-500/20";

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/75 px-4 py-4 backdrop-blur-md sm:py-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
          onClick={(event) => event.stopPropagation()}
          className="relative my-auto max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(220,38,38,0.18),transparent_32%),linear-gradient(145deg,#171111,#0b0b0b)] p-5 shadow-2xl sm:max-h-[calc(100vh-4rem)] sm:p-7"
        >
          <div className="pointer-events-none absolute -top-16 right-0 h-40 w-40 rounded-full bg-red-600/15 blur-3xl" />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full border border-white/10 bg-white/5 p-2 text-white transition hover:bg-white/10"
            data-testid="close-auth-modal"
          >
            <FaTimes />
          </button>

          <p className="text-xs uppercase tracking-[0.3em] text-red-300/80">
            {isSignup ? "Join Criticizer" : "Welcome Back"}
          </p>
          <h2 className="mt-2 text-2xl font-black text-white sm:text-3xl">
            {isSignup ? "Create your movie identity" : "Sign in to continue"}
          </h2>
          <p className="mt-2 text-sm text-gray-400">
            {isSignup
              ? "Unlock search, personalized picks, reviews, watchlists, and your yearly Wrapped."
              : "Access search, reviews, watchlists, and your personalized cinema profile."}
          </p>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-5 rounded-2xl border border-red-400/30 bg-red-500/15 px-4 py-3 text-sm text-red-100"
              data-testid="auth-error"
            >
              {error}
            </motion.div>
          )}

          <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <button
              type="button"
              onClick={handleGoogle}
              disabled={loading || !!oauthLoading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-semibold text-white transition hover:border-red-400/40 hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FaGoogle className="text-red-300" />
              {oauthLoading === "google"
                ? "Connecting..."
                : "Continue with Google"}
            </button>
            <button
              type="button"
              onClick={handleGithub}
              disabled={loading || !!oauthLoading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-semibold text-white transition hover:border-red-400/40 hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FaGithub />
              {oauthLoading === "github"
                ? "Connecting..."
                : "Continue with GitHub"}
            </button>
          </div>

          <div className="mt-4 flex items-center gap-3 text-xs uppercase tracking-[0.22em] text-gray-500">
            <span className="h-px flex-1 bg-white/10" />
            or
            <span className="h-px flex-1 bg-white/10" />
          </div>

          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            <div className="relative">
              <FaEnvelope className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="email"
                name="email"
                placeholder="Email address"
                value={formData.email}
                onChange={handleChange}
                required
                className={inputClassName}
                data-testid="email-input"
              />
            </div>

            {isSignup && (
              <div className="relative">
                <FaUser className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  name="username"
                  placeholder="Username"
                  value={formData.username}
                  onChange={handleChange}
                  required
                  minLength={3}
                  className={inputClassName}
                  data-testid="username-input"
                />
              </div>
            )}

            <div className="relative">
              <FaLock className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
                required
                className={inputClassName}
                data-testid="password-input"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-white"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>

            {isSignup && (
              <>
                <div className="relative">
                  <FaLock className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    name="confirmPassword"
                    placeholder="Confirm password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                    className={inputClassName}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-white"
                    aria-label={
                      showConfirmPassword
                        ? "Hide confirmation password"
                        : "Show confirmation password"
                    }
                  >
                    {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-2.5 text-xs text-gray-400">
                  <p
                    className={`mb-1 ${passwordChecks.minLength ? "text-emerald-300" : ""}`}
                  >
                    At least 8 characters
                  </p>
                  <p
                    className={`mb-1 ${passwordChecks.mixedCase ? "text-emerald-300" : ""}`}
                  >
                    Uppercase and lowercase letters
                  </p>
                  <p
                    className={passwordChecks.number ? "text-emerald-300" : ""}
                  >
                    At least one number
                  </p>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-gradient-to-r from-red-600 to-red-800 py-3.5 font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              data-testid="submit-auth-button"
            >
              {loading
                ? "Please wait..."
                : isSignup
                  ? "Create account"
                  : "Sign in"}
            </button>
          </form>

          <div className="mt-4 text-center">
            <p className="text-sm text-gray-400">
              {isSignup
                ? "Already have an account? "
                : "Don't have an account? "}
              <button
                type="button"
                onClick={() => onSwitchMode(isSignup ? "login" : "signup")}
                className="font-semibold text-red-300 transition hover:text-red-200"
                data-testid="switch-auth-mode"
              >
                {isSignup ? "Sign in" : "Sign up"}
              </button>
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AuthModal;
