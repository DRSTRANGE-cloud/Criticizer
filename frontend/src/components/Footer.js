import React from 'react';
import { Link } from 'react-router-dom';
import { FaXTwitter, FaInstagram, FaYoutube } from 'react-icons/fa6';

const Footer = () => {
  const linkClass =
    'inline-block text-gray-400 hover:text-white transition relative after:absolute after:left-0 after:-bottom-0.5 after:h-px after:w-0 after:bg-white after:transition-all hover:after:w-full';

  return (
    <footer className="border-t border-white/5 bg-[#080808] mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link to="/" className="text-2xl font-extrabold uppercase tracking-[0.2em] text-white">
              CRITICIZER
            </Link>
            <p className="mt-4 text-sm text-gray-400 max-w-xs">
              Discover faster, review smarter, and always know what to watch next.
            </p>
            <div className="mt-4 flex items-center gap-3 text-gray-400">
              {[FaXTwitter, FaInstagram, FaYoutube].map((Icon, idx) => (
                <button key={idx} className="h-9 w-9 rounded-full bg-white/5 border border-white/10 hover:text-white hover:border-white/30 transition inline-flex items-center justify-center">
                  <Icon className="text-sm" />
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">Browse</h3>
            <ul className="mt-3 space-y-2 text-sm text-gray-400">
              <li><Link to="/" className={linkClass}>Home</Link></li>
              <li><Link to="/" className={linkClass}>Movies</Link></li>
              <li><Link to="/" className={linkClass}>TV Shows</Link></li>
              <li><Link to="/watchlist" className={linkClass}>My List</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">Features</h3>
            <ul className="mt-3 space-y-2 text-sm text-gray-400">
              <li>Criticizer Meter</li>
              <li>Watchlist</li>
              <li>Reviews</li>
              <li>Community</li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">Legal</h3>
            <ul className="mt-3 space-y-2 text-sm text-gray-400">
              <li><Link to="/privacy" className={linkClass}>Privacy Policy</Link></li>
              <li><Link to="/terms" className={linkClass}>Terms</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-10 border-t border-white/5 pt-5 text-sm text-gray-500">
          © 2026 Criticizer
        </div>
      </div>
    </footer>
  );
};

export default Footer;
