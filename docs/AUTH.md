# Авторизация: как всё работает

1. **Регистрация** `POST /api/v1/auth/register`: `UserCreate` нормализует username к нижнему регистру и проверяет email/пароль. Argon2id генерирует индивидуальную соль и стойкий `password_hash`. Сырой пароль в БД не сохраняется. Уникальность username/email защищена БД.
2. **Вход** `POST /api/v1/auth/login`: сверяем пароль с сохранённым Argon2id-хешем, не читаем пароль обратно. Ответ выставляет две cookie: `postik_access` (`HttpOnly`, подписанный HS256 JWT) и `postik_csrf` (JS может прочитать). JWT содержит `sub`, `sid`, `exp`, `iat`, `iss`, SHA256-хеш CSRF. Клиент **не хранит JWT в localStorage**.
3. **Проверка пользователя**: FastAPI читает JWT из cookie, проверяет подпись, срок, имя эмитента и запись `auth_sessions` (не отозвана). Существование активного пользователя проверяется в БД. `require_user` предоставляет Python-объект `User` обработчику.
4. **Запись данных**: `require_write` поверх `require_user` требует `X-CSRF-Token`, равный CSRF-cookie и хешу внутри JWT, а также отклоняет чужой `Origin` и `Sec-Fetch-Site: cross-site`. В `src/api/client.js` заголовок добавляется ко всем POST/PATCH/DELETE автоматически. Дополнительная защита — `SameSite=Lax` и same-origin Vite proxy.
5. **Выход** `POST /api/v1/auth/logout`: помечаем запись `auth_sessions.revoked_at`, затем удаляем обе cookie. Поэтому даже сохранённый ранее JWT после logout не принимается. Срок жизни access JWT — `ACCESS_MINUTES`, refresh token пока нет: нужно войти снова.
6. **Права**: `POST /posts`, `PATCH /posts/{id}` работают только с аутентифицированным пользователем; сервер назначает `author_id` сам. PATCH проверяет владельца. Чтение публичное.

Пользовательские профили и публикации в PostgreSQL. Локальными остаются только черновики, офлайн-снимки, неподключённые соцфункции.

## Swagger и curl

В `/docs` регистрация доступна без логина. После регистрации cookies получены браузером. Чтобы вызвать защищённый POST в Swagger UI, дополнительно передай заголовок `X-CSRF-Token` со значением `postik_csrf` из браузерных cookies (либо вызывай через сам фронтенд — он делает это автоматически). `/docs` не обязана показывать JWT в OpenAPI, так как cookie — приватный транспорт.

Для Linux curl:

```bash
curl -c /tmp/postik.cookies -H 'Content-Type: application/json' \
  -d '{"username":"reader1","email":"reader1@example.com","password":"strong-password-123"}' \
  http://127.0.0.1:8000/api/v1/auth/register
# csrf читается из cookies как отдельная строка; не печатай секретный JWT в логах
CSRF=$(awk '$6 == "postik_csrf" { print $7 }' /tmp/postik.cookies)
curl -b /tmp/postik.cookies -H "X-CSRF-Token: $CSRF" -H 'Content-Type: application/json' \
  -d '{"title":"Тестовая статья","content_md":"# Привет","topic_ids":[1],"tag_names":[]}' \
  http://127.0.0.1:8000/api/v1/posts
```

**Безопасность:** HTTPS, корректный `ALLOWED_ORIGINS`, `COOKIE_SECURE=1`, секреты через env, rate limiting на вход, подтверждение email, ротация JWT, управление сеансами и CSP — до публичного запуска. Сейчас MVP подходит для локальной разработки и учёбы, но не является законченной production-auth системой. Не коммить cookies и dump с реальными данными.
