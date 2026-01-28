"""
API Routes
"""
from .auth import router as auth_router
from .buses import router as buses_router
from .routes import router as routes_router
from .trips import router as trips_router
from .expenses import router as expenses_router
from .expense_categories import router as expense_categories_router
from .drivers import router as drivers_router
from .schedules import router as schedules_router
from .stock import router as stock_router
from .invoices import router as invoices_router
from .repairs import router as repairs_router
from .uploads import router as uploads_router
from .settings import router as settings_router
from .states import router as states_router
from .notifications import router as notifications_router

__all__ = [
    "auth_router",
    "buses_router",
    "routes_router",
    "trips_router",
    "expenses_router",
    "expense_categories_router",
    "drivers_router",
    "schedules_router",
    "stock_router",
    "invoices_router",
    "repairs_router",
    "uploads_router",
    "settings_router",
    "states_router",
    "notifications_router",
]
