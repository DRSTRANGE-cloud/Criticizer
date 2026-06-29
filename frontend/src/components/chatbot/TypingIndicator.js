import React from 'react';
import { motion } from 'framer-motion';

const TypingIndicator = () => (
  <div className="flex items-center gap-1.5 px-4 py-3">
    <span className="text-[10px] uppercase tracking-[0.2em] text-red-300/50 mr-1">thinking</span>
    {[0, 1, 2].map((i) => (
      <motion.span
        key={i}
        className="h-1.5 w-1.5 rounded-full bg-red-400/70"
        animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
        transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
      />
    ))}
  </div>
);

export default TypingIndicator;