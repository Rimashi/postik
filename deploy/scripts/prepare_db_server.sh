#!/usr/bin/env bash
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Run as root: sudo $0"
  exit 1
fi

if [[ -z "${PSME_DB_PASSWORD:-}" ]]; then
  echo "Set PSME_DB_PASSWORD before running."
  echo "Example: sudo env PSME_DB_PASSWORD='strong-password' $0"
  exit 1
fi

apt update
apt install -y postgresql nftables
systemctl enable --now postgresql

sudo -u postgres psql -v ON_ERROR_STOP=1 --set=dbpass="$PSME_DB_PASSWORD" <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'psme_app') THEN
    CREATE ROLE psme_app LOGIN;
  END IF;
END
$$;
ALTER ROLE psme_app WITH NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
SELECT format('ALTER ROLE psme_app PASSWORD %L', :'dbpass') \gexec
SELECT 'CREATE DATABASE psme OWNER psme_app'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'psme') \gexec
SQL

echo "PostgreSQL, database 'psme' and role 'psme_app' are ready."
echo "Configure listen_addresses and pg_hba.conf as described in docs/LAB2.md."
