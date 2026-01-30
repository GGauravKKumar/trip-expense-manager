"""BusManager FastAPI Backend - main application entry point."""

import os
from pathlib import Path


def _load_env_file(path: Path) -> None:
    """Lightweight .env loader (no extra dependency).

    - Only sets variables that are not already in the environment
    - Supports simple KEY=VALUE lines and ignores comments/blank lines
    """
    if not path.exists() or not path.is_file():
        return

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key:
            os.environ.setdefault(key, value)


def load_env() -> None:
    """Load env vars from backend/.env then project-root .env (if present)."""
    base_dir = Path(__file__).resolve().parent
    _load_env_file(base_dir / ".env")
    _load_env_file(base_dir.parent / ".env")


# CRITICAL: Load env vars BEFORE any other imports that depend on them
load_env()

# Now safe to import modules that read env vars at import time
from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from fastapi.staticfiles import StaticFiles  # noqa: E402

from routes import (  # noqa: E402
    auth_router,
    buses_router,
    drivers_router,
    expense_categories_router,
    expenses_router,
    invoices_router,
    notifications_router,
    repairs_router,
    routes_router,
    schedules_router,
    settings_router,
    states_router,
    stock_router,
    trips_router,
    uploads_router,
)

# Create FastAPI app
app = FastAPI(
    title="BusManager API",
    description="Lightweight REST API for Bus Fleet Management",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



BASE_DIR = Path(__file__).resolve().parent

# Upload directory (overrideable via env)
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", BASE_DIR / "uploads")).resolve()

# Create required subdirectories
(UPLOAD_DIR / "expenses").mkdir(parents=True, exist_ok=True)
(UPLOAD_DIR / "repairs").mkdir(parents=True, exist_ok=True)

# Mount static files for uploads
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Include routers
app.include_router(auth_router, prefix="/auth", tags=["Authentication"])
app.include_router(buses_router, prefix="/buses", tags=["Buses"])
app.include_router(routes_router, prefix="/routes", tags=["Routes"])
app.include_router(trips_router, prefix="/trips", tags=["Trips"])
app.include_router(expenses_router, prefix="/expenses", tags=["Expenses"])
app.include_router(expense_categories_router, prefix="/expense-categories", tags=["Expense Categories"])
app.include_router(drivers_router, prefix="/drivers", tags=["Drivers"])
app.include_router(schedules_router, prefix="/schedules", tags=["Schedules"])
app.include_router(stock_router, prefix="/stock", tags=["Stock"])
app.include_router(invoices_router, prefix="/invoices", tags=["Invoices"])
app.include_router(repairs_router, prefix="/repairs", tags=["Repairs"])
app.include_router(uploads_router, prefix="/upload", tags=["Uploads"])
app.include_router(settings_router, prefix="/settings", tags=["Settings"])
app.include_router(states_router, prefix="/states", tags=["Indian States"])
app.include_router(notifications_router, prefix="/notifications", tags=["Notifications"])


@app.get("/")
async def root():
    return {"message": "BusManager API", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
