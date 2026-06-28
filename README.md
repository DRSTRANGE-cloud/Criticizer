<div align="center">

# 🎬 Criticizer

**Discover. Review. Discuss. Powered by AI.**

An intelligent full-stack entertainment platform where movie lovers discover films, share reviews, build watchlists, and get AI-driven recommendations — wrapped in a cinematic dark-themed experience.

<br/>

[![Live Demo](https://img.shields.io/badge/Live%20Demo-criticizer.vercel.app-dc2626?style=for-the-badge&logo=vercel&logoColor=white)](https://criticizer.vercel.app)
[![Backend](https://img.shields.io/badge/API-Render-22c55e?style=for-the-badge&logo=render&logoColor=white)](https://criticizer.onrender.com/api/health)
[![License](https://img.shields.io/badge/License-MIT-a855f7?style=for-the-badge)](LICENSE)

<br/>

![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=flat-square&logo=mongodb&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white)

</div>

---

## 🎯 Overview

Criticizer is a full-stack AI-powered movie platform built with **React** and **FastAPI**. It combines content discovery, community reviews, and a conversational AI assistant into one cohesive cinematic experience.

Users can search movies, rate them with the **Criticizer Meter**, build personal watchlists, engage in community discussions, and receive personalized recommendations — all through a responsive, animation-rich interface with Google and GitHub OAuth.

---

## ✨ Features

| Category | Highlights |
|----------|-----------|
| 🔍 **Discovery** | Trending movies & TV, Hollywood, Bollywood, Anime categories, real-time search |
| ⭐ **Reviews** | 5-tier Criticizer Meter, community reviews, nested comments, likes |
| 📊 **Insights** | Community Pulse donut chart, Genre Vibe pie chart, Top Review highlight |
| 📚 **Collections** | Watchlist, Watched, personal profile dashboard, Criticizer Wrapped |
| 🤖 **AI Assistant** | Groq-powered Critics Talk — mood-based picks, comparisons, recommendations |
| 🔐 **Auth** | JWT sessions, bcrypt hashing, Google OAuth, GitHub OAuth popup flow |
| 🎨 **UI** | Cinematic dark theme, Framer Motion animations, double-row cast slider, fully responsive |

---

## 🛠️ Tech Stack

### Frontend
| Technology | Role |
|------------|------|
| React 18 | UI framework with lazy loading & Suspense |
| Tailwind CSS | Utility-first styling |
| Framer Motion | Page transitions & micro-animations |
| Axios | HTTP client with JWT interceptor |
| React Router v6 | Client-side routing |
| Recharts | Rating & genre visualizations |

### Backend
| Technology | Role |
|------------|------|
| FastAPI | Async REST API |
| MongoDB Atlas | Cloud database |
| JWT + bcrypt | Auth & password security |
| httpx | Async HTTP for OAuth & external APIs |
| Pydantic v2 | Request/response validation |

### Services & Deployment
| Service | Purpose |
|---------|---------|
| TMDB API | Movie data, cast, trailers |
| Groq API (LLaMA 3) | AI assistant & recommendations |
| Google & GitHub OAuth | Social login |
| Vercel | Frontend hosting |
| Render | Backend hosting |
| MongoDB Atlas | Production database |

---

## 🏗️ Architecture

```
┌──────────────────────────────────────┐
│         Vercel  ·  React 18          │
│  JWT localStorage · OAuth popups     │
│  Axios interceptor · React Router    │
└─────────────────┬────────────────────┘
                  │ HTTPS
┌─────────────────▼────────────────────┐
│         Render  ·  FastAPI           │
│  /api/auth  /api/movies  /api/ai     │
│  /api/reviews  /api/watchlist        │
│  /api/comments  /api/discussions     │
└──────────┬───────────────┬───────────┘
           │               │
┌──────────▼──────┐ ┌──────▼──────────┐
│  MongoDB Atlas  │ │  External APIs   │
│  users          │ │  TMDB            │
│  reviews        │ │  Groq AI         │
│  watchlist      │ │  Google OAuth    │
│  comments       │ │  GitHub OAuth    │
│  chat_history   │ └─────────────────┘
│  ai_profiles    │
└─────────────────┘
```

---

## 🚀 Local Development

### Prerequisites
- Python 3.11+ and Node.js 18+
- [TMDB API key](https://www.themoviedb.org/settings/api)
- [Groq API key](https://console.groq.com)
- MongoDB running locally or an Atlas URI

### Setup

```bash
# 1. Clone
git clone https://github.com/DRSTRANGE-cloud/Criticizer.git
cd Criticizer

# 2. Backend
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1   # Windows
# source .venv/bin/activate    # macOS/Linux
pip install -r requirements.txt

# 3. Frontend
cd ../frontend
npm install
```

### Environment Variables

**`backend/.env`**
```env
MONGO_URL=mongodb://localhost:27017/
MONGO_DB_NAME=criticizer
SECRET_KEY=your_jwt_secret
TMDB_API_KEY=your_tmdb_key
GROQ_API_KEY=your_groq_key
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
CORS_ALLOW_ORIGINS=http://localhost:3000
```

**`frontend/.env`**
```env
REACT_APP_BACKEND_URL=http://localhost:8000
REACT_APP_GOOGLE_CLIENT_ID=your_google_client_id
REACT_APP_GITHUB_CLIENT_ID=your_github_client_id
REACT_APP_GITHUB_REDIRECT_URI=http://localhost:3000/auth/github/callback
```

### Run

```bash
# Terminal 1 — Backend
cd backend
python -m uvicorn server:app --reload --host 127.0.0.1 --port 8000

# Terminal 2 — Frontend
cd frontend
npm start
```

| | URL |
|-|-----|
| Frontend | http://localhost:3000 |
| Backend | http://localhost:8000 |
| Health | http://localhost:8000/api/health |

---

## 📁 Project Structure

```
Criticizer/
├── backend/
│   ├── app/
│   │   ├── config.py          # Settings & env loading
│   │   ├── db.py              # MongoDB collections & indexes
│   │   ├── main.py            # FastAPI app, CORS, routers
│   │   ├── routes/
│   │   │   ├── auth.py        # Signup, login, Google & GitHub OAuth
│   │   │   ├── movies.py      # TMDB proxy & caching
│   │   │   ├── reviews.py     # Review CRUD & likes
│   │   │   ├── watchlist.py   # User collections
│   │   │   ├── comments.py    # Nested comment threads
│   │   │   ├── discussions.py # Community discussions
│   │   │   └── ai.py          # Groq AI assistant
│   │   └── services/
│   │       ├── tmdb.py        # TMDB integration
│   │       ├── recommendations.py
│   │       └── ai_chat/       # AI assistant logic
│   └── server.py
│
└── frontend/
    └── src/
        ├── App.js             # Router, OAuth bridge, auth state
        ├── pages/
        │   ├── Home.js        # Discovery feed
        │   ├── MovieDetails.js # Movie page, cast slider, reviews
        │   ├── Watchlist.js
        │   ├── Profile.js
        │   └── Wrapped.js     # Yearly stats
        ├── components/
        │   ├── AuthModal.js   # Login, signup, OAuth buttons
        │   ├── MovieCard.js
        │   └── chatbot.js     # AI assistant widget
        └── services/
            └── api.js         # Axios instance & JWT interceptor
```

---

## 👨‍💻 Author

**Deepak Yadav** — Full-Stack Developer & Computer Engineering Student

[![GitHub](https://img.shields.io/badge/GitHub-DRSTRANGE--cloud-181717?style=flat-square&logo=github&logoColor=white)](https://github.com/DRSTRANGE-cloud)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-deepakyadav100-0A66C2?style=flat-square&logo=linkedin&logoColor=white)](https://linkedin.com/in/deepakyadav100)

---

## 📄 License

Licensed under the [MIT License](LICENSE).

---

<div align="center">

*Built for movie lovers who want more than just another streaming guide.*

⭐ **Star this repo if you found it useful!**

</div>