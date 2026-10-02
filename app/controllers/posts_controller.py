from flask import request, jsonify, render_template, abort
from flask_login import login_required, current_user
from app.services.post_service import save_post, delete_post
from app.models.post_models import Post, PostStatus, Comment, PostVote, SavedPost, Tag, Category, CommentVote
from app import db
from datetime import datetime
from sqlalchemy import func
from datetime import timedelta
from slugify import slugify
import os
import uuid
from werkzeug.utils import secure_filename
from flask import current_app


def list_of_posts():
    return render_template("posts.html")

def get_post(post_id):
    post = Post.query.get_or_404(post_id)
    post.views_count += 1
    db.session.commit()
    is_author = current_user.is_authenticated and current_user.id == post.author_id
    return render_template(
        "post.html",
        post=post,
        is_author=is_author,
        current_user=current_user
    )

def feed_posts():
    sort = request.args.get('sort', 'recent')
    tags = request.args.getlist('tag')
    period = request.args.get('period', 'all')

    query = Post.query.filter(Post.status == PostStatus.PUBLISHED)

    # фильтр по нескольким тегам
    if tags:
        # Превращаем каждое имя тега в slug (как при создании тега)
        tag_slugs = [slugify(t) for t in tags if t.strip()]
        for slug in tag_slugs:
            query = query.filter(Post.tags.any(Tag.slug == slug))

    # фильтр по периоду
    if period == 'week':
        since = datetime.utcnow() - timedelta(days=7)
        query = query.filter(Post.published_at >= since)
    elif period == 'month':
        since = datetime.utcnow() - timedelta(days=30)
        query = query.filter(Post.published_at >= since)

    # сортировка
    if sort == 'popular':
        query = query.order_by(Post.views_count.desc())
    elif sort == 'likes':
        likes_count = (
            db.session.query(func.count(PostVote.id))
            .filter(PostVote.post_id == Post.id, PostVote.value == 1)
            .correlate(Post)
            .scalar_subquery()
        )
        # Основная сортировка по количеству лайков, дополнительная – по дате
        query = query.order_by(likes_count.desc(), Post.published_at.desc())
    else:
        query = query.order_by(Post.published_at.desc())

    posts = query.limit(50).all()
    return jsonify([{
        'id': p.id,
        'title': p.title,
        'slug': p.slug,
        'author': p.author.username,
        'published_at': p.published_at.isoformat() if p.published_at else None,
        'views_count': p.views_count,
        'tags': [t.name for t in p.tags],
        'excerpt': p.excerpt or (p.content_md[:200] + '...'),
        'cover_image': p.cover_image,
        'content_length': len(p.content_md or ''),
        'likes': PostVote.query.filter_by(post_id=p.id, value=1).count(),
        'dislikes': PostVote.query.filter_by(post_id=p.id, value=-1).count(),
    } for p in posts])


@login_required
def create_post_page():
    # страница редактора
    return render_template('create.html')

@login_required
def my_posts_page():
    return render_template('my_posts.html')

# API
@login_required
def my_posts_api():
    posts = Post.query.filter_by(author_id=current_user.id).order_by(Post.created_at.desc()).all()
    return jsonify([post_to_dict(p) for p in posts])

@login_required
def create_or_update_post():
    data = request.get_json(silent=True) or {}
    title = str(data.get('title', '')).strip()
    if not title:
        return jsonify({'error': 'title_required'}), 400
    post_id = data.get('id')
    post, error = save_post(data, current_user, post_id)
    if error:
        if error == 'forbidden':
            return jsonify({'error': error}), 403
        if error in ('title_required', 'category_not_found'):
            return jsonify({'error': error}), 400
        return jsonify({'error': error}), 500
    return jsonify({'success': True, 'post': post_to_dict(post)})

def get_tags():
    q = request.args.get('q', '').strip()
    if q:
        tags = Tag.query.filter(Tag.name.ilike(f'%{q}%')).limit(10).all()
    else:
        tags = Tag.query.order_by(Tag.name).limit(20).all()
    return jsonify([t.name for t in tags])

