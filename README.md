# 🎬 Critisizer - Movie Review Platform

**Critisizer** is a full-stack movie review platform that combines Netflix's sleek UI with IMDB/Rotten Tomatoes functionality. Built with React, FastAPI, and MongoDB.

## ✨ Features

### Core Features
- 🔐 **User Authentication** - Signup/Login with JWT tokens
- 🎥 **Browse Movies** - Discover trending movies with beautiful UI
- ⭐ **Parameter-Based Reviews** - Unique rating system with categories:
  - 🎭 **Absolute Cinema** (Masterpiece - 10/10)
  - ⭐ **Peak** (Outstanding - 9/10)
  - 🌟 **Excellent** (Great - 8/10)
  - 👍 **Good** (Enjoyable - 7/10)
  - ✓ **Go for it** (Worth watching - 6/10)
  - 👎 **Not my type** (Not recommended - 5/10)
- 📝 **Write Reviews** - Share your thoughts on movies
- 📚 **Personal Watchlist** - Save movies to watch later
- 👤 **User Profiles** - View your reviews and activity
- 🎨 **Netflix-Inspired UI** - Dark theme with smooth animations

## 🛠️ Tech Stack

### Frontend
- **React** 18.2.0
- **React Router** 6.20.0
- **Tailwind CSS** 3.3.5
- **Axios** for API calls
- **React Icons**

### Backend
- **FastAPI** (Python)
- **MongoDB** for database
- **JWT** authentication
- **Bcrypt** password hashing
- **TMDB API** integration (mock data currently)

## 📁 Project Structure

```
/app/
├── backend/
│   ├── server.py          # Main FastAPI application
│   ├── requirements.txt   # Python dependencies
│   └── .env              # Backend environment variables
├── frontend/
│   ├── src/
│   │   ├── components/   # React components
│   │   │   ├── Navbar.js
│   │   │   ├── AuthModal.js
│   │   │   └── MovieCard.js
│   │   ├── pages/        # Page components
│   │   │   ├── Home.js
│   │   │   ├── MovieDetails.js
│   │   │   ├── Watchlist.js
│   │   │   └── Profile.js
│   │   ├── App.js
│   │   ├── index.js
│   │   └── index.css
│   ├── package.json
│   ├── tailwind.config.js
│   └── .env              # Frontend environment variables
└── README.md
```

## 🚀 Getting Started

### Prerequisites
- Python 3.8+
- Node.js 14+
- MongoDB
- Yarn package manager

### Installation

The application is already set up and running! Services are managed by Supervisor:

```bash
# Check service status
sudo supervisorctl status

# Restart services
sudo supervisorctl restart all

# View logs
tail -f /var/log/supervisor/backend.err.log
tail -f /var/log/supervisor/frontend.err.log
```

## 🌐 API Endpoints

### Authentication
- `POST /api/auth/signup` - Create new account
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Movies
- `GET /api/movies/trending` - Get trending movies
- `GET /api/movies/search?query=` - Search movies
- `GET /api/movies/{id}` - Get movie details with reviews

### Reviews
- `POST /api/reviews/create` - Create a review
- `GET /api/reviews/user/{user_id}` - Get user's reviews

### Watchlist
- `POST /api/watchlist/add` - Add movie to watchlist
- `DELETE /api/watchlist/remove/{movie_id}` - Remove from watchlist
- `GET /api/watchlist/get` - Get user's watchlist
- `GET /api/watchlist/check/{movie_id}` - Check if movie is in watchlist

### User
- `GET /api/user/profile/{user_id}` - Get user profile

## 🎨 UI Features

- **Responsive Design** - Works on desktop, tablet, and mobile
- **Dark Theme** - Netflix-inspired dark aesthetic
- **Smooth Animations** - Hover effects and transitions
- **Interactive Carousels** - Scrollable movie lists
- **Modal Authentication** - Clean signup/login experience
- **Rating Distribution** - Visual representation of reviews

## 🔧 Configuration

### Environment Variables

**Backend** (`/app/backend/.env`):
```env
MONGO_URL=mongodb://localhost:27017/
SECRET_KEY=your-secret-key-change-in-production
TMDB_API_KEY=mock-will-add-later
```

**Frontend** (`/app/frontend/.env`):
```env
REACT_APP_BACKEND_URL=http://localhost:8001
```

## 📊 Mock Data

Currently using mock data for 8 popular movies:
1. The Shawshank Redemption
2. The Dark Knight
3. Inception
4. Pulp Fiction
5. Forrest Gump
6. The Matrix
7. Interstellar
8. Parasite

## 🔜 TMDB API Integration

To integrate real TMDB data:

1. Get API key from https://www.themoviedb.org/settings/api
2. Update `/app/backend/.env`:
   ```env
   TMDB_API_KEY=your-actual-api-key
   ```
3. Update the backend code to use TMDB API instead of mock data
4. Restart backend: `sudo supervisorctl restart backend`

## 🧪 Testing

### Test Authentication
```bash
# Signup
curl -X POST http://localhost:8001/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","username":"newuser","password":"pass123"}'

# Login
curl -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"pass123"}'
```

### Test Movies
```bash
# Get trending movies
curl http://localhost:8001/api/movies/trending

# Get movie details
curl http://localhost:8001/api/movies/1
```

## 🎯 Next Steps

1. **Integrate TMDB API** - Replace mock data with real movie data
2. **Search Functionality** - Add search feature on frontend
3. **Advanced Filters** - Filter by genre, year, rating
4. **Social Features** - Follow users, like reviews
5. **Recommendations** - AI-powered movie recommendations
6. **Email Notifications** - Notify users of new reviews
7. **Admin Panel** - Manage users and content

## 📝 License

This project is open-source and available under the MIT License.

## 🙏 Acknowledgments

- TMDB for movie data
- Netflix for UI inspiration
- React and FastAPI communities

---

**Built with ❤️ for movie lovers**
