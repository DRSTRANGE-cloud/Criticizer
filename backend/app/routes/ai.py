import json
import re

from pydantic import BaseModel, Field

from fastapi import APIRouter, HTTPException

from app.config import settings

router = APIRouter(prefix="/api/ai", tags=["ai"])


class RecommendBody(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000)


def _parse_json_block(text: str) -> dict | None:
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


@router.post("/recommend")
async def recommend(body: RecommendBody):
    if not settings.openai_api_key:
        raise HTTPException(
            status_code=503,
            detail="OpenAI is not configured. Set OPENAI_API_KEY in backend/.env.",
        )

    try:
        from openai import AsyncOpenAI

        client = AsyncOpenAI(api_key=settings.openai_api_key)
        completion = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a movie curator. Suggest 5–8 movie titles with a one-line reason each. "
                        "Respond as JSON only: {\"movies\": [{\"title\": \"...\", \"year\": \"...\", \"why\": \"...\"}], "
                        "\"summary\": \"short paragraph\"}."
                    ),
                },
                {"role": "user", "content": body.query},
            ],
            temperature=0.7,
            max_tokens=800,
        )
        text = completion.choices[0].message.content or ""
        parsed = _parse_json_block(text)
        if parsed and isinstance(parsed, dict):
            return {"result": parsed, "model": "gpt-4o-mini"}
        return {"result": None, "raw": text, "model": "gpt-4o-mini"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
