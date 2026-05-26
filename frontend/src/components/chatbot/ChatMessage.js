import React from 'react';
import { motion } from 'framer-motion';
import ChatMovieCard from './ChatMovieCard';

function renderMarkdownLight(text) {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="text-white font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

const ChatMessage = ({ message }) => {
  const isUser = message.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} px-3`}
    >
      <div
        className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-gradient-to-br from-fuchsia-600/90 to-violet-700/90 text-white shadow-lg shadow-fuchsia-900/20'
            : 'bg-white/[0.06] border border-white/10 text-gray-200 backdrop-blur-md'
        }`}
      >
        {!isUser && (
          <p className="text-[10px] uppercase tracking-[0.2em] text-fuchsia-300/70 mb-1.5 font-medium">
            Critics Talk
          </p>
        )}
        <div className="whitespace-pre-wrap">{renderMarkdownLight(message.content)}</div>

        {!isUser && message.recommendations?.length > 0 && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {message.recommendations.map((m) => (
              <ChatMovieCard key={m.slug || m.id} movie={m} />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default ChatMessage;
