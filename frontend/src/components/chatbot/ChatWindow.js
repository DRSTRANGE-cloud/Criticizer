import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaMinus, FaMagic } from 'react-icons/fa';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import SuggestedPrompts from './SuggestedPrompts';
import TypingIndicator from './TypingIndicator';

const ChatWindow = ({
  isOpen,
  onClose,
  onMinimize,
  messages,
  isTyping,
  streamingContent,
  suggestedPrompts,
  tasteSummary,
  onSend,
  disabled,
}) => {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping, streamingContent]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          className="fixed bottom-24 right-4 sm:right-6 z-[60] w-[calc(100vw-2rem)] sm:w-[400px] max-h-[min(640px,calc(100vh-7rem))] flex flex-col rounded-3xl overflow-hidden shadow-2xl shadow-black/60 border border-white/10"
          style={{
            background:
              'linear-gradient(165deg, rgba(18,12,28,0.97) 0%, rgba(8,8,12,0.98) 50%, rgba(12,8,20,0.99) 100%)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <div className="relative px-4 py-3 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-fuchsia-950/40 to-violet-950/30">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-fuchsia-500 to-violet-600 flex items-center justify-center shadow-lg shadow-fuchsia-900/40">
                <FaMagic className="text-white text-sm" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white tracking-wide">Critics Talk</h2>
                <p className="text-[10px] text-fuchsia-200/60">Cinematic AI · Criticizer</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onMinimize}
                className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition"
                aria-label="Minimize"
              >
                <FaMinus className="text-xs" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition"
                aria-label="Close chat"
              >
                <FaTimes />
              </button>
            </div>
          </div>

          {tasteSummary && (
            <div className="px-4 py-2 text-xs text-fuchsia-200/80 border-b border-white/5 bg-fuchsia-950/20 line-clamp-2">
              {tasteSummary}
            </div>
          )}

          <div ref={scrollRef} className="flex-1 overflow-y-auto py-4 space-y-3 min-h-[280px] max-h-[420px]">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}

            {streamingContent && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="px-3"
              >
                <div className="max-w-[92%] rounded-2xl px-4 py-3 text-sm bg-white/[0.06] border border-white/10 text-gray-200">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-fuchsia-300/70 mb-1">Critics Talk</p>
                  <span>{streamingContent}</span>
                  <span className="inline-block w-1.5 h-4 ml-0.5 bg-fuchsia-400 animate-pulse align-middle" />
                </div>
              </motion.div>
            )}

            {isTyping && !streamingContent && (
              <div className="px-3">
                <div className="inline-block rounded-2xl bg-white/[0.06] border border-white/10">
                  <TypingIndicator />
                </div>
              </div>
            )}
          </div>

          <SuggestedPrompts prompts={suggestedPrompts} onSelect={onSend} disabled={disabled} />
          <ChatInput onSend={onSend} disabled={disabled} />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ChatWindow;
