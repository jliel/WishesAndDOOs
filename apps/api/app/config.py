import os
from datetime import timedelta


class Config:
    """Base configuration for WishesAndDOOs Flask API."""

    APP_NAME = "WishesAndDOOs API"
    API_VERSION = "1.0.0"
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production-32b")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-jwt-secret-key-change-in-prod-32b")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=15)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=14)

    BASE_DIR = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))
    DEFAULT_SQLITE_URI = f"sqlite:///{os.path.join(BASE_DIR, 'wishes_and_doos_dev.db')}"

    # Uses PostgreSQL when DATABASE_URL is set (Docker / Cloud), or local SQLite file out-of-the-box
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL", DEFAULT_SQLITE_URI)
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    CORS_ORIGINS = [
        "http://localhost:8081",
        "http://127.0.0.1:8081",
        "http://192.168.101.18:8081",
        r"^http://192\.168\.\d+\.\d+(:\d+)?$",
    ]

    RATELIMIT_DEFAULT = "120 per minute"
    RATELIMIT_STORAGE_URI = "memory://"


class TestingConfig(Config):
    """Testing configuration using in-memory SQLite for fast isolated tests."""

    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    RATELIMIT_ENABLED = False
