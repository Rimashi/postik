#!/usr/bin/env bash
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Run as root: sudo $0"
  exit 1
fi

apt update
apt install -y python3 python3-venv python3-pip git nftables curl

if ! id psme >/dev/null 2>&1; then
  useradd --system --user-group --home-dir /opt/psme --create-home --shell /usr/sbin/nologin psme
fi

mkdir -p /opt/psme /etc/psme
chown -R psme:psme /opt/psme
chmod 750 /opt/psme
chmod 750 /etc/psme

echo "App server base packages and service account are ready."
echo "Next: clone/copy repository to /opt/psme and follow docs/LAB2.md."
