"""Конфигурация берётся из .env окружения, а не хранится в репозитории."""

import os
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.environ.get("DATABASE_URL", "")
JWT_SECRET = os.environ.get("JWT_SECRET", "")
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "0") == "1"
ACCESS_MINUTES = int(os.getenv("ACCESS_MINUTES", "60"))
ALLOWED_ORIGINS = {
    s.strip().rstrip("/")
    for s in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8000,http://127.0.0.1:8000",
    ).split(",")
    if s.strip()
}


def validate_runtime_config():
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is required")
    if len(JWT_SECRET) < 32 or JWT_SECRET in {"change-me-in-production", "local_dev_secret"}:
        raise RuntimeError("JWT_SECRET must be a random secret of at least 32 characters")
    if os.getenv("APP_ENV") == "production" and not COOKIE_SECURE:
        raise RuntimeError("COOKIE_SECURE=1 is required in production")
