# 🎬 Criticizer

Criticizer is a modern entertainment platform for movie and series lovers.  
Discover trending movies, explore anime and TV shows, create watchlists, rate films, write reviews, and chat with an AI movie assistant — all inside a smooth cinematic experience.

---

# ✨ Features

- 🎥 Discover trending movies & series
- ⭐ Rate movies using the Criticizer Meter
- 📝 Write reviews and reactions
- 🤖 AI movie recommendation chatbot
- 📚 Watchlist, Watched & Watch Later system
- 🔎 Smart search with live suggestions
- 🎭 Explore Anime, Hollywood & Bollywood sections
- 👤 Personalized user profiles
- 💬 Comment and discussion system
- 📱 Fully responsive modern UI
- 🌙 Dark cinematic theme with smooth animations

---

# ⭐ Criticizer Meter

| Rating | Meaning |
|---|---|
| ⭐ 1 | Waste of Time |
| ⭐⭐ 2 | Check That Out Once |
| ⭐⭐⭐ 3 | Kinda Liked It |
| ⭐⭐⭐⭐ 4 | It's Peak |
| ⭐⭐⭐⭐⭐ 5 | Absolute Cinema |

---

# 🛠️ Tech Stack

## Frontend
- React
- Tailwind CSS
- React Router
- Axios
- Framer Motion

## Backend
- FastAPI
- MongoDB
- JWT Authentication
- TMDB API
- Groq AI API

---

# 📂 Project Structure

```bash
Criticizer/
│
├── backend/
│   ├── server.py
│   ├── requirements.txt
│   └── .env
│
├── frontend/
│   ├── src/
│   ├── package.json
│   └── .env
│
└── README.md
```

---

# 🚀 Local Setup

## 1️⃣ Clone Repository

```bash
git clone https://github.com/DRSTRANGE-cloud/Criticizer.git
cd Criticizer
```

---

# 2️⃣ Backend Setup

```powershell
cd backend

python -m venv .venv

.\.venv\Scripts\Activate.ps1

pip install -r requirements.txt
```

---

# 3️⃣ Create Backend `.env`

Inside:

```bash
backend/.env
```

Add:

```env
MONGO_URL=mongodb://localhost:27017/
SECRET_KEY=your_secret_key
TMDB_API_KEY=your_tmdb_api_key
GROQ_API_KEY=your_groq_api_key
```

---

# 4️⃣ Start Backend

```bash
python -m uvicorn server:app --reload --port 8001
```

Backend runs on:

```bash
http://localhost:8001
```

---

# 5️⃣ Frontend Setup

Open a new terminal:

```powershell
cd frontend

npm install
```

---

# 6️⃣ Create Frontend `.env`

Inside:

```bash
frontend/.env
```

Add:

```env
REACT_APP_BACKEND_URL=http://localhost:8001
```

---

# 7️⃣ Start Frontend

```bash
npm start
```

Frontend runs on:

```bash
http://localhost:3000
```

---

# 🎬 Main Sections

- 🔥 Trending
- 🎞️ Popular Movies
- 📺 TV Shows
- 🇮🇳 Bollywood
- 🌎 Hollywood
- 🍥 Anime
- 👶 Animated / Kids Movies
- ❤️ Personalized Picks

---

# 🤖 Criticizer AI

The built-in AI assistant can:

- recommend movies
- suggest anime
- explain endings
- compare movies
- detect mood-based preferences
- help users discover content faster

---

# 🌐 APIs Used

- TMDB API
- Groq AI API

---

# 🔐 Authentication

- JWT-based login system
- Secure password hashing
- Protected user routes

---

# 📱 Responsive Design

Criticizer is optimized for:
- Desktop
- Tablet
- Mobile devices

---

# ⚡ Performance Features

- Lazy loading
- Async API requests
- Cached movie data
- Optimized database queries
- Smooth page transitions

---

# 👨‍💻 Author

### Deepak Yadav

Passionate full-stack developer focused on AI-powered products and scalable web applications.

---

# 📜 License

This project is licensed under the MIT License.

---

# 🎥 Built For Entertainment Lovers

Criticizer is designed for people who love Movies, Animated Movies, TV Shows, and Cinematic discussions in one modern platform.