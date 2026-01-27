"""
BusManager FastAPI Backend
Main application entry point
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from routes import (
    auth_router, buses_router, routes_router, trips_router,
    expenses_router, drivers_router, schedules_router,
    stock_router, invoices_router, repairs_router,
    uploads_router, settings_router, states_router,
    notifications_router
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

# Create uploads directory if not exists
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "/app/uploads")
os.makedirs(f"{UPLOAD_DIR}/expenses", exist_ok=True)
os.makedirs(f"{UPLOAD_DIR}/repairs", exist_ok=True)

# Mount static files for uploads
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Include routers
app.include_router(auth_router, prefix="/auth", tags=["Authentication"])
app.include_router(buses_router, prefix="/buses", tags=["Buses"])
app.include_router(routes_router, prefix="/routes", tags=["Routes"])
app.include_router(trips_router, prefix="/trips", tags=["Trips"])
app.include_router(expenses_router, prefix="/expenses", tags=["Expenses"])
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
