from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime
from typing import Any, AsyncIterator

from app.db import ai_recommendations_collection, chat_history_collection
from app.services.ai_chat.context import gather_context
from app.services.ai_chat.intents import ChatIntent, detect_intent
from app.services.ai_chat.taste import build_taste_profile, get_taste_profile
from app.services.cache import ai_response_cache
from app.services.recommendations import is_personalized_request


def _cache_key(message: str, user_id: str | None, session_id: str) -> str:
    raw = f"{user_id or ''}:{session_id}:{message.strip().lower()[:500]}"
    return "chat:" + hashlib.sha256(raw.encode()).hexdigest()[:32]


def _load_history(user_id: str | None, session_id: str, limit: int = 8) -> list[dict[str, Any]]:
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


def _movie_line(movie: dict[str, Any]) -> str:
    year = (movie.get("release_date") or "")[:4]
    parts = [movie.get("title") or "Unknown title"]
    if year:
        parts.append(f"({year})")
    genres = movie.get("genres") or []
    if genres:
        parts.append(f"- {', '.join(genres[:2])}")
    rating = movie.get("vote_average")
    if rating:
        parts.append(f"- TMDB {float(rating):.1f}")
    return " ".join(parts)


def _why_it_fits(movie: dict[str, Any]) -> str:
    reasons = movie.get("recommendation_reasons") or []
    if reasons:
        return str(reasons[0]).capitalize()
    genres = movie.get("genres") or []
    if genres:
        return f"Leans into {', '.join(genres[:2]).lower()}"
    if movie.get("director"):
        return f"Directed by {movie['director']}"
    return "Fits the vibe of your request"


def _reply_for_recommendations(
    recs: list[dict[str, Any]],
    *,
    locked_personal: bool,
) -> str:
    if not recs:
        if locked_personal:
            return "Login to unlock personalized recommendations. I can still suggest general picks if you tell me a mood, genre, runtime, language, or a movie you already like."
        return "I could not ground a strong recommendation set from the current data. Try adding a mood, genre, runtime, language, decade, actor, director, or a title you want something similar to."

    opener = "Login to unlock personalized recommendations.\n\nHere are grounded picks you can start with:\n" if locked_personal else "Here are grounded picks based on real TMDB matches:\n"
    lines = [f"- **{movie.get('title')}**: {_why_it_fits(movie)}." for movie in recs[:5]]
    return opener + "\n".join(lines)


def _reply_for_streaming(ctx: dict[str, Any]) -> str:
    data = ctx.get("data") or {}
    movie = data.get("focus_movie") or {}
    providers = data.get("where_to_watch") or []
    if not movie:
        return "Tell me the title you want to watch and I will check grounded provider data."
    if not providers:
        return f"I found **{movie.get('title', 'that title')}**, but I do not have grounded provider data for it right now."
    names = ", ".join(provider.get("provider_name") for provider in providers[:6] if provider.get("provider_name"))
    return f"Grounded streaming options for **{movie.get('title', 'this title')}**: {names}."


def _reply_for_cast(ctx: dict[str, Any]) -> str:
    data = ctx.get("data") or {}
    cast_crew = data.get("cast_crew") or {}
    people = cast_crew.get("people") or []
    filmography = cast_crew.get("filmography") or []
    if not people:
        return "Tell me an actor or director name and I will pull grounded filmography matches."
    focus = people[0]
    if not filmography:
        return f"I found **{focus.get('name')}**, but I could not load grounded filmography picks right now."
    picks = ", ".join(movie.get("title") for movie in filmography[:5] if movie.get("title"))
    return f"**{focus.get('name')}** is a strong match for your query. Start with: {picks}."


def _reply_for_explain(ctx: dict[str, Any]) -> str:
    movie = ((ctx.get("data") or {}).get("focus_movie")) or {}
    if not movie:
        return "Tell me the title you want explained and I will use grounded TMDB data for a spoiler-safe summary."
    overview = (movie.get("overview") or "").strip()
    genres = movie.get("genres") or []
    genre_text = ", ".join(genres[:3]) if genres else "genre-blended"
    director = movie.get("director")
    pieces = [f"**{movie.get('title', 'This title')}** is grounded here as a {genre_text} story."]
    if director:
        pieces.append(f"It is led creatively by {director}.")
    if overview:
        pieces.append(overview[:260])
    pieces.append("If you want an ending breakdown, I can only do that from grounded data already in the app, so I may need more context than TMDB provides.")
    return " ".join(pieces)


def _reply_for_discussion(ctx: dict[str, Any]) -> str:
    community = ((ctx.get("data") or {}).get("community")) or {}
    if not community:
        return "Tell me the title and I will summarize grounded review and discussion activity from Criticizer."
    samples = community.get("sample_snippets") or []
    sample = f' Sample take: "{samples[0]}"' if samples else ""
    return (
        f"Criticizer users have logged **{community.get('review_count', 0)} reviews** and "
        f"**{community.get('discussion_posts', 0)} discussion posts** for this title.{sample}"
    )