@login_required
def delete_post_api(post_id):
    success, error = delete_post(post_id, current_user)
    if error:
        return jsonify({'error': error}), 403
    return jsonify({'success': True})

def get_post_api(post_id):
    post = Post.query.get_or_404(post_id)
    post.views_count += 1
    db.session.commit()
    current_user_id = current_user.id if current_user.is_authenticated else None
    return jsonify(post_to_dict(post, current_user_id))

def get_categories():
    cats = Category.query.all()
    return jsonify([{'id': c.id, 'name': c.name} for c in cats])

@login_required
def toggle_vote(post_id):
    data = request.get_json(silent=True) or {}
    try:
        value = int(data.get('value', 1))
    except (TypeError, ValueError):
        return jsonify({'error': 'invalid_vote'}), 400
    if value not in (-1, 1):
        return jsonify({'error': 'invalid_vote'}), 400  # +1/-1
    existing = PostVote.query.filter_by(user_id=current_user.id, post_id=post_id).first()
    if existing:
        if existing.value == value:
            db.session.delete(existing)
        else:
            existing.value = value
    else:
        vote = PostVote(user_id=current_user.id, post_id=post_id, value=value)
        db.session.add(vote)
    db.session.commit()
    likes = PostVote.query.filter_by(post_id=post_id, value=1).count()
    dislikes = PostVote.query.filter_by(post_id=post_id, value=-1).count()
    return jsonify({'likes': likes, 'dislikes': dislikes})


@login_required
def upload_image():
    file = request.files.get("image")

    if not file:
        return jsonify({"error": "Файл не найден"}), 400

    allowed_extensions = {"png", "jpg", "jpeg", "gif", "webp"}
    filename = secure_filename(file.filename)

    if "." not in filename:
        return jsonify({"error": "Некорректный файл"}), 400

    ext = filename.rsplit(".", 1)[1].lower()

    if ext not in allowed_extensions:
        return jsonify({"error": "Недопустимый формат"}), 400

    unique_name = f"{uuid.uuid4().hex}.{ext}"
    upload_dir = os.path.join(
        current_app.root_path,
        "..",
        "static",
        "uploads",
        "posts"
    )

    os.makedirs(upload_dir, exist_ok=True)
    save_path = os.path.join(upload_dir, unique_name)
    file.save(save_path)
    image_url = f"/static/uploads/posts/{unique_name}"

    return jsonify({
        "data": {
            "filePath": image_url
        }
    })


@login_required
def toggle_save(post_id):
    saved = SavedPost.query.filter_by(user_id=current_user.id, post_id=post_id).first()
    if saved:
        db.session.delete(saved)
        saved = False
    else:
        db.session.add(SavedPost(user_id=current_user.id, post_id=post_id))
        saved = True
    db.session.commit()
    return jsonify({'saved': saved})

@login_required
def pin_comment(comment_id):
    comment = Comment.query.get_or_404(comment_id)
    post = comment.post
    if post.author_id != current_user.id and not current_user.is_admin:
        return jsonify({'error': 'Forbidden'}), 403
    comment.is_pinned = not comment.is_pinned
    db.session.commit()
    return jsonify({'pinned': comment.is_pinned})

@login_required
def post_stats(post_id):
    post = Post.query.get_or_404(post_id)
    if post.author_id != current_user.id and not current_user.is_admin:
        return jsonify({'error': 'Forbidden'}), 403
    views = post.views_count
    likes = PostVote.query.filter_by(post_id=post_id, value=1).count()
    dislikes = PostVote.query.filter_by(post_id=post_id, value=-1).count()
    saves = SavedPost.query.filter_by(post_id=post_id).count()
    comments = Comment.query.filter_by(post_id=post_id).count()
    return jsonify({
        'views': views, 'likes': likes, 'dislikes': dislikes,
        'saves': saves, 'comments': comments
    })

