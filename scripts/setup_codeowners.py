"""Создать CODEOWNERS с настоящим GitHub-логином владельца.

Использование: python3 scripts/setup_codeowners.py GITHUB_LOGIN
"""

import re
import sys
from pathlib import Path

if len(sys.argv) != 2 or not re.fullmatch(
    r"[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?", sys.argv[1]
):
    raise SystemExit("Usage: python3 scripts/setup_codeowners.py YOUR_GITHUB_LOGIN")
owner = "@" + sys.argv[1]
root = Path(__file__).resolve().parents[1]
file = root / ".github/CODEOWNERS"
file.write_text(
    f"""# Правила ревью критических файлов: тесты, CI, миграции, проверки.
# Важно: в Settings → Rules/Rulesets дополнительно включить Require review from Code Owners.
/.github/ {owner}
/Makefile {owner}
/backend/tests/ {owner}
/frontend/tests/ {owner}
/backend/migrations/ {owner}
/backend/requirements.txt {owner}
/backend/requirements-dev.txt {owner}
/frontend/package.json {owner}
/frontend/package-lock.json {owner}
/scripts/ {owner}
""",
    encoding="utf-8",
)
print(
    f"Created {file} for {owner}; commit it and enable required code owner review in GitHub settings."
)
