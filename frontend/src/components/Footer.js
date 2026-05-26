import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
  const linkClass = 'text-gray-400 hover:text-white transition-colors duration-200';

  return (
    <footer className="border-t border-white/5 bg-[#080808]/95 backdrop-blur-sm mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            to="/"
            className="text-lg font-extrabold uppercase tracking-[0.15em] text-white hover:text-fuchsia-200 transition-colors"
          >
            CRITICIZER
          </Link>
          <p className="mt-2 text-sm text-gray-500 max-w-xs">
            Review smarter. Watch what matters.
          </p>
        </div>

        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <Link to="/" className={linkClass}>
            Home
          </Link>
          <Link to="/watchlist" className={linkClass}>
            My List
          </Link>
          <Link to="/privacy" className={linkClass}>
            Privacy
          </Link>
          <Link to="/terms" className={linkClass}>
            Terms
          </Link>
        </nav>

        <p className="text-xs text-gray-600 sm:text-right">© 2026 Criticizer</p>
      </div>
    </footer>
  );
};

export default Footer;
