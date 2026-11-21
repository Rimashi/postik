"""Pydantic-схемы входа/выхода. Это не описание таблиц БД."""

from datetime import datetime
from typing import Literal, Annotated
from pydantic import BaseModel, ConfigDict, BeforeValidator, EmailStr, Field


def normalize_username(username: str) -> str:
    if isinstance(username, str):
        return (
            username.strip().lower()
        )  # временно, потом появится display_name, где будет отображение с учетом регистра
    return username


Username = Annotated[
    str,
    BeforeValidator(normalize_username),
    Field(min_length=3, max_length=32, pattern=r"^[a-z0-9_]+$"),
]  # Правило повторяется в UserCreate и на уровне PostgreSQL.


class UserCreate(BaseModel):
    username: Username
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    bio: str | None
    avatar_url: str | None
    role: Literal["user", "admin"]
    created_at: datetime


class UserUpdate(BaseModel):
    username: Username | None = None
    bio: str | None = Field(default=None, max_length=2048)
    city: str | None = Field(default=None, max_length=100)
    other_site: str | None = None
    # email меняют через отдельное подтверждение — не в обычном редактировании профиля.


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class PostCreate(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    summary: str | None = Field(default=None, max_length=500)
    content_md: str = Field(min_length=1)
    format: Literal["article", "post", "blog"] = "article"
    cover_url: str | None = None
    topic_ids: list[int] = Field(min_length=1, max_length=3)
    tag_names: list[str] = Field(default_factory=list, max_length=5)
    parent_id: int | None = None
    # author_id, created_at, updated_at устанавливаются сервером, а не клиентом.


class PostUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=200)
    summary: str | None = Field(default=None, max_length=500)
    content_md: str | None = Field(default=None, min_length=1)
    format: Literal["article", "post", "blog"] | None = None
    cover_url: str | None = None
    topic_ids: list[int] | None = Field(default=None, min_length=1, max_length=3)
    tag_names: list[str] | None = Field(default=None, max_length=5)


class PostRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    author_id: int
    parent_id: int | None
    title: str
    summary: str | None
    content_md: str
    format: Literal["article", "post", "blog"]
    cover_url: str | None
    created_at: datetime
    published_at: datetime
    views_count: int = 0
    author_username: str
    topic_ids: list[int]
    tag_names: list[str]


class TopicRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    slug: str


class TagRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    slug: str
