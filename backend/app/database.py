"""Engine = пул соединений; SessionLocal = фабрика независимых ORM-сессий."""

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from .settings import DATABASE_URL

# pool_pre_ping проверяет соединение при взятии из пула. echo включают лишь в отладке.
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI dependency: отдельная сессия на запрос и гарантированное закрытие."""
    with SessionLocal() as session:
        yield session
