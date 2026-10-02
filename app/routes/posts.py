from flask import Blueprint
from app.controllers.posts_controller import (
    list_of_posts, get_post, create_post_page, my_posts_page,
    create_or_update_post, delete_post_api, get_post_api, get_tags,
    toggle_vote, toggle_save, pin_comment, post_stats, my_posts_api,
    get_categories, feed_posts, upload_image, create_comment,
    get_comments, toggle_comment_vote
)

posts_bp = Blueprint("posts", __name__)

# Страницы
posts_bp.route("/", methods=["GET"])(list_of_posts)
posts_bp.route("/<int:post_id>", methods=["GET"])(get_post)          # просмотр поста
posts_bp.route("/create", methods=["GET"])(create_post_page)        # редактор
posts_bp.route("/my", methods=["GET"])(my_posts_page)               # мои статьи

# API
posts_bp.route("/api/upload-image", methods=["POST"])(upload_image)

posts_bp.route("/api/feed", methods=["GET"])(feed_posts)

posts_bp.route("/api/posts", methods=["POST"])(create_or_update_post)
posts_bp.route('/api/tags', methods=['GET'])(get_tags)
posts_bp.route('/api/categories', methods=['GET'])(get_categories)
posts_bp.route("/api/posts/<int:post_id>", methods=["GET"])(get_post_api)
posts_bp.route("/api/posts/<int:post_id>", methods=["DELETE"])(delete_post_api)
posts_bp.route("/api/posts/<int:post_id>/vote", methods=["POST"])(toggle_vote)
posts_bp.route("/api/posts/<int:post_id>/save", methods=["POST"])(toggle_save)
posts_bp.route("/api/posts/<int:post_id>/stats", methods=["GET"])(post_stats)

posts_bp.route("/api/comments/<int:comment_id>/pin", methods=["POST"])(pin_comment)
posts_bp.route("/api/posts/<int:post_id>/comments", methods=["GET"])(get_comments)
posts_bp.route("/api/posts/<int:post_id>/comments", methods=["POST"])(create_comment)
posts_bp.route("/api/comments/<int:comment_id>/vote", methods=["POST"])(toggle_comment_vote)
posts_bp.route("/api/my", methods=["GET"])(my_posts_api)             # список моих постов