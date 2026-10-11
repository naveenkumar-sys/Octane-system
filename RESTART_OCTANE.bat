@echo off
title Octane Systems - Restarting System
color 0B
cls
echo ========================================================
echo              RESTARTING OCTANE SYSTEMS
echo ========================================================
echo.

cd /d "%~dp0"

echo [*] Restarting all services...
docker compose restart

echo.
echo ========================================================
echo  [SUCCESS] Services restarted successfully!
echo ========================================================
echo.
echo [*] Reloading browser...
ping 127.0.0.1 -n 2 >nul
start http://localhost:8080
ping 127.0.0.1 -n 4 >nul
