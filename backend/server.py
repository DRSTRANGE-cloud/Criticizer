from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from pymongo import MongoClient
import os
from dotenv import load_dotenv
import uuid

load_dotenv()

app = FastAPI(title="Critisizer API")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB setup
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017/")
client = MongoClient(MONGO_URL)
db = client.critisizer

# Collections
users_collection = db.users
reviews_collection = db.reviews
watchlist_collection = db.watchlist

# Security
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30 * 24  # 30 days

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

# Mock Movie Data
MOCK_MOVIES = [
    {
        "id": "1",
        "title": "The Shawshank Redemption",
        "overview": "Two imprisoned men bond over a number of years, finding solace and eventual redemption through acts of common decency.",
        "poster_path": "https://image.tmdb.org/t/p/w500/q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg",
        "backdrop_path": "https://image.tmdb.org/t/p/original/kXfqcdQKsToO0OUXHcrrNCHDBzO.jpg",
        "release_date": "1994-09-23",
        "vote_average": 8.7,
        "genres": ["Drama", "Crime"],
        "runtime": 142,
        "trailer_key": "6hB3S9bIaco"
    },
    {
        "id": "2",
        "title": "The Dark Knight",
        "overview": "When the menace known as the Joker wreaks havoc and chaos on the people of Gotham, Batman must accept one of the greatest psychological and physical tests.",
        "poster_path": "https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg",
        "backdrop_path": "https://image.tmdb.org/t/p/original/hkBaDkMWbLaf8B1lsWsKX7Ew3Xq.jpg",
        "release_date": "2008-07-18",
        "vote_average": 9.0,
        "genres": ["Action", "Crime", "Drama"],
        "runtime": 152,
        "trailer_key": "EXeTwQWrcwY"
    },
    {
        "id": "3",
        "title": "Inception",
        "overview": "A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea.",
        "poster_path": "https://image.tmdb.org/t/p/w500/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg",
        "backdrop_path": "https://image.tmdb.org/t/p/original/s3TBrRGB1iav7gFOCNx3H31MoES.jpg",
        "release_date": "2010-07-16",
        "vote_average": 8.8,
        "genres": ["Action", "Sci-Fi", "Thriller"],
        "runtime": 148,
        "trailer_key": "YoHD9XEInc0"
    },
    {
        "id": "4",
        "title": "Pulp Fiction",
        "overview": "The lives of two mob hitmen, a boxer, a gangster and his wife intertwine in four tales of violence and redemption.",
        "poster_path": "https://image.tmdb.org/t/p/w500/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg",
        "backdrop_path": "https://image.tmdb.org/t/p/original/suaEOtk1N1sgg2MTM7oZd2cfVp3.jpg",
        "release_date": "1994-10-14",
        "vote_average": 8.9,
        "genres": ["Crime", "Drama"],
        "runtime": 154,
        "trailer_key": "s7EdQ4FqbhY"
    },
    {
        "id": "5",
        "title": "Forrest Gump",
        "overview": "The presidencies of Kennedy and Johnson, the Vietnam War, and other historical events unfold from the perspective of an Alabama man.",
        "poster_path": "https://image.tmdb.org/t/p/w500/arw2vcBveWOVZr6pxd9XTd1TdQa.jpg",
        "backdrop_path": "https://image.tmdb.org/t/p/original/7c9UVPPiTPltouxRVY6N5uIM5pG.jpg",
        "release_date": "1994-07-06",
        "vote_average": 8.8,
        "genres": ["Drama", "Romance"],
        "runtime": 142,
        "trailer_key": "bLvqoHBptjg"
    },
    {
        "id": "6",
        "title": "The Matrix",
        "overview": "A computer hacker learns from mysterious rebels about the true nature of his reality and his role in the war against its controllers.",
        "poster_path": "https://image.tmdb.org/t/p/w500/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
        "backdrop_path": "https://image.tmdb.org/t/p/original/icmmSD4vTTDKOq2vvdulafOGw93.jpg",
        "release_date": "1999-03-31",
        "vote_average": 8.7,
        "genres": ["Action", "Sci-Fi"],
        "runtime": 136,
        "trailer_key": "vKQi3bBA1y8"
    },
    {
        "id": "7",
        "title": "Interstellar",
        "overview": "A team of explorers travel through a wormhole in space in an attempt to ensure humanity's survival.",
        "poster_path": "https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
        "backdrop_path": "https://image.tmdb.org/t/p/original/xu9zaAevzQ5nnrsXN6JcahLnG4i.jpg",
        "release_date": "2014-11-07",
        "vote_average": 8.6,
        "genres": ["Adventure", "Drama", "Sci-Fi"],
        "runtime": 169,
        "trailer_key": "zSWdZVtXT7E"
    },
    {
        "id": "8",
        "title": "Parasite",
        "overview": "Greed and class discrimination threaten the newly formed symbiotic relationship between the wealthy Park family and the destitute Kim clan.",
        "poster_path": "https://image.tmdb.org/t/p/w500/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg",
        "backdrop_path": "https://image.tmdb.org/t/p/original/TU9NIjwzjoKPwQHoHshkFcQUCG.jpg",
        "release_date": "2019-05-30",
        "vote_average": 8.5,
        "genres": ["Comedy", "Thriller", "Drama"],
        "runtime": 132,
        "trailer_key": "5xH0HfJHsaY"
    }
]

