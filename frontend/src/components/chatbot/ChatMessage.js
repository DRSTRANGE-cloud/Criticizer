import React, { useState } from 'react';
import { motion } from 'framer-motion';
import ChatMovieCard from './ChatMovieCard';

function renderMarkdown(text) {
  if (!text) return null;
  return text.split(/(\*\*[^*]+\*\*|\n)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="text-white font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part === '\n') return <br key={i} />;
    // Bullet points
    if (part.startsWith('• ') || part.startsWith('- ')) {
      return (
        <span key={i} className="block pl-2 my-0.5">
          <span className="text-red-400 mr-1.5">•</span>
          {part.slice(2)}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

const INTENT_LABELS = {
  recommendation: { label: 'Recommendations', color: 'text-violet-300/70' },
  mood: { label: 'Mood Match', color: 'text-pink-300/70' },
  streaming: { label: 'Streaming Info', color: 'text-blue-300/70' },
  cast_crew: { label: 'Cast & Crew', color: 'text-amber-300/70' },
  explain: { label: 'Film Breakdown', color: 'text-emerald-300/70' },
  compare: { label: 'Comparison', color: 'text-orange-300/70' },
  trending: { label: 'Trending', color: 'text-cyan-300/70' },
  franchise: { label: 'Franchise Guide', color: 'text-purple-300/70' },
  discussion: { label: 'Community Views', color: 'text-fuchsia-300/70' },
  analytics: { label: 'Your Taste', color: 'text-teal-300/70' },
  watchlist: { label: 'Watchlist', color: 'text-green-300/70' },
  review_help: { label: 'Review Help', color: 'text-yellow-300/70' },
};

const ChatMessage = ({ message }) => {
  const isUser = message.role === 'user';
  const [showRecs, setShowRecs] = useState(true);
  const intentMeta = INTENT_LABELS[message.intent] || null;
  const hasRecs = !isUser && message.recommendations?.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} px-3`}
    >
      <div className={`max-w-[93%] ${isUser ? '' : 'w-full'}`}>
        {/* Assistant bubble */}
        {!isUser && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.05] backdrop-blur-md overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-3 pb-1">
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[10px] uppercase tracking-[0.22em] text-red-300/70 font-medium">
                  Critics Talk
                </span>
              </div>
              {intentMeta && (
                <span className={`text-[9px] uppercase tracking-[0.15em] ${intentMeta.color}`}>
                  {intentMeta.label}
                </span>
              )}
            </div>

            {/* Content */}
            <div className="px-4 pb-3 text-sm text-gray-200 leading-relaxed">
              {renderMarkdown(message.content)}
            </div>

            {/* Movie recommendations strip */}
            {hasRecs && (
              <div className="border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowRecs((v) => !v)}
                  className="w-full flex items-center justify-between px-4 py-2 text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
                >
                  <span className="uppercase tracking-[0.18em]">
                    {message.recommendations.length} title{message.recommendations.length > 1 ? 's' : ''} to explore
                  </span>
                  <span className="text-gray-600">{showRecs ? '▲' : '▼'}</span>
                </button>
                {showRecs && (
                  <div className="flex gap-2 overflow-x-auto pb-3 px-3 scrollbar-hide">
                    {message.recommendations.map((m) => (
                      <ChatMovieCard key={m.slug || m.id} movie={m} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* User bubble */}
        {isUser && (
          <div className="rounded-2xl px-4 py-3 text-sm leading-relaxed bg-gradient-to-br from-red-600/90 to-red-900/90 text-white shadow-lg shadow-red-900/20">
            {message.content}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default ChatMessage;