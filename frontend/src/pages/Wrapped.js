import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { FaArrowLeft, FaDownload, FaShareAlt } from 'react-icons/fa';
import api from '../services/api';
import MovieCard from '../components/MovieCard';

function useAnimatedNumber(target, duration = 900) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let frame = 0;
    const steps = 24;
    const finalTarget = Number(target) || 0;
    const timer = window.setInterval(() => {
      frame += 1;
      const next = finalTarget * (frame / steps);
      setValue(frame >= steps ? finalTarget : next);
      if (frame >= steps) {
        window.clearInterval(timer);
      }
    }, duration / steps);
    return () => window.clearInterval(timer);
  }, [target, duration]);

  return typeof target === 'number' && !Number.isInteger(target) ? value.toFixed(1) : Math.round(value);
}

function DnaTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl border border-white/10 bg-black/90 px-4 py-3 shadow-2xl backdrop-blur">
      <p className="text-xs uppercase tracking-[0.2em] text-gray-500">{payload[0].payload.subject}</p>
      <p className="mt-1 text-2xl font-bold text-white">{payload[0].value}</p>
    </div>
  );
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 4) {
  const words = String(text || '').split(/\s+/);
  let line = '';
  let lineCount = 0;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y + lineCount * lineHeight);
      line = word;
      lineCount += 1;
      if (lineCount >= maxLines) return;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, y + lineCount * lineHeight);
}

