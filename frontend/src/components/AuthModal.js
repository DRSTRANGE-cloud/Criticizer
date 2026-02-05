import React, { useState } from 'react';
import axios from 'axios';
import { FaTimes } from 'react-icons/fa';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

const AuthModal = ({ mode, onClose, onSuccess, onSwitchMode }) => {
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/signup';
      const payload = mode === 'login' 
        ? { email: formData.email, password: formData.password }
        : formData;

      const response = await axios.post(`${API_URL}${endpoint}`, payload);
      onSuccess(response.data.user, response.data.access_token);
    } catch (err) {
      setError(err.response?.data?.detail || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 px-4">
      <div className="bg-critisizer-gray rounded-lg p-8 max-w-md w-full relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white hover:text-critisizer-red transition"
          data-testid="close-auth-modal"
        >
          <FaTimes className="text-2xl" />
        </button>

        <h2 className="text-3xl font-bold text-white mb-6">
          {mode === 'login' ? 'Sign In' : 'Sign Up'}
        </h2>

        {error && (
          <div className="bg-red-500 text-white p-3 rounded mb-4" data-testid="auth-error">
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
              className="w-full px-4 py-3 bg-critisizer-dark text-white rounded border border-gray-600 focus:border-critisizer-red focus:outline-none"
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
                className="w-full px-4 py-3 bg-critisizer-dark text-white rounded border border-gray-600 focus:border-critisizer-red focus:outline-none"
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
              className="w-full px-4 py-3 bg-critisizer-dark text-white rounded border border-gray-600 focus:border-critisizer-red focus:outline-none"
              data-testid="password-input"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-critisizer-red text-white py-3 rounded font-semibold hover:bg-red-700 transition disabled:opacity-50"
            data-testid="submit-auth-button"
          >
            {loading ? 'Loading...' : mode === 'login' ? 'Sign In' : 'Sign Up'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-400">
            {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={() => onSwitchMode(mode === 'login' ? 'signup' : 'login')}
              className="text-critisizer-red hover:underline font-semibold"
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