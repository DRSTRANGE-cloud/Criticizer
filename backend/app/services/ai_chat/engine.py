from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime
from typing import Any, AsyncIterator

import httpx

from app.config import settings
from app.db import ai_recommendations_collection, chat_history_collection
from app.services.ai_chat.context import gather_context
from app.services.ai_chat.intents import ChatIntent, detect_intent
from app.services.ai_chat.taste import build_taste_profile, get_taste_profile
from app.services.cache import ai_response_cache
from app.services.recommendations import is_personalized_request


# ---------------------------------------------------------------------------
# Groq LLM caller
# ---------------------------------------------------------------------------

async def _call_groq(system_prompt: str, history: list[dict], message: str) -> str:
    """Call Groq chat completion. Returns empty string on any failure so template fallback runs."""
    if not settings.groq_api_key:
        return ""

    messages: list[dict] = [{"role": "system", "content": system_prompt}]
    for h in history[-8:]:
        if h.get("role") in ("user", "assistant") and h.get("content"):
            messages.append({"role": h["role"], "content": str(h["content"])[:1200]})
    messages.append({"role": "user", "content": message})

    try:
        async with httpx.AsyncClient(timeout=25) as client:
            resp = await client.post(
                f"{settings.groq_base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.groq_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": settings.groq_chat_model,
                    "messages": messages,
                    "max_tokens": 700,
                    "temperature": 0.72,
                    "top_p": 0.9,
                },
            )
        if resp.status_code == 200:
            return resp.json()["choices"][0]["message"]["content"].strip()
        # Log non-200 but don't crash
    except Exception:
        pass
    return ""


# ---------------------------------------------------------------------------
# System prompt builder — injects all context Groq needs
# ---------------------------------------------------------------------------

