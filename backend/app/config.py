import os
from dataclasses import dataclass, field

from dotenv import load_dotenv

load_dotenv()


def _env(name: str) -> str | None:
    value = os.getenv(name)
    if value is None:
        return None
    value = value.strip()
    return value or None


def _default_cors_origins() -> list[str]:
    raw = os.getenv("CORS_ALLOW_ORIGINS", "").strip()

    if raw:
        return [origin.strip() for origin in raw.split(",") if origin.strip()]

    return [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://criticizer.vercel.app",
    ]


def _default_cors_origin_regex() -> str | None:
    raw = os.getenv("CORS_ALLOW_ORIGIN_REGEX", "").strip()
    if raw:
        return raw
    # Supports Vercel production and preview deployments without allowing all origins.
    return r"https://.*\.vercel\.app"


@dataclass(frozen=True)
class Settings:
    mongo_url: str = _env("MONGODB_URI") or _env("MONGO_URL") or "mongodb://localhost:27017/"
    mongo_db_name: str = _env("MONGO_DB_NAME") or "criticizer"

    secret_key: str = _env("JWT_SECRET") or _env("SECRET_KEY") or "your-secret-key-change-in-production"
    jwt_algorithm: str = _env("JWT_ALGORITHM") or "HS256"
    access_token_expire_minutes: int = int(_env("ACCESS_TOKEN_EXPIRE_MINUTES") or str(30 * 24))

    tmdb_api_key: str | None = _env("TMDB_API_KEY")
    tmdb_base_url: str = _env("TMDB_BASE_URL") or "https://api.themoviedb.org/3"
    tmdb_image_base_url: str = _env("TMDB_IMAGE_BASE_URL") or "https://image.tmdb.org/t/p"

    watchmode_api_key: str | None = _env("WATCHMODE_API_KEY")
    watchmode_base_url: str = _env("WATCHMODE_BASE_URL") or "https://api.watchmode.com/v1"

    groq_api_key: str | None = _env("GROQ_API_KEY") or _env("OPENAI_API_KEY")
    groq_base_url: str = _env("GROQ_BASE_URL") or "https://api.groq.com/openai/v1"
    groq_chat_model: str = (
        _env("GROQ_CHAT_MODEL")
        or _env("GROQ_MODEL")
        or _env("OPENAI_CHAT_MODEL")
        or "llama-3.1-8b-instant"
    )
    ai_chat_rate_limit: int = int(_env("AI_CHAT_RATE_LIMIT") or "30")
    ai_chat_rate_window_seconds: int = int(_env("AI_CHAT_RATE_WINDOW_SECONDS") or "60")

    google_client_id: str | None = _env("GOOGLE_CLIENT_ID")
    google_client_secret: str | None = _env("GOOGLE_CLIENT_SECRET")
    github_client_id: str | None = _env("GITHUB_CLIENT_ID")
    github_client_secret: str | None = _env("GITHUB_CLIENT_SECRET")

    cors_allow_origins: list[str] = field(default_factory=_default_cors_origins)
    cors_allow_origin_regex: str | None = field(default_factory=_default_cors_origin_regex)


settings = Settings()
