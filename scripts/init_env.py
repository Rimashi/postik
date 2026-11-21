"""Генерация учебных секретов окружения. Не перезаписывает существующий файл."""

from pathlib import Path
from secrets import token_hex

root = Path(__file__).resolve().parents[1]
target = root / ".env"
if target.exists():
    print("Existing .env preserved; nothing was changed")
else:
    target.write_text(
        "DB_PASSWORD=" + token_hex(24) + "\nJWT_SECRET=" + token_hex(48) + "\n",
        encoding="utf-8",
    )
    target.chmod(0o600)
    print("Created .env (0600), not committed to Git")
