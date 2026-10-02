#!/usr/bin/env bash
set -euo pipefail

systemctl --no-pager --full status postgresql || true
printf '\n--- PostgreSQL listeners ---\n'
ss -ltnp | grep ':5432' || true
printf '\n--- nftables ---\n'
nft list ruleset || true
