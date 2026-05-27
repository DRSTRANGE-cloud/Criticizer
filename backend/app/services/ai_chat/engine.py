from __future__ import annotations

import hashlib
import json
import re
import uuid
from datetime import datetime
from typing import Any, AsyncIterator

from app.config import settings
from app.db import ai_recommendations_collection, chat_history_collection
from app.services.ai_chat.context import gather_context
from app.services.ai_chat.intents import ChatIntent, detect_intent
from app.services.ai_chat.taste import build_taste_profile, get_taste_profile
from app.services.cache import ai_response_cache
from app.services.tmdb import resolve_movie_titles

SYSTEM_PERSONALITY = """You are Critics Talk — the cinematic AI inside Criticizer.
You are a smart movie companion: warm, concise, and cinematic. Never robotic.
You help users discover films by mood, genre, taste, runtime, cast, streaming, and trends.
You explain plots and endings without spoiling unless the user explicitly asks for spoilers.
You support English, Hindi, and Hinglish naturally.
When CONTEXT JSON is provided, ground your answer in it. If data is missing, say so honestly.
For recommendations, mention why each pick fits the user.
Keep replies under 220 words unless explaining a complex topic.
End with a short engaging follow-up when appropriate."""

RESPONSE_SCHEMA = (
    'Respond with JSON only: {"reply": "markdown-light text", '
    '"movie_queries": ["Title Year optional", ...], '
    '"follow_up_prompts": ["short prompt", ...]}. '
    "movie_queries: up to 6 real movie/TV titles you recommend or discuss. "
    "follow_up_prompts: 2-3 suggested next questions."
)


def _groq_client():
    from openai import AsyncOpenAI

    return AsyncOpenAI(
        api_key=settings.groq_api_key,
        base_url=settings.groq_base_url,
    )


def _parse_ai_json(text: str) -> dict | None:
    if not text:
        return None
    t = text.strip()
    try:
        return json.loads(t)
    except json.JSONDecodeError:
        pass
    m = re.search(r"\{[\s\S]*\}", t)
    if m:
        try:
            return json.loads(m.group(0))
        except json.JSONDecodeError:
            return None
    return None


def _cache_key(message: str, user_id: str | None, session_id: str) -> str:
    raw = f"{user_id or ''}:{session_id}:{message.strip().lower()[:500]}"
    return "chat:" + hashlib.sha256(raw.encode()).hexdigest()[:32]


def _load_history(user_id: str | None, session_id: str, limit: int = 8) -> list[dict]:
    query: dict[str, Any] = {}
    if user_id:
        query["user_id"] = user_id
    else:
        query["session_id"] = session_id
    rows = list(
        chat_history_collection.find(query).sort("created_at", -1).limit(limit)
    )
    rows.reverse()
    return [{"role": r["role"], "content": r["content"]} for r in rows]


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


def _movies_from_context(ctx: dict) -> list[dict]:
    data = ctx.get("data") or {}
    pools: list[dict] = []
    for key in (
        "referenced_titles",
        "trending",
        "trending_anime",
        "mood_picks",
        "taste_discover",
        "compare_titles",
        "filmography",
    ):
        val = data.get(key)
        if isinstance(val, list):
            pools.extend(val)
        elif key == "cast_crew" and isinstance(val, dict):
            pools.extend(val.get("filmography") or [])
    seen: set[str] = set()
    out = []
    for m in pools:
        if not isinstance(m, dict):
            continue
        k = m.get("slug") or m.get("id")
        if k and k not in seen:
            seen.add(str(k))
            out.append(m)
    return out[:12]


