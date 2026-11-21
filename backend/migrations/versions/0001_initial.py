"""Исходная схема из 6 таблиц (совместима с ранее выполненным create_all).

Revision ID: 0001_initial
Revises:
"""

from alembic import op
import sqlalchemy as sa

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "users",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("username", sa.String(32), nullable=False, unique=True),
        sa.Column("email", sa.String(254), nullable=False, unique=True),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("bio", sa.Text()),
        sa.Column("avatar_url", sa.Text()),
        sa.Column("city", sa.String(100)),
        sa.Column("other_site", sa.Text()),
        sa.Column("role", sa.String(20), nullable=False, server_default="user"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.CheckConstraint("role IN ('user','admin')", name="ck_users_role"),
        sa.CheckConstraint("username ~ '^[A-Za-z0-9_]{3,32}$'", name="ck_users_username"),
    )
    op.create_table(
        "topics",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(80), nullable=False, unique=True),
        sa.Column("slug", sa.String(100), nullable=False, unique=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )
    op.create_table(
        "posts",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            "author_id",
            sa.BigInteger(),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("parent_id", sa.BigInteger(), sa.ForeignKey("posts.id", ondelete="RESTRICT")),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("summary", sa.Text()),
        sa.Column("content_md", sa.Text(), nullable=False),
        sa.Column("format", sa.String(20), nullable=False, server_default="article"),
        sa.Column("cover_url", sa.Text()),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "published_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.CheckConstraint("format IN ('article','post','blog')", name="ck_posts_format"),
    )
    op.create_index("ix_posts_author_id", "posts", ["author_id"])
    op.create_index("ix_posts_parent_id", "posts", ["parent_id"])
    op.create_index("ix_posts_published_at", "posts", ["published_at"])
    op.create_table(
        "tags",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("slug", sa.String(100), nullable=False, unique=True),
        sa.Column("created_by_id", sa.BigInteger(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("is_blocked", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.create_index("ix_tags_created_by_id", "tags", ["created_by_id"])
    op.create_table(
        "post_topics",
        sa.Column(
            "post_id",
            sa.BigInteger(),
            sa.ForeignKey("posts.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "topic_id",
            sa.BigInteger(),
            sa.ForeignKey("topics.id", ondelete="RESTRICT"),
            primary_key=True,
        ),
    )
    op.create_table(
        "post_tags",
        sa.Column(
            "post_id",
            sa.BigInteger(),
            sa.ForeignKey("posts.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "tag_id",
            sa.BigInteger(),
            sa.ForeignKey("tags.id", ondelete="RESTRICT"),
            primary_key=True,
        ),
    )


def downgrade():
    op.drop_table("post_tags")
    op.drop_table("post_topics")
    op.drop_table("tags")
    op.drop_table("posts")
    op.drop_table("topics")
    op.drop_table("users")
