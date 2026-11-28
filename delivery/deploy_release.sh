#!/usr/bin/env bash
# Runs via the root-owned, restricted CD handler, not as general SSH shell.
set -Eeuo pipefail
umask 077
cd "$(dirname "$0")"
sha="${1:?Usage: deploy_release.sh FULL_SHA}"
[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || { echo 'Invalid SHA' >&2; exit 2; }
[[ -f .env ]] || { echo '.env missing' >&2; exit 2; }

exec 9>.deploy.lock
flock -n 9 || { echo 'Concurrent deployment refused' >&2; exit 1; }

base='ghcr.io/rimashi/postik'
candidate="$(mktemp .candidate.XXXXXX)"
saved="$(mktemp .saved.XXXXXX)"
trap 'rm -f "$candidate" "$saved"' EXIT
printf 'APP_VERSION=%s\nAPI_IMAGE=%s-api:sha-%s\nWEB_IMAGE=%s-web:sha-%s\n' \
  "$sha" "$base" "$sha" "$base" "$sha" > "$candidate"

compose() {
  local release_file="$1"
  shift
  docker compose --env-file .env --env-file "$release_file" -f compose.yml "$@"
}
smoke() {
  local expected_sha="$1"
  local port
  port="$(sed -n 's/^HTTP_PORT=//p' .env | tail -1)"
  python3 smoke_release.py "http://127.0.0.1:${port:-8088}" "$expected_sha"
}

current_sha=''
if [[ -f release.env ]]; then
  current_sha="$(sed -n 's/^APP_VERSION=//p' release.env | head -1)"
  [[ "$current_sha" =~ ^[0-9a-f]{40}$ ]] || { echo 'Invalid active release.env' >&2; exit 2; }
  if [[ -f last-successful-sha && "$(cat last-successful-sha)" != "$current_sha" ]]; then
    echo 'release.env disagrees with last-successful-sha; manual inspection needed' >&2
    exit 2
  fi
  cp -p release.env "$saved"
fi

if [[ "$sha" == "$current_sha" ]]; then
  smoke "$sha"
  echo "Already deployed and verified: $sha"
  exit 0
fi

# Pull by candidate tag without changing active release metadata.
pull_candidate() {
  if [[ "${POSTIK_LAB_CACHED_PULL:-0}" == 1 ]]; then
    timeout --kill-after=10s 300s docker compose --env-file .env --env-file "$candidate" -f compose.yml pull --policy missing
  else
    compose "$candidate" pull
  fi
}

if ! pull_candidate; then
  echo "Pull failed; active release remains $current_sha" >&2
  exit 1
fi

cp "$candidate" release.env
restore() {
  if [[ -n "$current_sha" ]]; then
    cp -p "$saved" release.env
    if compose release.env up -d --wait --no-build && smoke "$current_sha"; then
      echo "Restored previous successful release: $current_sha" >&2
    else
      echo "CRITICAL: restoration failed, inspect staging immediately" >&2
    fi
  else
    echo 'First deployment failed; no prior release to restore' >&2
  fi
}

if ! compose release.env up -d --wait --no-build; then
  echo "Container deployment failed for $sha" >&2
  restore
  exit 1
fi
if ! smoke "$sha"; then
  echo "Post-deployment smoke tests failed for $sha" >&2
  restore
  exit 1
fi

# Only a successful release updates rollback history and the latest SHA.
if [[ -n "$current_sha" ]]; then
  cp -p "$saved" previous.env
fi
printf '%s\n' "$sha" > last-successful-sha
echo "Deployed: $sha"
