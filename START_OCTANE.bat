@echo off
title Octane Systems - Starting POS / ERP
color 0A
cls
echo ========================================================
echo               STARTING OCTANE SYSTEMS
echo ========================================================
echo.

cd /d "%~dp0"

echo [*] Checking Docker engine status...
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Docker Desktop is not running. Starting Docker Desktop...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe" 2>nul
    echo [*] Waiting for Docker engine to initialize...
    ping 127.0.0.1 -n 20 >nul
)

echo [*] Launching application containers...
docker compose up -d

if %errorlevel% equ 0 (
    echo.
    echo ========================================================
    echo  [SUCCESS] Octane Systems is UP and RUNNING!
    echo ========================================================
    echo.
    echo [*] Opening POS in your browser...
    ping 127.0.0.1 -n 3 >nul
    start http://localhost:8080
    echo [*] You can safely close this window.
    ping 127.0.0.1 -n 4 >nul
) else (
    echo.
    echo [ERROR] Failed to start containers. Please ensure Docker Desktop is open and green.
    echo.
    pause
)