def _build_system_prompt(
    intent: ChatIntent,
    ctx: dict[str, Any],
    taste: dict | None,
    recs: list[dict[str, Any]],
    locked_personal: bool,
    message: str,
) -> str:
    data = ctx.get("data") or {}

    # Movie recommendations block
    rec_lines = "\n".join(
        f"  • {m.get('title', '?')} ({(m.get('release_date') or '')[:4]}) "
        f"| {', '.join((m.get('genres') or [])[:2])} "
        f"| ⭐ {m.get('vote_average', 'N/A')} "
        f"| {(m.get('overview') or '')[:80]}"
        for m in recs[:8]
    ) or "  No specific movie data fetched for this query."

    # Focus movie block (for explain/streaming/decision)
    focus = data.get("focus_movie") or {}
    focus_block = ""
    if focus:
        focus_block = (
            f"\n\nFOCUS MOVIE:\n"
            f"  Title: {focus.get('title')} ({(focus.get('release_date') or '')[:4]})\n"
            f"  Director: {focus.get('director', 'Unknown')}\n"
            f"  Genres: {', '.join((focus.get('genres') or [])[:5])}\n"
            f"  Score: {focus.get('vote_average', 'N/A')}\n"
            f"  Runtime: {focus.get('runtime', 'N/A')} min\n"
            f"  Overview: {(focus.get('overview') or '')[:400]}"
        )

    # User taste block
    taste_block = ""
    if taste and not locked_personal:
        taste_block = (
            f"\n\nUSER TASTE PROFILE:\n"
            f"  Summary: {taste.get('taste_summary', 'Not enough data yet')}\n"
            f"  Favorite genres: {', '.join((taste.get('favorite_genres') or [])[:5])}\n"
            f"  Total reviews: {taste.get('total_reviews', 0)}\n"
            f"  Loved titles count: {len(taste.get('loved_movie_ids') or [])}"
        )

    # Streaming providers
    providers = data.get("where_to_watch") or []
    streaming_block = ""
    if providers:
        pnames = [p.get("provider_name") for p in providers[:8] if p.get("provider_name")]
        streaming_block = f"\n\nSTREAMING AVAILABILITY: {', '.join(pnames)}"

    # Comparison block
    compare = data.get("compare_titles") or []
    compare_block = ""
    if len(compare) >= 2:
        left, right = compare[0], compare[1]
        compare_block = (
            f"\n\nCOMPARISON DATA:\n"
            f"  {left.get('title')} — Score: {left.get('vote_average')} | "
            f"Runtime: {left.get('runtime')} min | Genres: {', '.join((left.get('genres') or [])[:3])}\n"
            f"  {right.get('title')} — Score: {right.get('vote_average')} | "
            f"Runtime: {right.get('runtime')} min | Genres: {', '.join((right.get('genres') or [])[:3])}"
        )

    # Cast/crew block
    cast_crew = data.get("cast_crew") or {}
    cast_block = ""
    if cast_crew:
        people = cast_crew.get("people") or []
        films = cast_crew.get("filmography") or []
        if people:
            cast_block = (
                f"\n\nPERSON INFO:\n"
                f"  Name: {people[0].get('name')}\n"
                f"  Known for: {', '.join(f.get('title') for f in films[:8] if f.get('title'))}"
            )

    # Community/discussion block
    community = data.get("community") or {}
    community_block = ""
    if community:
        snippets = community.get("sample_snippets") or []
        community_block = (
            f"\n\nCOMMUNITY DATA:\n"
            f"  Reviews: {community.get('review_count', 0)}\n"
            f"  Discussion posts: {community.get('discussion_posts', 0)}\n"
            f"  Sample takes: {'; '.join(snippets[:3])}"
        )

    # Mood context
    mood = ctx.get("detected_mood", "")
    mood_block = f"\n\nDETECTED MOOD: {mood}" if mood else ""

    guest_note = (
        "\n\nNOTE: User is NOT logged in. Gently suggest logging in for personalized picks, "
        "but still give genuinely useful general recommendations."
        if locked_personal else ""
    )

    return (
        "You are Critics Talk, the AI cinematic companion on Criticizer — a premium movie review and discovery platform.\n\n"
        "## YOUR PERSONALITY\n"
        "- Talk like a passionate, knowledgeable film-obsessed friend — warm, direct, opinionated but fair\n"
        "- Never robotic, never vague. Give real, confident recommendations\n"
        "- Use **bold** for movie/show titles always\n"
        "- Keep replies focused: 3-6 sentences for simple questions, bullet lists for recommendations\n"
        "- Never say 'As an AI' or 'I cannot' — always find a useful answer\n"
        "- You have expertise across movies, TV shows, anime, directors, actors, awards, and streaming\n\n"
        "## YOUR CAPABILITIES\n"
        "- Recommend movies/shows/anime based on mood, genre, runtime, language, themes, actors, directors\n"
        "- Explain plots, endings, timelines, and lore (ask if user wants spoilers first)\n"
        "- Compare titles across score, tone, runtime, cast, and impact\n"
        "- Provide watch orders for franchises (MCU, Star Wars, Naruto, etc.)\n"
        "- Summarize community reviews and opinions\n"
        "- Help users write or improve their reviews\n"
        "- Show streaming availability\n"
        "- Give personalized picks based on user's taste profile\n\n"
        f"## CURRENT REQUEST CONTEXT\n"
        f"  Intent detected: {intent.value}\n"
        f"  User message: {message[:300]}"
        f"{focus_block}"
        f"{taste_block}"
        f"{streaming_block}"
        f"{compare_block}"
        f"{cast_block}"
        f"{community_block}"
        f"{mood_block}"
        f"{guest_note}\n\n"
        f"## AVAILABLE MOVIE DATA TO REFERENCE\n{rec_lines}\n\n"
        "When listing recommendations, give 3-5 titles with a specific one-line reason for each. "
        "Be opinionated — tell them what makes each pick special for their specific request."
    )


# ---------------------------------------------------------------------------
# Template fallbacks (used only when Groq is unavailable)
# ---------------------------------------------------------------------------

