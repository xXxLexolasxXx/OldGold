# Нагрузочный тест кооп-сервера

Боты (WebSocket без зависимостей) ходят на **локальный** сервер, который тест поднимает сам: временная папка данных,
случайный порт, `OLDGOLD_STRESS=1`, `--expose-gc`. На боевой VPS тест не ходит.

```bash
node tools/loadtest/run.js smoke                       # проверка самого теста (20 с)
node tools/loadtest/run.js hold --players 4 --secs 1500 --speed 6   # одна деревня долго (speed 6 ≈ 3 игровых часа за 25 мин)
node tools/loadtest/run.js ramp --steps 2,8,16,32,60 --dwell 30     # рост числа игроков
node tools/loadtest/run.js rooms --k 3                 # k деревень (процессов) одновременно
node tools/loadtest/run.js spike --n 60                # 60 входов одновременно
node tools/loadtest/run.js limits                      # потолки и понятные отказы
node tools/loadtest/run.js reconnect                   # обрыв, «зомби», дребезг, рестарт сервера
node tools/loadtest/run.js slow                        # клиент, который не читает
node tools/loadtest/run.js versions                    # старые/кривые клиенты
node tools/loadtest/run.js overload --grow 300,700     # большая деревня
node tools/loadtest/run.js leak --secs 900             # заходы-выходы, наклон кучи
```

Результаты — `tools/loadtest/out/*.json` (в git не попадают). Итоги и пределы — в `НАГРУЗКА_СЕРВЕРА.md`.

Тест и сервер делят одну машину, поэтому цифры CPU чуть завышены (боты сами разжимают пакеты); `results._runner.cpuSec`
показывает, сколько съел сам тест. Не запускайте рядом тяжёлые задачи (`node tests/run.js`) — цифры поплывут.

Серверные переменные: `OLDGOLD_MAX_PLAYERS` (40), `OLDGOLD_MAX_CONNS` (80), `OLDGOLD_MAX_PER_IP` (12),
`OLDGOLD_SPEED` (только для тестов — ускорение времени), `OLDGOLD_THROTTLE_LOOPBACK=1` (проверять защиту от перебора
пароля и с loopback). Метрики: `curl http://127.0.0.1:ПОРТ/coop-info?metrics=1[&reset=1][&gc=1]` (только с loopback).
