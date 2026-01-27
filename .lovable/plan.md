

## Python Backend + PostgreSQL for Raspberry Pi 4B (2GB)

### Overview

This plan replaces the heavy Supabase stack (6 containers, ~736MB) with a lightweight Python API + PostgreSQL setup (2 containers, ~300MB), keeping your React frontend unchanged.

### Architecture Comparison

**Current (Supabase Stack):**
```text
┌─────────────────────────────────────────────────┐
│  6 Containers (~736MB RAM)                      │
├─────────────────────────────────────────────────┤
│  PostgreSQL → GoTrue → PostgREST → Kong → Storage → Frontend │
└─────────────────────────────────────────────────┘
```

**Proposed (Python Stack):**
```text
┌─────────────────────────────────────────────────┐
│  2 Containers (~300MB RAM)                      │
├─────────────────────────────────────────────────┤
│  PostgreSQL (150MB) → Python API (100MB) → Frontend (50MB)   │
└─────────────────────────────────────────────────┘
```

### Key Benefits

| Aspect | Supabase Stack | Python Stack |
|--------|---------------|--------------|
| RAM Usage | ~736MB | ~300MB |
| Containers | 6 | 2-3 |
| Complexity | High | Low |
| File Storage | Supabase Storage | Local filesystem |
| Maintenance | Multiple services | Single API |

---

### Implementation Steps

#### Step 1: Create Python FastAPI Backend

Create a new `backend/` directory with:

**Files to create:**
- `backend/requirements.txt` - Dependencies (FastAPI, SQLAlchemy, python-jose, bcrypt)
- `backend/main.py` - API entry point with all routes
- `backend/database.py` - Database connection
- `backend/models.py` - SQLAlchemy models
- `backend/auth.py` - JWT authentication (replaces GoTrue)
- `backend/routes/` - API endpoints for each table
- `backend/Dockerfile` - Container build

**API Endpoints Required:**

| Category | Endpoints |
|----------|-----------|
| Auth | `POST /auth/login`, `POST /auth/signup`, `GET /auth/me` |
| Trips | `GET/POST/PUT /trips` |
| Buses | `GET/POST/PUT /buses` |
| Routes | `GET/POST/PUT /routes` |
| Expenses | `GET/POST/PUT /expenses` |
| Drivers | `GET /profiles`, `POST /drivers` |
| Schedules | `GET/POST/PUT /schedules` |
| Stock | `GET/POST/PUT /stock` |
| Invoices | `GET/POST/PUT /invoices` |
| Repairs | `GET/POST/PUT /repairs` |
| Upload | `POST /upload/expense`, `POST /upload/repair` |

#### Step 2: Create Docker Compose for Pi

**File: `docker-compose.python.yml`**

```text
┌────────────────────────────────────────────────┐
│  Service Configuration                          │
├────────────────────────────────────────────────┤
│  PostgreSQL: 150MB limit                       │
│  Python API: 100MB limit                       │
│  Frontend:   50MB limit (optional, can run     │
│              directly in browser)              │
└────────────────────────────────────────────────┘
```

#### Step 3: Create API Client for Frontend

**File: `src/lib/api-client.ts`**

Replace Supabase client with a custom API client that:
- Handles JWT token storage
- Makes REST calls to Python backend
- Manages file uploads
- Provides same interface as Supabase client

#### Step 4: Update Auth Hook

**File: `src/hooks/useAuth.tsx`**

Modify to use Python API endpoints instead of Supabase auth:
- Login via `POST /auth/login`
- Signup via `POST /auth/signup`
- Session via `GET /auth/me` with stored JWT

#### Step 5: Create Data Hooks

**File: `src/hooks/useApi.ts`**

Create a React Query-based hook that replaces Supabase queries:

```typescript
// Before (Supabase)
const { data } = await supabase.from('trips').select('*');

// After (Python API)
const { data } = await api.get('/trips');
```

#### Step 6: Update All Data-Fetching Components

**Files to modify:**
- All pages in `src/pages/admin/`
- All pages in `src/pages/driver/`
- `src/pages/repair/RepairDashboard.tsx`
- Components using `supabase.storage`

---

### Technical Details

#### Python API Structure

```text
backend/
├── main.py                 # FastAPI app
├── database.py             # SQLAlchemy connection
├── models.py               # All table models
├── auth.py                 # JWT auth logic
├── requirements.txt        # Dependencies
├── Dockerfile              # Container build
└── routes/
    ├── auth.py            # Login/signup
    ├── trips.py           # Trip CRUD
    ├── buses.py           # Bus CRUD
    ├── routes.py          # Route CRUD
    ├── expenses.py        # Expense CRUD
    ├── drivers.py         # Driver management
    ├── schedules.py       # Schedule CRUD
    ├── stock.py           # Stock management
    ├── invoices.py        # Invoice CRUD
    ├── repairs.py         # Repair records
    └── uploads.py         # File handling
```

#### Database Schema

Uses the same PostgreSQL schema from `docker/init-db.sql`, but without Supabase-specific features like RLS (role-based access handled in Python instead).

#### File Storage

Files stored in `/app/uploads/` directory mounted as Docker volume:
- `/app/uploads/expenses/` - Expense documents
- `/app/uploads/repairs/` - Repair photos

#### Authentication Flow

```text
1. User submits login form
2. Python API validates credentials against users table
3. API returns JWT token (valid 24h)
4. Frontend stores token in localStorage
5. All subsequent requests include Bearer token
6. Python API validates token on each request
```

#### Memory Budget for 2GB Pi

```text
┌─────────────────────────────────────────────────┐
│  Available RAM after OS: ~1.3GB                 │
├─────────────────────────────────────────────────┤
│  PostgreSQL:    150MB (hard limit)              │
│  Python API:    100MB (hard limit)              │
│  Reserved:      100MB (for Node.js project)     │
│  Free:          ~950MB                          │
└─────────────────────────────────────────────────┘
```

---

### Migration Path

| Phase | Description | Effort |
|-------|-------------|--------|
| 1 | Create Python API with all endpoints | 2-3 days |
| 2 | Create API client for frontend | 1 day |
| 3 | Update useAuth hook | 0.5 day |
| 4 | Update all admin pages | 1-2 days |
| 5 | Update driver/repair pages | 1 day |
| 6 | Testing and fixes | 1 day |

**Total estimated effort: 6-8 days**

---

### Alternative: Keep Supabase (Lighter)

If the Python rewrite is too much, I can also create a **minimal Supabase config** that:
- Removes Kong (API gateway) - frontend talks directly to PostgREST
- Removes Auth (use direct PostgreSQL for login)
- Keeps only: PostgreSQL + PostgREST + Frontend

This would reduce to ~400MB but requires frontend changes for auth.

---

### Recommendation

For your 2GB Pi running another Node.js project:

**Go with Python API** - It's cleaner, more maintainable, and uses significantly less RAM. The trade-off is development time, but you get a simpler, faster system that's easier to debug and extend.