def _why_it_fits(movie: dict[str, Any]) -> str:
    reasons = movie.get("recommendation_reasons") or []
    if reasons:
        return str(reasons[0]).capitalize()
    genres = movie.get("genres") or []
    if genres:
        return f"Strong {', '.join(genres[:2]).lower()} pick"
    if movie.get("director"):
        return f"Directed by {movie['director']}"
    return "Fits your request well"


def _template_reply(
    intent: ChatIntent,
    ctx: dict[str, Any],
    recs: list[dict[str, Any]],
    locked_personal: bool,
) -> str:
    data = ctx.get("data") or {}
    focus = data.get("focus_movie") or {}

    if intent == ChatIntent.STREAMING:
        providers = data.get("where_to_watch") or []
        movie = focus or {}
        if not movie:
            return "Tell me the title and I'll check where it's streaming."
        if not providers:
            return f"I found **{movie.get('title', 'that title')}**, but streaming data isn't available right now."
        names = ", ".join(p.get("provider_name") for p in providers[:6] if p.get("provider_name"))
        return f"**{movie.get('title')}** is available on: {names}."

    if intent == ChatIntent.CAST_CREW:
        cast_crew = data.get("cast_crew") or {}
        people = cast_crew.get("people") or []
        films = cast_crew.get("filmography") or []
        if not people:
            return "Tell me an actor or director name and I'll pull their filmography."
        person = people[0]
        if not films:
            return f"Found **{person.get('name')}** but couldn't load their filmography right now."
        picks = ", ".join(m.get("title") for m in films[:6] if m.get("title"))
        return f"**{person.get('name')}** — notable works include: {picks}."

    if intent == ChatIntent.EXPLAIN:
        if not focus:
            return "Tell me the title you want explained and I'll give you a spoiler-safe summary."
        overview = (focus.get("overview") or "").strip()
        genres = ", ".join((focus.get("genres") or [])[:3]) or "drama"
        return (
            f"**{focus.get('title', 'This title')}** is a {genres} story. "
            + (f"{overview[:250]} " if overview else "")
            + "Want an ending breakdown? Just say so."
        )

    if intent == ChatIntent.COMPARE:
        rows = data.get("compare_titles") or []
        if len(rows) < 2:
            return "Tell me two titles to compare, e.g. `Dune vs Interstellar`."
        left, right = rows[0], rows[1]
        left_r = float(left.get("vote_average") or 0)
        right_r = float(right.get("vote_average") or 0)
        winner = left if left_r >= right_r else right
        return (
            f"**{left.get('title')}** ({left_r:.1f}⭐) vs **{right.get('title')}** ({right_r:.1f}⭐): "
            f"**{winner.get('title')}** leads on audience score. Want a deeper breakdown by tone or theme?"
        )

    if intent == ChatIntent.DISCUSSION:
        community = data.get("community") or {}
        if not community:
            return "Tell me the title and I'll summarize community reviews and opinions."
        snippets = community.get("sample_snippets") or []
        sample = f' Sample take: "{snippets[0]}"' if snippets else ""
        return (
            f"Criticizer community — **{community.get('review_count', 0)} reviews** "
            f"and **{community.get('discussion_posts', 0)} posts**.{sample}"
        )

    if intent == ChatIntent.TRENDING:
        movies = recs or []
        if not movies:
            return "Couldn't load trending titles right now. Try asking for a specific genre instead."
        lines = "\n".join(f"• **{m.get('title')}** ({(m.get('release_date') or '')[:4]})" for m in movies[:6])
        return f"Trending right now:\n{lines}"

    # Default: recommendations
    if not recs:
        if locked_personal:
            return "Log in to unlock personalized picks. I can still recommend by genre, mood, runtime, or a title you love."
        if focus:
            return (
                f"**{focus.get('title')}** — {(focus.get('overview') or '')[:200]} "
                "Want me to suggest similar titles?"
            )
        return "Give me a genre, mood, actor, or a movie you loved and I'll find great picks."

    opener = (
        "Log in for personalized picks. Here's what I'd suggest for now:\n"
        if locked_personal
        else "Here are picks for your request:\n"
    )
    lines = "\n".join(f"• **{m.get('title')}** — {_why_it_fits(m)}" for m in recs[:5])
    return opener + lines


