import re
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.config import settings
from app.db import chat_history_collection
from app.deps import get_optional_user
from app.models.ai_chat import ChatRequest
from app.services.ai_chat.engine import run_chat, stream_chat
from app.services.ai_chat.rate_limit import check_rate_limit
from app.services.ai_chat.taste import build_taste_profile, get_taste_profile

router = APIRouter(prefix="/api/ai", tags=["ai"])


class RecommendBody(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000)


def _sanitize_message(text: str) -> str:
    t = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", text)
    return t.strip()[:4000]


def _actor_key(user: dict | None, session_id: str) -> str:
    if user:
        return f"user:{user['user_id']}"
    return f"session:{session_id}"


def _parse_json_block(text: str) -> dict | None:
    import json

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


@router.post("/chat")
async def chat(
    body: ChatRequest,
    current_user: dict | None = Depends(get_optional_user),
):
    message = _sanitize_message(body.message)
    if not message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    session_id = (body.session_id or "").strip() or str(uuid.uuid4())
    user_id = current_user["user_id"] if current_user else None

    allowed, retry_after = check_rate_limit(_actor_key(current_user, session_id))
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail=f"Too many messages. Try again in {retry_after}s.",
            headers={"Retry-After": str(retry_after)},
        )

    if body.stream:
        return StreamingResponse(
            stream_chat(message, user_id, session_id),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
            },
        )

    result = await run_chat(message, user_id, session_id)
    return result


@router.get("/chat/history")
async def chat_history(
    session_id: str = Query(..., min_length=8, max_length=64),
    limit: int = Query(20, ge=1, le=50),
    current_user: dict | None = Depends(get_optional_user),
):
    query: dict = {"session_id": session_id}
    if current_user:
        query["user_id"] = current_user["user_id"]

    rows = list(
        chat_history_collection.find(query).sort("created_at", -1).limit(limit)
    )
    rows.reverse()
    for r in rows:
        r.pop("_id", None)
    return {"messages": rows, "session_id": session_id}


@router.get("/profile")
async def ai_profile(current_user: dict | None = Depends(get_optional_user)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Sign in for your taste profile")
    profile = get_taste_profile(current_user["user_id"]) or build_taste_profile(
        current_user["user_id"]
    )
    return {
        "taste_summary": profile.get("taste_summary"),
        "favorite_genres": profile.get("favorite_genres", []),
        "rating_breakdown": profile.get("rating_breakdown", {}),
        "total_reviews": profile.get("total_reviews", 0),
    }


@router.post("/recommend")
async def recommend(body: RecommendBody):
    if not settings.groq_api_key:
        raise HTTPException(
            status_code=503,
            detail="Groq is not configured. Set GROQ_API_KEY in backend/.env.",
        )

    try:
        from openai import AsyncOpenAI

        client = AsyncOpenAI(
            api_key=settings.groq_api_key,
            base_url=settings.groq_base_url,
        )
        completion = await client.chat.completions.create(
            model=settings.groq_chat_model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a movie curator. Suggest 5–8 movie titles with a one-line reason each. "
                        'Respond as JSON only: {"movies": [{"title": "...", "year": "...", "why": "..."}], '
                        '"summary": "short paragraph"}.'
                    ),
                },
                {"role": "user", "content": body.query},
            ],
            temperature=0.7,
            max_tokens=800,
            response_format={"type": "json_object"},
        )
        text = completion.choices[0].message.content or ""
        parsed = _parse_json_block(text)
        if parsed and isinstance(parsed, dict):
            return {"result": parsed, "model": settings.groq_chat_model}
        return {"result": None, "raw": text, "model": settings.groq_chat_model}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
