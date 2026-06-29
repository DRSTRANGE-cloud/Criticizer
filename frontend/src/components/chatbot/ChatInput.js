import React, { useState, useCallback, useRef } from 'react';
import { FaPaperPlane, FaMicrophone } from 'react-icons/fa';
import { motion } from 'framer-motion';

const QUICK_ACTIONS = [
  { label: '🎭 Mood', text: "I'm in the mood for something " },
  { label: '🔍 Explain', text: 'Explain the ending of ' },
  { label: '⚡ Compare', text: 'Compare ' },
  { label: '📺 Stream', text: 'Where can I watch ' },
];

const ChatInput = ({ onSend, disabled, placeholder }) => {
  const [value, setValue] = useState('');
  const [showQuick, setShowQuick] = useState(false);
  const textareaRef = useRef(null);

  const submit = useCallback(() => {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue('');
    setShowQuick(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value, disabled, onSend]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const handleChange = (e) => {
    setValue(e.target.value);
    // Auto-resize
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 96) + 'px';
    }
  };

  const applyQuick = (text) => {
    setValue(text);
    setShowQuick(false);
    textareaRef.current?.focus();
  };

  return (
    <div className="border-t border-white/[0.07] bg-black/50 backdrop-blur-xl">
      {/* Quick action chips */}
      {showQuick && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex gap-1.5 px-3 pt-2.5 flex-wrap"
        >
          {QUICK_ACTIONS.map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={() => applyQuick(q.text)}
              className="text-[11px] px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.05] text-gray-300 hover:border-red-500/40 hover:text-white transition-all"
            >
              {q.label}
            </button>
          ))}
        </motion.div>
      )}

      <div className="p-3">
        <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 transition-all focus-within:border-red-500/40 focus-within:bg-white/[0.06]">
          {/* Quick actions toggle */}
          <button
            type="button"
            onClick={() => setShowQuick((v) => !v)}
            disabled={disabled}
            className={`flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-xl transition-all ${
              showQuick
                ? 'bg-red-600/30 text-red-300 border border-red-500/30'
                : 'text-gray-600 hover:text-gray-400'
            }`}
            title="Quick actions"
          >
            <span className="text-sm">⚡</span>
          </button>

          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            rows={1}
            maxLength={2000}
            placeholder={placeholder || 'Ask anything about movies, shows, or anime...'}
            className="flex-1 resize-none bg-transparent py-1.5 text-sm text-white outline-none placeholder-gray-600 min-h-[28px] max-h-24"
          />

          <button
            type="button"
            onClick={submit}
            disabled={disabled || !value.trim()}
            className="flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-xl bg-gradient-to-br from-red-600 to-red-800 text-white shadow-md shadow-red-900/30 transition-all hover:opacity-90 disabled:opacity-30"
            aria-label="Send"
          >
            <FaPaperPlane className="text-[11px]" />
          </button>
        </div>
        <p className="mt-1.5 text-center text-[9px] text-gray-700">
          Enter to send · Shift+Enter for newline
        </p>
      </div>
    </div>
  );
};

export default ChatInput;