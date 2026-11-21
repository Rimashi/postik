"""Новая функция: просмотры; миграция имени пользователя к нижнему регистру.

Revision ID: 0003_views_and_usernames
Revises: 0002_auth_sessions
"""

from alembic import op
import sqlalchemy as sa

revision = "0003_views_and_usernames"
down_revision = "0002_auth_sessions"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "posts", sa.Column("views_count", sa.BigInteger(), nullable=False, server_default="0")
    )
    # Перед нормализацией данных нельзя допустить коллизии Maxim / maxim.
    op.execute("""
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM users GROUP BY lower(username) HAVING count(*) > 1) THEN
        RAISE EXCEPTION 'Username case conflicts: resolve them before migration';
      END IF;
    END $$;
    """)
    op.execute("UPDATE users SET username = lower(username) WHERE username <> lower(username)")
    op.drop_constraint("ck_users_username", "users", type_="check")
    op.create_check_constraint("ck_users_username", "users", "username ~ '^[a-z0-9_]{3,32}$'")


def downgrade():
    op.drop_constraint("ck_users_username", "users", type_="check")
    op.create_check_constraint("ck_users_username", "users", "username ~ '^[A-Za-z0-9_]{3,32}$'")
    op.drop_column("posts", "views_count")
