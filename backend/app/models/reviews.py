from pydantic import BaseModel


class ReviewCreate(BaseModel):
    movie_id: str
    rating_label: str
    review_text: str


class WatchlistItem(BaseModel):
    movie_id: str
    status: str = "watchlist"


class CommentCreate(BaseModel):
    review_id: str
    text: str
    parent_comment_id: str | None = None


class ReviewLikePayload(BaseModel):
    review_id: str

