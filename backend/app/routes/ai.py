import re
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.db import chat_history_collection
from app.deps import get_current_user, get_optional_user
from app.models.ai_chat import ChatRequest
from app.services.ai_chat.engine import run_chat, stream_chat
from app.services.ai_chat.rate_limit import check_rate_limit
from app.services.ai_chat.taste import build_taste_profile, get_taste_profile
from app.services.recommendations import recommend_for_query

router = APIRouter(prefix="/api/ai", tags=["ai"])


class RecommendBody(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000)


def _sanitize_message(text: str) -> str:
    clean = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", text)
    return clean.strip()[:4000]


def _actor_key(user: dict | None, session_id: str) -> str:
    if user:
        return f"user:{user['user_id']}:{session_id}"
    return f"guest:{session_id}"


@router.post("/chat")
async def chat(body: ChatRequest, current_user: dict | None = Depends(get_optional_user)):
    message = _sanitize_message(body.message)
    if not message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    session_id = (body.session_id or "").strip() or str(uuid.uuid4())
    user_id = current_user["user_id"] if current_user else f"guest:{session_id}"

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
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    return await run_chat(message, user_id, session_id)


@router.get("/chat/history")
async def chat_history(
    session_id: str = Query(..., min_length=8, max_length=64),
    limit: int = Query(20, ge=1, le=50),
    current_user: dict = Depends(get_current_user),
):
    query: dict = {"session_id": session_id, "user_id": current_user["user_id"]}

    rows = list(chat_history_collection.find(query).sort("created_at", -1).limit(limit))
    rows.reverse()
    for row in rows:
        row.pop("_id", None)
    return {"messages": rows, "session_id": session_id}


@router.delete("/chat/history")
async def delete_chat_history(
    session_id: str = Query(..., min_length=8, max_length=64),
    current_user: dict = Depends(get_current_user),
):
    result = chat_history_collection.delete_many(
        {"session_id": session_id, "user_id": current_user["user_id"]}
    )
    return {"deleted": result.deleted_count, "session_id": session_id}


@router.get("/profile")
async def ai_profile(current_user: dict = Depends(get_current_user)):
    profile = get_taste_profile(current_user["user_id"]) or build_taste_profile(current_user["user_id"])
    return {
        "taste_summary": profile.get("taste_summary"),
        "favorite_genres": profile.get("favorite_genres", []),
        "rating_breakdown": profile.get("rating_breakdown", {}),
        "total_reviews": profile.get("total_reviews", 0),
    }


@router.post("/recommend")
async def recommend(body: RecommendBody, current_user: dict | None = Depends(get_optional_user)):
    user_id = current_user["user_id"] if current_user else None
    taste = (get_taste_profile(user_id) or build_taste_profile(user_id)) if user_id else None

    personalized_locked = current_user is None
    try:
        movies = await recommend_for_query(body.query, taste=taste, user_id=user_id, limit=8)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Recommendation provider unavailable: {exc}") from exc
    return {
        "result": {
            "summary": (
                "Login to unlock personalized recommendations."
                if personalized_locked
                else "Recommendations tuned from Criticizer taste signals and current movie data."
            ),
            "movies": [
                {
                    "title": movie.get("title"),
                    "year": (movie.get("release_date") or "")[:4],
                    "why": (movie.get("recommendation_reasons") or ["Strong Criticizer match"])[0],
                    "slug": movie.get("slug"),
                }
                for movie in movies
            ],
        },
        "movies": movies,
        "model": "criticizer-personal-assistant",
    }
