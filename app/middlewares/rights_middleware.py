from functools import wraps
from flask import flash, redirect, url_for
from flask_login import current_user

def check_rights(role):
    """Декоратор, разрешающий доступ только пользователям с указанной ролью."""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not current_user.is_authenticated or current_user.role.value != role:
                flash('У вас недостаточно прав для доступа к данной странице.', 'danger')
                return redirect(url_for('main.index'))
            return f(*args, **kwargs)
        return decorated_function
    return decorator