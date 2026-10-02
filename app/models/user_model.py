from app import db
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
import enum
from datetime import datetime


class Role(enum.Enum):
    USER = "user"
    MODERATOR = "moderator"
    ADMIN = "admin"


class User(UserMixin, db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True, nullable=False, index=True)
    email = db.Column(db.String(120), unique=True, nullable=True)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.Enum(Role), default=Role.USER, nullable=False)
    posts = db.relationship('Post', back_populates='author', lazy='dynamic')
    comments = db.relationship('Comment', back_populates='author', lazy='dynamic')
    # saves = db.relationship('SavedPost', back_populates='user', lazy='dynamic')
    
    last_name = db.Column(db.String(100), nullable=True)   # фамилия
    first_name = db.Column(db.String(100), nullable=True)  # имя
    middle_name = db.Column(db.String(100), nullable=True) # отчество (опционально)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    # Вспомогательные проверки
    @property
    def is_admin(self):
        return self.role == Role.ADMIN

    @property
    def is_moderator(self):
        return (
            self.role == Role.MODERATOR or self.role == Role.ADMIN
        )  # админ тоже модератор
        
    @property
    def full_name(self):
        parts = [self.last_name, self.first_name, self.middle_name]
        return " ".join([p for p in parts if p])

    def __repr__(self):
        return f"<User {self.username} ({self.role.value})>"
