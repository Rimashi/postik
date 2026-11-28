# ЛР7 — воспроизводимая инфраструктура Postik (Debian 13 VM)

## Граница воздействия

Ansible запускается **с ноутбука**, цель — только VM `DevOps_labs` (`10.60.0.10` через `homelab-remote`). **Не применять к хосту homelab.**

Плейбук не меняет существующие настройки SSH, UFW, WireGuard, Traefik или Nginx и не добавляет операционного пользователя в группу Docker. На существующем Debian 13 повторно Docker не устанавливает; для чистой VM использует Debian пакеты `docker.io` и `docker-compose` (Compose v2).

Плейбук запускает новый изолированный Compose-проект `postik_lr7_staging` в `/opt/postik/lr7-staging`, веб-интерфейс доступен только на `127.0.0.1:8088` внутри VM; внешний домен не настраивается. Секреты лежат вне образов, в файле `.env` с правами `0600` и под контролем Ansible Vault.

## Подготовка

1. Перед действиями с VM сохраните её qcow2 на выключенной машине, если нужна точка возврата.
2. Выключите старый Compose-проект Postik **без `-v`**, чтобы сохранить PostgreSQL volume.
3. На ноутбуке уже установлен Ansible и работает SSH по ключу `~/.ssh/id_postik_ansible` через `homelab-remote`.
4. Создайте inventory и зашифрованный vault (оба файла локальные и не коммитятся):

```bash
cp ansible/inventories/staging/hosts.yml.example ansible/inventories/staging/hosts.yml
.ansible-venv/bin/ansible-vault create ansible/inventories/staging/group_vars/all/vault.yml
```

Содержимое `vault.yml` (подставьте отдельно случайно сгенерированные строки из hex символов длиной не менее 32):

```yaml
vault_db_password: '<random hex secret>'
vault_jwt_secret: '<random hex secret>'
```

В `.gitignore` должны быть `ansible/inventories/**/hosts.yml`, `ansible/inventories/**/vault.yml`, `*.vault-password`, `.ansible-venv/`.

## Запуск

```bash
.ansible-venv/bin/ansible -i ansible/inventories/staging/hosts.yml postik_servers -m ping --ask-vault-pass
.ansible-venv/bin/ansible-playbook -i ansible/inventories/staging/hosts.yml ansible/prepare.yml --syntax-check --ask-vault-pass
.ansible-venv/bin/ansible-playbook -i ansible/inventories/staging/hosts.yml ansible/prepare.yml --ask-become-pass --ask-vault-pass
# Repeat and capture recap: ideally changed=0.
.ansible-venv/bin/ansible-playbook -i ansible/inventories/staging/hosts.yml ansible/prepare.yml --ask-become-pass --ask-vault-pass
```

Для проверки восстановления конфигурации изменить права compose.yml с 0600 на 0640 и повторно запустить playbook. Ansible должен восстановить права 0600.

Health on the VM:

```bash
sudo docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
curl -fsS http://127.0.0.1:8088/api/health
curl -fsS http://127.0.0.1:8088/api/version
```

Production inventory/group_vars defines a separate environment on 8089 but MUST target a separately provisioned VM (for genuine machine-level separation); it is not deployed automatically. A real fresh-machine demonstration requires bootstrapping a clean VM or clone, not claiming the current VM was clean.

## Evidence and remaining limitations

Save screenshots: VM baseline and backup; Ansible first apply; repeat idempotent recap; injected drift and repaired file; vaulted secret file; working containers and health; infra CI job. `infra-check.yml` performs syntax checks only, it is not a remote infrastructure rollout. Automatic infrastructure deployment and independent production machine, if demanded by the rubric, must be configured and demonstrated separately.

## Результаты проверки

Проверка проведена 28.11.2026 на VM DevOps_labs.

| Проверка | Результат |
|---|---|
| Развёртывание | ok=20, changed=2, failed=0 |
| Идемпотентность | ok=20, changed=0, failed=0 |
| Восстановление конфигурации | Права compose.yml восстановлены с 0640 до 0600 |
| PostgreSQL | healthy |
| Миграции Alembic | Код завершения 0 |
| API и Web | healthy |
| /api/health | status: ok, database: ok |
| /api/version | Соответствует SHA из inventory |

## Требования к инфраструктурному коду

- Не открывать внешние порты API и PostgreSQL.
- Публиковать веб-интерфейс только на loopback.
- Не предоставлять операционному пользователю права sudo или Docker.
- Хранить секреты в Ansible Vault, не добавлять открытые секреты в Git.
- На целевой машине ограничивать доступ к .env правами 0600.
- Использовать декларативные модули Ansible вместо необоснованных shell-команд.
- Обеспечивать идемпотентность и проверку приложения после настройки.
- Использовать существующие образы при лабораторном развёртывании, ограничивать время загрузки отсутствующих образов.
- Согласовывать изменения ansible/ и delivery/ через Pull Request и CODEOWNERS.

## Интеграция с CD

GitHub Actions выполняет автоматическую проверку инфраструктурного кода.
Применение Ansible выполняется с доверенного ноутбука отдельным ручным
этапом CD после проверки и согласования изменений.

Настройки существующего SSH-сервера, firewall и сетевой инфраструктуры
не изменяются. Подготовка полностью чистой VM предусмотрена кодом,
но отдельно не проверена. Production описан в inventory, но не развёрнут.
