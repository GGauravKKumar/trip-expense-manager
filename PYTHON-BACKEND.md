# BusManager - Python Backend Self-Hosting Guide

This guide covers deploying BusManager with the lightweight Python + PostgreSQL backend, ideal for Raspberry Pi or other resource-constrained environments.

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│  2-3 Containers (~300MB Total RAM)                  │
├─────────────────────────────────────────────────────┤
│  PostgreSQL (150MB) → Python API (100MB) → Frontend │
└─────────────────────────────────────────────────────┘
```

## Requirements

- **Hardware**: Raspberry Pi 4B (2GB+), x86 Linux, or any Docker-capable system
- **Software**: Docker Engine 20.10+, Docker Compose v2+
- **Storage**: 2GB+ for containers and data
- **Swap**: 2GB recommended for stability

## Quick Start

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd busmanager
```

### 2. Create environment file

```bash
cp docker/.env.local .env
```

Edit `.env` with your settings:

```bash
# Required: Change these!
POSTGRES_PASSWORD=your-secure-database-password
JWT_SECRET=your-super-secret-jwt-token-with-at-least-32-characters

# Optional: For LAN access, set your Pi's IP
API_URL=http://192.168.1.100:8000
```

### 3. Start the stack

```bash
docker compose -f docker-compose.python.yml up -d
```

### 4. Create admin user

```bash
docker exec -it busmanager-db psql -U postgres -c \
  "SELECT create_user_with_role('admin@example.com', 'YourSecurePassword123', 'Admin User', 'admin');"
```

### 5. Access the application

- **Frontend**: http://localhost:5173 (or your Pi's IP)
- **API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

## Configuration Options

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_USER` | postgres | Database username |
| `POSTGRES_PASSWORD` | (required) | Database password |
| `POSTGRES_DB` | postgres | Database name |
| `JWT_SECRET` | (required) | Secret for JWT tokens (32+ chars) |
| `API_URL` | http://localhost:8000 | API URL for frontend |

### Memory Limits

The default configuration is optimized for 2GB RAM systems:

| Service | Memory Limit | Reservation |
|---------|--------------|-------------|
| PostgreSQL | 150MB | 100MB |
| Python API | 100MB | 50MB |
| Frontend | 50MB | 25MB |

For systems with more RAM, adjust limits in `docker-compose.python.yml`.

## User Management

### Create Users via SQL

```bash
# Admin user
docker exec -it busmanager-db psql -U postgres -c \
  "SELECT create_user_with_role('admin@example.com', 'password', 'Admin Name', 'admin');"

# Driver user
docker exec -it busmanager-db psql -U postgres -c \
  "SELECT create_user_with_role('driver@example.com', 'password', 'Driver Name', 'driver', '9876543210', 'DL-1234567890', '2025-12-31');"

# Repair organization user
docker exec -it busmanager-db psql -U postgres -c \
  "SELECT create_user_with_role('repair@example.com', 'password', 'Repair User', 'repair_org', NULL, NULL, NULL, 'org-uuid-here');"
```

### User Roles

- **admin**: Full access to all features
- **driver**: Can manage their trips and expenses
- **repair_org**: Can submit repair records for their organization

## Data Persistence

Data is stored in Docker volumes:

- `db-data`: PostgreSQL database files
- `uploads-data`: Uploaded expense documents and repair photos

### Backup

```bash
# Backup database
docker exec busmanager-db pg_dump -U postgres postgres > backup.sql

# Backup uploads
docker cp busmanager-api:/app/uploads ./uploads-backup
```

### Restore

```bash
# Restore database
cat backup.sql | docker exec -i busmanager-db psql -U postgres postgres

# Restore uploads
docker cp ./uploads-backup/. busmanager-api:/app/uploads/
```

## Network Access

### LAN Access

1. Find your Pi's IP: `hostname -I`
2. Update `.env`:
   ```
   API_URL=http://192.168.1.100:8000
   ```
3. Rebuild frontend:
   ```bash
   docker compose -f docker-compose.python.yml up -d --build frontend
   ```
4. Access from other devices: `http://192.168.1.100:5173`

### Port Configuration

| Service | Default Port | Purpose |
|---------|--------------|---------|
| Frontend | 5173 | Web interface |
| API | 8000 | REST API |
| PostgreSQL | 5432 | Database (internal) |

## Monitoring

### View logs

```bash
# All services
docker compose -f docker-compose.python.yml logs -f

# Specific service
docker logs -f busmanager-api
```

### Check resource usage

```bash
docker stats
```

### Health check

```bash
curl http://localhost:8000/health
# Expected: {"status":"healthy"}
```

## Updating

```bash
# Pull latest code
git pull

# Rebuild and restart
docker compose -f docker-compose.python.yml up -d --build
```

## Troubleshooting

### API won't start

1. Check if database is healthy:
   ```bash
   docker logs busmanager-db
   ```

2. Verify database connection:
   ```bash
   docker exec -it busmanager-db psql -U postgres -c "\dt"
   ```

### Out of memory

1. Add/increase swap:
   ```bash
   sudo fallocate -l 2G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
   ```

2. Reduce memory limits in docker-compose.python.yml

### Frontend can't connect to API

1. Verify API is running:
   ```bash
   curl http://localhost:8000/health
   ```

2. Check CORS settings in API if accessing from different host

3. Ensure API_URL is correctly set for your network

## API Endpoints Reference

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `/auth/login` | POST | User login |
| `/auth/signup` | POST | User registration |
| `/auth/me` | GET | Current user info |
| `/buses` | GET, POST, PUT, DELETE | Bus management |
| `/routes` | GET, POST, PUT, DELETE | Route management |
| `/trips` | GET, POST, PUT, DELETE | Trip management |
| `/expenses` | GET, POST, PUT | Expense management |
| `/expense-categories` | GET, POST, PUT, DELETE | Expense categories |
| `/drivers` | GET, POST | Driver management |
| `/schedules` | GET, POST, PUT, DELETE | Schedule management |
| `/stock` | GET, POST, PUT | Stock management |
| `/invoices` | GET, POST, PUT, DELETE | Invoice management |
| `/repairs` | GET, POST, PUT | Repair records |
| `/settings` | GET, PUT | Admin settings |
| `/states` | GET | Indian states list |
| `/notifications` | GET, PUT, DELETE | User notifications |
| `/upload/expense` | POST | Upload expense document |
| `/upload/repair` | POST | Upload repair photo |

## Security Considerations

1. **Change default passwords** immediately after setup
2. **Use HTTPS** in production (configure with reverse proxy like Nginx)
3. **Firewall**: Only expose necessary ports
4. **JWT Secret**: Use a strong, random 32+ character string
5. **Backups**: Regularly backup both database and uploads

## Comparison with Supabase Stack

| Feature | Python Stack | Supabase Stack |
|---------|--------------|----------------|
| RAM Usage | ~300MB | ~736MB |
| Containers | 2-3 | 6 |
| Setup Complexity | Simple | Complex |
| Realtime | ❌ | ✅ |
| Edge Functions | ❌ | ✅ |
| Best For | Pi/Offline | Cloud |