def post_to_dict(post, current_user_id=None):
    likes = PostVote.query.filter_by(post_id=post.id, value=1).count()
    dislikes = PostVote.query.filter_by(post_id=post.id, value=-1).count()
    user_vote = 0
    if current_user_id:
        vote = PostVote.query.filter_by(user_id=current_user_id, post_id=post.id).first()
        if vote:
            user_vote = vote.value

    return {
        'id': post.id,
        'title': post.title,
        'slug': post.slug,
        'status': post.status.value,
        'created_at': post.created_at.isoformat(),
        'content_md': post.content_md,
        'excerpt': post.excerpt,
        'cover_image': post.cover_image,
        'category_id': post.category_id,
        'tags': [t.name for t in post.tags],
        'author': post.author.username,
        'views_count': post.views_count,
        'likes': likes,
        'dislikes': dislikes,
        'user_vote': user_vote
    }

def comment_to_dict(comment, current_user_id=None):
    user_vote = 0

    if current_user_id:
        existing_vote = CommentVote.query.filter_by(
            user_id=current_user_id,
            comment_id=comment.id
        ).first()

        if existing_vote:
            user_vote = existing_vote.value

    return {
        "id": comment.id,
        "author": comment.author.username,
        "author_id": comment.author.id,
        "text": comment.content,
        "created_at": comment.created_at.isoformat(),
        "likes": CommentVote.query.filter_by(
            comment_id=comment.id,
            value=1
        ).count(),
        "dislikes": CommentVote.query.filter_by(
            comment_id=comment.id,
            value=-1
        ).count(),
        "user_vote": user_vote,
        "parent_id": comment.parent_id,
        "is_pinned": comment.is_pinned,
        "children": [
            comment_to_dict(reply, current_user_id)
            for reply in sorted(
                comment.replies,
                key=lambda x: x.created_at
            )
        ]
    }


def get_comments(post_id):
    post = Post.query.get_or_404(post_id)

    root_comments = (
        Comment.query
        .filter_by(post_id=post.id, parent_id=None)
        .order_by(
            Comment.is_pinned.desc(),
            Comment.created_at.asc()
        )
        .all()
    )

    return jsonify([
        comment_to_dict(
            c,
            current_user.id if current_user.is_authenticated else None
        )
        for c in root_comments
    ])


@login_required
def create_comment(post_id):
    post = Post.query.get_or_404(post_id)

    data = request.get_json(silent=True) or {}

    text = (data.get("text") or "").strip()
    parent_id = data.get("parent_id")

    if not text:
        return jsonify({"error": "empty_comment"}), 400

    parent_comment = None

    if parent_id:
        parent_comment = Comment.query.get(parent_id)

        if not parent_comment:
            return jsonify({"error": "parent_not_found"}), 404

        if parent_comment.post_id != post.id:
            return jsonify({"error": "invalid_parent"}), 400

    comment = Comment(
        post_id=post.id,
        user_id=current_user.id,
        parent_id=parent_id,
        content=text
    )

    db.session.add(comment)
    db.session.commit()

    return jsonify({
        "success": True,
        "comment": comment_to_dict(comment, current_user.id)
    })


@login_required
def toggle_comment_vote(comment_id):
    comment = Comment.query.get_or_404(comment_id)

    data = request.get_json(silent=True) or {}
    try:
        value = int(data.get("value", 1))
    except (TypeError, ValueError):
        return jsonify({"error": "invalid_vote"}), 400

    if value not in (-1, 1):
        return jsonify({"error": "invalid_vote"}), 400

    existing = CommentVote.query.filter_by(
        user_id=current_user.id,
        comment_id=comment.id
    ).first()

    current_vote = 0

    if existing:

        # повторное нажатие удаляет реакцию
        if existing.value == value:
            db.session.delete(existing)
            current_vote = 0

        # смена лайка -> диз
        else:
            existing.value = value
            current_vote = value

    else:
        vote = CommentVote(
            user_id=current_user.id,
            comment_id=comment.id,
            value=value
        )

        db.session.add(vote)
        current_vote = value

    db.session.commit()

    likes = CommentVote.query.filter_by(
        comment_id=comment.id,
        value=1
    ).count()

    dislikes = CommentVote.query.filter_by(
        comment_id=comment.id,
        value=-1
    ).count()

    return jsonify({
        "success": True,
        "likes": likes,
        "dislikes": dislikes,
        "user_vote": current_vote
    })