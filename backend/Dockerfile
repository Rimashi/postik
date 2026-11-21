# Backend-образ. Версии базовых образов и прямых зависимостей закреплены.
# Для полной побитовой воспроизводимости дополнительно фиксируют digest образа и
# транзитивные зависимости pip (requirements lock / hashes).
FROM python:3.13.18-slim-trixie

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Забираем актуальные исправления безопасности Debian и убираем apt-cache.
RUN apt-get update \
    && apt-get upgrade -y --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Создаём НЕпривилегированную учётную запись с фиксированным UID.
RUN groupadd --system --gid 10001 postik \
    && useradd --system --uid 10001 --gid 10001 --no-create-home --shell /usr/sbin/nologin postik

# Сначала зависимости — слой кэшируется независимо от изменений app/.
COPY backend/requirements.txt /tmp/requirements.txt
# Установщик и его vendored-библиотеки не нужны для запуска FastAPI.
# Удаляем pip только после установки зависимостей, уменьшая поверхность атаки.
RUN python -m pip install --no-cache-dir -r /tmp/requirements.txt \
    && python -m pip uninstall -y setuptools wheel pip \
    && rm -f /tmp/requirements.txt

COPY --chown=10001:10001 backend/app/ /app/app/
COPY --chown=10001:10001 backend/migrations/ /app/migrations/
COPY --chown=10001:10001 backend/alembic.ini /app/alembic.ini

USER 10001:10001
EXPOSE 8000
STOPSIGNAL SIGTERM

# Проверяем реальную готовность FastAPI + соединения с БД, а не просто живой PID.
HEALTHCHECK --interval=15s --timeout=4s --start-period=25s --retries=5 \
 CMD python -c "from urllib.request import urlopen; assert urlopen('http://127.0.0.1:8000/api/health', timeout=3).status == 200" || exit 1

# Exec-форма: Uvicorn — PID 1 и получает SIGTERM напрямую.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
