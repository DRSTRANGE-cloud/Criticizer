import React, { useState } from 'react';
import api, { API_URL } from '../services/api';
import { FaTimes } from 'react-icons/fa';

/** FastAPI returns `detail` as a string, array of objects, or object — normalize for UI */
function formatAuthError(err) {
  if (!err.response) {
    if (err.code === 'ECONNABORTED') return 'Request timed out. Is the backend running on port 8001?';
    if (err.message === 'Network Error') {
      return `Cannot reach API at ${API_URL}. Start the backend: cd backend → uvicorn server:app --reload --port 8001`;
    }
    return err.message || 'Network error';
  }
  const d = err.response.data?.detail;
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) {
    return d.map((e) => e.msg || JSON.stringify(e)).join(' ');
  }
  if (d && typeof d === 'object') return JSON.stringify(d);
  return err.response.statusText || 'An error occurred';
}

const AuthModal = ({ mode, onClose, onSuccess, onSwitchMode }) => {
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/signup';
      const email = formData.email.trim();
      const payload =
        mode === 'login'
          ? { email, password: formData.password }
          : { ...formData, email, username: formData.username.trim() };

      const response = await api.post(endpoint, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 20000,
      });
      onSuccess(response.data.user, response.data.access_token);
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/70 backdrop-blur-md">
      <div className="bg-[#141414] rounded-2xl p-8 max-w-md w-full relative border border-white/10 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white hover:text-critisizer-red transition"
          data-testid="close-auth-modal"
        >
          <FaTimes className="text-2xl" />
        </button>

        <h2 className="text-3xl font-bold text-white mb-6">{mode === 'login' ? 'Sign In' : 'Sign Up'}</h2>

        {error && (
          <div className="bg-red-500/90 text-white p-3 rounded-xl mb-4" data-testid="auth-error">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="email"
              name="email"
              placeholder="Email"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 bg-critisizer-dark text-white rounded-xl border border-gray-600 focus:border-fuchsia-500 focus:outline-none"
              data-testid="email-input"
            />
          </div>

          {mode === 'signup' && (
            <div>
              <input
                type="text"
                name="username"
                placeholder="Username"
                value={formData.username}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 bg-critisizer-dark text-white rounded-xl border border-gray-600 focus:border-fuchsia-500 focus:outline-none"
                data-testid="username-input"
              />
            </div>
          )}

          <div>
            <input
              type="password"
              name="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 bg-critisizer-dark text-white rounded-xl border border-gray-600 focus:border-fuchsia-500 focus:outline-none"
              data-testid="password-input"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-red-600 to-fuchsia-600 text-white py-3 rounded-xl font-semibold hover:opacity-90 transition disabled:opacity-50"
            data-testid="submit-auth-button"
          >
            {loading ? 'Loading...' : mode === 'login' ? 'Sign In' : 'Sign Up'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-400">
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => onSwitchMode(mode === 'login' ? 'signup' : 'login')}
              className="text-fuchsia-400 hover:underline font-semibold"
              data-testid="switch-auth-mode"
            >
              {mode === 'login' ? 'Sign Up' : 'Sign In'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
