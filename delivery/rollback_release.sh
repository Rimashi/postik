#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
cd "$(dirname "$0")"
[[ -f previous.env && -f release.env && -f .env ]] || { echo 'Previous release missing' >&2; exit 2; }

exec 9>.deploy.lock
flock -n 9 || { echo 'Concurrent deployment refused' >&2; exit 1; }

saved="$(mktemp .current.XXXXXX)"
trap 'rm -f "$saved"' EXIT
cp -p release.env "$saved"
old_sha="$(sed -n 's/^APP_VERSION=//p' "$saved" | head -1)"
new_sha="$(sed -n 's/^APP_VERSION=//p' previous.env | head -1)"
[[ "$old_sha" =~ ^[0-9a-f]{40}$ && "$new_sha" =~ ^[0-9a-f]{40}$ ]] || {
  echo 'Invalid active/previous SHA' >&2; exit 2;
}
compose() { docker compose --env-file .env --env-file release.env -f compose.yml "$@"; }
smoke() {
  local port
  port="$(sed -n 's/^HTTP_PORT=//p' .env | tail -1)"
  python3 smoke_release.py "http://127.0.0.1:${port:-8088}" "$1"
}

cp -p previous.env release.env
restore() {
  cp -p "$saved" release.env
  if compose up -d --wait --no-build && smoke "$old_sha"; then
    echo "Restored original release: $old_sha" >&2
  else
    echo 'CRITICAL: failed to restore the original release' >&2
  fi
}
if ! compose pull || ! compose up -d --wait --no-build; then
  restore
  exit 1
fi
if ! smoke "$new_sha"; then
  restore
  exit 1
fi
cp -p "$saved" previous.env
printf '%s\n' "$new_sha" > last-successful-sha
echo "Rolled back to $new_sha"
