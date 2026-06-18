import React from 'react';
import { Link } from 'react-router-dom';
import { FaGithub, FaLinkedin, FaTwitter } from 'react-icons/fa';

const Footer = () => {
  return (
    <footer className="relative mt-24 border-t border-red-500/10 bg-[#050505]/95 backdrop-blur-xl">
      
      {/* Glow Line */}
      <div className="absolute top-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-red-500/40 to-transparent" />

      <div className="max-w-7xl mx-auto px-6 py-12">

        {/* Top Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-10">

          {/* Brand */}
          <div>
            <Link
              to="/"
              className="
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
              "
            >
              CRITICIZER
            </Link>

            <p className="mt-3 text-sm text-zinc-500 max-w-sm leading-relaxed">
              Discover. Review. Discuss. Your personal destination for movies,
              anime, TV shows, and cinematic experiences.
            </p>
          </div>

          {/* Navigation */}
          <div className="flex flex-wrap gap-6 text-sm text-zinc-400">
            <Link to="/" className="hover:text-white transition">
              Home
            </Link>

            <Link to="/watchlist" className="hover:text-white transition">
              Watchlist
            </Link>

            <Link to="/collections" className="hover:text-white transition">
              Collections
            </Link>

            <Link to="/privacy" className="hover:text-white transition">
              Privacy
            </Link>

            <Link to="/terms" className="hover:text-white transition">
              Terms
            </Link>
          </div>
        </div>

        {/* Divider */}
        <div className="my-8 h-px bg-white/5" />

        {/* Bottom Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">

          <p className="text-xs text-zinc-600">
            © 2026 Criticizer. All rights reserved.
          </p>

          <div className="flex items-center gap-5 text-zinc-500">
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="hover:text-red-400 transition"
            >
              <FaGithub size={18} />
            </a>

            <a
              href="https://linkedin.com"
              target="_blank"
              rel="noreferrer"
              className="hover:text-red-400 transition"
            >
              <FaLinkedin size={18} />
            </a>

            <a
              href="https://twitter.com"
              target="_blank"
              rel="noreferrer"
              className="hover:text-red-400 transition"
            >
              <FaTwitter size={18} />
            </a>
          </div>
        </div>

      </div>
    </footer>
  );
};

export default Footer;