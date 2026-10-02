import logging
import os

from flask import Flask, jsonify, redirect, request, url_for
from flask_login import LoginManager
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text


db = SQLAlchemy()
login_manager = LoginManager()
migrate = Migrate()


def create_app():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    template_dir = os.path.join(base_dir, "templates")
    static_dir = os.path.join(base_dir, "static")

    app = Flask(__name__, template_folder=template_dir, static_folder=static_dir)
    app.logger.setLevel(logging.INFO)

    secret_key = os.environ.get("SECRET_KEY")
    database_url = os.environ.get("DATABASE_URL")

    if not secret_key:
        raise RuntimeError("SECRET_KEY is not set")

    if not database_url:
        raise RuntimeError("DATABASE_URL is not set")

    app.config["SECRET_KEY"] = secret_key
    app.config["SQLALCHEMY_DATABASE_URI"] = database_url
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024

    db.init_app(app)
    login_manager.init_app(app)
    migrate.init_app(app, db)

    from app import auth

    login_manager.login_message = "Пожалуйста, войдите для доступа к этой странице."
    login_manager.login_message_category = "info"

    @login_manager.unauthorized_handler
    def unauthorized():
        if "/api/" in request.path:
            return jsonify({"error": "authentication_required"}), 401
        return redirect(url_for("main.index"))

    from app.routes.admin import admin_bp
    from app.routes.main import main_bp
    from app.routes.posts import posts_bp
    from app.routes.users import user_bp

    app.register_blueprint(main_bp)
    app.register_blueprint(user_bp, url_prefix="/users")
    app.register_blueprint(posts_bp, url_prefix="/posts")
    app.register_blueprint(admin_bp, url_prefix="/admin")

    @app.errorhandler(400)
    def bad_request(error):
        if "/api/" in request.path:
            return jsonify({"error": "bad_request"}), 400
        return "Некорректный запрос", 400

    @app.errorhandler(404)
    def not_found(error):
        if "/api/" in request.path:
            return jsonify({"error": "not_found"}), 404
        return "Страница не найдена", 404

    @app.errorhandler(405)
    def method_not_allowed(error):
        if "/api/" in request.path:
            return jsonify({"error": "method_not_allowed"}), 405
        return "Метод не поддерживается", 405

    @app.errorhandler(500)
    def internal_error(error):
        db.session.rollback()
        if "/api/" in request.path:
            return jsonify({"error": "internal_server_error"}), 500
        return "Внутренняя ошибка сервера", 500

    with app.app_context():
        from app.models.post_models import Category, Comment, Post, Tag
        from app.models.user_model import Role, User

        db.create_all()

        admin_login = os.environ.get("ADMIN_LOGIN", "admin")
        admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.local")
        admin_password = os.environ.get("ADMIN_PASSWORD")

        if Category.query.count() == 0:
            db.session.add_all([
                Category(name="Разработка", slug="development", description="Программирование и разработка"),
                Category(name="DevOps", slug="devops", description="Инфраструктура и эксплуатация"),
                Category(name="Разное", slug="other", description="Материалы без отдельной категории"),
            ])
            db.session.commit()

        if admin_password and not User.query.filter_by(username=admin_login).first():
            admin = User(
                username=admin_login,
                email=admin_email,
                role=Role.ADMIN,
                last_name="Администратор",
                first_name="PSME",
            )
            admin.set_password(admin_password)
            db.session.add(admin)
            db.session.commit()
            app.logger.info("Default administrator created")

    return app