def _reply_for_compare(ctx: dict[str, Any]) -> str:
    rows = ((ctx.get("data") or {}).get("compare_titles")) or []
    if len(rows) < 2:
        return "Tell me the two titles you want compared, for example `Dune vs Interstellar`."
    left, right = rows[:2]
    left_rating = float(left.get("vote_average") or 0)
    right_rating = float(right.get("vote_average") or 0)
    winner = left if left_rating >= right_rating else right
    return (
        f"**{left.get('title')}** vs **{right.get('title')}**: "
        f"{winner.get('title')} currently has the stronger TMDB score. "
        f"If you want, I can next compare them by tone, scale, runtime, or accessibility."
    )


def _reply_for_trending(ctx: dict[str, Any]) -> str:
    recs = ((ctx.get("data") or {}).get("candidate_recommendations")) or _movies_from_context(ctx)
    if not recs:
        return "I could not load grounded trending picks right now."
    return "What is trending right now:\n" + "\n".join(f"- **{movie.get('title')}**" for movie in recs[:5])


def _reply_for_general(
    intent: ChatIntent,
    ctx: dict[str, Any],
    recs: list[dict[str, Any]],
    *,
    locked_personal: bool,
) -> str:
    if intent in {ChatIntent.RECOMMENDATION, ChatIntent.MOOD, ChatIntent.GENERAL, ChatIntent.GROUP, ChatIntent.DECISION}:
        return _reply_for_recommendations(recs, locked_personal=locked_personal)
    if intent == ChatIntent.STREAMING:
        return _reply_for_streaming(ctx)
    if intent == ChatIntent.CAST_CREW:
        return _reply_for_cast(ctx)
    if intent == ChatIntent.EXPLAIN:
        return _reply_for_explain(ctx)
    if intent == ChatIntent.DISCUSSION:
        return _reply_for_discussion(ctx)
    if intent == ChatIntent.COMPARE:
        return _reply_for_compare(ctx)
    if intent == ChatIntent.TRENDING:
        return _reply_for_trending(ctx)
    return _reply_for_recommendations(recs, locked_personal=locked_personal)


def _default_prompts(intent: ChatIntent) -> list[str]:
    defaults = {
        ChatIntent.RECOMMENDATION: [
            "Dark sci-fi under 2 hours",
            "Something like Interstellar",
            "Feel-good movies tonight",
        ],
        ChatIntent.MOOD: [
            "Emotional anime",
            "Make it darker",
            "Something lighter instead",
        ],
        ChatIntent.STREAMING: [
            "Where can I watch Dune?",
            "Best movies on Netflix tonight",
        ],
        ChatIntent.CAST_CREW: [
            "Movies by Christopher Nolan",
            "Best performances by Ryan Gosling",
        ],
    }
    return defaults.get(
        intent,
        [
            "Recommend mind-bending sci-fi",
            "Feel-good movies under 2 hours",
            "Something similar to Attack on Titan",
        ],
    )


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


async def run_chat(
    message: str,
    user_id: str | None,
    session_id: str,
    *,
    use_cache: bool = True,
) -> dict[str, Any]:
    intent = detect_intent(message)
    cache_key = _cache_key(message, user_id, session_id)
    if use_cache:
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
    reply = _reply_for_general(intent, ctx, recs, locked_personal=locked_personal)

    if history and intent == ChatIntent.GENERAL and not recs:
        reply += "\n\nIf you want sharper picks, mention a mood, genre, runtime, language, actor, director, or a title you already enjoy."

    result = {
        "reply": reply,
        "recommendations": recs[:8],
        "intent": intent.value,
        "suggested_prompts": _default_prompts(intent),
        "taste_summary": taste.get("taste_summary") if taste and user_id else None,
        "session_id": session_id,
        "model": "grounded-tmdb-profile",
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
        recommendations=recs[:8],
    )

    if user_id and recs:
        ai_recommendations_collection.insert_one(
            {
                "user_id": user_id,
                "session_id": session_id,
                "message": message[:500],
                "movie_ids": [movie.get("slug") or movie.get("id") for movie in recs[:8]],
                "intent": intent.value,
                "created_at": datetime.utcnow().isoformat(),
            }
        )

    ai_response_cache.set(cache_key, result, ttl_seconds=300)
    return result


async def stream_chat(message: str, user_id: str | None, session_id: str) -> AsyncIterator[str]:
    payload = await run_chat(message, user_id, session_id, use_cache=False)
    reply = payload.get("reply") or ""
    for index in range(0, len(reply), 24):
        yield f"data: {json.dumps({'type': 'token', 'content': reply[index:index + 24]})}\n\n"

    done = {
        "type": "done",
        "reply": payload.get("reply"),
        "recommendations": payload.get("recommendations") or [],
        "intent": payload.get("intent"),
        "suggested_prompts": payload.get("suggested_prompts") or [],
        "taste_summary": payload.get("taste_summary"),
        "session_id": payload.get("session_id"),
    }
    yield f"data: {json.dumps(done, default=str)}\n\n"