const Wrapped = ({ user }) => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [wrapped, setWrapped] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadWrapped = async () => {
      try {
        const response = await api.get(`/api/user/wrapped/${userId}`);
        setWrapped(response.data);
      } catch (err) {
        setError(err.response?.data?.detail || err.message);
      } finally {
        setLoading(false);
      }
    };
    loadWrapped();
  }, [userId]);

  const dnaData = useMemo(() => {
    if (!wrapped?.cinema_dna) return [];
    return Object.entries(wrapped.cinema_dna).map(([key, value]) => ({
      subject: key.replace('-', ' '),
      value,
      fullMark: 100,
    }));
  }, [wrapped]);

  const watchedCounter = useAnimatedNumber(wrapped?.stats?.movies_watched || 0);
  const reviewsCounter = useAnimatedNumber(wrapped?.stats?.reviews_written || 0);
  const ratingCounter = useAnimatedNumber(wrapped?.stats?.average_rating || 0);
  const hoursCounter = useAnimatedNumber(wrapped?.stats?.hours_watched || 0);

  const downloadShareCard = () => {
    if (!wrapped?.share_card) return;
    const canvas = document.createElement('canvas');
    canvas.width = 1600;
    canvas.height = 900;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#09090b');
    gradient.addColorStop(0.4, '#4c0519');
    gradient.addColorStop(1, '#1d4ed8');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.arc(1320, 180, 160, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(240, 760, 210, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f5f5f5';
    ctx.font = '700 60px Arial';
    ctx.fillText('Criticizer Wrapped', 110, 140);
    ctx.font = '500 28px Arial';
    ctx.fillStyle = '#fda4af';
    ctx.fillText(String(wrapped.tagline || 'Your Year In Cinema'), 110, 190);

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 72px Arial';
    ctx.fillText(String(wrapped.share_card.feature_title || 'Your cinema year'), 110, 340);
    ctx.font = '600 34px Arial';
    ctx.fillStyle = '#d4d4d8';
    wrapText(ctx, wrapped.share_card.subheadline, 110, 410, 980, 46, 3);

    ctx.fillStyle = '#ffffff';
    ctx.font = '600 30px Arial';
    wrapText(ctx, wrapped.share_card.stat_line, 110, 585, 900, 42, 2);

    ctx.fillStyle = '#f9a8d4';
    ctx.font = '700 26px Arial';
    ctx.fillText(`Year ${wrapped.year}`, 110, 720);

    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `criticizer-wrapped-${wrapped.year}.png`;
    link.click();
  };

  if (!user || user.user_id !== userId) {
    return (
      <div className="min-h-screen bg-[#0B0B0B] flex flex-col items-center justify-center pt-24 px-4">
        <h1 className="text-2xl font-bold text-white">Wrapped is private</h1>
        <p className="mt-3 max-w-md text-center text-gray-400">Sign in to explore your year in cinema.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0B0B] flex items-center justify-center pt-24">
        <div className="h-10 w-10 rounded-full border-2 border-white/20 border-t-fuchsia-500 animate-spin" />
      </div>
    );
  }

  if (error || !wrapped) {
    return (
      <div className="min-h-screen bg-[#0B0B0B] flex flex-col items-center justify-center pt-24 px-4">
        <h1 className="text-2xl font-bold text-white">Wrapped could not load</h1>
        <p className="mt-3 max-w-lg text-center text-red-300">{error || 'No wrapped data available yet.'}</p>
      </div>
    );
  }

  return (
    <motion.div
      className="min-h-screen bg-[#060608] pt-28 pb-16"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:border-fuchsia-500/40 hover:bg-white/10"
        >
          <FaArrowLeft className="text-xs" />
          Back
        </button>

        <section className="relative mt-6 overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(244,114,182,0.2),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.22),transparent_35%),linear-gradient(140deg,#121216,#09090b)] p-8 shadow-2xl">
          <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.02),transparent)]" />
          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm uppercase tracking-[0.35em] text-fuchsia-300/80">Criticizer Wrapped {wrapped.year}</p>
              <h1 className="mt-4 text-5xl font-black tracking-tight text-white md:text-7xl">Your Year In Cinema</h1>
              <p className="mt-5 max-w-2xl text-lg text-gray-300">{wrapped.ai_summary}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={downloadShareCard}
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 font-semibold text-black transition hover:bg-gray-200"
              >
                <FaDownload className="text-sm" />
                Download PNG
              </button>
              <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm text-gray-300">
                <FaShareAlt className="text-fuchsia-300" />
                Social preview ready
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            ['Movies Watched', watchedCounter],
            ['Reviews Written', reviewsCounter],
            ['Average Rating', ratingCounter],
            ['Hours Watched', hoursCounter],
          ].map(([label, value], index) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06 }}
              className="rounded-3xl border border-white/10 bg-white/[0.04] p-6"
            >
              <p className="text-xs uppercase tracking-[0.25em] text-gray-500">{label}</p>
              <p className="mt-3 text-4xl font-black text-white">{value}</p>
            </motion.div>
          ))}
        </section>

        <section className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[2rem] border border-white/10 bg-[#101013] p-6">
            <div className="mb-6">
              <p className="text-xs uppercase tracking-[0.25em] text-cyan-300/80">Cinema DNA</p>
              <h2 className="mt-2 text-3xl font-bold text-white">Your emotional blueprint</h2>
            </div>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_0.9fr]">
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={dnaData}>
                    <PolarGrid stroke="rgba(255,255,255,0.12)" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#d4d4d8', fontSize: 12 }} />
                    <Radar
                      name="DNA"
                      dataKey="value"
                      stroke="#f472b6"
                      fill="#f472b6"
                      fillOpacity={0.35}
                      strokeWidth={2}
                    />
                    <Tooltip content={<DnaTooltip />} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3">
                {dnaData.map((item) => (
                  <div key={item.subject} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="text-sm font-medium capitalize text-white">{item.subject}</span>
                      <span className="text-sm font-bold text-fuchsia-300">{item.value}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-400"
                        style={{ width: `${item.value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-fuchsia-950/35 to-blue-950/30 p-6">
            <p className="text-xs uppercase tracking-[0.25em] text-fuchsia-300/80">Life As A Movie</p>
            <h2 className="mt-2 text-3xl font-bold text-white">{wrapped.life_as_movie.headline}</h2>
            <p className="mt-4 text-2xl font-semibold text-fuchsia-100">{wrapped.life_as_movie.combo}</p>
            <p className="mt-4 text-gray-300">{wrapped.life_as_movie.explanation}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {(wrapped.life_as_movie.themes || []).map((theme) => (
                <span key={theme} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-white">
                  {theme}
                </span>
              ))}
            </div>
            <p className="mt-5 text-sm text-cyan-200/90">{wrapped.life_as_movie.emotional_profile}</p>
          </div>
        </section>

        <section className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
            <p className="text-xs uppercase tracking-[0.25em] text-amber-300/80">Main Character</p>
            <h2 className="mt-2 text-3xl font-bold text-white">{wrapped.main_character_archetype.title}</h2>
            <p className="mt-4 text-gray-300">{wrapped.main_character_archetype.reason}</p>
          </div>
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 lg:col-span-2">
            <p className="text-xs uppercase tracking-[0.25em] text-emerald-300/80">Cinematic Aura</p>
            <div className="mt-4 flex flex-wrap gap-3">
              {(wrapped.cinematic_aura || []).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-white/10 bg-gradient-to-r from-white/10 to-white/5 px-4 py-2 text-sm font-medium text-white"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </section>

        {wrapped.top_titles?.length > 0 && (
          <section className="mt-8">
            <h2 className="text-2xl font-bold text-white">Anchor titles of your year</h2>
            <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {wrapped.top_titles.map((movie) => (
                <div key={movie.slug || movie.title} className="mx-auto w-full max-w-[240px]">
                  <MovieCard movie={movie} />
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mt-8 rounded-[2rem] border border-white/10 bg-[#101013] p-6">
          <p className="text-xs uppercase tracking-[0.25em] text-violet-300/80">Year In Genres</p>
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
            {(wrapped.genre_timeline || []).map((entry) => (
              <div key={`${entry.month}-${entry.genre}`} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">{entry.month}</p>
                <p className="mt-2 text-lg font-bold text-white">{entry.genre}</p>
                <p className="mt-1 text-sm text-gray-400">{entry.count} key moments</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[2rem] border border-white/10 bg-[#101013] p-6">
            <p className="text-xs uppercase tracking-[0.25em] text-red-300/80">Hidden Stats</p>
            <div className="mt-5 space-y-3">
              {(wrapped.hidden_stats || []).map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-gray-500">{item.label}</p>
                  <p className="mt-2 text-lg font-semibold text-white">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(244,114,182,0.15),rgba(59,130,246,0.12))] p-6">
            <p className="text-xs uppercase tracking-[0.25em] text-fuchsia-300/80">AI Critic Summary</p>
            <h2 className="mt-2 text-3xl font-bold text-white">The season finale of your taste</h2>
            <p className="mt-5 text-lg leading-8 text-gray-200">{wrapped.ai_summary}</p>

            <div className="mt-8 rounded-[1.5rem] border border-white/10 bg-black/30 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-gray-500">{wrapped.share_card.headline}</p>
              <p className="mt-2 text-2xl font-bold text-white">{wrapped.share_card.feature_title}</p>
              <p className="mt-3 text-sm text-fuchsia-100">{wrapped.share_card.subheadline}</p>
              <p className="mt-4 text-sm text-gray-300">{wrapped.share_card.stat_line}</p>
            </div>
          </div>
        </section>
      </div>
    </motion.div>
  );
};

export default Wrapped;
