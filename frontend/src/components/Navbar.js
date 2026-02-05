import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaSearch, FaUser, FaBookmark } from 'react-icons/fa';

const Navbar = ({ user, onLogout, onOpenAuth }) => {
  const navigate = useNavigate();

  return (
    <nav className="fixed top-0 w-full bg-gradient-to-b from-black to-transparent z-50 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <span className="text-critisizer-red text-3xl font-bold tracking-tight">
              CRITISIZER
            </span>
          </Link>

          {/* Right side */}
          <div className="flex items-center space-x-6">
            {user ? (
              <>
                <button
                  onClick={() => navigate('/watchlist')}
                  className="flex items-center space-x-2 text-white hover:text-critisizer-red transition"
                  data-testid="watchlist-nav-button"
                >
                  <FaBookmark className="text-xl" />
                  <span className="hidden md:inline">Watchlist</span>
                </button>
                
                <div className="relative group">
                  <button className="flex items-center space-x-2 text-white hover:text-critisizer-red transition">
                    <img
                      src={user.avatar}
                      alt={user.username}
                      className="w-8 h-8 rounded-full"
                    />
                    <span className="hidden md:inline">{user.username}</span>
                  </button>
                  
                  <div className="absolute right-0 mt-2 w-48 bg-critisizer-gray rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                    <Link
                      to={`/profile/${user.user_id}`}
                      className="block px-4 py-3 text-white hover:bg-critisizer-red transition"
                      data-testid="profile-nav-link"
                    >
                      My Profile
                    </Link>
                    <button
                      onClick={onLogout}
                      className="w-full text-left px-4 py-3 text-white hover:bg-critisizer-red transition"
                      data-testid="logout-button"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <button
                onClick={() => onOpenAuth('login')}
                className="bg-critisizer-red text-white px-6 py-2 rounded font-semibold hover:bg-red-700 transition"
                data-testid="signin-button"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;