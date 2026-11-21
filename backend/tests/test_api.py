"""Integration: HTTP -> FastAPI -> SQLAlchemy -> изолированная БД.

Тесты требуют реальных FK и транзакций, но не трогают docker-db разработчика.
"""

from app import models
from app.database import get_db
from app.main import app
from .conftest import csrf_headers


def make_post(client, **changes):
    data = {
        "title": "Проверочная статья",
        "summary": "Текст для теста",
        "content_md": "# Начало\n\nHello",
        "format": "article",
        "topic_ids": [1],
        "tag_names": ["Linux"],
        "parent_id": None,
    }
    data.update(changes)
    return client.post("/api/v1/posts", json=data, headers=csrf_headers(client))


def put_topic(client):
    from app import models

    dep = app.dependency_overrides[get_db]
    with next(dep()) as db:
        db.add(models.Topic(name="Технологии", slug="technology"))
        db.commit()


def test_health_and_public_empty(client):
    assert client.get("/api/health").json()["status"] == "ok"
    assert client.get("/api/v1/posts").json() == []
    assert client.get("/api/v1/posts/count").json() == {"count": 0}
    assert client.get("/api/v1/posts/999").status_code == 404
    assert client.get("/api/v1/users/nobody").status_code == 404


def test_login_and_registration_errors(registered):
    c = registered
    assert c.get("/api/v1/auth/me").json()["username"] == "tester_01"
    assert (
        c.post(
            "/api/v1/auth/register",
            json={"username": "tester_01", "email": "other@example.com", "password": "secret123"},
        ).status_code
        == 409
    )
    assert (
        c.post(
            "/api/v1/auth/login", json={"email": "tester@example.com", "password": "incorrect"}
        ).status_code
        == 401
    )
    assert (
        c.post(
            "/api/v1/auth/login",
            json={"email": "tester@example.com", "password": "good-password-123"},
        ).status_code
        == 200
    )
    assert c.get("/api/v1/users/TESTER_01").status_code == 200
    assert "password_hash" not in c.get("/api/v1/users/tester_01").json()
    assert "email" not in c.get("/api/v1/users/tester_01").json()


def test_csrf_reject_and_origin(registered):
    c = registered
    put_topic(c)
    payload = {"title": "Название статьи", "content_md": "hello", "topic_ids": [1]}
    assert c.post("/api/v1/posts", json=payload).status_code == 403
    assert c.post("/api/v1/posts", json=payload, headers={"X-CSRF-Token": "bad"}).status_code == 403
    assert (
        c.post(
            "/api/v1/posts",
            json=payload,
            headers={**csrf_headers(c), "Origin": "https://evil.example"},
        ).status_code
        == 403
    )
    assert c.get("/api/v1/posts/count").json()["count"] == 0


def test_post_crud_and_relations(registered):
    c = registered
    put_topic(c)
    post = make_post(c)
    assert post.status_code == 201, post.text
    p = post.json()
    assert p["id"] == 1 and p["author_username"] == "tester_01"
    assert p["tag_names"] == ["Linux"] and p["topic_ids"] == [1]
    assert p["views_count"] == 0
    assert c.get("/api/v1/posts/count").json()["count"] == 1
    assert len(c.get("/api/v1/posts?limit=1").json()) == 1
    assert c.get("/api/v1/posts/1").json()["views_count"] == 1
    assert c.get("/api/v1/posts/1").json()["views_count"] == 2
    child = make_post(c, title="Продолжение статьи", parent_id=1, tag_names=[])
    assert child.status_code == 201, child.text
    assert len(c.get("/api/v1/posts/1/continuations").json()) == 1
    assert c.get("/api/v1/posts/99/continuations").status_code == 404
    patch = c.patch("/api/v1/posts/1", json={"title": "Новое название"}, headers=csrf_headers(c))
    assert patch.status_code == 200 and patch.json()["title"] == "Новое название"
    assert (
        c.patch("/api/v1/posts/1", json={"title": None}, headers=csrf_headers(c)).status_code == 422
    )


def test_invalid_topics_tags_and_parent(registered):
    c = registered
    put_topic(c)
    assert make_post(c, topic_ids=[1, 1]).status_code == 400
    assert make_post(c, topic_ids=[999]).status_code == 400
    assert make_post(c, parent_id=900).status_code == 400
    assert make_post(c, tag_names=["---"]).status_code == 400
    assert make_post(c, tag_names=["Linux", "linux"]).status_code == 400
    assert make_post(c, content_md="").status_code == 422
    assert c.get("/api/v1/posts/count").json()["count"] == 0


def test_tag_blocked_and_public_listing(registered):
    c = registered
    put_topic(c)
    assert make_post(c).status_code == 201
    assert len(c.get("/api/v1/tags").json()) == 1
    dep = app.dependency_overrides[get_db]
    with next(dep()) as db:
        tag = db.get(models.Tag, 1)
        tag.is_blocked = True
        db.commit()
    assert c.get("/api/v1/tags").json() == []
    assert c.get("/api/v1/posts/1").json()["tag_names"] == []
    assert make_post(c, tag_names=["Linux"]).status_code == 400
    with next(dep()) as db:
        db.add(models.Tag(name="Тестовый тег", slug="old-manual-slug", is_blocked=True))
        db.commit()
    assert make_post(c, tag_names=["Тестовый тег"]).status_code == 400
    assert len(c.get("/api/v1/topics").json()) == 1


def test_logout_revokes_token(registered):
    c = registered
    token = c.cookies.get("postik_access")
    assert c.post("/api/v1/auth/logout", headers=csrf_headers(c)).status_code == 204
    assert c.get("/api/v1/auth/me").status_code == 401
    # Попытка вернуть старую JWT-cookie не восстановит сессию: jti в БД отозван.
    c.cookies.set("postik_access", token)
    assert c.get("/api/v1/auth/me").status_code == 401


def test_ownership(registered):
    c = registered
    put_topic(c)
    assert make_post(c).status_code == 201
    c.post("/api/v1/auth/logout", headers=csrf_headers(c))
    r = c.post(
        "/api/v1/auth/register",
        json={
            "username": "second_user",
            "email": "second@example.com",
            "password": "secret-password",
        },
    )
    assert r.status_code == 201
    assert (
        c.patch(
            "/api/v1/posts/1", json={"title": "Украденная статья"}, headers=csrf_headers(c)
        ).status_code
        == 403
    )
    assert c.get("/api/v1/posts/1").json()["title"] == "Проверочная статья"
    assert (
        c.patch(
            "/api/v1/users/me", json={"bio": "Новый текст"}, headers=csrf_headers(c)
        ).status_code
        == 200
    )


def test_inactive_user_cannot_authenticate(registered):
    c = registered
    dep = app.dependency_overrides[get_db]
    with next(dep()) as db:
        user = db.get(models.User, 1)
        user.is_active = False
        db.commit()
    assert c.get("/api/v1/auth/me").status_code == 401
    assert (
        c.post(
            "/api/v1/auth/login",
            json={"email": "tester@example.com", "password": "good-password-123"},
        ).status_code
        == 401
    )
