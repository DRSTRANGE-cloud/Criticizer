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
    REVIEW_HELP = "review_help"
    WATCHLIST = "watchlist"
    ANALYTICS = "analytics"
    GENERAL = "general"


MOOD_KEYWORDS: dict[str, list[str]] = {
    "relaxing": ["relax", "chill", "calm", "cozy", "easy watch", "light", "Sunday", "lazy"],
    "emotional": ["emotional", "cry", "tearjerker", "heartfelt", "moving", "sad", "feels"],
    "dark": ["dark", "gritty", "noir", "bleak", "disturbing", "twisted", "sinister"],
    "intense": ["intense", "gripping", "suspense", "edge of seat", "adrenaline", "thriller", "tense"],
    "hype": ["hype", "epic", "action-packed", "blockbuster", "exciting", "pumped", "adrenaline"],
    "feel-good": ["feel good", "feel-good", "uplifting", "wholesome", "happy", "cheerful", "fun"],
    "romantic": ["romantic", "romance", "love story", "date night", "date movie"],
    "mind-bending": ["mind-bending", "mindfuck", "mindblow", "trippy", "cerebral", "thought-provoking", "mind blowing"],
    "horror": ["scary", "horror", "terrifying", "disturbing", "creepy", "haunting", "jump scare"],
    "weekend": ["weekend", "binge", "marathon", "all night", "series", "long watch"],
}

MOOD_GENRE_IDS: dict[str, str] = {
    "relaxing": "35,10751",
    "emotional": "18,10749",
    "dark": "53,27",
    "intense": "53,28",
    "hype": "28,12",
    "feel-good": "35,10751",
    "romantic": "10749,35",
    "mind-bending": "878,9648",
    "horror": "27,53",
    "weekend": "18,28",
}

INTENT_PATTERNS: list[tuple[ChatIntent, re.Pattern[str]]] = [
    (ChatIntent.STREAMING, re.compile(
        r"\b(where (can|to|do i) watch|streaming|stream|on netflix|on prime|on disney|available on|watch online|platform)\b", re.I
    )),
    (ChatIntent.COMPARE, re.compile(r"\b(vs\.?|versus|compare|better than|difference between)\b", re.I)),
    (ChatIntent.EXPLAIN, re.compile(
        r"\b(explain|ending|meaning|plot twist|hidden|what happens|spoiler|timeline|lore|what is|tell me about)\b", re.I
    )),
    (ChatIntent.CAST_CREW, re.compile(
        r"\b(directed by|director|starring|actor|actress|cast|filmography|movies by|films by|works of|career of)\b", re.I
    )),
    (ChatIntent.DISCUSSION, re.compile(
        r"\b(what do people think|reviews say|community|sentiment|opinion|rated|acclaimed|loved|hated)\b", re.I
    )),
    (ChatIntent.TRENDING, re.compile(
        r"\b(trending|popular this week|hot right now|new release|just released|latest|what.?s new|top movies)\b", re.I
    )),
    (ChatIntent.FRANCHISE, re.compile(
        r"\b(watch order|filler guide|marvel|mcu|star wars|dc|naruto|one piece|franchise|universe|series order|chronological)\b", re.I
    )),
    (ChatIntent.DECISION, re.compile(r"\b(should i watch|worth watching|worth it|is it good|skip it|overrated)\b", re.I)),
    (ChatIntent.GROUP, re.compile(r"\b(family|friends|group|movie night|kids|children|everyone|party)\b", re.I)),
    (ChatIntent.REVIEW_HELP, re.compile(
        r"\b(write (a |my )?review|help (me |with )?review|review (for|of)|improve my review|draft review)\b", re.I
    )),
    (ChatIntent.WATCHLIST, re.compile(
        r"\b(watchlist|my list|what.?s next|next (to watch|up)|saved movies|already watched|what to watch next)\b", re.I
    )),
    (ChatIntent.ANALYTICS, re.compile(
        r"\b(my stats|my taste|analytics|wrapped|viewing habits|genre breakdown|what do i (like|watch)|my profile)\b", re.I
    )),
    (ChatIntent.MOOD, re.compile(
        r"\b(mood|feeling|vibe|dark sci-fi|feel-good|emotional anime|in the mood|tonight|right now|something)\b", re.I
    )),
    (ChatIntent.RECOMMENDATION, re.compile(
        r"\b(recommend|suggest|pick|show me|find me|give me|similar to|like|based on|i (loved|liked|enjoyed))\b", re.I
    )),
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
    """Pull quoted titles or reference phrases from message."""
    titles: list[str] = []
    titles.extend(re.findall(r'"([^"]{2,80})"', message))
    titles.extend(re.findall(r"'([^']{2,80})'", message))
    for m in re.finditer(r"\blike\s+([A-Z][\w\s:&'-]{2,50})", message, re.I):
        titles.append(m.group(1).strip())
    for m in re.finditer(r"\bsimilar to\s+([A-Z][\w\s:&'-]{2,50})", message, re.I):
        titles.append(m.group(1).strip())
    for m in re.finditer(
        r"\b(watch|watching|rewatch|see|loved|liked|enjoyed)\s+([A-Z][\w\s:&'-]{2,60}?)(?:\s+(?:tonight|today|now|this weekend|with|for|and)|[?.!]|$)",
        message,
    ):
        titles.append(m.group(2).strip())
    for m in re.finditer(r"\b(explain|about|review of|details on)\s+([A-Z][\w\s:&'-]{2,60}?)(?:[?.!,]|$)", message, re.I):
        titles.append(m.group(2).strip())
    return list(dict.fromkeys(t for t in titles if len(t) > 2))[:5]