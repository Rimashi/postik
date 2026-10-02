# Лабораторная работа №2 — развёртывание PSME в Linux

Цель: запустить PSME без контейнеров на двух Linux-машинах и оформить приложение как управляемую `systemd`-службу.

## 1. Схема стенда

Удобный вариант для VirtualBox — две Debian-машины, у каждой два адаптера:

- Adapter 1: NAT — только для доступа в Интернет;
- Adapter 2: Host-Only — для связи между машинами и с хостом.

Пример постоянных адресов Host-Only:

| Узел | Адрес | Назначение |
|---|---|---|
| `app` | `192.168.56.10/24` | Flask/Gunicorn |
| `db` | `192.168.56.11/24` | PostgreSQL |
| host/client | из `192.168.56.0/24` | SSH и браузер |

Если у тебя другая сеть, замени эти адреса во всех примерах.

Сначала узнай имя Host-Only интерфейса:

```bash
ip -br link
```

Например, если это `enp0s8`, на Debian с `ifupdown` постоянный адрес можно задать в `/etc/network/interfaces.d/hostonly`:

App-server:

```text
auto enp0s8
iface enp0s8 inet static
    address 192.168.56.10/24
```

DB-server:

```text
auto enp0s8
iface enp0s8 inet static
    address 192.168.56.11/24
```

На Host-Only интерфейсе отдельный gateway не нужен: Интернет идёт через NAT-адаптер. Если сеть управляется NetworkManager, те же адреса задай через `nmcli`.

После применения сети проверки на обеих машинах:

```bash
ip -br addr
ip route
ping -c 3 192.168.56.10
ping -c 3 192.168.56.11
```

## 2. Административный пользователь и SSH-ключ

На обеих машинах должен быть отдельный пользователь для администрирования, например `devops`. Если его ещё нет, из локальной консоли VM или под текущим sudo-пользователем:

```bash
sudo adduser devops
sudo usermod -aG sudo devops
```

На машине, с которой подключаешься:

```bash
ssh-keygen -t ed25519
ssh-copy-id devops@192.168.56.10
ssh-copy-id devops@192.168.56.11
```

Сначала убедись, что вход по ключу действительно работает, и только потом запрети root/password login.

На каждом сервере:

```bash
sudo mkdir -p /etc/ssh/sshd_config.d
sudo nano /etc/ssh/sshd_config.d/99-devops-hardening.conf
```

Содержимое:

```text
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
```

Проверка и перезапуск:

```bash
sudo sshd -t
sudo systemctl restart ssh
```

Не закрывай текущую SSH-сессию, пока не проверишь вход во второй вкладке.

## 3. Сервер приложения

Подключиться к `app`:

```bash
ssh devops@192.168.56.10
```

Чтобы использовать готовые скрипты, сначала установить Git и получить репозиторий во временный каталог:

```bash
sudo apt update && sudo apt install -y git
git clone <URL_ТВОЕГО_РЕПОЗИТОРИЯ> ~/psme-deploy
cd ~/psme-deploy
```

Подготовить систему:

```bash
sudo ./deploy/scripts/prepare_app_server.sh
```

Или выполнить те же действия вручную: установить Python, `venv`, Git, nftables и создать системного пользователя `psme`.

Пользователь `psme` не используется для интерактивного входа и не имеет root-прав.

### Разместить проект

Пример через Git:

```bash
sudo rm -rf /opt/psme
sudo git clone <URL_ТВОЕГО_РЕПОЗИТОРИЯ> /opt/psme
sudo chown -R psme:psme /opt/psme
```

Создать виртуальное окружение:

```bash
sudo -u psme python3 -m venv /opt/psme/.venv
sudo -u psme /opt/psme/.venv/bin/pip install --upgrade pip
sudo -u psme /opt/psme/.venv/bin/pip install -r /opt/psme/requirements.txt
```

Каталог загрузок должен быть доступен service-user:

```bash
sudo mkdir -p /opt/psme/static/uploads/posts
sudo chown -R psme:psme /opt/psme/static/uploads
```

## 4. Сервер PostgreSQL

На `db`:

```bash
ssh devops@192.168.56.11
```

Получить репозиторий с deployment-скриптами:

```bash
sudo apt update && sudo apt install -y git
git clone <URL_ТВОЕГО_РЕПОЗИТОРИЯ> ~/psme-deploy
cd ~/psme-deploy
```

Придумай пароль БД и передай его только через переменную текущей команды:

```bash
sudo env PSME_DB_PASSWORD='СЮДА_ПАРОЛЬ' ./deploy/scripts/prepare_db_server.sh
```

Создаются:

- PostgreSQL;
- БД `psme`;
- роль `psme_app`;
- роль не является superuser и не имеет `CREATEDB`/`CREATEROLE`.

### Разрешить PostgreSQL слушать приватный адрес

Узнать версию:

```bash
ls /etc/postgresql/
```

Открыть `postgresql.conf`, например:

```bash
sudo nano /etc/postgresql/18/main/postgresql.conf
```

Установить:

