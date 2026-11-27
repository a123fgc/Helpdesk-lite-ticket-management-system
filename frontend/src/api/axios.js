import axios from 'axios';

/**
 * Single API client for the whole app.
 *
 * `VITE_API_BASE_URL` controls where requests go:
 *   - development: "/api" (default) -> Vite dev proxy forwards to the backend
 *     (see vite.config.js / VITE_PROXY_TARGET).
 *   - production:  "/api" when a reverse proxy serves the API on the same
 *     origin, or an absolute URL when it does not.
 * The Vite dev proxy is never used by a production build.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('hd_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('hd_token');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;