# Pydantic Models
class UserCreate(BaseModel):
    email: EmailStr
    username: str
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: Dict[str, Any]

class ReviewCreate(BaseModel):
    movie_id: str
    rating_category: str
    review_text: str
    rating_score: float

class WatchlistItem(BaseModel):
    movie_id: str

# Helper functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = users_collection.find_one({"user_id": user_id})
    if user is None:
        raise credentials_exception
    return user

# Routes
@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "Critisizer API"}

# Auth Routes
@app.post("/api/auth/signup", response_model=Token)
async def signup(user: UserCreate):
    # Check if user exists
    existing_user = users_collection.find_one({"email": user.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    existing_username = users_collection.find_one({"username": user.username})
    if existing_username:
        raise HTTPException(status_code=400, detail="Username already taken")
    
    # Create new user
    user_id = str(uuid.uuid4())
    hashed_password = get_password_hash(user.password)
    
    new_user = {
        "user_id": user_id,
        "email": user.email,
        "username": user.username,
        "password_hash": hashed_password,
        "created_at": datetime.utcnow().isoformat(),
        "avatar": f"https://ui-avatars.com/api/?name={user.username}&background=random"
    }
    
    users_collection.insert_one(new_user)
    
    # Create access token
    access_token = create_access_token(data={"sub": user_id})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "user_id": user_id,
            "email": user.email,
            "username": user.username,
            "avatar": new_user["avatar"]
        }
    }

@app.post("/api/auth/login", response_model=Token)
async def login(user: UserLogin):
    # Find user
    db_user = users_collection.find_one({"email": user.email})
    if not db_user or not verify_password(user.password, db_user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Create access token
    access_token = create_access_token(data={"sub": db_user["user_id"]})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "user_id": db_user["user_id"],
            "email": db_user["email"],
            "username": db_user["username"],
            "avatar": db_user.get("avatar", "")
        }
    }

@app.get("/api/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "user_id": current_user["user_id"],
        "email": current_user["email"],
        "username": current_user["username"],
        "avatar": current_user.get("avatar", "")
    }

# Movie Routes
@app.get("/api/movies/trending")
async def get_trending_movies():
    return {"movies": MOCK_MOVIES}

@app.get("/api/movies/search")
async def search_movies(query: str):
    filtered_movies = [
        movie for movie in MOCK_MOVIES 
        if query.lower() in movie["title"].lower() or query.lower() in movie["overview"].lower()
    ]
    return {"movies": filtered_movies}

@app.get("/api/movies/{movie_id}")
async def get_movie_details(movie_id: str):
    movie = next((m for m in MOCK_MOVIES if m["id"] == movie_id), None)
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")
    
    # Get reviews for this movie
    reviews = list(reviews_collection.find({"movie_id": movie_id}))
    for review in reviews:
        review["_id"] = str(review["_id"])
        # Get user info for each review
        user = users_collection.find_one({"user_id": review["user_id"]})
        if user:
            review["username"] = user["username"]
            review["avatar"] = user.get("avatar", "")
    
    # Calculate rating distribution
    rating_dist = {
        "Absolute Cinema": 0,
        "Peak": 0,
        "Excellent": 0,
        "Good": 0,
        "Go for it": 0,
        "Not my type": 0
    }
    
    for review in reviews:
        rating_cat = review.get("rating_category", "")
        if rating_cat in rating_dist:
            rating_dist[rating_cat] += 1
    
    total_reviews = len(reviews)
    avg_score = sum(r.get("rating_score", 0) for r in reviews) / total_reviews if total_reviews > 0 else 0
    
    return {
        "movie": movie,
        "reviews": reviews,
        "rating_distribution": rating_dist,
        "total_reviews": total_reviews,
        "average_score": round(avg_score, 1)
    }

