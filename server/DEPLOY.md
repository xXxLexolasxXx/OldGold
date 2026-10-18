# Сервер кооператива на VPS (Ubuntu)

Сервер — один процесс Node.js без зависимостей: раздаёт игру по HTTP, принимает игроков по WebSocket
и считает общий мир. Мир и аккаунты лежат в `/var/lib/oldgold` (вне репозитория), сохраняются раз в 30 с
и при остановке службы.

## Что нужно

- VPS с Ubuntu 22.04 или 24.04, 1 ядро и 1 ГБ памяти хватает на несколько игроков.
- Публичный IPv4 и вход по SSH под root (или пользователем с `sudo`).
- Домен — **не обязателен**: скрипт умеет адрес вида `1-2-3-4.sslip.io`, который сам указывает на ваш IP,
  и получает для него настоящий сертификат https.

## Быстрая установка (одна команда)

Зайдите на сервер (`ssh root@ВАШ_IP`) и выполните:

```bash
curl -fsSL https://raw.githubusercontent.com/xXxLexolasxXx/OldGold/main/server/install.sh -o install.sh
sudo bash install.sh --sslip --admin ВашНик
```

Скрипт:
1. ставит Node.js 22, git, ufw;
2. клонирует репозиторий в `/opt/oldgold`;
3. создаёт системного пользователя `oldgold` и службу systemd `oldgold` (автозапуск, перезапуск при падении);
4. открывает в брандмауэре SSH и 80/443 (с `--sslip`/`--domain`) или 8787 (без них);
5. с `--sslip` или `--domain` ставит Caddy — он сам получает сертификат Let's Encrypt и проксирует https и wss на игру.

В конце скрипт напишет адрес игры и адрес для GitHub Pages.

Варианты:

| Команда | Что получится |
|---|---|
| `sudo bash install.sh` | только `http://IP:8787/` — играть можно, открыв этот адрес; с GitHub Pages (https) подключиться **нельзя** |
| `sudo bash install.sh --sslip` | `https://1-2-3-4.sslip.io/` и `wss://1-2-3-4.sslip.io` — работает и с GitHub Pages |
| `sudo bash install.sh --domain game.example.ru` | то же на своём домене (A-запись домена должна указывать на IP сервера) |
| `--admin Ник1,Ник2` | эти игроки — «хосты»: меняют права игроков и перезапускают сервер |
| `--port 9000` | другой внутренний порт |

**Админ по нику**: зарегистрируйте этот ник в игре сразу после установки, пока его не занял кто-то другой.

## Подключение с GitHub Pages

Страница на GitHub Pages открыта по https, а браузер с https-страницы пускает только на `wss://` —
поэтому нужен вариант с `--sslip` или `--domain`.

1. В `js/coop/coopclient.js` впишите адрес сервера:
   ```js
   const COOP_SERVER = 'wss://1-2-3-4.sslip.io';
   ```
2. Закоммитьте и запушьте — после обновления Pages в главном меню появится кнопка «Общая деревня».

Проверить без правки кода: откройте `https://<ваш pages>/?server=wss://1-2-3-4.sslip.io`.
Можно и вовсе без Pages: `https://1-2-3-4.sslip.io/` — сервер сам раздаёт игру.

## Обслуживание

```bash
systemctl status oldgold          # жив ли
journalctl -u oldgold -f          # журнал: входы, выходы, ошибки
systemctl restart oldgold         # перезапуск (мир сохраняется перед остановкой)
sudo bash install.sh --sslip --admin ВашНик   # обновить игру до свежей версии из GitHub
```

## Статистика игроков

Сервер сам считает реальных игроков: сколько всего, кто заходил сегодня и за неделю, входы и часы по дням,
пик онлайна, последний вход каждого, версии клиента (Pages или сайт сервера) и сервера (коммит).
Пишется в `/var/lib/oldgold/stats.json`. Паролей там нет, IP — только хэш с солью этого сервера
(видно лишь, со скольких разных сетей заходил игрок).

Где смотреть:

- **В игре** (только хосту): кнопка «Права» → «Статистика».
- **По SSH:**
  ```bash
  node /opt/oldgold/server/stats.js
  ```
  (`--json` — то же самое в JSON). «Сейчас в игре» здесь — на момент последнего сохранения, раз в 30 с.
- **В браузере по секретному ключу:** ключ сервер создаёт сам при первом запуске в `/var/lib/oldgold/stats.key`:
  ```bash
  cat /var/lib/oldgold/stats.key
  ```
  Потом откройте `https://151-252-107-75.sslip.io/stats?key=КЛЮЧ` (добавьте `&json`, чтобы получить JSON).
  Свой ключ можно задать переменной `OLDGOLD_STATS_KEY` в службе. Ключ не публикуйте: с ним видны ники и часы всех игроков.

