@echo off
title Octane Systems - Restore Backup
color 0C
cls
echo ========================================================
echo             OCTANE SYSTEMS - RESTORE BACKUP
echo ========================================================
echo.

cd /d "%~dp0"

if not exist backups (
    echo [ERROR] No backups folder found!
    echo.
    pause
    exit /b
)

echo Available Backup Files in 'backups' folder:
echo --------------------------------------------------------
dir /b /o-d backups\*.sql
echo --------------------------------------------------------
echo.

set /p backup_name="Copy and paste the backup file name here: "

if not exist "backups\%backup_name%" (
    echo.
    echo [ERROR] File 'backups\%backup_name%' not found!
    echo.
    pause
    exit /b
)

echo.
echo [WARNING] Restoring will overwrite existing data with this backup!
set /p confirm="Are you sure you want to proceed? (Y/N): "
if /i "%confirm%" neq "Y" (
    echo.
    echo [CANCELED] Restore operation canceled.
    echo.
    pause
    exit /b
)

echo.
echo [*] Restoring database from: backups\%backup_name%...
docker compose exec -T db psql -U octane_user octane_systems < "backups\%backup_name%"

if %errorlevel% equ 0 (
    echo.
    echo ========================================================
    echo  [SUCCESS] Database restored successfully!
    echo ========================================================
    echo.
    echo [*] Restarting backend to sync caches...
    docker compose restart backend
    timeout /t 2 >nul
    start http://localhost:8080
) else (
    echo.
    echo [ERROR] Restore failed. Please check the container logs.
    echo.
)

pause
