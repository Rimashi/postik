"""Единая начальная инициализация БД (безопасная для старой схемы)."""

import subprocess
import sys
from pathlib import Path
from sqlalchemy import create_engine, inspect
from app.settings import DATABASE_URL

root = Path(__file__).resolve().parents[1]
engine = create_engine(DATABASE_URL)
with engine.connect() as connection:
    tables = set(inspect(connection).get_table_names())
engine.dispose()

if tables and "alembic_version" not in tables:
    # Не делаем stamp без отдельного подтверждения и копии БД.
    print("Old unversioned schema detected. Data untouched!")
    print("NEXT: make backup; make baseline-existing STAMP_CONFIRM=YES; make migrate; make seed")
else:
    subprocess.run(
        [sys.executable, "-m", "alembic", "-c", str(root / "alembic.ini"), "upgrade", "head"],
        cwd=root,
        check=True,
    )
    subprocess.run([sys.executable, "-m", "app.seed"], cwd=root, check=True)
    print("Database ready: migrations applied and topics seeded")
