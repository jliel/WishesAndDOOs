import os
from datetime import timedelta


def _parse_cors_origins():
    env_origins = os.getenv("CORS_ORIGINS")
    if env_origins:
        return [orig.strip() for orig in env_origins.split(",") if orig.strip()]
    return [
        "http://localhost:8081",
        "http://127.0.0.1:8081",
        "http://192.168.101.18:8081",
        r"^http://192\.168\.\d+\.\d+(:\d+)?$",
    ]


class Config:
    """Base configuration for WishesAndDOOs Flask API."""

    APP_NAME = "WishesAndDOOs API"
    API_VERSION = "1.0.0"
    DEBUG = os.getenv("FLASK_DEBUG", "false").lower() in ("true", "1", "yes")
    TESTING = False

    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production-32b")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-jwt-secret-key-change-in-prod-32b")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=15)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=14)

    BASE_DIR = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))
    DEFAULT_SQLITE_URI = f"sqlite:///{os.path.join(BASE_DIR, 'wishes_and_doos_dev.db')}"

    # Uses PostgreSQL when DATABASE_URL is set (Docker / Cloud), or local SQLite file out-of-the-box
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL", DEFAULT_SQLITE_URI)
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
    }

    CORS_ORIGINS = _parse_cors_origins()

    RATELIMIT_DEFAULT = os.getenv("RATELIMIT_DEFAULT", "120 per minute")
    RATELIMIT_STORAGE_URI = os.getenv("RATELIMIT_STORAGE_URI", "memory://")
    ENABLE_PROXY_FIX = os.getenv("ENABLE_PROXY_FIX", "false").lower() in ("true", "1", "yes")
    MAX_CONTENT_LENGTH = 10 * 1024 * 1024  # 10 MB maximum request payload size


class ProductionConfig(Config):
    """Hardened production configuration."""

    DEBUG = False
    TESTING = False
    ENABLE_PROXY_FIX = os.getenv("ENABLE_PROXY_FIX", "true").lower() in ("true", "1", "yes")

    # Production connection pool settings for Postgres
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "pool_recycle": 300,
        "pool_size": int(os.getenv("DB_POOL_SIZE", "10")),
        "max_overflow": int(os.getenv("DB_MAX_OVERFLOW", "20")),
    }

    @classmethod
    def validate_secrets(cls):
        dev_secret = "dev-secret-key-change-in-production-32b"
        dev_jwt = "dev-jwt-secret-key-change-in-prod-32b"
        secret = os.getenv("SECRET_KEY", dev_secret)
        jwt_secret = os.getenv("JWT_SECRET_KEY", dev_jwt)
        if not secret or secret == dev_secret or len(secret) < 32:
            raise RuntimeError(
                "CRITICAL SECURITY: In production, SECRET_KEY must be set to a secure random string of at least 32 characters."
            )
        if not jwt_secret or jwt_secret == dev_jwt or len(jwt_secret) < 32:
            raise RuntimeError(
                "CRITICAL SECURITY: In production, JWT_SECRET_KEY must be set to a secure random string of at least 32 characters."
            )


class TestingConfig(Config):
    """Testing configuration using in-memory SQLite for fast isolated tests."""

    TESTING = True
    DEBUG = False
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    RATELIMIT_ENABLED = False


CONFIG_MAP = {
    "development": Config,
    "production": ProductionConfig,
    "testing": TestingConfig,
}
