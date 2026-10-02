from flask import jsonify
from flask_login import login_required

from app.models.user_model import User


@login_required
def get_users():
    users = User.query.order_by(User.username).all()
    return jsonify([
        {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role.value,
        }
        for user in users
    ])
