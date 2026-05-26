"""Lightweight API smoke tests (no external mocks). Requires valid TMDB + Mongo for full success."""

from fastapi.testclient import TestClient

from server import app

client = TestClient(app)


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json().get("status") == "healthy"


def test_movies_trending_shape():
    r = client.get("/api/movies/trending")
    assert r.status_code == 200
    data = r.json()
    assert "movies" in data
    assert isinstance(data["movies"], list)


def test_movies_discover_shape():
    r = client.get("/api/movies/discover?page=1")
    assert r.status_code == 200
    data = r.json()
    assert "movies" in data
    assert data.get("page") == 1
    assert "total_pages" in data
    assert "total_results" in data


def test_movies_search_shape():
    r = client.get("/api/movies/search?query=test&page=1")
    assert r.status_code == 200
    data = r.json()
    assert "movies" in data
    assert "page" in data


def test_movie_suggest_shape():
    r = client.get("/api/movies/suggest?query=test&page=1")
    assert r.status_code == 200
    data = r.json()
    assert "movies" in data


def test_movie_category_shape():
    r = client.get("/api/movies/category/tv?page=1")
    assert r.status_code == 200
    data = r.json()
    assert "movies" in data


def test_movie_kids_category_shape():
    r = client.get("/api/movies/category/kids?page=1")
    assert r.status_code == 200
    data = r.json()
    assert "movies" in data


def test_ai_recommend_requires_openai():
    r = client.post("/api/ai/recommend", json={"query": "sci-fi picks"})
    assert r.status_code == 503


def test_ai_chat_requires_openai_or_runs():
    r = client.post(
        "/api/ai/chat",
        json={"message": "Recommend sci-fi movies", "session_id": "test-session-12345"},
    )
    assert r.status_code in (200, 503)
    if r.status_code == 200:
        data = r.json()
        assert "reply" in data
        assert "recommendations" in data


def test_reviews_user_route_exists():
    r = client.get("/api/reviews/user/00000000-0000-0000-0000-000000000000")
    assert r.status_code == 200
    assert "reviews" in r.json()


def test_comments_route_exists():
    r = client.get("/api/comments/review/does-not-exist")
    assert r.status_code == 200
    assert "comments" in r.json()


def test_discussions_route_exists():
    r = client.get("/api/discussions/movie/does-not-exist")
    assert r.status_code == 200
    assert "posts" in r.json()
