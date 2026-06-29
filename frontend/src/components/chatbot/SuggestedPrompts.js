import React from 'react';
import { motion } from 'framer-motion';

const SuggestedPrompts = ({ prompts, onSelect, disabled }) => {
  if (!prompts?.length) return null;

  return (
    <div className="px-3 pb-2.5">
      <p className="text-[9px] uppercase tracking-[0.2em] text-gray-600 mb-2 px-1">Try asking</p>
      <div className="flex flex-wrap gap-1.5">
        {prompts.slice(0, 6).map((text) => (
          <motion.button
            key={text}
            type="button"
            disabled={disabled}
            whileHover={{ scale: disabled ? 1 : 1.02 }}
            whileTap={{ scale: disabled ? 1 : 0.97 }}
            onClick={() => onSelect(text)}
            className="max-w-full text-left text-[11px] px-3 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] text-gray-400 transition-all hover:border-red-500/35 hover:bg-red-950/20 hover:text-white disabled:opacity-30 truncate"
          >
            {text}
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default SuggestedPrompts;