"""Идемпотентные справочники для локального MVP; пароль не создаётся."""

from sqlalchemy import select
from .database import SessionLocal
from .models import Topic

DEFAULT_TOPICS = (
    ("Технологии", "technology"),
    ("Программирование", "programming"),
    ("Саморазвитие", "self-development"),
    ("Наука", "science"),
    ("Дизайн", "design"),
    ("Жизнь", "life"),
    ("Культура", "culture"),
)


def seed_topics():
    with SessionLocal.begin() as session:
        existing = set(session.scalars(select(Topic.slug)).all())
        for name, slug in DEFAULT_TOPICS:
            if slug not in existing:
                session.add(Topic(name=name, slug=slug))


if __name__ == "__main__":
    seed_topics()
