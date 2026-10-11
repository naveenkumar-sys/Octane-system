@echo off
title Octane Systems - Software Update
color 0B
cls
echo ========================================================
echo          OCTANE SYSTEMS - 1-CLICK SOFTWARE UPDATE
echo ========================================================
echo.

cd /d "%~dp0"

echo [*] Pulling latest code and features from GitHub...
git pull

echo.
echo [*] Rebuilding application containers...
docker compose up -d --build

if %errorlevel% equ 0 (
    echo.
    echo ========================================================
    echo  [SUCCESS] Octane Systems has been updated successfully!
    echo ========================================================
    echo.
    echo [*] Opening updated system...
    ping 127.0.0.1 -n 3 >nul
    start http://localhost:8080
    ping 127.0.0.1 -n 4 >nul
) else (
    echo.
    echo [ERROR] Update failed. Please check your internet connection or git status.
    echo.
    pause
)
