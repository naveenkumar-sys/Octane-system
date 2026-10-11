@echo off
title Octane Systems - Stopping System
color 0E
cls
echo ========================================================
echo               STOPPING OCTANE SYSTEMS
echo ========================================================
echo.

cd /d "%~dp0"

echo [*] Safely stopping all services...
docker compose down

echo.
echo ========================================================
echo  [SUCCESS] Octane Systems has been safely stopped.
echo ========================================================
echo.
ping 127.0.0.1 -n 4 >nul
