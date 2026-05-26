from pymongo import MongoClient

from app.config import settings

client = MongoClient(
    settings.mongo_url,
    maxPoolSize=50,
    minPoolSize=5,
    serverSelectionTimeoutMS=8000,
)
db = client[settings.mongo_db_name]

users_collection = db.users
reviews_collection = db.reviews
watchlist_collection = db.watchlist
movies_collection = db.movies
comments_collection = db.comments
discussions_collection = db.discussions
chat_history_collection = db.chat_history
ai_profiles_collection = db.ai_profiles
ai_recommendations_collection = db.ai_recommendations


def ensure_indexes() -> None:
    """Idempotent indexes for common queries (Atlas-safe)."""
    try:
        users_collection.create_index("email", unique=True)
        users_collection.create_index("user_id", unique=True)
        reviews_collection.create_index("movie_id")
        reviews_collection.create_index("user_id")
        reviews_collection.create_index([("user_id", 1), ("movie_id", 1)], unique=True)
        watchlist_collection.create_index("user_id")
        watchlist_collection.create_index([("user_id", 1), ("status", 1)])
        watchlist_collection.create_index([("user_id", 1), ("movie_id", 1)], unique=True)
        watchlist_collection.update_many(
            {"status": "watch_later"},
            {"$set": {"status": "watchlist"}},
        )
        comments_collection.create_index("review_id")
        comments_collection.create_index("user_id")
        comments_collection.create_index("parent_comment_id")
        discussions_collection.create_index("movie_id")
        discussions_collection.create_index("user_id")
        chat_history_collection.create_index([("user_id", 1), ("created_at", -1)])
        chat_history_collection.create_index([("session_id", 1), ("created_at", -1)])
        ai_profiles_collection.create_index("user_id", unique=True)
        ai_recommendations_collection.create_index([("user_id", 1), ("created_at", -1)])
    except Exception:
        # e.g. duplicate key if legacy data — ignore in dev
        pass