# Review Routes
@app.post("/api/reviews/create")
async def create_review(review: ReviewCreate, current_user: dict = Depends(get_current_user)):
    # Check if user already reviewed this movie
    existing_review = reviews_collection.find_one({
        "user_id": current_user["user_id"],
        "movie_id": review.movie_id
    })
    
    if existing_review:
        raise HTTPException(status_code=400, detail="You have already reviewed this movie")
    
    review_id = str(uuid.uuid4())
    new_review = {
        "review_id": review_id,
        "user_id": current_user["user_id"],
        "movie_id": review.movie_id,
        "rating_category": review.rating_category,
        "rating_score": review.rating_score,
        "review_text": review.review_text,
        "created_at": datetime.utcnow().isoformat(),
        "likes": 0
    }
    
    reviews_collection.insert_one(new_review)
    
    return {"message": "Review created successfully", "review_id": review_id}

@app.get("/api/reviews/user/{user_id}")
async def get_user_reviews(user_id: str):
    reviews = list(reviews_collection.find({"user_id": user_id}))
    for review in reviews:
        review["_id"] = str(review["_id"])
        # Add movie info
        movie = next((m for m in MOCK_MOVIES if m["id"] == review["movie_id"]), None)
        if movie:
            review["movie_title"] = movie["title"]
            review["movie_poster"] = movie["poster_path"]
    
    return {"reviews": reviews}

# Watchlist Routes
@app.post("/api/watchlist/add")
async def add_to_watchlist(item: WatchlistItem, current_user: dict = Depends(get_current_user)):
    watchlist = watchlist_collection.find_one({"user_id": current_user["user_id"]})
    
    if watchlist:
        if item.movie_id in watchlist.get("movie_ids", []):
            raise HTTPException(status_code=400, detail="Movie already in watchlist")
        
        watchlist_collection.update_one(
            {"user_id": current_user["user_id"]},
            {"$push": {"movie_ids": item.movie_id}}
        )
    else:
        watchlist_collection.insert_one({
            "user_id": current_user["user_id"],
            "movie_ids": [item.movie_id]
        })
    
    return {"message": "Movie added to watchlist"}

@app.delete("/api/watchlist/remove/{movie_id}")
async def remove_from_watchlist(movie_id: str, current_user: dict = Depends(get_current_user)):
    watchlist_collection.update_one(
        {"user_id": current_user["user_id"]},
        {"$pull": {"movie_ids": movie_id}}
    )
    return {"message": "Movie removed from watchlist"}

@app.get("/api/watchlist/get")
async def get_watchlist(current_user: dict = Depends(get_current_user)):
    watchlist = watchlist_collection.find_one({"user_id": current_user["user_id"]})
    
    if not watchlist:
        return {"movies": []}
    
    movie_ids = watchlist.get("movie_ids", [])
    movies = [m for m in MOCK_MOVIES if m["id"] in movie_ids]
    
    return {"movies": movies}

@app.get("/api/watchlist/check/{movie_id}")
async def check_watchlist(movie_id: str, current_user: dict = Depends(get_current_user)):
    watchlist = watchlist_collection.find_one({"user_id": current_user["user_id"]})
    
    if not watchlist:
        return {"in_watchlist": False}
    
    return {"in_watchlist": movie_id in watchlist.get("movie_ids", [])}

# User Profile Routes
@app.get("/api/user/profile/{user_id}")
async def get_user_profile(user_id: str):
    user = users_collection.find_one({"user_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    reviews = list(reviews_collection.find({"user_id": user_id}))
    
    return {
        "user_id": user["user_id"],
        "username": user["username"],
        "avatar": user.get("avatar", ""),
        "joined_date": user.get("created_at", ""),
        "total_reviews": len(reviews)
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)