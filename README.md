# PSME

платформа публикации и обсуждения статей.

Текущая версия основана на Flask. В дальнейшем архитектура, схема БД и пользовательский интерфейс могут быть переработаны; для ЛР1 фиксируется работоспособное текущее состояние проекта.

## Что уже есть

- Flask + Jinja2 веб-интерфейс;
- PostgreSQL + SQLAlchemy;
- регистрация и аутентификация;
- роли `user`, `moderator`, `admin`;
- публикации и черновики;
- категории и теги;
- комментарии и ответы;
- лайки/дизлайки;
- сохранённые публикации;
- загрузка изображений;
- HTTP API;
- обработка части некорректных запросов;
- конфигурация через переменные окружения;
- healthcheck `GET /api/health`.

## Архитектура

```text
Browser
   |
   v
Flask routes
   |
   v
Controllers
   |
   v
Services
   |
   v
SQLAlchemy models
   |
   v
PostgreSQL
```

Проект пока не является завершённой копией крупной платформы: часть интерфейса и административных функций будет развиваться позже.

## Быстрый локальный запуск

Нужны Python 3.11+ и PostgreSQL.

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Создать БД и пользователя PostgreSQL:

```sql
CREATE USER psme_app WITH PASSWORD 'your-password';
CREATE DATABASE psme OWNER psme_app;
```

Указать тот же пароль в `.env`, после чего:

```bash
python app.py
```

По умолчанию сайт доступен на `http://127.0.0.1:8000`.

Healthcheck:

```text
http://127.0.0.1:8000/api/health
```

## Переменные окружения

Список переменных приведён в `.env.example`.

Основные:

- `DATABASE_URL` — подключение к PostgreSQL;
- `SECRET_KEY` — секрет Flask-сессии;
- `ADMIN_LOGIN`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` — первоначальный администратор;
- `APP_HOST`, `APP_PORT` — параметры локального запуска.

`.env` находится в `.gitignore` и не должен попадать в репозиторий.

## Основные сущности

В проекте больше трёх связанных сущностей. Например:

```text
User -> Post -> Comment
        |
        +-> Category
        +<-> Tag
```

Полная схема: [`schema.dbml`](schema.dbml).

## Документация

- [`TECHNICAL_SPEC.md`](TECHNICAL_SPEC.md) — ТЗ для ЛР1;
- [`API.md`](API.md) — HTTP API;
- [`GIT_PROCESS.md`](GIT_PROCESS.md) — правила работы с Git;
- [`schema.dbml`](schema.dbml) — схема данных;
- [`docs/LAB1_CHECKLIST.md`](docs/LAB1_CHECKLIST.md) — проверка требований ЛР1;
- [`docs/LAB2.md`](docs/LAB2.md) — развёртывание на двух Linux-машинах.

## ЛР2

Для ЛР2 подготовлены:

- systemd unit `deploy/systemd/psme.service`;
- пример серверного env `deploy/env/psme.env.example`;
- скрипты подготовки app- и DB-серверов;
- скрипты настройки firewall;
- команды проверки systemd, сети, процесса, порта и журналов.

Подробная последовательность: [`docs/LAB2.md`](docs/LAB2.md).
