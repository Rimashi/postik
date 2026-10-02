from flask import Blueprint, jsonify, render_template
from sqlalchemy import text

from app import db
from app.controllers.main_controller import index


main_bp = Blueprint("main", __name__)
main_bp.route("/", methods=["GET"])(index)


@main_bp.get("/api/health")
def health():
    try:
        db.session.execute(text("SELECT 1"))
        return jsonify({"status": "ok", "database": "ok"})
    except Exception:
        db.session.rollback()
        return jsonify({"status": "error", "database": "unavailable"}), 503
