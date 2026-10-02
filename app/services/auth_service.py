from app import db
from app.models.user_model import User


def authenticate_user(username, password):
    user = User.query.filter_by(username=username).first()
    if not user:
        return None
    if not user.check_password(password):
        return None
    return user


def register_user(username, password, email=None):
    if User.query.filter_by(username=username).first():
        return {"error": "userErr"}

    if email and User.query.filter_by(email=email).first():
        return {"error": "emailErr"}

    user = User(username=username, email=email)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    return {"success": True, "user_id": user.id}
