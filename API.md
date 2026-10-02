# HTTP API

Ниже перечислены основные HTTP-маршруты текущей версии PSME.

## Служебный endpoint

### `GET /api/health`
Проверяет работоспособность Flask-приложения и соединение с PostgreSQL.

Успешный ответ:

```json
{
  "status": "ok",
  "database": "ok"
}
```

При недоступности БД возвращается HTTP 503.

## Аутентификация

### `POST /users/register`
Регистрация пользователя.

Поля формы / JSON:

```json
{
  "login": "user",
  "email": "user@example.com",
  "pass": "password"
}
```

### `POST /users/login`
Вход по логину и паролю.

### `GET /users/logout`
Завершение пользовательской сессии.

## Публикации

### `GET /posts/api/feed`
Публичная лента опубликованных материалов.

Query-параметры:

- `sort=recent|popular|likes`;
- `period=all|week|month`;
- `tag=<tag>` — может повторяться.

### `GET /posts/api/posts/{post_id}`
Получение публикации.

### `POST /posts/api/posts`
Создание или изменение публикации. Требует входа.

Основные поля:

```json
{
  "id": null,
  "title": "Заголовок",
  "content_md": "Текст в Markdown",
  "excerpt": "Краткое описание",
  "category_id": 1,
  "tags": "python, flask",
  "status": "draft"
}
```

### `DELETE /posts/api/posts/{post_id}`
Удаление публикации автором или администратором.

### `GET /posts/api/my`
Публикации текущего пользователя.

### `POST /posts/api/posts/{post_id}/vote`
Лайк или дизлайк. Значение `value` должно быть `1` или `-1`.

### `POST /posts/api/posts/{post_id}/save`
Добавляет публикацию в сохранённые или удаляет её оттуда.

### `GET /posts/api/posts/{post_id}/stats`
Статистика публикации. Доступна автору или администратору.

## Категории и теги

### `GET /posts/api/categories`
Список категорий.

### `GET /posts/api/tags`
Список тегов. Поддерживает `?q=<строка>`.

## Комментарии

### `GET /posts/api/posts/{post_id}/comments`
Получение дерева комментариев.

### `POST /posts/api/posts/{post_id}/comments`
Создание комментария или ответа. Требует входа.

### `POST /posts/api/comments/{comment_id}/vote`
Лайк или дизлайк комментария.

### `POST /posts/api/comments/{comment_id}/pin`
Закрепление комментария автором публикации или администратором.

## Загрузка изображений

### `POST /posts/api/upload-image`
Загрузка изображения для публикации. Требует входа.
Допустимые расширения: `png`, `jpg`, `jpeg`, `gif`, `webp`.