# ---------------------------------------------------------------------------
# Suggested prompts per intent
# ---------------------------------------------------------------------------

def _default_prompts(intent: ChatIntent) -> list[str]:
    mapping = {
        ChatIntent.RECOMMENDATION: [
            "Dark sci-fi that will mess with my mind",
            "Something like Interstellar",
            "Hidden gems from the last 5 years",
        ],
        ChatIntent.MOOD: [
            "Something emotional but not depressing",
            "Make it darker and more intense",
            "Feel-good movie for tonight",
        ],
        ChatIntent.STREAMING: [
            "Where can I watch Dune?",
            "Best movies on Netflix right now",
        ],
        ChatIntent.CAST_CREW: [
            "Best Christopher Nolan films ranked",
            "Movies starring Cillian Murphy",
        ],
        ChatIntent.EXPLAIN: [
            "Explain the ending of Inception",
            "What's the timeline in Dark?",
        ],
        ChatIntent.COMPARE: [
            "Dune vs Interstellar — which is better?",
            "Compare The Godfather and Goodfellas",
        ],
        ChatIntent.TRENDING: [
            "What's trending this week?",
            "Best new anime of this season",
        ],
        ChatIntent.FRANCHISE: [
            "MCU watch order for beginners",
            "How to watch Star Wars chronologically",
        ],
        ChatIntent.ANALYTICS: [
            "What genres do I watch most?",
            "Show me my Criticizer taste profile",
        ],
        ChatIntent.WATCHLIST: [
            "What should I watch next from my list?",
            "Best movie to watch tonight",
        ],
        ChatIntent.REVIEW_HELP: [
            "Help me write a review for Parasite",
            "How do I improve my review writing?",
        ],
    }
    return mapping.get(
        intent,
        [
            "Recommend mind-bending sci-fi",
            "Best anime of all time",
            "Something like Attack on Titan",
        ],
    )


# ---------------------------------------------------------------------------
# History & persistence
# ---------------------------------------------------------------------------

def _cache_key(message: str, user_id: str | None, session_id: str) -> str:
    raw = f"{user_id or ''}:{session_id}:{message.strip().lower()[:500]}"
    return "chat:" + hashlib.sha256(raw.encode()).hexdigest()[:32]


def _load_history(user_id: str | None, session_id: str, limit: int = 10) -> list[dict[str, Any]]:
    query: dict[str, Any] = {"user_id": user_id} if user_id else {"session_id": session_id}
    rows = list(chat_history_collection.find(query).sort("created_at", -1).limit(limit))
    rows.reverse()
    return [{"role": row["role"], "content": row["content"]} for row in rows]


def _save_turn(
    *,
    user_id: str | None,
    session_id: str,
    role: str,
    content: str,
    intent: str,
    recommendations: list | None = None,
) -> None:
    chat_history_collection.insert_one(
        {
            "chat_id": str(uuid.uuid4()),
            "user_id": user_id,
            "session_id": session_id,
            "role": role,
            "content": content,
            "intent": intent,
            "recommendations": recommendations or [],
            "created_at": datetime.utcnow().isoformat(),
        }
    )


def _movies_from_context(ctx: dict[str, Any]) -> list[dict[str, Any]]:
    data = ctx.get("data") or {}
    pools: list[dict[str, Any]] = []
    for key in (
        "candidate_recommendations",
        "referenced_titles",
        "trending",
        "trending_anime",
        "compare_titles",
    ):
        value = data.get(key)
        if isinstance(value, list):
            pools.extend(value)
    cast_crew = data.get("cast_crew")
    if isinstance(cast_crew, dict):
        pools.extend(cast_crew.get("filmography") or [])
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for movie in pools:
        key = str(movie.get("slug") or movie.get("id") or "")
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(movie)
    return out[:10]


