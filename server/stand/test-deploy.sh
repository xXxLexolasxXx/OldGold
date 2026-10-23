#!/usr/bin/env bash
# «Залить версию на тест»: bash test-deploy.sh <ветка|тег|коммит> [--force]
# Как на боевом: точка отката, перезапуск только при online=0 (--force — не ждать), проверка coop-info и журнала.
# Ветка пишется как origin/<имя>; можно откатываться назад (тест — не боевой, fast-forward не обязателен).
set -euo pipefail
REF=${1:?укажи версию: bash $0 origin/main}; FORCE=${2:-}
CODE=/opt/oldgold-test DATA=/var/lib/oldgold-test PORT=8788 SVC=oldgold-test
say() { echo "== $*"; }
[ "$(id -u)" = 0 ] || { echo "нужен root"; exit 1; }
git -C "$CODE" fetch -q --tags --force origin
NEW=$(git -C "$CODE" rev-parse --verify -q "$REF^{commit}") || { echo "нет версии $REF"; exit 1; }
OLD=$(git -C "$CODE" rev-parse HEAD)
ON=$(curl -fsS http://127.0.0.1:$PORT/coop-info | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).online))' || echo 0)
[ "$ON" = 0 ] || [ "$FORCE" = --force ] || { echo "на тесте $ON игроков — подождите или добавьте --force"; exit 1; }
say "код: ${OLD:0:7} -> ${NEW:0:7} (откат: bash $0 $OLD --force)"
systemctl stop $SVC                       # при остановке сервер сохраняет мир
git -C "$CODE" checkout -q --detach "$NEW"
systemctl start $SVC
for i in $(seq 1 30); do curl -fsS http://127.0.0.1:$PORT/coop-info >/dev/null 2>&1 && break; sleep 1; done
say "coop-info: $(curl -fsS http://127.0.0.1:$PORT/coop-info)"
say "версия: $(grep -m1 -o "v: *'[^']*'" "$CODE/js/changelog.js" || true)"
journalctl -u $SVC -n 10 --no-pager | cut -c1-200
