from flask import Blueprint

from app.controllers.admin_controller import admin_panel


admin_bp = Blueprint("admin", __name__)
admin_bp.route("/", methods=["GET"])(admin_panel)
