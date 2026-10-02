from app import db
from datetime import datetime
from slugify import slugify
import enum

# ========== АССОЦИАТИВНАЯ ТАБЛИЦА ==========
post_tags = db.Table(
    'post_tags',
    db.Column('post_id', db.Integer, db.ForeignKey('posts.id', ondelete='CASCADE'), primary_key=True),
    db.Column('tag_id', db.Integer, db.ForeignKey('tags.id', ondelete='CASCADE'), primary_key=True)
)

# ========== МОДЕЛИ ==========
class Category(db.Model):
    __tablename__ = 'categories'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False, index=True)
    slug = db.Column(db.String(100), unique=True, nullable=False, index=True)
    description = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    posts = db.relationship('Post', back_populates='category', lazy='dynamic')

    def __repr__(self):
        return f'<Category {self.name}>'


class ProposedCategory(db.Model):
    """Категории, предложенные пользователями, ждут одобрения админом."""
    __tablename__ = 'proposed_categories'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=True)
    proposed_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    proposer = db.relationship('User', backref='proposed_categories')


class Tag(db.Model):
    __tablename__ = 'tags'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False, index=True)
    slug = db.Column(db.String(50), unique=True, nullable=False, index=True)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)  # может быть анонимным
    is_active = db.Column(db.Boolean, default=True)  # админ может деактивировать тег
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    creator = db.relationship('User', backref='created_tags')

    def __repr__(self):
        return f'<Tag {self.name}>'

class PostStatus(enum.Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    UNDER_REVIEW = "under_review"   # админ может отправить на доработку

class Post(db.Model):
    __tablename__ = 'posts'

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False, index=True)
    slug = db.Column(db.String(200), unique=True, nullable=False, index=True)
    content_md = db.Column(db.Text, nullable=False)            # Markdown
    excerpt = db.Column(db.Text, nullable=True)
    cover_image = db.Column(db.String(500), nullable=True)     # URL обложки
    author_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey('categories.id'), nullable=True)
    is_published = db.Column(db.Boolean, default=False)        # черновик/опубликован
    views_count = db.Column(db.Integer, default=0)             # денормализованный счётчик
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    status = db.Column(db.Enum(PostStatus), default=PostStatus.DRAFT, nullable=False)
    published_at = db.Column(db.DateTime, nullable=True)

    # Отношения
    author = db.relationship('User', back_populates='posts')
    category = db.relationship('Category', back_populates='posts')
    tags = db.relationship('Tag', secondary=post_tags, lazy='subquery',
                           backref=db.backref('posts', lazy=True))
    images = db.relationship('PostImage', back_populates='post', cascade='all, delete-orphan')
    comments = db.relationship('Comment', back_populates='post', lazy='dynamic')
    votes = db.relationship('PostVote', back_populates='post', lazy='dynamic', cascade='all, delete-orphan')
    views = db.relationship('PostView', back_populates='post', lazy='dynamic')
    saves = db.relationship('SavedPost', back_populates='post', lazy='dynamic', cascade='all, delete-orphan')

    def __repr__(self):
        return f'<Post {self.title}>'


class PostImage(db.Model):
    __tablename__ = 'post_images'

    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey('posts.id', ondelete='CASCADE'), nullable=False)
    url = db.Column(db.String(500), nullable=False)
    alt_text = db.Column(db.String(200), nullable=True)
    order = db.Column(db.Integer, default=0)

    post = db.relationship('Post', back_populates='images')


class Comment(db.Model):
    __tablename__ = 'comments'

    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey('posts.id', ondelete='CASCADE'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    parent_id = db.Column(db.Integer, db.ForeignKey('comments.id'), nullable=True)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_pinned = db.Column(db.Boolean, default=False)

    post = db.relationship('Post', back_populates='comments')
    author = db.relationship('User', back_populates='comments')
    parent = db.relationship('Comment', remote_side=[id], backref='replies')
    votes = db.relationship('CommentVote', back_populates='comment', lazy='dynamic', cascade='all, delete-orphan')

class PostView(db.Model):
    __tablename__ = 'post_views'

    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey('posts.id', ondelete='CASCADE'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)  # для авторизованных
    ip_address = db.Column(db.String(45), nullable=True)   # для анонимов (IPv4/IPv6)
    viewed_at = db.Column(db.DateTime, default=datetime.utcnow)

    post = db.relationship('Post', back_populates='views')
    user = db.relationship('User')
    
    
class PostVote(db.Model):
    __tablename__ = 'post_votes'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    post_id = db.Column(db.Integer, db.ForeignKey('posts.id', ondelete='CASCADE'), nullable=False)
    value = db.Column(db.SmallInteger, nullable=False)   # +1 или -1
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', backref='post_votes')
    post = db.relationship('Post', back_populates='votes')

    __table_args__ = (
        db.UniqueConstraint('user_id', 'post_id', name='unique_post_vote'),
    )


class CommentVote(db.Model):
    __tablename__ = 'comment_votes'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    comment_id = db.Column(db.Integer, db.ForeignKey('comments.id', ondelete='CASCADE'), nullable=False)
    value = db.Column(db.SmallInteger, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', backref='comment_votes')
    comment = db.relationship('Comment', back_populates='votes')

    __table_args__ = (
        db.UniqueConstraint('user_id', 'comment_id', name='unique_comment_vote'),
    )
    

class SavedPost(db.Model):
    __tablename__ = 'saved_posts'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    post_id = db.Column(db.Integer, db.ForeignKey('posts.id', ondelete='CASCADE'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', backref='saved_posts')
    post = db.relationship('Post', back_populates='saves')
    __table_args__ = (db.UniqueConstraint('user_id', 'post_id', name='unique_save'),)