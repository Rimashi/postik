#!/usr/bin/env bash
# Runs as unprivileged dedicated deploy user (Docker socket is privileged).
set -Eeuo pipefail
umask 077
cd "$(dirname "$0")"
sha="${1:?Usage: deploy_release.sh FULL_SHA}"
[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || { echo 'Invalid SHA' >&2; exit 2; }
[[ -f .env ]] || { echo 'Environment secrets missing' >&2; exit 2; }
exec 9>.deploy.lock
flock -n 9 || { echo 'Concurrent deployment refused' >&2; exit 1; }
base="ghcr.io/rimashi/postik"
candidate="$(mktemp .candidate.XXXXXX)"
trap 'rm -f "$candidate"' EXIT
printf 'APP_VERSION=%s\nAPI_IMAGE=%s-api:sha-%s\nWEB_IMAGE=%s-web:sha-%s\n' "$sha" "$base" "$sha" "$base" "$sha" > "$candidate"
chmod 600 "$candidate"
if [[ -f release.env ]]; then cp -p release.env previous.env; fi
mv "$candidate" release.env
compose() { docker compose --env-file .env --env-file release.env -f compose.yml "$@"; }
restore() {
  if [[ -f previous.env ]]; then
    cp -p previous.env release.env
    compose up -d --wait --no-build || true
  fi
}
if ! compose pull; then restore; exit 1; fi
if ! compose up -d --wait --no-build; then restore; exit 1; fi
port="$(sed -n 's/^HTTP_PORT=//p' .env | tail -1)"
if ! python3 smoke_release.py "http://127.0.0.1:${port:-8088}" "$sha"; then restore; exit 1; fi
printf '%s\n' "$sha" > last-successful-sha
echo "Deployed: $sha"
