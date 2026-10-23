#!/usr/bin/env bash
# Разовая установка ТЕСТОВОГО кооп-сервера рядом с боевым (см. СТЕНД.md). Запуск на VPS от root:
#   bash test-setup.sh [ветка|тег|коммит]      (по умолчанию origin/main)
# Боевой сервер (служба oldgold, /opt/oldgold, /var/lib/oldgold) не трогается.
# Общая точка — Caddy: в Caddyfile дописывается блок тестового адреса (копия файла перед правкой, validate, reload).
set -euo pipefail
REF=${1:-origin/main}
REPO=https://github.com/xXxLexolasxXx/OldGold.git
CODE=/opt/oldgold-test DATA=/var/lib/oldgold-test PORT=8788 SVC=oldgold-test
DOMAIN=test-151-252-107-75.sslip.io
HERE=$(cd "$(dirname "$0")" && pwd)
[ "$(id -u)" = 0 ] || { echo "нужен root"; exit 1; }
say() { echo "== $*"; }

say "код: $CODE"
[ -d "$CODE/.git" ] || git clone -q "$REPO" "$CODE"
git -C "$CODE" fetch -q --tags origin
git -C "$CODE" checkout -q --detach "$(git -C "$CODE" rev-parse --verify "$REF^{commit}")"
mkdir -p "$DATA" && chown -R oldgold:oldgold "$DATA"

say "служба $SVC (127.0.0.1:$PORT, данные $DATA)"
cat > /etc/systemd/system/$SVC.service <<EOF
[Unit]
Description=OldGold coop server (TEST stand)
After=network-online.target
Wants=network-online.target

[Service]
User=oldgold
Group=oldgold
WorkingDirectory=$CODE
Environment=PORT=$PORT
Environment=HOST=127.0.0.1
Environment=OLDGOLD_DATA=$DATA
Environment=OLDGOLD_ADMIN=tester1
ExecStart=/usr/bin/node $CODE/server/server.js
Restart=always
RestartSec=3
KillSignal=SIGTERM
TimeoutStopSec=20
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=$DATA
ProtectHome=true
PrivateTmp=true
MemoryMax=600M

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload

if [ ! -s "$DATA/players.json" ]; then say "синтетические игроки"; node "$HERE/seed-testers.js" "$DATA"; chown -R oldgold:oldgold "$DATA"; fi
systemctl enable -q --now $SVC

say "Caddy: https://$DOMAIN"
CF=/etc/caddy/Caddyfile
if ! grep -q "^$DOMAIN " "$CF"; then
  cp -a "$CF" "$CF.bak-$(date +%Y%m%d-%H%M%S)"
  printf '\n%s {\n\tencode gzip\n\treverse_proxy 127.0.0.1:%s\n}\n' "$DOMAIN" "$PORT" >> "$CF"
  caddy validate --config "$CF" --adapter caddyfile >/dev/null || { echo "Caddyfile не прошёл проверку — верните копию $CF.bak-*"; exit 1; }
  systemctl reload caddy
fi
for i in $(seq 1 30); do curl -fsS http://127.0.0.1:$PORT/coop-info >/dev/null 2>&1 && break; sleep 1; done
say "тест: $(curl -fsS http://127.0.0.1:$PORT/coop-info)  код $(git -C "$CODE" rev-parse --short HEAD)"
say "боевой: $(curl -fsS http://127.0.0.1:8787/coop-info)"
