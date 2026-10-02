from flask import render_template
from flask_login import login_required
from app.middlewares.auth_middleware import admin_required


@login_required
@admin_required
def admin_panel():
    return render_template("admin.html")
