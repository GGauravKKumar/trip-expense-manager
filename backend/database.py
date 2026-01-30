"""
Database connection and session management
"""
import os
from urllib.parse import quote_plus

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base


def _build_database_url() -> str:
    """Build a sane default DB URL for *non-docker* local runs.

    In docker-compose.python.yml, DATABASE_URL is explicitly provided and will override this.
    """
    user = os.getenv("POSTGRES_USER", "postgres")
    password = os.getenv("POSTGRES_PASSWORD", "your-super-secret-password")
    host = os.getenv("POSTGRES_HOST", "localhost")
    port = os.getenv("POSTGRES_PORT", "5432")
    db = os.getenv("POSTGRES_DB", "postgres")

    # Escape to handle special characters in passwords.
    safe_password = quote_plus(password)
    return f"postgresql://{user}:{safe_password}@{host}:{port}/{db}"


DATABASE_URL = os.getenv("DATABASE_URL") or _build_database_url()

engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_size=5, max_overflow=10)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """Dependency to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
