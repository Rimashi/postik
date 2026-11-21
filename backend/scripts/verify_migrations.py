"""Проверка: воспроизводимая миграция чистой и заполненной БД PostgreSQL.

НИКОГДА не запускается против рабочей БД: разрешены только *_test на 5434.
Данные test-db намеренно уничтожаются перед выполнением.
"""

import os
from pathlib import Path
import subprocess
import sys
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
url = os.getenv("POSTIK_TEST_DATABASE_URL", "")
if not url:
    raise SystemExit("POSTIK_TEST_DATABASE_URL is required (test database only)")
parsed = make_url(url)
if (
    not (parsed.database or "").endswith("_test")
    or parsed.port != 5434
    or parsed.host not in ("127.0.0.1", "localhost")
):
    raise SystemExit("Refusing to reset non-test database: required *\u005ftest on localhost:5434")

env = {**os.environ, "DATABASE_URL": url}


def alembic(*args):
    subprocess.run(
        [sys.executable, "-m", "alembic", "-c", str(ROOT / "alembic.ini"), *args],
        cwd=ROOT,
        env=env,
        check=True,
    )


engine = create_engine(url)
with engine.begin() as conn:
    # ИЗОЛИРОВАННАЯ test_db — только она сбрасывается полностью.
    conn.execute(text("DROP SCHEMA public CASCADE"))
    conn.execute(text("CREATE SCHEMA public"))

alembic("upgrade", "0001_initial")
with engine.begin() as conn:
    uid = conn.execute(
        text("""INSERT INTO users (username,email,password_hash)
        VALUES ('UPPERCASE','before@example.invalid','!test') RETURNING id""")
    ).scalar_one()
    conn.execute(
        text("""INSERT INTO posts(author_id,title,content_md) VALUES
        (:uid,'Статья до миграций','Сохранённые данные')"""),
        {"uid": uid},
    )
alembic("upgrade", "0002_auth_sessions")
alembic("upgrade", "head")
with engine.connect() as conn:
    row = conn.execute(text("SELECT username FROM users WHERE id=:id"), {"id": uid}).scalar_one()
    view = conn.execute(text("SELECT views_count FROM posts")).scalar_one()
    tables = {
        r[0]
        for r in conn.execute(text("SELECT tablename FROM pg_tables WHERE schemaname='public'"))
    }
    assert row == "uppercase", f"Username normalization failed: {row}"
    assert view == 0, f"View counter must default to zero: {view}"
    assert "auth_sessions" in tables and len(tables) >= 7
    assert conn.execute(text("SELECT content_md FROM posts")).scalar_one() == "Сохранённые данные"
    # Проверяем CHECK, который в SQLite быстрых тестов отсутствует.
    try:
        with engine.begin() as writable:
            writable.execute(
                text(
                    "INSERT INTO users(username,email,password_hash) VALUES ('BAD_NAME','bad@example.invalid','!test')"
                )
            )
    except Exception:
        pass  # ожидаем отказ PostgreSQL
    else:
        raise AssertionError("PostgreSQL lowercase username CHECK was not enforced")
print("OK: clean install + sequential upgrades with existing data + PG CHECK + preserved records")
alembic("check")
engine.dispose()

# Дополнительная интеграция именно с PostgreSQL, не с SQLite:
# после upgrade head исполняем настоящие FastAPI маршруты поверх test-db.
os.environ["DATABASE_URL"] = url
os.environ["JWT_SECRET"] = "isolated-pg-test-secret-not-used-outside-tests-0001"
os.environ["ALLOWED_ORIGINS"] = "http://testserver"


def load_isolated_test_app():
    # Импортируем приложение только ПОСЛЕ задания переменных тестового окружения.
    # Это важно: settings читает DATABASE_URL и JWT_SECRET при импорте.
    from app.main import app

    return app


with create_engine(url).begin() as conn:
    conn.execute(text("INSERT INTO topics(name,slug) VALUES('Технологии', 'technology')"))
with TestClient(load_isolated_test_app(), base_url="http://testserver") as client:
    assert client.get("/api/health").status_code == 200
    assert client.get("/api/v1/posts/count").json()["count"] == 1
    assert client.get("/api/v1/posts/1").json()["views_count"] == 1
    registered = client.post(
        "/api/v1/auth/register",
        json={
            "username": "PG_Student",
            "email": "pg@example.com",
            "password": "secure_password_123",
        },
    )
    assert registered.status_code == 201, registered.text
    assert registered.json()["username"] == "pg_student"
    csrf = client.cookies.get("postik_csrf")
    created = client.post(
        "/api/v1/posts",
        headers={"X-CSRF-Token": csrf},
        json={
            "title": "Новая статья PostgreSQL",
            "content_md": "# Тест",
            "topic_ids": [1],
            "tag_names": ["Linux"],
        },
    )
    assert created.status_code == 201, created.text
    assert created.json()["author_username"] == "pg_student"
    assert client.get("/api/v1/posts/count").json()["count"] == 2
print("OK: HTTP auth + PostgreSQL ORM + article + view counter")