```text
listen_addresses = '192.168.56.11'
```

В `pg_hba.conf` добавить:

```text
host    psme    psme_app    192.168.56.10/32    scram-sha-256
```

Перезапустить:

```bash
sudo systemctl restart postgresql
sudo systemctl status postgresql
ss -ltnp | grep 5432
```

## 5. Настройки приложения отдельно от Git

На app-server:

```bash
sudo mkdir -p /etc/psme
sudo cp /opt/psme/deploy/env/psme.env.example /etc/psme/psme.env
sudo nano /etc/psme/psme.env
```

Минимально нужно заменить:

```env
DATABASE_URL=postgresql+psycopg://psme_app:ПАРОЛЬ_БД@192.168.56.11:5432/psme
SECRET_KEY=ДЛИННАЯ_СЛУЧАЙНАЯ_СТРОКА
ADMIN_PASSWORD=ПАРОЛЬ_АДМИНА
```

Секрет можно получить:

```bash
python3 -c 'import secrets; print(secrets.token_hex(32))'
```

Права:

```bash
sudo chown root:psme /etc/psme/psme.env
sudo chmod 640 /etc/psme/psme.env
```

Файл `/etc/psme/psme.env` не находится в Git.

## 6. systemd

Установить unit:

```bash
sudo cp /opt/psme/deploy/systemd/psme.service /etc/systemd/system/psme.service
sudo systemctl daemon-reload
sudo systemctl enable --now psme
```

Проверить:

```bash
systemctl status psme
systemctl is-enabled psme
curl http://127.0.0.1:8000/api/health
```

Основные команды:

```bash
sudo systemctl start psme
sudo systemctl stop psme
sudo systemctl restart psme
sudo systemctl status psme
journalctl -u psme -f
```

Unit содержит:

```text
Restart=on-failure
RestartSec=3
```

поэтому после аварийного завершения Gunicorn будет автоматически запущен снова.

### Проверка автоматического restart

Найти PID:

```bash
pgrep -a gunicorn
```

Завершить worker/master для учебной проверки и снова посмотреть:

```bash
sudo kill -9 <PID>
sleep 5
systemctl status psme
```

## 7. Firewall

**Важно:** сначала убедись, что SSH по ключам работает. Иначе можно отрезать себе доступ.

### App-server

Разрешить SSH и порт приложения только из Host-Only сети:

```bash
cd /opt/psme
sudo APP_NET=192.168.56.0/24 ./deploy/scripts/firewall_app.sh
```

### DB-server

Разрешить SSH из административной сети, а PostgreSQL — только от app-server:

```bash
cd /opt/psme
sudo ADMIN_NET=192.168.56.0/24 APP_IP=192.168.56.10 ./deploy/scripts/firewall_db.sh
```

Проверка правил:

```bash
sudo nft list ruleset
```

С app-server подключение к БД должно проходить:

```bash
psql 'postgresql://psme_app@192.168.56.11:5432/psme'
```

С посторонней машины обращение к `192.168.56.11:5432` должно блокироваться firewall.

## 8. Что показать на защите

### После перезагрузки

На обеих машинах:

```bash
sudo reboot
```

После возврата:

```bash
systemctl status psme          # app-server
systemctl status postgresql    # db-server
```

Приложение должно подняться без ручного запуска из IDE.

### Остановить БД и диагностировать

На db-server:

```bash
sudo systemctl stop postgresql
```

На app-server:

```bash
curl -i http://127.0.0.1:8000/api/health
systemctl status psme
journalctl -u psme -n 50 --no-pager
```

Healthcheck должен показать недоступность БД. После демонстрации:

```bash
sudo systemctl start postgresql
```

### Найти процесс, порт и журнал

```bash
ps -u psme -f
pgrep -a gunicorn
ss -ltnp | grep ':8000'
journalctl -u psme -n 50 --no-pager
```

### Изменить параметр service и восстановить

Например временно поменять:

```text
RestartSec=3
```

на:

```text
RestartSec=7
```

после чего:

```bash
sudo systemctl daemon-reload
sudo systemctl restart psme
systemctl show psme -p RestartUSec
```

Затем вернуть `3`, снова `daemon-reload` и `restart`.

### Проверить, что приложение не root

```bash
ps -o user,pid,cmd -C gunicorn
```

В колонке USER должен быть `psme`.

## 9. Готовые проверки

На app-server:

```bash
/opt/psme/deploy/scripts/check_app_server.sh
```

На db-server:

```bash
/opt/psme/deploy/scripts/check_db_server.sh
```

## 10. Что сохранить для отчёта

Полезные скриншоты:

1. `ip -br addr` обеих машин;
2. успешный SSH по ключу;
3. `systemctl status psme`;
4. `systemctl status postgresql`;
5. `/api/health`;
6. `ss -ltnp` на app и DB;
7. `journalctl -u psme`;
8. `nft list ruleset` на обеих машинах;
9. успешное подключение app -> DB;
10. неуспешное подключение посторонний узел -> DB;
11. состояние после reboot;
12. демонстрация auto-restart после аварийного завершения.
