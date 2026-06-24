from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db import ensure_indexes
from app.routes.ai import router as ai_router
from app.routes.auth import router as auth_router
from app.routes.comments import router as comments_router
from app.routes.discussions import router as discussions_router
from app.routes.movies import router as movies_router
from app.routes.reviews import router as reviews_router
from app.routes.user import router as user_router
from app.routes.watchlist import router as watchlist_router
from app.services.http_client import aclose_http_client


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_indexes()
    yield
    await aclose_http_client()


def create_app() -> FastAPI:
    app = FastAPI(title="Criticizer API", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allow_origins,
        allow_origin_regex=settings.cors_allow_origin_regex,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],    
    )

    @app.get("/api/health")
    async def health_check():
        return {"status": "healthy", "service": "Criticizer API"}

    app.include_router(auth_router)
    app.include_router(movies_router)
    app.include_router(reviews_router)
    app.include_router(comments_router)
    app.include_router(discussions_router)
    app.include_router(watchlist_router)
    app.include_router(user_router)
    app.include_router(ai_router)

    return app


app = create_app()
