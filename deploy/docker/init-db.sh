#!/bin/sh

set -eu

psql \
    --username "$POSTGRES_USER" \
    --dbname "$POSTGRES_DB" \
    --set=app_user="$APP_DB_USER" \
    --set=app_password="$APP_DB_PASSWORD" <<'EOSQL'
CREATE USER :"app_user" WITH PASSWORD :'app_password';
EOSQL

createdb \
    --username "$POSTGRES_USER" \
    --owner "$APP_DB_USER" \
    "$APP_DB_NAME"
