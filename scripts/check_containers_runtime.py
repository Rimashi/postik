"""Проверка контейнерного стека: сеть, non-root, SIGTERM, health, volume."""

import json
import subprocess
import time
from urllib.request import urlopen
from pathlib import Path

root = Path(__file__).resolve().parents[1]
compose_args = [
    "docker",
    "compose",
    "--env-file",
    str(root / ".env"),
    "-f",
    str(root / "compose.yml"),
]


def cmd(*args, capture=False):
    return subprocess.run(
        [*compose_args, *args],
        check=True,
        text=True,
        stdout=subprocess.PIPE if capture else None,
        stderr=subprocess.PIPE if capture else None,
    )


def check_url(url, attempts=15):
    for _attempt in range(attempts):
        try:
            with urlopen(url, timeout=3) as response:
                if response.status == 200:
                    return response.read()
        except Exception:
            time.sleep(2)
    raise SystemExit("HTTP unavailable: " + url)


def sql(statement):
    return cmd(
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
        statement,
        capture=True,
    ).stdout.strip()


def main():
    config = json.loads(cmd("config", "--format", "json", capture=True).stdout)
    services = config["services"]
    for name in ["db", "migrate", "api", "web"]:
        assert name in services, f"No service {name}"
    for name in ["db", "migrate", "api"]:
        assert not services[name].get("ports"), f"Unexpected published ports: {name}"
    assert services["db"].get("volumes"), "DB must have persistent volume"
    for name in ["db", "api", "web"]:
        assert services[name].get("healthcheck"), f"Missing healthcheck: {name}"
    for name in ["db", "api", "web"]:
        assert services[name].get("mem_limit") and services[name].get("cpus"), f"No limits: {name}"

    cmd("up", "-d", "--build", "--wait")
    assert check_url("http://127.0.0.1:8088/api/health")
    check_url("http://127.0.0.1:8088/")  # SPA must respond with HTTP 200
    uid = cmd("exec", "-T", "api", "id", "-u", capture=True).stdout.strip()
    web_uid = cmd("exec", "-T", "web", "id", "-u", capture=True).stdout.strip()
    assert uid != "0" and web_uid != "0", f"Root UID is forbidden: api={uid}, web={web_uid}"
    assert sql("SELECT count(*) FROM alembic_version") == "1"
    # Контрольная запись создаётся в PostgreSQL контейнерного стека, не в dev-БД.
    sql(
        "INSERT INTO topics(name, slug) VALUES('Проверка сохранности данных','container-volume-check') ON CONFLICT(slug) DO NOTHING"
    )
    assert sql("SELECT count(*) FROM topics WHERE slug='container-volume-check'") == "1"
    # Проверка остановки по SIGTERM: ожидаем именно успешную остановку процесса.
    cmd("stop", "-t", "20", "api")
    # inspect подтверждает, что Docker не применил принудительный SIGKILL (137).
    stopped_id = cmd("ps", "-a", "-q", "api", capture=True).stdout.strip()
    inspect = subprocess.run(
        [
            "docker",
            "inspect",
            "-f",
            "{{.State.ExitCode}} {{.State.OOMKilled}}",
            stopped_id,
        ],
        check=True,
        text=True,
        capture_output=True,
    ).stdout.strip()
    assert inspect.split()[0] in ("0", "143") and inspect.endswith("false"), inspect
    # Перезапуск после остановки; docker compose восстанавливает healthy-сервис.
    cmd("up", "-d", "--wait", "api")
    assert check_url("http://127.0.0.1:8088/api/health")
    # Принудительно пересоздаём СУБД, но volume НЕ удаляем.
    cmd("up", "-d", "--force-recreate", "--no-deps", "--wait", "db")
    assert sql("SELECT count(*) FROM topics WHERE slug='container-volume-check'") == "1"
    cmd("up", "-d", "--wait", "api", "web")
    assert check_url("http://127.0.0.1:8088/api/health")
    # После повторной сборки/обновления образа пересоздаём приложение, не том БД.
    cmd("build", "api")
    cmd("up", "-d", "--force-recreate", "--wait", "api")
    assert sql("SELECT count(*) FROM topics WHERE slug='container-volume-check'") == "1"
    assert check_url("http://127.0.0.1:8088/api/health")
    print("OK: non-root, HTTP health, SIGTERM, recreation, rebuilt image and persisted record")


if __name__ == "__main__":
    main()