async def run_chat(
    message: str,
    user_id: str | None,
    session_id: str,
    *,
    use_cache: bool = True,
) -> dict[str, Any]:
    if not settings.groq_api_key:
        return {
            "reply": (
                "Critics Talk needs Groq to come alive. "
                "Add GROQ_API_KEY to backend/.env and restart the server."
            ),
            "recommendations": [],
            "intent": "general",
            "suggested_prompts": [
                "Recommend mind-bending sci-fi",
                "Feel-good movies under 2 hours",
                "What's trending this week?",
            ],
            "taste_summary": None,
            "session_id": session_id,
            "model": None,
        }

    intent = detect_intent(message)
    ck = _cache_key(message, user_id, session_id)
    if use_cache:
        cached = ai_response_cache.get(ck)
        if cached:
            cached = dict(cached)
            cached["cached"] = True
            return cached

    taste = None
    if user_id:
        taste = get_taste_profile(user_id)
        if not taste or taste.get("total_reviews", 0) == 0:
            taste = build_taste_profile(user_id)

    ctx = await gather_context(message, intent, taste)
    history = _load_history(user_id, session_id)

    context_block = json.dumps(
        {
            "intent": ctx.get("intent"),
            "detected_mood": ctx.get("detected_mood"),
            "taste_summary": ctx.get("taste_summary"),
            "favorite_genres": ctx.get("favorite_genres"),
            "data": _serialize_context(ctx.get("data") or {}),
        },
        default=str,
    )[:12000]

    messages: list[dict[str, str]] = [
        {"role": "system", "content": SYSTEM_PERSONALITY},
        {
            "role": "system",
            "content": f"CONTEXT (use this):\n{context_block}\n\n{RESPONSE_SCHEMA}",
        },
    ]
    messages.extend(history[-8:])
    messages.append({"role": "user", "content": message.strip()})

    client = _groq_client()
    completion = await client.chat.completions.create(
        model=settings.groq_chat_model,
        messages=messages,
        temperature=0.75,
        max_tokens=900,
        response_format={"type": "json_object"},
    )
    raw = completion.choices[0].message.content or ""
    parsed = _parse_ai_json(raw) or {
        "reply": raw[:2000] if raw else "I couldn't craft a response. Try rephrasing?",
        "movie_queries": [],
        "follow_up_prompts": [],
    }

    reply = parsed.get("reply") or ""
    queries = parsed.get("movie_queries") or []
    if isinstance(queries, str):
        queries = [queries]

    recs = await resolve_movie_titles([str(q) for q in queries if q])
    ctx_movies = _movies_from_context(ctx)
    seen = {m.get("slug") or m.get("id") for m in recs}
    for m in ctx_movies:
        k = m.get("slug") or m.get("id")
        if k and k not in seen:
            seen.add(k)
            recs.append(m)
        if len(recs) >= 8:
            break
    recs = recs[:8]

    suggested = parsed.get("follow_up_prompts") or _default_prompts(intent)
    if not isinstance(suggested, list):
        suggested = _default_prompts(intent)

    result = {
        "reply": reply,
        "recommendations": recs,
        "intent": intent.value,
        "suggested_prompts": suggested[:4],
        "taste_summary": taste.get("taste_summary") if taste else None,
        "session_id": session_id,
        "model": settings.groq_chat_model,
        "cached": False,
    }

    _save_turn(
        user_id=user_id,
        session_id=session_id,
        role="user",
        content=message.strip(),
        intent=intent.value,
    )
    _save_turn(
        user_id=user_id,
        session_id=session_id,
        role="assistant",
        content=reply,
        intent=intent.value,
        recommendations=recs,
    )

    if user_id and recs:
        ai_recommendations_collection.insert_one(
            {
                "user_id": user_id,
                "session_id": session_id,
                "message": message[:500],
                "movie_ids": [m.get("slug") or m.get("id") for m in recs],
                "intent": intent.value,
                "created_at": datetime.utcnow().isoformat(),
            }
        )

    ai_response_cache.set(ck, result, ttl_seconds=300)
    return result


