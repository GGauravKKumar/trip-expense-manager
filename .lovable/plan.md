## Python Backend + PostgreSQL for Raspberry Pi 4B (2GB)

### Status: ✅ IMPLEMENTED

### Overview

This implementation replaces the Supabase stack (6 containers, ~736MB) with a lightweight Python API + PostgreSQL setup (2 containers, ~300MB).

### Files Created

#### Backend (Python FastAPI)
- `backend/requirements.txt` - Dependencies
- `backend/main.py` - FastAPI application entry point
- `backend/database.py` - SQLAlchemy database connection
- `backend/models.py` - All SQLAlchemy models
- `backend/auth.py` - JWT authentication
- `backend/Dockerfile` - Container build
- `backend/routes/__init__.py` - Route exports
- `backend/routes/auth.py` - Login/signup/password endpoints
- `backend/routes/buses.py` - Bus CRUD
- `backend/routes/routes.py` - Route CRUD
- `backend/routes/trips.py` - Trip CRUD
- `backend/routes/expenses.py` - Expense CRUD
- `backend/routes/drivers.py` - Driver management
- `backend/routes/schedules.py` - Schedule CRUD
- `backend/routes/stock.py` - Stock management
- `backend/routes/invoices.py` - Invoice CRUD
- `backend/routes/repairs.py` - Repair records
- `backend/routes/uploads.py` - File handling
- `backend/routes/settings.py` - Admin settings
- `backend/routes/states.py` - Indian states
- `backend/routes/notifications.py` - Notifications

#### Docker Configuration
- `docker-compose.python.yml` - Python + PostgreSQL stack
- `Dockerfile.frontend` - Frontend build for offline mode
- `docker/.env.python.example` - Environment template

#### Frontend Integration
- `src/lib/api-client.ts` - REST API client (replaces Supabase client)
- `src/lib/api-hooks.ts` - React Query hooks for all entities
- `src/hooks/useAuthOffline.tsx` - Auth hook supporting both modes

### Deployment

```bash
# Start the stack
docker compose -f docker-compose.python.yml up -d

# Create admin user
docker exec -it busmanager-db psql -U postgres -c "SELECT create_user_with_role('admin@example.com', 'admin123', 'Admin User', 'admin');"
```

### Memory Usage

| Service | Limit | Reservation |
|---------|-------|-------------|
| PostgreSQL | 150MB | 100MB |
| Python API | 100MB | 50MB |
| Frontend | 50MB | 25MB |
| **Total** | **300MB** | **175MB** |

