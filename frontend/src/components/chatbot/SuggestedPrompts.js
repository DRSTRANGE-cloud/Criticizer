import React from 'react';
import { motion } from 'framer-motion';

const SuggestedPrompts = ({ prompts, onSelect, disabled }) => {
  if (!prompts?.length) return null;

  return (
    <div className="flex flex-wrap gap-2 px-3 pb-2">
      {prompts.map((text) => (
        <motion.button
          key={text}
          type="button"
          disabled={disabled}
          whileHover={{ scale: disabled ? 1 : 1.02 }}
          whileTap={{ scale: disabled ? 1 : 0.98 }}
          onClick={() => onSelect(text)}
          className="text-left text-xs px-3 py-2 rounded-full border border-white/10 bg-white/[0.04] text-gray-300 hover:text-white hover:border-fuchsia-500/40 hover:bg-fuchsia-950/30 transition disabled:opacity-40 max-w-full truncate"
        >
          {text}
        </motion.button>
      ))}
    </div>
  );
};

export default SuggestedPrompts;
