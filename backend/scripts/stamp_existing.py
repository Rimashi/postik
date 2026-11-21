"""Одноразовая регистрация уже существующей схемы без её пересоздания."""

import os
import subprocess
import sys
from pathlib import Path
from sqlalchemy import create_engine, inspect
from app.settings import DATABASE_URL

expected_columns = {
    "users": {
        "id",
        "username",
        "email",
        "password_hash",
        "bio",
        "avatar_url",
        "city",
        "other_site",
        "role",
        "is_active",
        "created_at",
    },
    "posts": {
        "id",
        "author_id",
        "parent_id",
        "title",
        "summary",
        "content_md",
        "format",
        "cover_url",
        "created_at",
        "updated_at",
        "published_at",
    },
    "tags": {"id", "name", "slug", "created_by_id", "is_blocked"},
    "topics": {"id", "name", "slug", "is_active"},
    "post_topics": {"post_id", "topic_id"},
    "post_tags": {"post_id", "tag_id"},
}
expected = set(expected_columns)
engine = create_engine(DATABASE_URL)
with engine.connect() as conn:
    found = set(inspect(conn).get_table_names())
    if "alembic_version" in found:
        raise SystemExit("Already versioned by Alembic: use make migrate")
    if found != expected:
        raise SystemExit(f"Cannot stamp: expected exactly {sorted(expected)}, got {sorted(found)}")
    # Проверяем только структуру уже созданной версии, а не её данные.
    for t in expected:
        actual_columns = {c["name"] for c in inspect(conn).get_columns(t)}
        if actual_columns != expected_columns[t]:
            raise SystemExit(f"Unexpected structure for {t}: {actual_columns}")
        if not inspect(conn).get_pk_constraint(t).get("constrained_columns"):
            raise SystemExit(f"No primary key: {t}")
engine.dispose()
if os.getenv("STAMP_CONFIRM") != "YES":
    raise SystemExit("Run with STAMP_CONFIRM=YES after backing up DB; this labels schema as 0001")
root = Path(__file__).resolve().parents[1]
subprocess.run(
    [sys.executable, "-m", "alembic", "-c", str(root / "alembic.ini"), "stamp", "0001_initial"],
    check=True,
    cwd=root,
)
print("Existing six tables stamped as 0001_initial, no data deleted. Now run make migrate.")
