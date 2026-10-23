#!/usr/bin/env bash
# «Сбросить тест»: bash test-reset.sh [--keep-players]
# Останавливает тестовую службу, кладёт копию в /var/backups/oldgold-test-ДАТА (хранятся 5 последних),
# стирает всё в /var/lib/oldgold-test и заводит синтетических игроков заново (--keep-players — стереть только мир).
# Боевой сервер не трогается. Репетиция боевого обнуления — см. СТЕНД.md (oldgold-reset.sh с SVC/PORT/DATA теста).
set -euo pipefail
CODE=/opt/oldgold-test DATA=/var/lib/oldgold-test SVC=oldgold-test PORT=8788
HERE=$(cd "$(dirname "$0")" && pwd)
BK=/var/backups/oldgold-test-$(date +%Y%m%d-%H%M%S)
say() { echo "== $*"; }
[ "$(id -u)" = 0 ] || { echo "нужен root"; exit 1; }
case "$DATA" in /var/lib/oldgold-test) ;; *) echo "не тот каталог: $DATA"; exit 1 ;; esac
systemctl stop $SVC
cp -a "$DATA" "$BK" && say "копия: $BK"
ls -d /var/backups/oldgold-test-* 2>/dev/null | sort | head -n -5 | xargs -r rm -rf
if [ "${1:-}" = --keep-players ]; then
  ( cd "$DATA" && rm -f world*.json village.json )
else
  find "$DATA" -mindepth 1 -delete
  node "$HERE/seed-testers.js" "$DATA"
fi
chown -R oldgold:oldgold "$DATA"
systemctl start $SVC
for i in $(seq 1 30); do curl -fsS http://127.0.0.1:$PORT/coop-info >/dev/null 2>&1 && break; sleep 1; done
say "coop-info: $(curl -fsS http://127.0.0.1:$PORT/coop-info)  код $(git -C "$CODE" rev-parse --short HEAD)"
