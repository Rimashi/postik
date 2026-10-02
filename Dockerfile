FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

RUN useradd --create-home --uid 10001 postik

COPY --chown=postik:postik . .

RUN mkdir -p /app/static/uploads/posts \
    && chown -R postik:postik /app/static/uploads

USER postik

EXPOSE 8000

CMD [
    "gunicorn",
    "--workers", "2",
    "--bind", "0.0.0.0:8000",
    "--access-logfile", "-",
    "--error-logfile", "-",
    "app:app"
]
