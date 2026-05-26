import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaComments } from 'react-icons/fa';
import ChatWindow from './ChatWindow';
import { DEFAULT_PROMPTS, WELCOME_MESSAGE } from './constants';
import {
  sendChatMessage,
  parseChatStream,
  getChatSessionId,
  fetchChatHistory,
  fetchAiTasteProfile,
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
  const busyRef = useRef(false);

  useEffect(() => {
    if (user) {
      fetchAiTasteProfile().then((p) => {
        if (p?.taste_summary) setTasteSummary(p.taste_summary);
      });
    }
  }, [user]);

  useEffect(() => {
    if (!isOpen) return;
    const sid = getChatSessionId();
    setSessionId(sid);
    fetchChatHistory(sid, 12).then((data) => {
      const rows = data.messages || [];
      if (rows.length === 0) return;
      const mapped = rows.map((r) => ({
        id: r.chat_id || nextId(),
        role: r.role,
        content: r.content,
        recommendations: r.recommendations || [],
      }));
      setMessages([{ ...WELCOME_MESSAGE, id: 'welcome' }, ...mapped]);
    });
  }, [isOpen]);

  const handleSend = useCallback(
    async (text) => {
      if (busyRef.current || !text?.trim()) return;
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
        const reply = finalPayload?.reply || fullReply || 'Here are some ideas for you.';
        const assistantMsg = {
          id: nextId(),
          role: 'assistant',
          content: reply,
          recommendations: finalPayload?.recommendations || [],
        };
        setMessages((prev) => [...prev, assistantMsg]);

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
    [sessionId]
  );

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
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-4 sm:right-6 z-[55] h-14 w-14 rounded-full bg-gradient-to-br from-fuchsia-600 via-violet-600 to-indigo-700 text-white shadow-xl shadow-fuchsia-900/50 flex items-center justify-center border border-white/20 group"
            aria-label="Open Critics Talk"
            data-testid="critics-talk-fab"
          >
            <FaComments className="text-xl group-hover:scale-110 transition-transform" />
            <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-400 border-2 border-[#0B0B0B] animate-pulse" />
          </motion.button>
        )}
      </AnimatePresence>

      {isOpen && (
        <motion.button
          type="button"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          onClick={() => setIsOpen(false)}
          className="fixed bottom-6 right-4 sm:right-6 z-[61] h-12 w-12 rounded-full bg-zinc-900/90 border border-white/15 text-white flex items-center justify-center sm:hidden"
          aria-label="Close"
        >
          ✕
        </motion.button>
      )}
    </>
  );
};

export default ChatbotWidget;
