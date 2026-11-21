"""Unit: бизнес-правила без сетевого API и PostgreSQL."""

import pytest
from pydantic import ValidationError
from app.auth import check_password, hash_password
from app.main import tag_slug
from app.schemas import PostCreate, UserCreate, PostUpdate


def test_password_is_not_plaintext_and_checks():
    digest = hash_password("long-enough-secret")
    assert digest.startswith("$argon2id$")
    assert digest != "long-enough-secret"
    assert check_password("long-enough-secret", digest)
    assert not check_password("wrong-password", digest)
    assert not check_password("anything", "!disabled-dev-account")


def test_username_lowercase_and_bounds():
    assert (
        UserCreate(username="  RiMaShi ", email="A@EXAMPLE.com", password="12345678").username
        == "rimashi"
    )
    for username in ["ab", "кириллица", "a-b", "x" * 33]:
        with pytest.raises(ValidationError):
            UserCreate(username=username, email="a@example.com", password="12345678")


def test_post_validation_bounds():
    good = dict(title="Тестовая статья", content_md="## Текст", topic_ids=[1])
    assert PostCreate(**good).format == "article"
    for change in [
        dict(title="ab"),
        dict(content_md=""),
        dict(topic_ids=[]),
        dict(topic_ids=[1, 2, 3, 4]),
        dict(format="video"),
        dict(tag_names=["t"] * 6),
    ]:
        with pytest.raises(ValidationError):
            PostCreate(**(good | change))


def test_patch_partial_semantics():
    model = PostUpdate(title="Новое название")
    assert model.model_dump(exclude_unset=True) == {"title": "Новое название"}
    assert PostUpdate(summary=None).model_dump(exclude_unset=True) == {"summary": None}


def test_tag_slug_transliteration():
    assert tag_slug("Мой сервер") == "moi-server"
    assert tag_slug("Linux & Docker") == "linux-docker"
    assert tag_slug("!!!") == ""
