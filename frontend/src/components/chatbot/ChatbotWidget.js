import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MdMovieFilter } from 'react-icons/md';
import ChatWindow from './ChatWindow';
import { DEFAULT_PROMPTS, WELCOME_MESSAGE } from './constants';
import {
  sendChatMessage,
  parseChatStream,
  getChatSessionId,
  fetchChatHistory,
  fetchAiTasteProfile,
  deleteChatHistory,
} from '../../services/chatApi';

let msgId = 0;
const nextId = () => `msg-${++msgId}-${Date.now()}`;

const ChatbotWidget = ({ user }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([{ ...WELCOME_MESSAGE, id: 'welcome' }]);
  const [suggestedPrompts, setSuggestedPrompts] = useState(DEFAULT_PROMPTS);
  const [isTyping, setIsTyping] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [tasteSummary, setTasteSummary] = useState(null);
  const [sessionId, setSessionId] = useState(() => getChatSessionId());
  const [unreadCount, setUnreadCount] = useState(0);
  const busyRef = useRef(false);

  useEffect(() => {
    if (!user) return;
    fetchAiTasteProfile().then((p) => {
      if (p?.taste_summary) setTasteSummary(p.taste_summary);
    });
  }, [user]);

  useEffect(() => {
    if (!user || !isOpen) return;
    setUnreadCount(0);
    const sid = getChatSessionId();
    setSessionId(sid);
    fetchChatHistory(sid, 14).then((data) => {
      const rows = data.messages || [];
      if (rows.length === 0) return;
      const mapped = rows.map((r) => ({
        id: r.chat_id || nextId(),
        role: r.role,
        content: r.content,
        recommendations: r.recommendations || [],
        intent: r.intent,
      }));
      setMessages([{ ...WELCOME_MESSAGE, id: 'welcome' }, ...mapped]);
    });
  }, [isOpen, user]);

  const handleSend = useCallback(
    async (text) => {
      if (busyRef.current || !text?.trim() || !user) return;
      busyRef.current = true;
      setIsTyping(true);
      setStreamingContent('');

      const userMsg = { id: nextId(), role: 'user', content: text.trim() };
      setMessages((prev) => [...prev, userMsg]);

      try {
        const { sessionId: sid, stream } = await sendChatMessage(text, {
          stream: true,
          sessionId,
        });
        setSessionId(sid);
        localStorage.setItem('critics_talk_session_id', sid);

        let fullReply = '';
        let finalPayload = null;

        for await (const event of parseChatStream(stream)) {
          if (event.type === 'token') {
            fullReply += event.content || '';
            setStreamingContent(fullReply);
          } else if (event.type === 'done') {
            finalPayload = event;
          }
        }

        setStreamingContent('');
        const reply = finalPayload?.reply || fullReply || 'Something went wrong. Try again.';
        const assistantMsg = {
          id: nextId(),
          role: 'assistant',
          content: reply,
          recommendations: finalPayload?.recommendations || [],
          intent: finalPayload?.intent,
        };
        setMessages((prev) => [...prev, assistantMsg]);

        if (!isOpen) setUnreadCount((c) => c + 1);

        if (finalPayload?.suggested_prompts?.length) {
          setSuggestedPrompts(finalPayload.suggested_prompts);
        }
        if (finalPayload?.taste_summary) {
          setTasteSummary(finalPayload.taste_summary);
        }
      } catch (err) {
        setStreamingContent('');
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: 'assistant',
            content: err.message || 'Something went wrong. Please try again.',
            recommendations: [],
          },
        ]);
      } finally {
        setIsTyping(false);
        busyRef.current = false;
      }
    },
    [sessionId, user, isOpen]
  );

  const handleClear = useCallback(async () => {
    if (busyRef.current || !user) return;
    try {
      await deleteChatHistory(sessionId);
    } catch {
      // ignore
    }
    const sid = `ct-${crypto.randomUUID?.() || Date.now()}`;
    localStorage.setItem('critics_talk_session_id', sid);
    setSessionId(sid);
    setStreamingContent('');
    setIsTyping(false);
    setMessages([{ ...WELCOME_MESSAGE, id: 'welcome' }]);
    setSuggestedPrompts(DEFAULT_PROMPTS);
    setUnreadCount(0);
  }, [sessionId, user]);

  const handleOpen = () => {
    setIsOpen(true);
    setUnreadCount(0);
  };

  if (!user) return null;

  return (
    <>
      <ChatWindow
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onMinimize={() => setIsOpen(false)}
        messages={messages}
        isTyping={isTyping}
        streamingContent={streamingContent}
        suggestedPrompts={suggestedPrompts}
        tasteSummary={tasteSummary}
        onSend={handleSend}
        onClear={handleClear}
        disabled={isTyping}
      />

      <AnimatePresence>
        {!isOpen && (
          <motion.button
            type="button"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            onClick={handleOpen}
            className="fixed bottom-6 right-4 sm:right-6 z-[55] h-14 w-14 rounded-full text-white shadow-xl flex items-center justify-center border group"
            style={{
              background: 'linear-gradient(135deg, #dc2626 0%, #7f1d1d 100%)',
              borderColor: 'rgba(239,68,68,0.3)',
              boxShadow: '0 8px 32px rgba(220,38,38,0.35)',
            }}
            aria-label="Open Critics Talk"
            data-testid="critics-talk-fab"
          >
            <MdMovieFilter className="text-2xl group-hover:scale-110 transition-transform" />

            {/* Pulse ring */}
            <span className="absolute inset-0 rounded-full border border-red-500/30 animate-ping opacity-40" />

            {/* Unread badge */}
            {unreadCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 border-2 border-[#0B0B0B] flex items-center justify-center text-[10px] font-bold text-white"
              >
                {unreadCount}
              </motion.span>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Mobile close button */}
      {isOpen && (
        <motion.button
          type="button"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          onClick={() => setIsOpen(false)}
          className="fixed bottom-6 right-4 z-[61] h-12 w-12 rounded-full bg-zinc-900/90 border border-white/15 text-white flex items-center justify-center sm:hidden shadow-xl"
          aria-label="Close"
        >
          ✕
        </motion.button>
      )}
    </>
  );
};

export default ChatbotWidget;