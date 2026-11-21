"""Постик MVP: чтение статей, регистрация, cookie-JWT, публикация.

Маршруты небольшие специально: понятный пример FastAPI + SQLAlchemy без
лишних controller/service/repository для учебного проекта.
"""

from contextlib import asynccontextmanager
from datetime import datetime, timezone
import re

from fastapi import Depends, FastAPI, HTTPException, Request, Response, status
from sqlalchemy import func, select, text, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload
from unidecode import unidecode

from . import models
from .auth import (
    check_password,
    clear_session,
    current_identity,
    hash_password,
    require_origin,
    require_user,
    require_write,
    start_session,
)
from .database import engine, get_db
from .schemas import (
    PostCreate,
    PostRead,
    PostUpdate,
    TagRead,
    TopicRead,
    UserCreate,
    UserLogin,
    UserRead,
    UserUpdate,
)
from .settings import validate_runtime_config


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Не вызываем create_all: структуру создаёт только Alembic (make migrate).
    validate_runtime_config()
    yield
    engine.dispose()


app = FastAPI(title="Постик API", version="0.2.0", lifespan=lifespan)


def post_output(post: models.Post) -> PostRead:
    """Явно формируем DTO: ORM-отношения не совпадают с полями JSON."""
    return PostRead.model_validate(
        {
            "id": post.id,
            "author_id": post.author_id,
            "author_username": post.author.username,
            "parent_id": post.parent_id,
            "title": post.title,
            "summary": post.summary,
            "content_md": post.content_md,
            "format": post.format,
            "cover_url": post.cover_url,
            "created_at": post.created_at,
            "published_at": post.published_at,
            "topic_ids": [t.id for t in post.topics],
            "tag_names": [t.name for t in post.tags if not t.is_blocked],
            "views_count": post.views_count,
        }
    )


def with_relations(stmt):
    # Избегаем N+1 запросов при сериализации 20 статей.
    return stmt.options(
        selectinload(models.Post.author),
        selectinload(models.Post.topics),
        selectinload(models.Post.tags),
    )


def checked_topics(db: Session, topic_ids: list[int]):
    if len(set(topic_ids)) != len(topic_ids):
        raise HTTPException(400, "Темы повторяются")
    found = db.scalars(
        select(models.Topic).where(models.Topic.id.in_(topic_ids), models.Topic.is_active.is_(True))
    ).all()
    if len(found) != len(topic_ids):
        raise HTTPException(400, "Некоторые темы не найдены или недоступны")
    return found


def tag_slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", unidecode(value).lower()).strip("-")


def checked_tags(db: Session, names: list[str], author: models.User):
    """Одна функция для POST/PATCH. Граничные случаи проверяет и Pydantic, и БД."""
    result, seen = [], set()
    for raw in names:
        name = raw.strip()
        if not (1 <= len(name) <= 80):
            raise HTTPException(400, "Длина тега должна быть от 1 до 80 символов")
        slug = tag_slug(name)
        if not slug or len(slug) > 100 or slug in seen:
            raise HTTPException(400, "Некорректный или повторяющийся тег")
        seen.add(slug)
        # Проверяем не только slug, но и имя: старый заблокированный тег
        # мог получить slug по другой схеме. Создавать его дубль нельзя.
        tag = db.scalar(
            select(models.Tag).where(
                (models.Tag.slug == slug)
                | (models.Tag.name == name)
                | (func.lower(models.Tag.name) == name.casefold())
            )
        )
        if tag is None:
            tag = models.Tag(name=name, slug=slug, created_by_id=author.id)
            db.add(tag)
            db.flush()
        if tag.is_blocked:
            raise HTTPException(400, "Заблокированный тег использовать нельзя")
        result.append(tag)
    return result


