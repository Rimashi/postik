# Постик — FastAPI + PostgreSQL + Vite + контейнеры + CI

Небольшая платформа публикаций: регистрация/вход, JWT в HttpOnly-cookie, защита CSRF, публикация и редактирование статей, теги и темы, продолжения публикаций. Фронтенд — Vanilla JS с Vite. Локальные черновики и офлайн-подборки хранятся в браузере.

Проект содержит **один** набор исходников и четыре Compose-конфигурации по назначению, а не отдельные копии приложения. Контейнерная конфигурация и CI используют те же Dockerfile, тесты и миграции, что и разработка.

## Структура

```text
postik/
├── backend/                 # FastAPI, SQLAlchemy ORM, Alembic, pytest
│   ├── app/                 # main, auth, models, schemas, database, settings, seed
│   ├── migrations/versions/ # 0001 → 0002 → 0003
│   ├── scripts/             # bootstrap, проверка миграций и восстановления
│   ├── tests/               # unit и HTTP-интеграционные тесты
│   ├── Dockerfile
│   └── requirements*.txt
├── frontend/                # Vanilla JS, Vite, Nginx, тесты Node
│   ├── src/                 # api/, pages/, components/, styles/
│   ├── public/              # статические изображения
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package-lock.json
├── compose.yml              # полный стек: db → migrate → api → web
├── compose.dev.yml          # локальная PostgreSQL на 127.0.0.1:5433
├── compose.test.yml         # изолированная тестовая БД на 5434
├── compose.restore.yml      # одноразовое восстановление в НОВЫЙ volume
├── scripts/                 # проверки контейнеров и CI, генерация секретов
├── .github/workflows/ci.yml # обязательные jobs, gate, публикация в GHCR
├── Makefile                 # единая точка входа
└── docs/                    # архитектура и операционные инструкции
```

## Быстрый старт для разработки

Требуются Python 3.13+, Node 22, Docker Compose и GNU Make.

```bash
make setup   # зависимости, .env, старая/новая dev-БД, миграции, темы
make run     # API: http://127.0.0.1:8000/docs, Vite: http://127.0.0.1:5173
```

> Сохранность прежней БД: `compose.dev.yml` использует имя Compose-проекта `backend` и том `backend_postgres_data`, как старая `backend/compose.yml`. Старые контейнеры/volumes **не удаляй через `down -v`**. Если база имеет исходные шесть таблиц без Alembic, сначала сделай `make backup`, затем `make baseline-existing STAMP_CONFIRM=YES` и `make migrate`. Для уже мигрированной БД достаточно `make migrate`.

## Полный контейнерный стек

```bash
make init    # создаёт корневой .env с случайными DB_PASSWORD и JWT_SECRET; не перезаписывает существующий
make build   # два образа postik-api:local и postik-web:local
make up      # контейнеры db, migrate (одноразовый), api, web
```

Главный адрес: **http://127.0.0.1:8088**. `db` и `api` не публикуют порты на хосте; Nginx раздаёт статику Vite и проксирует `/api/*` к FastAPI. Стек использует собственную БД и volume, **отдельные от dev-БД на порту 5433**. Остановка без удаления данных: `make down`.

Никаких шаблонизаторов для фронтенда здесь нет: HTML/CSS/JS собирает Vite, затем готовую папку `dist` отдаёт Nginx.

## Проверки и сопровождение

| Команда | Что делает |
|---|---|
| `make test` | Pytest и JS-тесты, JUnit XML, coverage XML, порог Python ≥65% |
| `make format` | Исправляет форматирование Ruff (изменяет файлы) |
| `make quality` | Ruff lint/format, Bandit SAST, JS syntax check |
| `make migration-check` | Чистая и заполненная **только test-БД** на `5434`, три миграции |
| `make restore-check` | Дамп → удаление → восстановление в изолированной тестовой БД |
| `make frontend-check` | Production-сборка Vite |
| `make container-check` | Реальный запуск, UID, healthcheck, остановка, пересоздание, volume, восстановление в отдельный том |
| `make verify` | Полный контур локальных функциональных и контейнерных проверок |
| `make dependency-check` | pip-audit и npm audit (CVE/уязвимости) |
| `make secrets-check` | Gitleaks проверяет историю Git; нужен настоящий Git-репозиторий |
| `make image-scan` | Trivy на Docker-образах: High/Critical блокируют результат |
| `make ci-verify` | Всё из `verify` + supply-chain проверки и правила CI |
| `make backup` | Дамп **dev-БД** (5433) в `backups/` |
| `make stack-backup` | Дамп БД **контейнерного стека** (8088) в `backups/` |
| `make restore RESTORE_CONFIRM=YES BACKUP_FILE=...` | ОПАСНО: восстанавливает dev-БД (5433) с удалением существующих объектов |

**Внимание:** проверки `migration-check`/`restore-check` намеренно пересоздают схему БД `postik_test` на 5434. У них есть защита от подключения к обычной БД. Контейнерный `check_restore_new_volume.py` использует только проект `postik_restore` и удаляет **его** volume. Ни одну из этих процедур нельзя переправлять на рабочую БД.

## GitHub Actions

`.github/workflows/ci.yml` запускает отдельные jobs для тестов, качества, миграций, восстановления, зависимостей, секретов, контейнеров и сканирования образов. `Mandatory CI gate` требует, чтобы каждый job завершился `success`. Только после push в `main` и успешного gate образы публикуются в GHCR с тегом `sha-<полный SHA коммита>`.

Перед GitHub создай настоящий CODEOWNERS: `python3 scripts/setup_codeowners.py ТВОЙ_ЛОГИН`, затем включи Ruleset для `main` с обязательным PR, status check `Mandatory CI gate` и review владельца кода. **Без включения правил в GitHub файлы не обеспечивают защиту.** CI в архиве подготовлен, но не может считаться проверенным в GitHub до первого реального запуска.

## Документация

- [Архитектура](docs/ARCHITECTURE.md)
- [Эксплуатация и команды](docs/OPERATIONS.md)
- [CI, GitHub и правила PR](docs/CI.md)
- [Авторизация](docs/AUTH.md)

**Безопасность:** `.env`, `node_modules`, `.venv`, дампы, отчёты и реальный JWT_SECRET не включены в архив и не должны попадать в Git. Не запускай этот локальный HTTP-стек напрямую в публичном интернете: для production нужны HTTPS, `COOKIE_SECURE=1`, защищённые секреты и наблюдаемость.
