import React, { useState, useCallback } from 'react';
import { FaPaperPlane } from 'react-icons/fa';

const ChatInput = ({ onSend, disabled, placeholder }) => {
  const [value, setValue] = useState('');

  const submit = useCallback(() => {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue('');
  }, [value, disabled, onSend]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="p-3 border-t border-white/10 bg-black/40 backdrop-blur-xl">
      <div className="flex gap-2 items-end rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 focus-within:border-fuchsia-500/50 transition">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
          maxLength={2000}
          placeholder={placeholder || 'Ask Critics Talk anything about movies…'}
          className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 resize-none outline-none max-h-24 py-1.5"
        />
        <button
          type="button"
          onClick={submit}
          disabled={disabled || !value.trim()}
          className="flex-shrink-0 h-9 w-9 rounded-xl bg-gradient-to-br from-fuchsia-600 to-violet-600 text-white flex items-center justify-center hover:opacity-90 disabled:opacity-40 transition shadow-lg shadow-fuchsia-900/30"
          aria-label="Send message"
        >
          <FaPaperPlane className="text-xs" />
        </button>
      </div>
      <p className="text-[10px] text-gray-600 mt-1.5 text-center">Enter to send · Shift+Enter for newline</p>
    </div>
  );
};

export default ChatInput;
