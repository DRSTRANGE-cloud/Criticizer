# 🎬 Criticizer

Criticizer is an AI-powered entertainment platform that helps users discover movies and TV shows, share reviews, build watchlists, participate in discussions, and receive personalized recommendations through an intelligent movie assistant.

Designed with a modern cinematic experience in mind, Criticizer combines content discovery, community interaction, and AI-driven insights into a single platform.

---

## ✨ Features

### 🎥 Content Discovery

* Discover trending movies and TV shows
* Explore Hollywood, Bollywood, Anime, and Animated content
* Smart search with real-time suggestions
* Personalized recommendations based on user preferences

### ⭐ Reviews & Ratings

* Rate movies using the Criticizer Meter
* Write and manage reviews
* Like and engage with community reviews
* Participate in movie discussions

### 📚 Personal Collections

* Watchlist
* Watched Collection
* Watch Later Collection
* Personalized profile dashboard

### 🤖 Critics Talk AI

* AI-powered movie assistant
* Personalized movie recommendations
* Mood-based suggestions
* Movie comparisons and explanations
* Content discovery assistance

### 🔐 Authentication & Security

* JWT Authentication
* Secure password hashing
* Protected routes
* Google OAuth Login
* GitHub OAuth Login

### 📱 Modern User Experience

* Responsive design for desktop, tablet, and mobile
* Framer Motion animations
* Smooth page transitions
* Optimized loading experience
* Cinematic dark theme

---

## 🛠️ Tech Stack

### Frontend

* React.js
* Tailwind CSS
* React Router
* Axios
* Framer Motion

### Backend

* FastAPI
* MongoDB
* JWT Authentication
* Pydantic

### External Services

* TMDB API
* Groq AI API
* Google OAuth
* GitHub OAuth

---

## 🚀 Local Development Setup

### 1. Clone the Repository

```bash
git clone https://github.com/DRSTRANGE-cloud/Criticizer.git
cd Criticizer
```

## Backend Setup

### 2. Navigate to Backend

```bash
cd backend
```

### 3. Create Virtual Environment

```bash
python -m venv .venv
```

### 4. Activate Virtual Environment

#### Windows PowerShell

```bash
.\.venv\Scripts\Activate.ps1
```

### 5. Install Dependencies

```bash
pip install -r requirements.txt
```

### 6. Create Backend Environment Variables

Create:

```text
backend/.env
```

Add:

```env
MONGO_URL=your_mongodb_connection_string
TMDB_API_KEY=your_tmdb_api_key
GROQ_API_KEY=your_groq_api_key
SECRET_KEY=your_jwt_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
```

### 7. Run Backend Server

```bash
python -m uvicorn server:app --reload --port 8000
```
Backend:

```text
http://localhost:8000
```

## Frontend Setup

Open a new terminal.

### 8. Navigate to Frontend

```bash
cd frontend
```

### 9. Install Dependencies

```bash
npm install
```

### 10. Create Frontend Environment Variables

Create:

```text
frontend/.env
```

Add:

```env
REACT_APP_BACKEND_URL=http://localhost:8001
REACT_APP_GOOGLE_CLIENT_ID=your_google_client_id
REACT_APP_GITHUB_CLIENT_ID=your_github_client_id
REACT_APP_GITHUB_REDIRECT_URI=http://localhost:3000/auth/github/callback
```

### 11. Start Frontend

```bash
npm start
```

Frontend:

```text
http://localhost:3000
```

---

## 🌐 APIs & Services

* TMDB API
* Groq AI API
* Google OAuth
* GitHub OAuth

---

## ⚡ Performance Optimizations

* Lazy loading
* Async API requests
* TMDB caching
* Optimized MongoDB queries
* Route-based code splitting
* Responsive image loading

---

## 👨‍💻 Author

**Deepak Yadav**

Movies & Anime Lover😍

---

## 📄 License

This project is licensed under the MIT License.

---

### Built for movie lovers, reviewers, and entertainment enthusiasts who want more than just another streaming guide.
