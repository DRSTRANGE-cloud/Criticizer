from __future__ import annotations

import re
from enum import Enum


class ChatIntent(str, Enum):
    RECOMMENDATION = "recommendation"
    MOOD = "mood"
    EXPLAIN = "explain"
    CAST_CREW = "cast_crew"
    STREAMING = "streaming"
    COMPARE = "compare"
    DISCUSSION = "discussion"
    TRENDING = "trending"
    FRANCHISE = "franchise"
    DECISION = "decision"
    GROUP = "group"
    GENERAL = "general"


MOOD_KEYWORDS: dict[str, list[str]] = {
    "relaxing": ["relax", "chill", "calm", "cozy", "easy watch", "light"],
    "emotional": ["emotional", "cry", "tearjerker", "heartfelt", "moving", "sad"],
    "dark": ["dark", "gritty", "noir", "bleak", "disturbing"],
    "intense": ["intense", "gripping", "suspense", "edge of seat", "adrenaline"],
    "hype": ["hype", "epic", "action-packed", "blockbuster", "exciting"],
    "feel-good": ["feel good", "feel-good", "uplifting", "wholesome", "happy"],
    "romantic": ["romantic", "romance", "love story", "date night"],
}

MOOD_GENRE_IDS: dict[str, str] = {
    "relaxing": "35,10751",
    "emotional": "18,10749",
    "dark": "53,27",
    "intense": "53,28",
    "hype": "28,12",
    "feel-good": "35,10751",
    "romantic": "10749,35",
}

INTENT_PATTERNS: list[tuple[ChatIntent, re.Pattern[str]]] = [
    (ChatIntent.STREAMING, re.compile(r"\b(where (can|to) watch|streaming|netflix|prime|disney\+?|hulu)\b", re.I)),
    (ChatIntent.COMPARE, re.compile(r"\b(vs\.?|versus|compare)\b", re.I)),
    (ChatIntent.EXPLAIN, re.compile(r"\b(explain|ending|meaning|plot twist|hidden)\b", re.I)),
    (ChatIntent.CAST_CREW, re.compile(r"\b(directed by|director|starring|actor|actress|cast)\b", re.I)),
    (ChatIntent.DISCUSSION, re.compile(r"\b(what do people think|reviews say|community|sentiment|opinion on)\b", re.I)),
    (ChatIntent.TRENDING, re.compile(r"\b(trending|popular this week|hot right now)\b", re.I)),
    (ChatIntent.FRANCHISE, re.compile(r"\b(watch order|filler guide|marvel|mcu|naruto|franchise)\b", re.I)),
    (ChatIntent.DECISION, re.compile(r"\b(should i watch|worth watching|worth it)\b", re.I)),
    (ChatIntent.GROUP, re.compile(r"\b(family|friends|group|movie night|kids)\b", re.I)),
    (ChatIntent.MOOD, re.compile(r"\b(mood|feeling|vibe|dark sci-fi|feel-good|emotional anime)\b", re.I)),
    (ChatIntent.RECOMMENDATION, re.compile(r"\b(recommend|suggest|pick|show me|bhai|koi mast|similar to|like)\b", re.I)),
]


def detect_mood(message: str) -> str | None:
    lower = message.lower()
    for mood, keywords in MOOD_KEYWORDS.items():
        if mood.replace("-", " ") in lower or mood in lower:
            return mood
        for kw in keywords:
            if kw in lower:
                return mood
    return None


def detect_intent(message: str) -> ChatIntent:
    for intent, pattern in INTENT_PATTERNS:
        if pattern.search(message):
            return intent
    if detect_mood(message):
        return ChatIntent.MOOD
    return ChatIntent.GENERAL


def extract_title_candidates(message: str) -> list[str]:
    """Pull quoted titles or 'like X' references."""
    titles: list[str] = []
    titles.extend(re.findall(r'"([^"]{2,80})"', message))
    titles.extend(re.findall(r"'([^']{2,80})'", message))
    for m in re.finditer(r"\blike\s+([A-Z][\w\s:&'-]{2,50})", message, re.I):
        titles.append(m.group(1).strip())
    for m in re.finditer(r"\bsimilar to\s+([A-Z][\w\s:&'-]{2,50})", message, re.I):
        titles.append(m.group(1).strip())
    for m in re.finditer(r"\b(watch|see)\s+([A-Z][\w\s:&'-]{2,40})", message):
        titles.append(m.group(2).strip())
    return list(dict.fromkeys(titles))[:5]
