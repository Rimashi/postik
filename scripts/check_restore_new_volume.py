"""Дамп основной контейнерной БД -> восстановление в ОТДЕЛЬНЫЙ НОВЫЙ volume.
Не изменяет главную db: работает с отдельным Compose project.
"""

import json
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[1]
env = root / ".env"
main = ["docker", "compose", "--env-file", str(env), "-f", str(root / "compose.yml")]
restore = [
    "docker",
    "compose",
    "--env-file",
    str(env),
    "-f",
    str(root / "compose.restore.yml"),
]
backup = root / "backups/restore-test.dump"
backup.parent.mkdir(parents=True, exist_ok=True)
backup.parent.chmod(0o700)


def run(*args, inp=None):
    return subprocess.run(args, check=True, input=inp)


def sql(com, sql_text):
    return subprocess.run(
        [
            *com,
            "exec",
            "-T",
            "db",
            "psql",
            "-X",
            "-U",
            "postik",
            "-d",
            "postik",
            "-Atc",
            sql_text,
        ],
        check=True,
        text=True,
        capture_output=True,
    ).stdout.strip()


# Оригинальные данные: защищённый маркер для независимой проверки.
marker = "restore-proof"
sql(
    main,
    "INSERT INTO topics(name,slug) VALUES('Контрольное восстановление','restore-proof') ON CONFLICT(slug) DO NOTHING",
)
assert sql(main, "SELECT count(*) FROM topics WHERE slug='restore-proof'") == "1"
with backup.open("wb") as f:
    p = subprocess.run(
        [*main, "exec", "-T", "db", "pg_dump", "-U", "postik", "-Fc", "postik"],
        stdout=f,
        check=True,
    )
assert backup.stat().st_size > 0
backup.chmod(0o600)
# Защита от случайного down -v не того проекта.
original_project = json.loads(
    subprocess.run(
        [*main, "config", "--format", "json"],
        check=True,
        text=True,
        capture_output=True,
    ).stdout
)["name"]
restore_project = json.loads(
    subprocess.run(
        [*restore, "config", "--format", "json"],
        check=True,
        text=True,
        capture_output=True,
    ).stdout
)["name"]
if (
    original_project != "postik_stack"
    or restore_project != "postik_restore"
    or restore_project == original_project
):
    raise SystemExit("Refusing destructive volume reset: unexpected Compose project names")
# down -v применяется ИСКЛЮЧИТЕЛЬНО к тестовому restore-проекту.
run(*restore, "down", "-v", "--remove-orphans")
run(*restore, "up", "-d", "--wait")
with backup.open("rb") as f:
    p = subprocess.run(
        [
            *restore,
            "exec",
            "-T",
            "db",
            "pg_restore",
            "-e",
            "-U",
            "postik",
            "-d",
            "postik",
            "--no-owner",
            "--no-acl",
        ],
        stdin=f,
        check=True,
    )
assert sql(restore, "SELECT count(*) FROM topics WHERE slug='restore-proof'") == "1"
assert sql(main, "SELECT count(*) FROM topics WHERE slug='restore-proof'") == "1"
print("OK: dump restored into newly created independent postik_restore volume; main DB preserved")
print("Saved backup:", backup)
