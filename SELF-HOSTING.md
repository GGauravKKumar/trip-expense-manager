# Self-Hosting Guide - Fleet Manager

This guide explains how to run Fleet Manager **completely offline** on your own infrastructure using Docker.

## Quick Start (One Command)

```bash
# 1. Copy environment template
cp docker/.env.example .env

# 2. Edit .env with your secrets (IMPORTANT!)
nano .env  # or use any editor

# 3. Start all services
docker compose up -d
```

**Access Points:**
| Service | URL | Description |
|---------|-----|-------------|
| **App** | http://localhost:5173 | Fleet Manager Frontend |
| **API** | http://localhost:8000 | Supabase API Gateway |
| **Studio** | http://localhost:3000 | Database Admin UI |
| **Database** | localhost:5432 | PostgreSQL |

---

## Prerequisites

- **Docker & Docker Compose v2+** - [Install Docker](https://docs.docker.com/get-docker/)
- **4GB+ RAM** recommended for all services
- **10GB+ disk space** for Docker images and data

---

## Step-by-Step Setup

### Step 1: Get the Code

Download from Lovable:
- Go to **Project Settings → Export → Download ZIP**
- Or use GitHub integration

### Step 2: Configure Environment

```bash
# Copy the example environment file
cp docker/.env.example .env
```

Edit `.env` and set secure values:

```env
# REQUIRED: Change these for security!
POSTGRES_PASSWORD=your-super-secret-password-change-me
JWT_SECRET=your-super-secret-jwt-token-with-at-least-32-characters-long

# Keep these default for local development, or generate new ones for production
ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# URLs - update if not running on localhost
API_EXTERNAL_URL=http://localhost:8000
SITE_URL=http://localhost:5173
```

> **⚠️ Production:** Generate new API keys at [supabase.com/docs/guides/self-hosting#api-keys](https://supabase.com/docs/guides/self-hosting#api-keys)

### Step 3: Start Services

```bash
docker compose up -d
```

Wait for all services to be healthy:
```bash
docker compose ps
```

### Step 4: Create Admin User

Connect to the database and create your first admin:

```bash
# Option A: Using psql
docker exec -it fleet-db psql -U postgres -c \
  "SELECT create_user_with_role('admin@yourcompany.com', 'YourSecurePassword123', 'Admin Name', 'admin');"

# Option B: Using Studio
# 1. Go to http://localhost:3000
# 2. Navigate to SQL Editor
# 3. Run: SELECT create_user_with_role('admin@yourcompany.com', 'YourSecurePassword123', 'Admin Name', 'admin');
```

### Step 5: Login

1. Go to http://localhost:5173
2. Login with the admin credentials you created
3. Start managing your fleet!

---

## Creating Users

### Create Driver

```sql
SELECT create_user_with_role(
  'driver@example.com',      -- email
  'DriverPassword123',       -- password
  'Driver Name',             -- full name
  'driver',                  -- role
  '9876543210',             -- phone (optional)
  'DL1234567890',           -- license number (optional)
  '2025-12-31'::date        -- license expiry (optional)
);
```

### Create Repair Organization User

First create the organization, then the user:

```sql
-- Create organization
INSERT INTO repair_organizations (org_code, org_name, contact_person, phone, email)
VALUES ('REP001', 'ABC Repairs', 'John Manager', '9876543210', 'abc@repairs.com')
RETURNING id;

-- Create user (use the returned org id)
SELECT create_user_with_role(
  'repair@example.com',
  'RepairPassword123',
  'Repair User',
  'repair_org',
  NULL, NULL, NULL,
  'org-uuid-here'  -- repair_org_id from above
);
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Docker Network                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │ Frontend │    │   Kong   │    │   Auth   │    │   REST   │  │
│  │  :5173   │───▶│  :8000   │───▶│  :9999   │    │  :3001   │  │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│                        │                │              │         │
│                        │                └──────────────┼─────────┤
│                        │                               │         │
│                        ▼                               ▼         │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │  Studio  │    │ Realtime │    │ Storage  │    │ Postgres │  │
│  │  :3000   │    │  :4000   │    │  :5000   │    │  :5432   │  │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Services

| Service | Container | Port | Purpose |
|---------|-----------|------|---------|
| Frontend | fleet-frontend | 5173 | React app |
| Kong | fleet-kong | 8000 | API Gateway |
| Auth | fleet-auth | 9999 | Authentication (GoTrue) |
| REST | fleet-rest | 3001 | PostgREST API |
| Realtime | fleet-realtime | 4000 | WebSocket subscriptions |
| Storage | fleet-storage | 5000 | File storage |
| Database | fleet-db | 5432 | PostgreSQL |
| Studio | fleet-studio | 3000 | Admin UI |
| Meta | fleet-meta | - | DB metadata for Studio |

---

## Data Persistence

Data is stored in Docker volumes:
- `db-data` - PostgreSQL database
- `storage-data` - Uploaded files

### Backup Database

```bash
# Create backup
docker exec fleet-db pg_dump -U postgres postgres > backup.sql

# Restore backup
cat backup.sql | docker exec -i fleet-db psql -U postgres postgres
```

### Backup Everything

```bash
# Stop services first
docker compose stop

# Backup volumes
docker run --rm -v fleet-manager_db-data:/data -v $(pwd):/backup alpine tar czf /backup/db-backup.tar.gz /data
docker run --rm -v fleet-manager_storage-data:/data -v $(pwd):/backup alpine tar czf /backup/storage-backup.tar.gz /data

# Restart services
docker compose start
```

---

## Common Operations

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f frontend
docker compose logs -f auth
docker compose logs -f db
```

### Restart Services

```bash
# All services
docker compose restart

# Specific service
docker compose restart frontend
```

### Stop Everything

```bash
docker compose down
```

### Reset Database (⚠️ DELETES ALL DATA)

```bash
docker compose down -v
docker compose up -d
```

---

## Updating

```bash
# Pull latest code
git pull  # or download new ZIP

# Rebuild and restart
docker compose build frontend
docker compose up -d
```

---

## Network Configuration

### Running on LAN

Update `.env`:
```env
API_EXTERNAL_URL=http://192.168.1.100:8000
SITE_URL=http://192.168.1.100:5173
```

Then rebuild:
```bash
docker compose build frontend
docker compose up -d
```

### Custom Domain (Production)

1. Set up reverse proxy (nginx/traefik)
2. Configure SSL certificates
3. Update `.env`:
```env
API_EXTERNAL_URL=https://api.yourdomain.com
SITE_URL=https://fleet.yourdomain.com
```

---

## Troubleshooting

### Services Won't Start

```bash
# Check status
docker compose ps

# Check logs
docker compose logs db
docker compose logs auth
```

### Database Connection Issues

```bash
# Test database connection
docker exec -it fleet-db psql -U postgres -c "SELECT 1;"

# Check if init script ran
docker exec -it fleet-db psql -U postgres -c "SELECT COUNT(*) FROM indian_states;"
```

### Auth Not Working

```bash
# Check auth service logs
docker compose logs auth

# Verify JWT secret matches between services
docker compose config | grep JWT_SECRET
```

### Frontend Shows Blank Page

```bash
# Check frontend build
docker compose logs frontend

# Verify environment variables
docker exec fleet-frontend env | grep VITE
```

### Storage Upload Fails

```bash
# Check storage service
docker compose logs storage

# Verify buckets exist
docker exec -it fleet-db psql -U postgres -c "SELECT * FROM storage.buckets;"
```

---

## Production Checklist

- [ ] Change `POSTGRES_PASSWORD` to a strong password
- [ ] Change `JWT_SECRET` to a random 64+ character string
- [ ] Generate new `ANON_KEY` and `SERVICE_ROLE_KEY`
- [ ] Set up SSL/TLS (required for production)
- [ ] Configure proper backup strategy
- [ ] Set up monitoring and alerting
- [ ] Restrict network access (firewall rules)
- [ ] Enable SMTP for password reset emails

---

## Support

For issues specific to this Fleet Manager application, check the project repository.

For Supabase self-hosting issues, see:
- [Supabase Self-Hosting Docs](https://supabase.com/docs/guides/self-hosting)
- [Supabase GitHub](https://github.com/supabase/supabase)
