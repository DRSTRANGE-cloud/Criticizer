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
    <div className="border-t border-white/10 bg-black/40 p-3 backdrop-blur-xl">
      <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 transition focus-within:border-red-500/50">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
          maxLength={2000}
          placeholder={placeholder || 'Ask Critics Talk anything about movies...'}
          className="max-h-24 flex-1 resize-none bg-transparent py-1.5 text-sm text-white outline-none placeholder-gray-500"
        />
        <button
          type="button"
          onClick={submit}
          disabled={disabled || !value.trim()}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-red-600 to-red-900 text-white shadow-lg shadow-red-900/30 transition hover:opacity-90 disabled:opacity-40"
          aria-label="Send message"
        >
          <FaPaperPlane className="text-xs" />
        </button>
      </div>
      <p className="mt-1.5 text-center text-[10px] text-gray-600">
        Enter to send - Shift+Enter for newline
      </p>
    </div>
  );
};

export default ChatInput;
