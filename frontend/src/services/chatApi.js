import { API_URL } from './api';

const SESSION_KEY = 'critics_talk_session_id';

export function getChatSessionId() {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `ct-${crypto.randomUUID?.() || Date.now()}`;
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

function authHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('token');
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function sendChatMessage(message, { stream = true, sessionId } = {}) {
  const sid = sessionId || getChatSessionId();
  const res = await fetch(`${API_URL}/api/ai/chat`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      message,
      session_id: sid,
      stream,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || res.statusText || 'Chat request failed');
  }

  if (!stream) {
    const data = await res.json();
    return { sessionId: sid, ...data };
  }

  return { sessionId: sid, stream: res.body };
}

export async function* parseChatStream(readableStream) {
  const reader = readableStream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        yield JSON.parse(line.slice(6));
      } catch {
        /* skip malformed */
      }
    }
  }
}

export async function fetchChatHistory(sessionId, limit = 20) {
  const params = new URLSearchParams({ session_id: sessionId, limit: String(limit) });
  const res = await fetch(`${API_URL}/api/ai/chat/history?${params}`, {
    headers: authHeaders(),
  });
  if (!res.ok) return { messages: [] };
  return res.json();
}

export async function deleteChatHistory(sessionId) {
  const params = new URLSearchParams({ session_id: sessionId });
  const res = await fetch(`${API_URL}/api/ai/chat/history?${params}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || res.statusText || 'Unable to delete chat');
  }
  return res.json();
}

export async function fetchAiTasteProfile() {
  const res = await fetch(`${API_URL}/api/ai/profile`, { headers: authHeaders() });
  if (!res.ok) return null;
  return res.json();
}
