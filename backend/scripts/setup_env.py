"""Создать .env из шаблона; JWT_SECRET генерируется случайно."""

from pathlib import Path
from secrets import token_urlsafe

root = Path(__file__).resolve().parents[1]
file = root / ".env"
if file.exists():
    print(".env exists; not overwriting")
else:
    content = (root / ".env.example").read_text().replace("GENERATE_ON_SETUP", token_urlsafe(48))
    file.write_text(content)
    file.chmod(0o600)
    print("Created .env (0600) with random JWT_SECRET")