async def stream_chat(
    message: str,
    user_id: str | None,
    session_id: str,
) -> AsyncIterator[str]:
    """SSE: token events then a final done payload."""
    if not settings.groq_api_key:
        payload = json.dumps(
            {
                "type": "done",
                "reply": "Configure GROQ_API_KEY to use Critics Talk.",
                "recommendations": [],
                "suggested_prompts": [],
            }
        )
        yield f"data: {payload}\n\n"
        return

    intent = detect_intent(message)
    taste = get_taste_profile(user_id) if user_id else None
    ctx = await gather_context(message, intent, taste)
    history = _load_history(user_id, session_id)
    context_block = json.dumps(
        {
            "intent": ctx.get("intent"),
            "taste_summary": ctx.get("taste_summary"),
            "data": _serialize_context(ctx.get("data") or {}),
        },
        default=str,
    )[:10000]

    messages: list[dict[str, str]] = [
        {"role": "system", "content": SYSTEM_PERSONALITY},
        {
            "role": "system",
            "content": f"CONTEXT:\n{context_block}\n\n{RESPONSE_SCHEMA}",
        },
    ]
    messages.extend(history[-6:])
    messages.append({"role": "user", "content": message.strip()})

    client = _groq_client()
    completion = await client.chat.completions.create(
        model=settings.groq_chat_model,
        messages=messages,
        temperature=0.75,
        max_tokens=900,
        response_format={"type": "json_object"},
    )

    full = completion.choices[0].message.content or ""
    parsed = _parse_ai_json(full) or {"reply": full, "movie_queries": [], "follow_up_prompts": []}
    reply = parsed.get("reply") or full

    for i in range(0, len(reply), 24):
        yield f"data: {json.dumps({'type': 'token', 'content': reply[i:i + 24]})}\n\n"

    queries = parsed.get("movie_queries") or []
    recs = await resolve_movie_titles([str(q) for q in queries if q])
    recs = (recs + _movies_from_context(ctx))[:8]
    seen: set[str] = set()
    deduped = []
    for m in recs:
        k = str(m.get("slug") or m.get("id"))
        if k in seen:
            continue
        seen.add(k)
        deduped.append(m)

    _save_turn(user_id=user_id, session_id=session_id, role="user", content=message.strip(), intent=intent.value)
    _save_turn(
        user_id=user_id,
        session_id=session_id,
        role="assistant",
        content=reply,
        intent=intent.value,
        recommendations=deduped,
    )

    done = {
        "type": "done",
        "reply": reply,
        "recommendations": deduped,
        "intent": intent.value,
        "suggested_prompts": parsed.get("follow_up_prompts") or _default_prompts(intent),
        "taste_summary": taste.get("taste_summary") if taste else None,
        "session_id": session_id,
    }
    yield f"data: {json.dumps(done, default=str)}\n\n"


def _serialize_context(data: dict) -> dict:
    out: dict[str, Any] = {}
    for k, v in data.items():
        if isinstance(v, list) and v and isinstance(v[0], dict):
            out[k] = [
                {
                    "title": i.get("title"),
                    "year": (i.get("release_date") or "")[:4],
                    "vote_average": i.get("vote_average"),
                    "overview": (i.get("overview") or "")[:160],
                }
                for i in v[:10]
            ]
        elif isinstance(v, dict):
            slim = {}
            for sk, sv in v.items():
                if sk == "filmography" and isinstance(sv, list):
                    slim[sk] = [
                        {"title": x.get("title"), "year": (x.get("release_date") or "")[:4]}
                        for x in sv[:8]
                    ]
                elif sk == "people" and isinstance(sv, list):
                    slim[sk] = [{"name": p.get("name")} for p in sv[:3]]
                elif sk in ("where_to_watch", "rating_labels", "sample_snippets"):
                    slim[sk] = sv
                elif sk == "focus_movie" and isinstance(sv, dict):
                    slim[sk] = {
                        "title": sv.get("title"),
                        "overview": (sv.get("overview") or "")[:200],
                    }
                else:
                    slim[sk] = sv
            out[k] = slim
        else:
            out[k] = v
    return out


def _default_prompts(intent: ChatIntent) -> list[str]:
    defaults = {
        ChatIntent.RECOMMENDATION: [
            "More like my last pick",
            "Something under 2 hours",
            "Hidden gems this year",
        ],
        ChatIntent.MOOD: [
            "Make it darker",
            "Something feel-good instead",
            "Anime with that vibe",
        ],
        ChatIntent.STREAMING: [
            "Where can I watch Dune?",
            "Best on Netflix tonight",
        ],
        ChatIntent.TRENDING: [
            "Trending anime this week",
            "Top Bollywood picks",
        ],
    }
    return defaults.get(
        intent,
        [
            "Recommend mind-bending sci-fi",
            "Should I watch this tonight?",
            "Explain a movie ending",
        ],
    )
