from flask import Blueprint
from app.controllers.users_controller import get_users
from app.controllers.auth_controller import login, register, logout

user_bp = Blueprint("user", __name__)

user_bp.route("/", methods=["GET"])(get_users)
user_bp.route("/login", methods=["POST"])(login)
user_bp.route("/register", methods=["POST"])(register)
user_bp.route("/logout", methods=["GET"])(logout)
