# Единый интерфейс разработки, проверки и контейнерной эксплуатации «Постика».
# Команды не ослабляют проверки ради зелёного статуса CI.
SHELL := /bin/bash
PY := backend/.venv/bin/python
PIP := backend/.venv/bin/pip
COMPOSE := docker compose --env-file .env -f compose.yml
DEV_COMPOSE := docker compose -f compose.dev.yml
TEST_COMPOSE := docker compose -f compose.test.yml
TEST_DB_URL := postgresql+psycopg://postik_test:isolated_test_password@127.0.0.1:5434/postik_test

.PHONY: init setup backend-init ci-python ci-node ci-prepare dev-up dev-down dev-run run up down build \
        migrate baseline-existing seed test test-db-up quality format frontend-check \
        migration-check restore-check backup restore stack-backup container-check \
        dependency-check secrets-check image-scan ci-verify verify

# Конфигурация: .env для контейнерного стека, backend/.env для локального Uvicorn.
init:
	python3 scripts/init_env.py

backend-init:
	$(PY) backend/scripts/setup_env.py

ci-python:
	python3 -m venv backend/.venv
	$(PIP) install -r backend/requirements-dev.txt

ci-node:
	cd frontend && npm ci --no-audit --no-fund

ci-prepare: ci-python ci-node

# Разработка без Docker для FastAPI и Vite; PostgreSQL остаётся в Docker на 5433.
setup: ci-prepare
	$(MAKE) init
	$(MAKE) backend-init
	$(MAKE) dev-up
	cd backend && .venv/bin/python -m scripts.bootstrap_db

# Сохраняет исторический проект backend и том backend_postgres_data из прежней версии.
dev-up:
	$(DEV_COMPOSE) up -d --wait

dev-down:
	$(DEV_COMPOSE) down

run:
	@echo 'Vite: http://127.0.0.1:5173 ; FastAPI: http://127.0.0.1:8000/docs'
	@(cd backend && .venv/bin/uvicorn app.main:app --reload --host 127.0.0.1) & api_pid=$$!; \
	  (cd frontend && npm run dev) & web_pid=$$!; \
	  trap 'kill $$api_pid $$web_pid 2>/dev/null || true' EXIT INT TERM; wait

dev-run: run

# Отдельно от dev-БД: полный стек Nginx + FastAPI + Alembic + PostgreSQL.
build:
	@test -f frontend/package-lock.json || (echo 'Missing frontend/package-lock.json' && exit 1)
	$(MAKE) init
	$(COMPOSE) build --pull

up:
	$(MAKE) init
	$(COMPOSE) up -d --build --wait

down:
	$(COMPOSE) down

migrate:
	cd backend && .venv/bin/alembic upgrade head

baseline-existing:
	cd backend && STAMP_CONFIRM=$(STAMP_CONFIRM) .venv/bin/python -m scripts.stamp_existing

seed:
	cd backend && .venv/bin/python -m app.seed

test-db-up:
	$(TEST_COMPOSE) up -d --wait

test:
	mkdir -p backend/reports
	cd backend && .venv/bin/python -m pytest tests -q --cov=app --cov-report=term-missing --cov-report=xml:reports/coverage.xml --junitxml=reports/pytest.xml --cov-fail-under=65
	cd frontend && npm test

format:
	cd backend && .venv/bin/ruff format app tests scripts migrations ../scripts
	cd backend && .venv/bin/ruff check --fix app tests scripts migrations ../scripts

quality:
	mkdir -p backend/reports
	cd backend && .venv/bin/ruff check app tests scripts migrations ../scripts
	cd backend && .venv/bin/ruff format --check app tests scripts migrations ../scripts
	cd backend && .venv/bin/bandit -r app -q
	cd backend && .venv/bin/bandit -r app -f json -o reports/bandit.json
	@for f in $$(find frontend/src frontend/tests -type f \( -name '*.js' -o -name '*.mjs' \)); do node --check "$$f" || exit 1; done

frontend-check:
	cd frontend && npm run build

# Сбросить схему можно ТОЛЬКО на postik_test (127.0.0.1:5434).
migration-check: test-db-up
	cd backend && POSTIK_TEST_DATABASE_URL='$(TEST_DB_URL)' .venv/bin/python -m scripts.verify_migrations

restore-check: migration-check
	cd backend && POSTIK_TEST_DATABASE_URL='$(TEST_DB_URL)' .venv/bin/python -m scripts.verify_backup_restore

