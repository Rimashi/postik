from flask import render_template, request, jsonify, redirect, url_for
from flask_login import login_user, logout_user, login_required, current_user
from app.services.auth_service import register_user, authenticate_user


def login():
    if request.method == "POST":
        data = request.get_json() if request.is_json else request.form
        username = data.get("login")
        password = data.get("pass")
        user = authenticate_user(username, password)
        print("user: ", user)
        if user:
            login_user(user)
            return jsonify({"success": True})
        return jsonify({"error": "invalid_credentials"}), 401
    # GET запрос — можно просто отдать страницу (но у нас модалка, не нужно)
    return jsonify({"error": "Method not allowed"}), 405


def register():
    if request.method == "POST":
        data = request.get_json() if request.is_json else request.form
        username = data.get("login", "").strip()
        password = data.get("pass", "").strip()
        email = data.get("email", "").strip()
        if not username or not password:
            return jsonify({"error": "username_password_required"}), 400
        result = register_user(username, password, email)
        if "error" in result:
            return jsonify(result), 400
        user = authenticate_user(username, password)
        login_user(user)
        return jsonify({"success": True})


def logout():
    logout_user()
    return redirect(url_for("main.index"))
