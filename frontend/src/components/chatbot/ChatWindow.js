import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaMinus, FaMagic, FaTrash } from 'react-icons/fa';
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
  onClear,
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
          className="fixed bottom-20 right-4 z-[60] flex max-h-[min(560px,calc(100vh-6rem))] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-3xl border border-red-500/15 shadow-2xl shadow-black/70 sm:right-6 sm:w-[360px] lg:w-[380px]"
          style={{
            background:
              'linear-gradient(165deg, rgba(20,10,10,0.98) 0%, rgba(8,8,8,0.99) 50%, rgba(14,10,10,0.99) 100%)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <div className="relative flex items-center justify-between border-b border-red-500/15 bg-gradient-to-r from-red-950/35 to-black px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-red-600 to-red-900 shadow-lg shadow-red-900/40">
                <FaMagic className="text-sm text-white" />
              </div>
              <div>
                <h2 className="text-sm font-bold tracking-wide text-white">Critics Talk</h2>
                <p className="text-[10px] text-red-100/60">Cinematic AI - Criticizer</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onClear}
                disabled={disabled}
                className="rounded-lg p-2 text-gray-400 transition hover:bg-white/10 hover:text-red-200 disabled:opacity-50"
                aria-label="Delete chat history"
              >
                <FaTrash className="text-xs" />
              </button>
              <button
                type="button"
                onClick={onMinimize}
                className="rounded-lg p-2 text-gray-400 transition hover:bg-white/10 hover:text-white"
                aria-label="Minimize"
              >
                <FaMinus className="text-xs" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-gray-400 transition hover:bg-white/10 hover:text-white"
                aria-label="Close chat"
              >
                <FaTimes />
              </button>
            </div>
          </div>

          {tasteSummary && (
            <div className="line-clamp-2 border-b border-white/5 bg-red-950/15 px-4 py-2 text-xs text-red-100/80">
              {tasteSummary}
            </div>
          )}

          <div ref={scrollRef} className="min-h-[240px] flex-1 space-y-3 overflow-y-auto py-4 sm:max-h-[360px]">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}

            {streamingContent && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-3">
                <div className="max-w-[92%] rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-gray-200">
                  <p className="mb-1 text-[10px] uppercase tracking-[0.2em] text-red-300/70">
                    Critics Talk
                  </p>
                  <span>{streamingContent}</span>
                  <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-red-400 align-middle" />
                </div>
              </motion.div>
            )}

            {isTyping && !streamingContent && (
              <div className="px-3">
                <div className="inline-block rounded-2xl border border-white/10 bg-white/[0.06]">
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
