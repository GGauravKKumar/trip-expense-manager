# BusManager - Local Development Setup (No Docker)

Quick guide to run BusManager locally with Python backend + PostgreSQL.

## Prerequisites

- Python 3.11+
- PostgreSQL 15+
- Node.js 18+ / Bun

---

## 1. Database Setup

```bash
# Create database
createdb busmanager

# Initialize schema (from project root)
psql -d busmanager -f docker/init-db-python.sql
```

---

## 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate   # Windows

# Install dependencies
pip install -r requirements.txt

# Create .env from template
cp .env.example .env

# Edit .env with your database credentials
nano .env
```

**Required `.env` values:**
```
POSTGRES_PASSWORD=your-actual-password
POSTGRES_HOST=localhost
POSTGRES_DB=busmanager
JWT_SECRET=change-this-to-a-random-32-char-string
```

```bash
# Start the API
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Test: http://localhost:8000/docs

---

## 3. Frontend Setup

```bash
# From project root
cp .env.example .env

# Ensure it contains:
# VITE_API_URL=http://localhost:8000

# Install dependencies
npm install
# or: bun install

# Start dev server
npm run dev
# or: bun dev
```

Access: http://localhost:8080

---

## 4. Create Admin User

```bash
psql -d busmanager -c \
  "SELECT create_user_with_role('admin@example.com', 'your-password', 'Admin Name', 'admin');"
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `could not translate host name "db"` | Set `POSTGRES_HOST=localhost` in backend/.env |
| `password authentication failed` | Check `POSTGRES_PASSWORD` matches your DB |
| `relation does not exist` | Run `psql -d busmanager -f docker/init-db-python.sql` |
| Frontend shows Cloud errors | Ensure `VITE_API_URL` is set, restart dev server |

---

## File Structure

```
project-root/
├── .env                 # Frontend env (VITE_API_URL)
├── backend/
│   ├── .env             # Backend env (DB + JWT)
│   └── main.py
└── docker/
    └── init-db-python.sql  # DB schema
```
