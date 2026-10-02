#!/usr/bin/env bash
set -euo pipefail

systemctl --no-pager --full status psme || true
printf '\n--- enabled ---\n'
systemctl is-enabled psme || true
printf '\n--- process ---\n'
ps -u psme -f || true
printf '\n--- listening port 8000 ---\n'
ss -ltnp | grep ':8000' || true
printf '\n--- health ---\n'
curl -i --max-time 5 http://127.0.0.1:8000/api/health || true
printf '\n--- recent logs ---\n'
journalctl -u psme -n 30 --no-pager || true
