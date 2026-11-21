# Запуск и эксплуатация

## Чистая локальная установка

```bash
make setup
make run
```

`make setup` устанавливает закреплённые Python-зависимости и Node-зависимости через `npm ci`, создаёт `backend/.env` и корневой `.env` со случайными секретами, запускает dev PostgreSQL на порту 5433, затем применяет миграции Alembic и добавляет темы. Уже созданный том с данными сохраняется.

## Существующая локальная PostgreSQL

Новая `compose.dev.yml` **сохраняет** Compose-имя `backend`, поэтому старый том `backend_postgres_data` остаётся доступен. При сомнениях сначала сделай копию (`make backup`) и проверь `docker volume ls`, а не выполняй `down -v`.

Если данные из старого периода без `alembic_version`: `make baseline-existing STAMP_CONFIRM=YES`, затем `make migrate`. При уже существующей таблице `alembic_version` — только `make migrate`. Скрипт baseline проверяет исходную схему, не должен подменять ошибочную схему.

## Полный контейнерный запуск

```bash
make init
make build
make up
docker compose --env-file .env -f compose.yml ps -a
curl -i http://127.0.0.1:8088/api/health
```

`db`, `api`, `web` должны получить healthy; одноразовый `migrate` штатно завершает работу с exit 0. Остановить без удаления volume: `make down`.

## Проверки

```bash
make test
make quality
make frontend-check
make migration-check  # удаляет только тестовую схему на localhost:5434
make restore-check    # намеренно повреждает тестовые данные и восстанавливает
make container-check  # пересоздаёт контейнеры ОСНОВНОГО стека, сохраняет их том
make verify           # объединение функциональных и эксплуатационных проверок
```

`make ci-verify` дополнительно включает CVE-аудит (pip/npm), историю Git (Gitleaks) и сканирование контейнеров (Trivy). Для них необходимы Docker, сеть и актуальные базы уязвимостей. Не использовать `continue-on-error`, снижение порога или исключения анализаторов для обхода реальных находок.

## Резервирование

- `make backup` — dev-БД на 5433, сохраняет `backups/postik-dev-*.dump`.
- `make stack-backup` — контейнерная PostgreSQL, `backups/postik-stack-*.dump`.
- `make restore RESTORE_CONFIRM=YES BACKUP_FILE=...` — **разрушительное восстановление dev-БД**, перезаписывает её объекты. Не использовать для демонстрации; тест восстановления входит в `make restore-check` и `make container-check`.

`compose.restore.yml` имеет явное имя проекта `postik_restore`. Скрипт проверяет его перед любым `down -v`, и удаляется volume **только** этого проекта.

## Проверка контейнерных свойств и снимки для защиты

```bash
docker compose --env-file .env -f compose.yml ps -a
docker compose --env-file .env -f compose.yml exec -T api id -u
docker compose --env-file .env -f compose.yml exec -T web id -u
docker compose --env-file .env -f compose.yml exec -T db psql -U postik -d postik -c 'SELECT * FROM alembic_version;'
make container-check
```

Пользователи должны быть отличны от root (API UID=10001, Nginx UID=101), на host опубликован только `127.0.0.1:8088`; база хранится в volume. Не публикуй `docker compose config` без `-q`, так как он может показать переменные окружения и пароль.
