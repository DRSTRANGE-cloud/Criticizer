import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaMinus, FaTrash, FaExpand, FaCompress } from 'react-icons/fa';
import { MdMovieFilter } from 'react-icons/md';
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
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping, streamingContent]);

  const windowClass = expanded
    ? 'fixed bottom-0 right-0 z-[60] flex flex-col sm:bottom-4 sm:right-4 sm:rounded-3xl overflow-hidden'
    : 'fixed bottom-20 right-4 z-[60] flex flex-col rounded-3xl overflow-hidden sm:right-6';

  const windowStyle = expanded
    ? {
        width: 'min(520px, 100vw)',
        height: 'min(700px, 95vh)',
        background: 'linear-gradient(160deg, rgba(15,8,8,0.99) 0%, rgba(8,8,8,0.99) 60%, rgba(12,8,10,0.99) 100%)',
        backdropFilter: 'blur(24px)',
        border: '1px solid rgba(239,68,68,0.12)',
        boxShadow: '0 32px 80px rgba(0,0,0,0.85), 0 0 1px rgba(239,68,68,0.15)',
      }
    : {
        width: 'calc(100vw - 2rem)',
        maxWidth: '380px',
        maxHeight: 'min(580px, calc(100vh - 6rem))',
        background: 'linear-gradient(160deg, rgba(15,8,8,0.99) 0%, rgba(8,8,8,0.99) 60%, rgba(12,8,10,0.99) 100%)',
        backdropFilter: 'blur(24px)',
        border: '1px solid rgba(239,68,68,0.12)',
        boxShadow: '0 24px 60px rgba(0,0,0,0.8), 0 0 1px rgba(239,68,68,0.12)',
      };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 400, damping: 34 }}
          className={windowClass}
          style={windowStyle}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 flex-shrink-0"
            style={{
              background: 'linear-gradient(90deg, rgba(127,29,29,0.25) 0%, rgba(0,0,0,0.1) 100%)',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-red-600 to-red-900 shadow-lg shadow-red-900/40">
                <MdMovieFilter className="text-sm text-white" />
              </div>
              <div>
                <h2 className="text-sm font-bold tracking-wide text-white leading-none">Critics Talk</h2>
                <p className="text-[9px] text-red-100/40 mt-0.5">Cinematic AI · Criticizer</p>
              </div>
              <div className="ml-1 h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
            </div>

            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={onClear}
                disabled={disabled}
                className="rounded-lg p-1.5 text-gray-500 transition hover:bg-white/10 hover:text-red-300 disabled:opacity-40"
                title="Clear history"
              >
                <FaTrash className="text-[10px]" />
              </button>
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="rounded-lg p-1.5 text-gray-500 transition hover:bg-white/10 hover:text-white hidden sm:flex"
                title={expanded ? 'Compact' : 'Expand'}
              >
                {expanded ? <FaCompress className="text-[10px]" /> : <FaExpand className="text-[10px]" />}
              </button>
              <button
                type="button"
                onClick={onMinimize}
                className="rounded-lg p-1.5 text-gray-500 transition hover:bg-white/10 hover:text-white"
              >
                <FaMinus className="text-[10px]" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-gray-500 transition hover:bg-white/10 hover:text-white"
              >
                <FaTimes className="text-xs" />
              </button>
            </div>
          </div>

          {/* Taste summary banner */}
          {tasteSummary && (
            <div className="flex-shrink-0 px-4 py-2 text-[11px] text-red-100/60 border-b border-white/[0.04]"
              style={{ background: 'rgba(127,29,29,0.1)' }}
            >
              <span className="text-red-400/60 font-medium mr-1">Your taste:</span>
              {tasteSummary}
            </div>
          )}

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto py-4 space-y-3 min-h-0"
            style={{ scrollbarWidth: 'none' }}
          >
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}

            {/* Streaming bubble */}
            {streamingContent && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="px-3"
              >
                <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-gray-200">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                    <p className="text-[10px] uppercase tracking-[0.22em] text-red-300/70">Critics Talk</p>
                  </div>
                  <span>{streamingContent}</span>
                  <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-red-400 align-middle rounded-full" />
                </div>
              </motion.div>
            )}

            {/* Typing indicator */}
            {isTyping && !streamingContent && (
              <div className="px-3">
                <div className="inline-block rounded-2xl border border-white/10 bg-white/[0.05]">
                  <TypingIndicator />
                </div>
              </div>
            )}
          </div>

          {/* Suggested prompts */}
          <SuggestedPrompts prompts={suggestedPrompts} onSelect={onSend} disabled={disabled} />

          {/* Input */}
          <ChatInput onSend={onSend} disabled={disabled} />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ChatWindow;