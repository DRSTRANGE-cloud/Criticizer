import os
from dataclasses import dataclass, field

from dotenv import load_dotenv

load_dotenv()


def _default_cors_origins() -> list[str]:
    """Browsers require explicit origins when using credentials; '*' is invalid with cookies."""
    raw = os.getenv("CORS_ALLOW_ORIGINS", "").strip()
    if raw and raw != "*":
        return [x.strip() for x in raw.split(",") if x.strip()]
    return [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]


@dataclass(frozen=True)
class Settings:
    mongo_url: str = os.getenv("MONGO_URL", "mongodb://localhost:27017/")
    mongo_db_name: str = os.getenv("MONGO_DB_NAME", "criticizer")

    secret_key: str = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
    jwt_algorithm: str = os.getenv("JWT_ALGORITHM", "HS256")
    access_token_expire_minutes: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", str(30 * 24)))

    tmdb_api_key: str | None = os.getenv("TMDB_API_KEY")
    tmdb_base_url: str = os.getenv("TMDB_BASE_URL", "https://api.themoviedb.org/3")
    tmdb_image_base_url: str = os.getenv("TMDB_IMAGE_BASE_URL", "https://image.tmdb.org/t/p")

    watchmode_api_key: str | None = os.getenv("WATCHMODE_API_KEY")
    watchmode_base_url: str = os.getenv("WATCHMODE_BASE_URL", "https://api.watchmode.com/v1")

    groq_api_key: str | None = os.getenv("GROQ_API_KEY") or os.getenv("OPENAI_API_KEY")
    groq_base_url: str = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1")
    groq_chat_model: str = (
        os.getenv("GROQ_CHAT_MODEL")
        or os.getenv("GROQ_MODEL")
        or os.getenv("OPENAI_CHAT_MODEL")
        or "llama-3.1-8b-instant"
    )
    ai_chat_rate_limit: int = int(os.getenv("AI_CHAT_RATE_LIMIT", "30"))
    ai_chat_rate_window_seconds: int = int(os.getenv("AI_CHAT_RATE_WINDOW_SECONDS", "60"))

    google_client_id: str | None = os.getenv("GOOGLE_CLIENT_ID")
    github_client_id: str | None = os.getenv("GITHUB_CLIENT_ID")
    github_client_secret: str | None = os.getenv("GITHUB_CLIENT_SECRET")

    cors_allow_origins: list[str] = field(default_factory=_default_cors_origins)


settings = Settings()