## Воронка одиночной игры (анонимный счётчик)

Одиночная игра шлёт на сервер `POST /e` короткие события (`tut-step-05`, `night-seen`, `lost-1`, `coop-join`…) со случайным
id клиента из localStorage (`oldgold-cid`). Ника, имён, паролей и IP в данных нет (IP держится только в памяти для лимита
60 запросов/мин). Пишется в `/var/lib/oldgold/events.json`; каждое событие у клиента считается один раз, повторы безвредны.

Сводка воронки (проценты от всех клиентов, возвращаемость на следующий день и за неделю, прочие события, новые клиенты по дням):

```bash
node /opt/oldgold/server/events.js /var/lib/oldgold          # текстом (--json — JSON)
```

Или в браузере: `https://151-252-107-75.sslip.io/stats?key=КЛЮЧ` — внизу блок «Воронка одиночной игры» (в `&json` — поле `solo`).
Список событий — в `СТАТИСТИКА.md`. После обновления сервера: `systemctl restart oldgold`.

Резервная копия мира и аккаунтов:

```bash
tar czf oldgold-backup-$(date +%F).tgz -C /var/lib oldgold
```

Рядом с миром всегда лежит прошлое сохранение `world.json.bak` — сервер сам откатится на него,
если основное окажется битым.

## Ручная установка (если скрипт не подходит)

```bash
# Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt-get install -y nodejs git

# код и данные
sudo git clone --depth 1 https://github.com/xXxLexolasxXx/OldGold.git /opt/oldgold
sudo useradd --system --home /var/lib/oldgold --shell /usr/sbin/nologin oldgold
sudo mkdir -p /var/lib/oldgold && sudo chown oldgold:oldgold /var/lib/oldgold
```

`/etc/systemd/system/oldgold.service`:

```ini
[Unit]
Description=OldGold coop server
After=network-online.target

[Service]
User=oldgold
WorkingDirectory=/opt/oldgold
Environment=PORT=8787
Environment=OLDGOLD_DATA=/var/lib/oldgold
Environment=OLDGOLD_ADMIN=ВашНик
ExecStart=/usr/bin/node /opt/oldgold/server/server.js
Restart=always
TimeoutStopSec=20

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now oldgold
sudo ufw allow OpenSSH && sudo ufw allow 8787/tcp && sudo ufw enable
```

### wss через Caddy

```bash
sudo apt-get install -y caddy      # или по инструкции caddyserver.com/docs/install
```

`/etc/caddy/Caddyfile`:

```
game.example.ru {
	reverse_proxy 127.0.0.1:8787
}
```

```bash
sudo systemctl reload caddy && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp
```

Добавьте в службу `Environment=HOST=127.0.0.1` и закройте 8787 (`sudo ufw delete allow 8787/tcp`) —
снаружи игра будет доступна только по https.

### wss через nginx (если nginx уже стоит)

```nginx
server {
    listen 443 ssl;
    server_name game.example.ru;
    ssl_certificate     /etc/letsencrypt/live/game.example.ru/fullchain.pem;   # certbot --nginx
    ssl_certificate_key /etc/letsencrypt/live/game.example.ru/privkey.pem;
    location / {
        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 120s;
    }
}
```

## Переменные окружения сервера

| Переменная | По умолчанию | Что |
|---|---|---|
| `PORT` | `8787` | порт HTTP и WebSocket |
| `HOST` | `0.0.0.0` | на каком адресе слушать (`127.0.0.1` — только для прокси) |
| `OLDGOLD_DATA` | `server/data` | папка мира, аккаунтов и прав |
| `OLDGOLD_ADMIN` | — | ники хостов через запятую (без этого хост — только тот, кто играет на самом сервере) |
| `OLDGOLD_STATS_KEY` | из `stats.key` | ключ для `/stats?key=…` (без переменной сервер создаёт ключ сам) |

## Если не подключается

- `systemctl status oldgold` — служба запущена? В `journalctl -u oldgold -n 50` нет ошибок?
- `curl http://127.0.0.1:8787/coop-info` на сервере должен ответить `{"coop":true,...}`.
- Снаружи: `http://IP:8787/coop-info` (без Caddy) или `https://адрес/coop-info` (с Caddy).
- Порт закрыт у хостера? У некоторых VPS есть свой брандмауэр в панели управления — откройте там 80, 443 (или 8787).
- Страница по https и адрес `ws://` — браузер не пустит: нужен `wss://` (вариант `--sslip`).
