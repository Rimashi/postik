from datetime import datetime

from slugify import slugify

from app import db
from app.models.post_models import Category, Post, PostStatus, Tag


def save_post(data, user, post_id=None):
    """Создаёт новый пост или обновляет существующий."""
    title = str(data.get("title", "")).strip()
    if not title:
        return None, "title_required"

    slug = slugify(title)
    base_slug = slug
    counter = 1

    existing = Post.query.filter_by(slug=slug).first()
    while existing and (not post_id or existing.id != int(post_id)):
        slug = f"{base_slug}-{counter}"
        counter += 1
        existing = Post.query.filter_by(slug=slug).first()

    if post_id:
        post = Post.query.get_or_404(post_id)
        if post.author_id != user.id and not user.is_admin:
            return None, "forbidden"
    else:
        post = Post(author_id=user.id)

    post.title = title
    post.slug = slug
    post.content_md = str(data.get("content_md", ""))
    post.cover_image = str(data.get("cover_image", ""))
    post.excerpt = str(data.get("excerpt", ""))

    category_id = data.get("category_id")
    if category_id:
        category = Category.query.get(category_id)
        if category is None:
            return None, "category_not_found"
        post.category_id = category.id

    tags_value = data.get("tags", "")
    if isinstance(tags_value, list):
        tag_names = [str(tag).strip() for tag in tags_value if str(tag).strip()]
    else:
        tag_names = [tag.strip() for tag in str(tags_value).split(",") if tag.strip()]

    tags = []
    for name in tag_names:
        tag_slug = slugify(name)
        tag = Tag.query.filter_by(slug=tag_slug).first()
        if tag is None:
            tag = Tag(name=name, slug=tag_slug, created_by=user.id)
            db.session.add(tag)
        tags.append(tag)
    post.tags = tags

    status_str = data.get("status", "draft")
    if status_str == "published":
        post.status = PostStatus.PUBLISHED
        if post.published_at is None:
            post.published_at = datetime.utcnow()
    elif status_str == "under_review":
        post.status = PostStatus.UNDER_REVIEW
    else:
        post.status = PostStatus.DRAFT

    try:
        if not post_id:
            db.session.add(post)
        db.session.commit()
        return post, None
    except Exception:
        db.session.rollback()
        return None, "database_error"


def delete_post(post_id, user):
    post = Post.query.get_or_404(post_id)
    if post.author_id != user.id and not user.is_admin:
        return False, "forbidden"
    db.session.delete(post)
    db.session.commit()
    return True, None
