import os

from dotenv import load_dotenv

from app import create_app


load_dotenv()
app = create_app()


if __name__ == "__main__":
    debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    host = os.environ.get("APP_HOST", "127.0.0.1")
    port = int(os.environ.get("APP_PORT", "8000"))
    app.run(host=host, port=port, debug=debug)
