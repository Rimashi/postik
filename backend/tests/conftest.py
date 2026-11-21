"""Быстрые интеграционные тесты: изолированная SQLite в памяти, не основная БД.

Полную совместимость с PostgreSQL/миграциями проверяет отдельный сценарий
scripts/verify_migrations.py на контейнере test-db (make verify).
"""

import os

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
os.environ["JWT_SECRET"] = "test-only-random-secret-used-in-isolated-tests-00000001"
os.environ["ALLOWED_ORIGINS"] = "http://testserver"

import pytest
from fastapi.testclient import TestClient  # noqa: E402 -- test env vars must be set before importing app
from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DefaultClause,
    create_engine,
    event,
    text,
)  # noqa: E402 -- test env vars must be set before importing app
from sqlalchemy.ext.compiler import compiles  # noqa: E402 -- test env vars must be set before importing app
from sqlalchemy.orm import Session  # noqa: E402 -- test env vars must be set before importing app
from sqlalchemy.pool import StaticPool  # noqa: E402 -- test env vars must be set before importing app
from app import models  # noqa: E402 -- test env vars must be set before importing app
from app.database import get_db  # noqa: E402 -- test env vars must be set before importing app
from app.main import app  # noqa: E402 -- test env vars must be set before importing app


@compiles(BigInteger, "sqlite")
def sqlite_bigint(element, compiler, **kwargs):
    # SQLite AUTO INCREMENT требует INTEGER PRIMARY KEY вместо BIGINT.
    return "INTEGER"


@compiles(CheckConstraint, "sqlite")
def sqlite_check(element, compiler, **kwargs):
    # PostgreSQL оператор regex ~ не поддерживается в SQLite.
    # CHECK-поведение PostgreSQL отдельно проверяем в контейнерных тестах.
    return "CHECK (1=1)"


@pytest.fixture
def client():
    engine = create_engine(
        "sqlite+pysqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )

    @event.listens_for(engine, "connect")
    def foreign_keys(conn, record):
        conn.execute("PRAGMA foreign_keys=ON")

    # В PostgreSQL DEFAULT 'true' приводится к BOOLEAN, а SQLite хранит текст.
    # Для изолированных SQLite-тестов меняем только DDL default (не production-код).
    for table in models.Base.metadata.tables.values():
        for column in table.columns:
            if isinstance(column.type, Boolean) and column.server_default is not None:
                value = (
                    str(column.server_default.arg).replace(chr(39), "").replace(chr(34), "").lower()
                )
                column.server_default = DefaultClause(text("1" if value in ("true", "1") else "0"))
    models.Base.metadata.create_all(engine)

    def isolated_db():
        with Session(engine, expire_on_commit=False) as session:
            yield session

    app.dependency_overrides[get_db] = isolated_db
    with TestClient(app, base_url="http://testserver") as test_client:
        yield test_client
    app.dependency_overrides.clear()
    engine.dispose()


@pytest.fixture
def topics(client):
    # Используем реальную ORM, а не моки SQL-запросов.
    dep = app.dependency_overrides[get_db]
    with next(dep()) as db:  # fixture создаёт отдельную сессию
        db.add_all(
            [
                models.Topic(name="Технологии", slug="technology"),
                models.Topic(name="Наука", slug="science"),
            ]
        )
        db.commit()
    return client


@pytest.fixture
def registered(client):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "username": " Tester_01 ",
            "email": "tester@example.com",
            "password": "good-password-123",
        },
    )
    assert response.status_code == 201, response.text
    return client


def csrf_headers(client):
    return {"X-CSRF-Token": client.cookies["postik_csrf"]}
