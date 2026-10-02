#!/usr/bin/env bash
set -euo pipefail

APP_NET="${APP_NET:-192.168.56.0/24}"

if [[ $EUID -ne 0 ]]; then
  echo "Run as root: sudo APP_NET=$APP_NET $0"
  exit 1
fi

cat > /etc/nftables.conf <<NFT
#!/usr/sbin/nft -f
flush ruleset

table inet filter {
  chain input {
    type filter hook input priority 0; policy drop;
    ct state established,related accept
    iifname "lo" accept
    ip protocol icmp accept
    ip6 nexthdr icmpv6 accept
    ip saddr $APP_NET tcp dport 22 accept
    ip saddr $APP_NET tcp dport 8000 accept
  }

  chain forward {
    type filter hook forward priority 0; policy drop;
  }

  chain output {
    type filter hook output priority 0; policy accept;
  }
}
NFT

nft -f /etc/nftables.conf
systemctl enable --now nftables
nft list ruleset