def _serialize_context(data: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for key, value in data.items():
        if isinstance(value, list) and value and isinstance(value[0], dict):
            out[key] = [
                {
                    "title": item.get("title"),
                    "year": (item.get("release_date") or "")[:4],
                    "vote_average": item.get("vote_average"),
                    "overview": (item.get("overview") or "")[:160],
                }
                for item in value[:8]
            ]
        elif isinstance(value, dict):
            out[key] = value
        else:
            out[key] = value
    return out


# ---------------------------------------------------------------------------
# Main chat runner
# ---------------------------------------------------------------------------

async def run_chat(
    message: str,
    user_id: str | None,
    session_id: str,
    *,
    use_cache: bool = True,
) -> dict[str, Any]:
    intent = detect_intent(message)
    cache_key = _cache_key(message, user_id, session_id)

    # Don't cache for personalized intents
    if use_cache and intent not in {ChatIntent.ANALYTICS, ChatIntent.WATCHLIST, ChatIntent.REVIEW_HELP}:
        cached = ai_response_cache.get(cache_key)
        if cached:
            payload = dict(cached)
            payload["cached"] = True
            return payload

    taste = None
    if user_id:
        taste = get_taste_profile(user_id)
        if not taste or taste.get("total_reviews", 0) == 0:
            taste = build_taste_profile(user_id)

    ctx = await gather_context(message, intent, taste, user_id=user_id)
    history = _load_history(user_id, session_id)
    locked_personal = not user_id and is_personalized_request(message)
    recs = (ctx.get("data") or {}).get("candidate_recommendations") or _movies_from_context(ctx)

    # Build system prompt and call Groq
    system_prompt = _build_system_prompt(intent, ctx, taste, recs, locked_personal, message)
    reply = await _call_groq(system_prompt, history, message)

    # Fall back to template if Groq unavailable or returned empty
    if not reply:
        reply = _template_reply(intent, ctx, recs, locked_personal)

    result = {
        "reply": reply,
        "recommendations": recs[:10],
        "intent": intent.value,
        "suggested_prompts": _default_prompts(intent),
        "taste_summary": taste.get("taste_summary") if taste and user_id else None,
        "session_id": session_id,
        "model": "criticizer-personal-assistant",
        "cached": False,
        "grounding": _serialize_context(ctx.get("data") or {}),
    }

    _save_turn(user_id=user_id, session_id=session_id, role="user", content=message.strip(), intent=intent.value)
    _save_turn(
        user_id=user_id,
        session_id=session_id,
        role="assistant",
        content=reply,
        intent=intent.value,
        recommendations=recs[:10],
    )

    if user_id and recs:
        try:
            ai_recommendations_collection.insert_one(
                {
                    "user_id": user_id,
                    "session_id": session_id,
                    "message": message[:500],
                    "movie_ids": [m.get("slug") or m.get("id") for m in recs[:10]],
                    "intent": intent.value,
                    "created_at": datetime.utcnow().isoformat(),
                }
            )
        except Exception:
            pass

    ai_response_cache.set(cache_key, result, ttl_seconds=180)
    return result


# ---------------------------------------------------------------------------
# Streaming chat
# ---------------------------------------------------------------------------

async def stream_chat(message: str, user_id: str | None, session_id: str) -> AsyncIterator[str]:
    payload = await run_chat(message, user_id, session_id, use_cache=False)
    reply = payload.get("reply") or ""

    # Stream tokens in small chunks for natural feel
    chunk_size = 18
    for index in range(0, len(reply), chunk_size):
        yield f"data: {json.dumps({'type': 'token', 'content': reply[index:index + chunk_size]})}\n\n"

    done = {
        "type": "done",
        "reply": payload.get("reply"),
        "recommendations": (payload.get("recommendations") or [])[:10],
        "intent": payload.get("intent"),
        "suggested_prompts": payload.get("suggested_prompts") or [],
        "taste_summary": payload.get("taste_summary"),
        "session_id": payload.get("session_id"),
    }
    yield f"data: {json.dumps(done, default=str)}\n\n"