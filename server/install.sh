#!/usr/bin/env bash
# Установка сервера кооператива OldGold на Ubuntu (VPS). Запускать от root:
#   curl -fsSL https://raw.githubusercontent.com/xXxLexolasxXx/OldGold/main/server/install.sh -o install.sh
#   sudo bash install.sh                      # только http://IP:8787/
#   sudo bash install.sh --sslip --admin Торин   # + https/wss на адресе IP.sslip.io (домен покупать не нужно)
#   sudo bash install.sh --domain game.example.ru --admin Торин
# Повторный запуск безопасен: обновляет код и перезапускает службу, мир и аккаунты не трогает.
set -euo pipefail

REPO="https://github.com/xXxLexolasxXx/OldGold.git"
BRANCH="main"
APP=/opt/oldgold
DATA=/var/lib/oldgold
PORT=8787
DOMAIN=""
SSLIP=0
ADMIN=""

while [ $# -gt 0 ]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2 ;;
    --sslip) SSLIP=1; shift ;;
    --admin) ADMIN="$2"; shift 2 ;;
    --port) PORT="$2"; shift 2 ;;
    --branch) BRANCH="$2"; shift 2 ;;
    *) echo "Неизвестный параметр: $1"; exit 1 ;;
  esac
done

[ "$(id -u)" -eq 0 ] || { echo "Запустите от root: sudo bash install.sh"; exit 1; }
export DEBIAN_FRONTEND=noninteractive

echo "== Пакеты"
apt-get update -y
apt-get install -y curl git ca-certificates gnupg ufw

echo "== Node.js 22"
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
node -v

echo "== Код игры в $APP"
id oldgold >/dev/null 2>&1 || useradd --system --home "$DATA" --shell /usr/sbin/nologin oldgold
if [ -d "$APP/.git" ]; then
  git -C "$APP" fetch --depth 1 origin "$BRANCH"
  git -C "$APP" reset --hard "origin/$BRANCH"
else
  git clone --depth 1 --branch "$BRANCH" "$REPO" "$APP"
fi
mkdir -p "$DATA"
chown -R oldgold:oldgold "$DATA"

if [ "$SSLIP" = 1 ] && [ -z "$DOMAIN" ]; then
  IP=$(curl -fsS4 https://api.ipify.org || curl -fsS4 https://ifconfig.me)
  DOMAIN="$(echo "$IP" | tr . -).sslip.io"
  echo "== Адрес без покупки домена: $DOMAIN"
fi

# Когда перед игрой стоит Caddy, порт игры слушает только сам сервер (снаружи — через https)
BIND="0.0.0.0"; [ -n "$DOMAIN" ] && BIND="127.0.0.1"

echo "== Служба systemd oldgold"
cat > /etc/systemd/system/oldgold.service <<EOF
[Unit]
Description=OldGold coop server
After=network-online.target
Wants=network-online.target

[Service]
User=oldgold
Group=oldgold
WorkingDirectory=$APP
Environment=PORT=$PORT
Environment=HOST=$BIND
Environment=OLDGOLD_DATA=$DATA
Environment=OLDGOLD_ADMIN=$ADMIN
ExecStart=/usr/bin/node $APP/server/server.js
Restart=always
RestartSec=3
KillSignal=SIGTERM
TimeoutStopSec=20
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=$DATA
ProtectHome=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable oldgold
systemctl restart oldgold

echo "== Брандмауэр"
SSH_PORT=$(echo "${SSH_CONNECTION:-}" | awk '{print $4}')
ufw allow "${SSH_PORT:-22}/tcp" >/dev/null
ufw allow OpenSSH >/dev/null 2>&1 || true
if [ -n "$DOMAIN" ]; then
  ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null
  ufw delete allow "$PORT/tcp" >/dev/null 2>&1 || true
else
  ufw allow "$PORT/tcp" >/dev/null
fi
ufw --force enable >/dev/null
ufw status

if [ -n "$DOMAIN" ]; then
  echo "== Caddy: https://$DOMAIN (сертификат Let's Encrypt получит сам)"
  if ! command -v caddy >/dev/null; then
    apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
    apt-get update -y
    apt-get install -y caddy
  fi
  cat > /etc/caddy/Caddyfile <<EOF
$DOMAIN {
	encode gzip
	reverse_proxy 127.0.0.1:$PORT
}
EOF
  systemctl reload caddy || systemctl restart caddy
fi

sleep 2
systemctl --no-pager --lines=8 status oldgold || true
echo
if [ -n "$DOMAIN" ]; then
  echo "Готово. Играть: https://$DOMAIN/"
  echo "Адрес для GitHub Pages (COOP_SERVER в js/coopclient.js): wss://$DOMAIN"
else
  IP=${IP:-$(curl -fsS4 https://api.ipify.org || hostname -I | awk '{print $1}')}
  echo "Готово. Играть: http://$IP:$PORT/"
  echo "С GitHub Pages (https) такой адрес не подключится — нужен wss: sudo bash install.sh --sslip"
fi
echo "Журнал: journalctl -u oldgold -f"
