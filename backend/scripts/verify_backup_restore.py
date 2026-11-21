"""Проверка: pg_dump -> преднамеренное повреждение -> pg_restore -> проверка.
Запускается ТОЛЬКО в изолированном docker compose test-db.
"""

import os
from pathlib import Path
import subprocess
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

url = os.environ.get("POSTIK_TEST_DATABASE_URL", "")
if not url:
    raise SystemExit("Missing POSTIK_TEST_DATABASE_URL")
parsed = make_url(url)
if (
    parsed.database != "postik_test"
    or parsed.port != 5434
    or parsed.host not in ("localhost", "127.0.0.1")
):
    raise SystemExit("Refusing to damage or restore anything except isolated postik_test")
root = Path(__file__).resolve().parents[2]
compose = ["docker", "compose", "-f", str(root / "compose.test.yml"), "exec", "-T", "db"]
engine = create_engine(url)
with engine.begin() as conn:
    conn.execute(
        text(
            "INSERT INTO topics(name, slug) VALUES('BACKUP_TEST', 'backup-test') ON CONFLICT(slug) DO NOTHING"
        )
    )
with subprocess.Popen(
    compose + ["pg_dump", "-U", "postik_test", "-Fc", "postik_test"], stdout=subprocess.PIPE
) as proc:
    dump = proc.stdout.read()
    if proc.wait() or not dump:
        raise SystemExit("pg_dump failed")
with engine.begin() as conn:
    conn.execute(text("DELETE FROM topics WHERE slug='backup-test'"))
with engine.connect() as conn:
    assert (
        conn.execute(text("SELECT count(*) FROM topics WHERE slug='backup-test'")).scalar_one() == 0
    )
engine.dispose()  # pg_restore --clean нужно освободить соединения
with subprocess.Popen(
    compose
    + [
        "pg_restore",
        "-U",
        "postik_test",
        "-d",
        "postik_test",
        "--clean",
        "--if-exists",
        "--no-owner",
        "--no-acl",
    ],
    stdin=subprocess.PIPE,
) as restore:
    restore.communicate(dump)
    if restore.returncode:
        raise SystemExit("pg_restore failed")
engine = create_engine(url)
with engine.connect() as conn:
    count = conn.execute(text("SELECT count(*) FROM topics WHERE slug='backup-test'")).scalar_one()
    assert count == 1, "Backup restore did not recover deleted record"
engine.dispose()
print("OK: pg_dump + intentional DELETE + pg_restore + restored data")
