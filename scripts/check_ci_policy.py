"""Минимальная автоматическая проверка неизменности обязательных CI-барьеров.

Не заменяет защиту ветки и code owner review на GitHub: ведь PR может изменить
сам этот скрипт. Для защиты необходимы правила репозитория (см. docs/CI.md).
"""

from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parents[1]
MAKE = (ROOT / "Makefile").read_text(encoding="utf-8")
WORKFLOW = (ROOT / ".github/workflows/ci.yml").read_text(encoding="utf-8")

# PyYAML (YAML 1.1) ошибочно считает ключ `on` булевым True.
# Здесь анализируем структуру jobs, не триггер workflow.
pipeline = yaml.safe_load(WORKFLOW)
jobs = pipeline.get("jobs", {})
required = {
    "quality",
    "tests",
    "migrations",
    "backup",
    "dependencies",
    "secrets",
    "containers",
    "images",
}
for name in sorted(required | {"ci-required", "publish"}):
    assert name in jobs, f"Missing CI job: {name}"
assert set(jobs["ci-required"]["needs"]) == required, "Mandatory gate does not depend on all checks"
assert jobs["publish"]["needs"] == ["ci-required"], "Publication must depend on full gate"
assert "github.event_name == 'push'" in WORKFLOW, "Publish must be restricted to push"
assert "refs/heads/main" in WORKFLOW, "Publish must be restricted to main"
assert jobs["publish"]["permissions"]["packages"] == "write", (
    "Only publishing job should request packages:write"
)
for command in [
    "test:",
    "quality:",
    "migration-check:",
    "restore-check:",
    "container-check:",
    "dependency-check:",
    "secrets-check:",
    "image-scan:",
    "verify:",
    "ci-verify:",
]:
    assert command in MAKE, f"Missing Makefile command: {command}"
assert "--cov-fail-under=65" in MAKE, "Coverage gate may not be weakened"
assert "bandit -r app -q" in MAKE, "Bandit static analysis must be active"
assert "--audit-level=high" in MAKE, "npm high severity audit must be active"
assert "--exit-code 1" in MAKE, "Security scans must block on violations"
owners = ROOT / ".github/CODEOWNERS"
if owners.exists():
    body = owners.read_text(encoding="utf-8")
    for protected in (
        "/.github/",
        "/Makefile",
        "/backend/tests/",
        "/frontend/tests/",
        "/backend/migrations/",
    ):
        assert protected in body, f"Missing CODEOWNERS protection: {protected}"
else:
    print(
        "WARNING: configure real .github/CODEOWNERS and enable code-owner review before submission"
    )
print("OK: mandatory gates, publication restriction and local quality policy")
