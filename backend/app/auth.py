"""JWT в HttpOnly cookie. Пароли Argon2id; CSRF = отдельный токен, связанный с JWT.

Доступ к паролю и JWT из JavaScript не нужен: браузер прикладывает cookie сам.
JWT подписан, но logout отзывает идентификатор сессии (jti) в БД.
"""

from datetime import datetime, timedelta, timezone
from hashlib import sha256
from hmac import compare_digest
from secrets import token_urlsafe
from uuid import uuid4

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError, VerificationError
from fastapi import Depends, Header, HTTPException, Request, Response
from sqlalchemy.orm import Session
from . import models
from .database import get_db
from .settings import ACCESS_MINUTES, ALLOWED_ORIGINS, COOKIE_SECURE, JWT_SECRET

password_hasher = PasswordHasher(time_cost=2, memory_cost=19456, parallelism=2)
COOKIE = "postik_access"
CSRF_COOKIE = "postik_csrf"


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def check_password(password: str, password_hash: str) -> bool:
    try:
        return password_hasher.verify(password_hash, password)
    except (VerifyMismatchError, InvalidHashError, VerificationError):
        return False


def require_origin(request: Request) -> None:
    """Дополнительная проверка CSRF: запрещаем запросы с чужого Origin."""
    origin = request.headers.get("origin")
    if origin is not None and origin.rstrip("/") not in ALLOWED_ORIGINS:
        raise HTTPException(403, "Недопустимый Origin")
    # При наличии Sec-Fetch-Site блокируем cross-site POST без исключений.
    if request.headers.get("sec-fetch-site") == "cross-site":
        raise HTTPException(403, "Запрещён межсайтовый запрос")


def start_session(response: Response, user: models.User, db: Session) -> None:
    now = datetime.now(timezone.utc)
    expires = now + timedelta(minutes=ACCESS_MINUTES)
    sid, csrf = str(uuid4()), token_urlsafe(32)
    db.add(models.AuthSession(id=sid, user_id=user.id, expires_at=expires))
    token = jwt.encode(
        {
            "iss": "postik",
            "sub": str(user.id),
            "sid": sid,
            "csrf_hash": sha256(csrf.encode()).hexdigest(),
            "iat": now,
            "exp": expires,
        },
        JWT_SECRET,
        algorithm="HS256",
    )
    # HttpOnly не позволяет скриптам прочитать JWT. Вторую cookie JS читает
    # и посылает в X-CSRF-Token; при XSS эта защита не помогает (нужна CSP).
    common = dict(secure=COOKIE_SECURE, samesite="lax", path="/", max_age=ACCESS_MINUTES * 60)
    response.set_cookie(COOKIE, token, httponly=True, **common)
    response.set_cookie(CSRF_COOKIE, csrf, httponly=False, **common)


def clear_session(response: Response) -> None:
    response.delete_cookie(COOKIE, path="/", secure=COOKIE_SECURE, samesite="lax")
    response.delete_cookie(CSRF_COOKIE, path="/", secure=COOKIE_SECURE, samesite="lax")


def current_identity(request: Request, db: Session = Depends(get_db)):
    token = request.cookies.get(COOKIE)
    if not token:
        raise HTTPException(401, "Необходимо войти в аккаунт")
    try:
        payload = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=["HS256"],
            issuer="postik",
            options={"require": ["sub", "sid", "csrf_hash", "exp", "iat", "iss"]},
        )
        uid = int(payload["sub"])
    except (jwt.PyJWTError, ValueError, TypeError):
        raise HTTPException(401, "Сессия недействительна") from None
    auth_session = db.get(models.AuthSession, payload["sid"])
    now = datetime.now(timezone.utc)
    expires_at = auth_session.expires_at if auth_session is not None else now
    if expires_at.tzinfo is None:  # SQLite в изолированных тестах не хранит timezone
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if (
        auth_session is None
        or auth_session.user_id != uid
        or auth_session.revoked_at is not None
        or expires_at <= now
    ):
        raise HTTPException(401, "Сессия завершена")
    user = db.get(models.User, uid)
    if user is None or not user.is_active:
        raise HTTPException(401, "Аккаунт недоступен")
    return user, payload


def require_user(identity=Depends(current_identity)) -> models.User:
    return identity[0]


def require_write(
    request: Request,
    identity=Depends(current_identity),
    csrf_header: str | None = Header(default=None, alias="X-CSRF-Token"),
) -> models.User:
    require_origin(request)
    user, payload = identity
    cookie_csrf = request.cookies.get(CSRF_COOKIE, "")
    header_csrf = csrf_header or ""
    if (
        not cookie_csrf
        or not header_csrf
        or not compare_digest(cookie_csrf, header_csrf)
        or not compare_digest(sha256(header_csrf.encode()).hexdigest(), payload["csrf_hash"])
    ):
        raise HTTPException(403, "Неверный или отсутствующий CSRF-токен")
    return user