# Все операции контейнерных сценариев используют ОСНОВНОЙ стек, но не dev-БД.
container-check:
	$(MAKE) init
	python3 scripts/check_containers_static.py
	python3 scripts/check_containers_runtime.py
	python3 scripts/check_restore_new_volume.py
	$(COMPOSE) config -q
	$(DEV_COMPOSE) config -q
	$(TEST_COMPOSE) config -q

# Дамп dev-БД, как и в прежней версии проекта: backend-db-1, порт 5433.
backup:
	@mkdir -p backups && chmod 700 backups
	@set -o pipefail; file="backups/postik-dev-$$(date +%Y%m%d-%H%M%S).dump"; \
	  $(DEV_COMPOSE) exec -T db pg_dump -U postik -Fc postik > "$$file" && \
	  chmod 600 "$$file" && echo "Backup created: $$file"

# Восстановление dev-БД перезаписывает объекты; требуется явное подтверждение.
restore:
	@test "$(RESTORE_CONFIRM)" = YES || (echo 'Destructive! Use RESTORE_CONFIRM=YES BACKUP_FILE=...' && exit 1)
	@test -f "$(BACKUP_FILE)" || (echo 'BACKUP_FILE not found' && exit 1)
	@echo 'Restoring development database: $(BACKUP_FILE)'
	@$(DEV_COMPOSE) exec -T db pg_restore -U postik -d postik --clean --if-exists --no-owner --no-acl < "$(BACKUP_FILE)"

stack-backup:
	@mkdir -p backups && chmod 700 backups
	@set -o pipefail; file="backups/postik-stack-$$(date +%Y%m%d-%H%M%S).dump"; \
	  $(COMPOSE) exec -T db pg_dump -U postik -Fc postik > "$$file" && \
	  chmod 600 "$$file" && echo "Backup created: $$file"

# Обязательная локальная проверка: тесты, безопасность, frontend build, миграции,
# backup/restore и живой контейнерный стек.
verify: test quality frontend-check restore-check container-check
	@echo 'verify passed: tests, coverage, quality, frontend, migrations, recovery, containers'

# Supply-chain: сканируем действительные зависимости, Git history и образы.
dependency-check:
	mkdir -p backend/reports
	cd backend && .venv/bin/pip-audit -r requirements.txt -f json -o reports/pip-audit-prod.json
	cd backend && .venv/bin/pip-audit -r requirements-dev.txt -f json -o reports/pip-audit-dev.json
	cd frontend && npm audit --audit-level=high --json > ../backend/reports/npm-audit.json

secrets-check:
	mkdir -p backend/reports
	@git rev-parse --is-inside-work-tree >/dev/null || (echo 'Git repository required for secret history scanning' && exit 1)
	@set -eu; for path in backend/.env .env; do \
	  if git ls-files --error-unmatch "$$path" >/dev/null 2>&1; then \
	    echo "ERROR: tracked secret file: $$path" >&2; exit 1; fi; done
	docker run --rm --user "$$(id -u):$$(id -g)" -v "$(CURDIR):/repo:ro" -w /repo \
	  -v "$(CURDIR)/backend/reports:/reports" ghcr.io/gitleaks/gitleaks:v8.30.1 \
	  git --redact --exit-code 1 --report-format json --report-path /reports/gitleaks.json /repo

image-scan: build
	mkdir -p backend/reports
	@set -eu; tmp="$$(mktemp -d)"; trap 'rm -rf "$$tmp"' EXIT; \
	  docker save postik-api:local -o "$$tmp/api.tar"; \
	  docker save postik-web:local -o "$$tmp/web.tar"; \
	  for image in api web; do \
	    docker run --rm --user "$$(id -u):$$(id -g)" -e TRIVY_CACHE_DIR=/tmp/trivy-cache \
	      -v "$$tmp:/images:ro" -v "$(CURDIR)/backend/reports:/reports" aquasec/trivy:0.69.3 image \
	      --scanners vuln --severity HIGH,CRITICAL --exit-code 1 --format json \
	      --output "/reports/trivy-$$image.json" --input "/images/$$image.tar"; \
	  done

ci-verify: verify dependency-check secrets-check image-scan
	@python3 scripts/check_ci_policy.py
	@echo 'ci-verify passed: full local verification and supply-chain gates'
