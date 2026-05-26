from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    session_id: str | None = Field(None, max_length=64)
    stream: bool = False


class ChatHistoryQuery(BaseModel):
    session_id: str | None = None
    limit: int = Field(20, ge=1, le=50)
