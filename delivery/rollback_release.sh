#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
cd "$(dirname "$0")"
[[ -f previous.env && -f release.env && -f .env ]] || { echo 'Previous release missing' >&2; exit 2; }
exec 9>.deploy.lock
flock -n 9 || { echo 'Concurrent deployment refused' >&2; exit 1; }
cp -p release.env current.env.tmp
trap 'rm -f current.env.tmp' EXIT
cp -p previous.env release.env
compose() { docker compose --env-file .env --env-file release.env -f compose.yml "$@"; }
if ! compose pull || ! compose up -d --wait --no-build; then
  cp -p current.env.tmp release.env
  compose up -d --wait --no-build || true
  exit 1
fi
sha="$(sed -n 's/^APP_VERSION=//p' release.env)"
port="$(sed -n 's/^HTTP_PORT=//p' .env | tail -1)"
if ! python3 smoke_release.py "http://127.0.0.1:${port:-8088}" "$sha"; then
  cp -p current.env.tmp release.env
  compose up -d --wait --no-build || true
  exit 1
fi
cp -p current.env.tmp previous.env
printf '%s\n' "$sha" > last-successful-sha
echo "Rolled back to $sha"
