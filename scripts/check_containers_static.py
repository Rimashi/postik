"""Быстрая проверка требований контейнерной конфигурации без Docker Engine.
Проверка намеренно не заменяет runtime-тесты контейнеров.
"""

import re
from pathlib import Path

root = Path(__file__).resolve().parents[1]
api = (root / "backend/Dockerfile").read_text(encoding="utf-8")
web = (root / "frontend/Dockerfile").read_text(encoding="utf-8")
compose = (root / "compose.yml").read_text(encoding="utf-8")
ignore = (root / ".dockerignore").read_text(encoding="utf-8")
requirements = (root / "backend/requirements.txt").read_text(encoding="utf-8")

assert re.search(r"(?m)^USER\s+10001:10001\s*$", api), "Backend must run as non-root"
assert re.search(r"(?m)^USER\s+101:101\s*$", web), "Frontend must run as non-root"
assert re.search(r"(?m)^STOPSIGNAL\s+SIGTERM", api), "Missing SIGTERM policy"
assert "HEALTHCHECK" in api and "HEALTHCHECK" in web
assert "npm ci" in web, "Frontend build must use lock file"
assert "frontend/package-lock.json" in web
assert "JWT_SECRET" in compose and "DB_PASSWORD" in compose
assert "mem_limit:" in compose and "cpus:" in compose
assert "condition: service_healthy" in compose
assert "condition: service_completed_successfully" in compose
assert "internal: true" in compose
assert "read_only: true" in compose
assert "ports:" in compose  # expected only for web
assert "127.0.0.1:8088:8080" in compose
assert ".env" in ignore
assert not re.search(r"(?m)^\s*FROM\s+\S+:latest\s*$", api + "\n" + web)
assert not re.search(r"(?m)^\s*image:\s*\S+:latest\s*$", compose)
assert all(
    "==" in line for line in requirements.splitlines() if line.strip() and not line.startswith("#")
)
print("OK: Dockerfile, non-root, signal, healthcheck, fixed direct dependencies, secrets excluded")