@app.get("/api/health")
def health(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ok", "database": "ok"}


@app.post("/api/v1/auth/register", response_model=UserRead, status_code=201)
def register(data: UserCreate, response: Response, request: Request, db: Session = Depends(get_db)):
    require_origin(request)
    email = str(data.email).lower()
    # Ошибку уникальности проверяет и база (защита от двух одновременных запросов).
    if db.scalar(
        select(models.User.id).where(
            (models.User.username == data.username) | (models.User.email == email)
        )
    ):
        raise HTTPException(409, "Имя или почта уже заняты")
    try:
        user = models.User(
            username=data.username, email=email, password_hash=hash_password(data.password)
        )
        db.add(user)
        db.flush()  # получаем user.id, ещё не фиксируя транзакцию
        start_session(response, user, db)
        db.commit()
        db.refresh(user)
        return user
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Имя или почта уже заняты") from None


@app.post("/api/v1/auth/login", response_model=UserRead)
def login(data: UserLogin, response: Response, request: Request, db: Session = Depends(get_db)):
    require_origin(request)
    user = db.scalar(select(models.User).where(models.User.email == str(data.email).lower()))
    if user is None or not user.is_active or not check_password(data.password, user.password_hash):
        raise HTTPException(401, "Неверная почта или пароль")
    start_session(response, user, db)
    db.commit()
    return user


@app.get("/api/v1/auth/me", response_model=UserRead)
def me(user: models.User = Depends(require_user)):
    return user


@app.post("/api/v1/auth/logout", status_code=204)
def logout(
    response: Response,
    identity=Depends(current_identity),
    user: models.User = Depends(require_write),
    db: Session = Depends(get_db),
):
    # Logout отзывает jti; украденная раньше cookie после этого не поможет.
    db_auth = db.get(models.AuthSession, identity[1]["sid"])
    db_auth.revoked_at = datetime.now(timezone.utc)
    db.commit()
    clear_session(response)


@app.patch("/api/v1/users/me", response_model=UserRead)
def update_me(
    data: UserUpdate, user: models.User = Depends(require_write), db: Session = Depends(get_db)
):
    changes = data.model_dump(exclude_unset=True)
    if "username" in changes and changes["username"] is None:
        raise HTTPException(422, "Имя не может быть null")
    for key, value in changes.items():
        setattr(user, key, value)
    try:
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Имя пользователя уже занято") from None


@app.get("/api/v1/users/{username}", response_model=UserRead)
def user_profile(username: str, db: Session = Depends(get_db)):
    user = db.scalar(
        select(models.User).where(
            models.User.username == username.strip().lower(), models.User.is_active.is_(True)
        )
    )
    if not user:
        raise HTTPException(404, "Пользователь не найден")
    return user


@app.get("/api/v1/topics", response_model=list[TopicRead])
def list_topics(db: Session = Depends(get_db)):
    return db.scalars(
        select(models.Topic).where(models.Topic.is_active.is_(True)).order_by(models.Topic.name)
    ).all()


@app.get("/api/v1/tags", response_model=list[TagRead])
def list_tags(db: Session = Depends(get_db)):
    return db.scalars(
        select(models.Tag).where(models.Tag.is_blocked.is_(False)).order_by(models.Tag.name)
    ).all()


@app.get("/api/v1/posts/count")
def count_posts(db: Session = Depends(get_db)):
    return {"count": db.scalar(select(func.count(models.Post.id)))}


@app.get("/api/v1/posts", response_model=list[PostRead])
def list_posts(
    limit: int = 20, offset: int = 0, author: str | None = None, db: Session = Depends(get_db)
):
    if not 1 <= limit <= 100 or offset < 0:
        raise HTTPException(422, "Неверные параметры пагинации")
    stmt = select(models.Post)
    if author:
        stmt = stmt.join(models.User, models.Post.author_id == models.User.id).where(
            models.User.username == author.lower()
        )
    posts = db.scalars(
        with_relations(
            stmt.order_by(models.Post.published_at.desc(), models.Post.id.desc())
            .limit(limit)
            .offset(offset)
        )
    ).all()
    return [post_output(p) for p in posts]


@app.get("/api/v1/posts/{post_id}", response_model=PostRead)
def get_post(post_id: int, db: Session = Depends(get_db)):
    if post_id <= 0:
        raise HTTPException(404, "Публикация не найдена")
    post = db.scalar(with_relations(select(models.Post).where(models.Post.id == post_id)))
    if not post:
        raise HTTPException(404, "Публикация не найдена")
    # Новая функция лабораторной: атомарно увеличиваем просмотры (миграция 0003).
    db.execute(
        update(models.Post)
        .where(models.Post.id == post_id)
        .values(views_count=models.Post.views_count + 1)
    )
    db.refresh(post)
    result = post_output(post)
    db.commit()
    return result


@app.get("/api/v1/posts/{post_id}/continuations", response_model=list[PostRead])
def continuations(post_id: int, db: Session = Depends(get_db)):
    if db.get(models.Post, post_id) is None:
        raise HTTPException(404, "Исходная публикация не найдена")
    posts = db.scalars(
        with_relations(
            select(models.Post)
            .where(models.Post.parent_id == post_id)
            .order_by(models.Post.published_at.desc())
        )
    ).all()
    return [post_output(p) for p in posts]


@app.post("/api/v1/posts", status_code=status.HTTP_201_CREATED, response_model=PostRead)
def create_post(
    data: PostCreate, user: models.User = Depends(require_write), db: Session = Depends(get_db)
):
    topics = checked_topics(db, data.topic_ids)
    if data.parent_id is not None and db.get(models.Post, data.parent_id) is None:
        raise HTTPException(400, "Исходная публикация не найдена")
    try:
        tags = checked_tags(db, data.tag_names, user)
        post = models.Post(
            author_id=user.id,
            parent_id=data.parent_id,
            title=data.title,
            summary=data.summary,
            content_md=data.content_md,
            format=data.format,
            cover_url=data.cover_url,
            topics=topics,
            tags=tags,
        )
        db.add(post)
        db.flush()
        result = post_output(
            db.scalar(with_relations(select(models.Post).where(models.Post.id == post.id)))
        )
        db.commit()
        return result
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Конфликт при сохранении публикации") from None


@app.patch("/api/v1/posts/{post_id}", response_model=PostRead)
def patch_post(
    post_id: int,
    data: PostUpdate,
    user: models.User = Depends(require_write),
    db: Session = Depends(get_db),
):
    post = db.scalar(with_relations(select(models.Post).where(models.Post.id == post_id)))
    if post is None:
        raise HTTPException(404, "Публикация не найдена")
    if post.author_id != user.id:
        raise HTTPException(403, "Можно редактировать только свои публикации")
    changes = data.model_dump(exclude_unset=True)
    for field in ("title", "content_md", "format"):
        if field in changes and changes[field] is None:
            raise HTTPException(422, f"{field} не может быть null")
    for field in ("title", "summary", "content_md", "format", "cover_url"):
        if field in changes:
            setattr(post, field, changes[field])
    if "topic_ids" in changes:
        if changes["topic_ids"] is None:
            raise HTTPException(422, "Темы не могут быть null")
        post.topics = checked_topics(db, changes["topic_ids"])
    if "tag_names" in changes:
        if changes["tag_names"] is None:
            raise HTTPException(422, "Теги не могут быть null")
        post.tags = checked_tags(db, changes["tag_names"], user)
    try:
        db.flush()
        result = post_output(post)
        db.commit()
        return result
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Конфликт при обновлении публикации") from None
