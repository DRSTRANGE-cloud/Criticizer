import axios from "axios";

const defaultApiUrl =
  typeof window !== "undefined" && window.location.hostname === "criticizer.vercel.app"
    ? "https://criticizer.onrender.com"
    : "http://localhost:8000";

const rawApiUrl = process.env.REACT_APP_BACKEND_URL || defaultApiUrl;
export const API_URL = rawApiUrl.replace(/\/+$/, "");

const api = axios.create({
  baseURL: API_URL,
  timeout: 25000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
