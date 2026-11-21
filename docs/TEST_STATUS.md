# Подтверждённые проверки и ограничения среды подготовки

Состояние на момент сборки единого архива. **Никакие строки ниже не являются подтверждением удалённого GitHub Actions или живого запуска Docker.**

| Проверка | Факт |
|---|---|
| Python | `cd backend && python -m pytest tests` — 14 тестов прошли |
| JavaScript | `cd frontend && npm test` — 9 тестов прошли |
| Ruff lint | `ruff check` над `backend/app`, `backend/tests`, `backend/scripts`, `backend/migrations`, корневыми `scripts` — прошёл |
| Ruff format | `ruff format --check` для тех же 28 Python-файлов — прошёл |
| Python compileall | Синтаксис серверных и служебных скриптов — прошёл |
| Контейнерные static checks | `python scripts/check_containers_static.py` — прошёл |
| CI policy | `python scripts/check_ci_policy.py` — прошёл; CODEOWNERS с реальным логином ещё надо создать |
| HTML-учебник | Проверена кликабельность и JS на десктопе и ширине 375 px в изолированном Chromium; без runtime JS-ошибок |

**Не выполнено в этой среде:** сборка/запуск Docker Engine и проверка контейнерной сети, PostgreSQL-миграции/backup/restore на живом Docker, Bandit и pip-audit/npm audit/Trivy/Gitleaks с реальными актуальными CVE-базами, полная production-сборка Vite, удалённые GitHub Actions/GHCR. Эти проверки требуют отдельного реального запуска на машине пользователя/в GitHub и могут выявить проблемы, которые здесь не были видны.

Проверки нельзя заменять изменением тестов, снижением порогов, выключением SAST/аудита или `continue-on-error`. Если CVE-сканер находит проблему, устраняйте её корректным обновлением и повторным запуском.
