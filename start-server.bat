@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Сервер OldGold. Игра откроется по адресу http://localhost:8787/
echo Закройте это окно, чтобы остановить сервер.
node server\server.js
pause
