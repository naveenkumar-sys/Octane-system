@echo off
title Octane Systems - Database Backup
color 0A
cls
echo ========================================================
echo              OCTANE SYSTEMS - DATA BACKUP
echo ========================================================
echo.

cd /d "%~dp0"

if not exist backups mkdir backups

:: Reliable cross-locale timestamp via PowerShell
for /f %%a in ('powershell -Command "Get-Date -format yyyy-MM-dd_HH-mm-ss"') do set datestr=%%a
set backup_file=backups\octane_backup_%datestr%.sql

echo [*] Exporting full PostgreSQL database snapshot...
echo [*] Saving to: %backup_file%
echo.

docker compose exec -T db pg_dump -U octane_user octane_systems > "%backup_file%"

if %errorlevel% equ 0 (
    echo.
    echo ========================================================
    echo  [SUCCESS] Backup completed successfully!
    echo ========================================================
    echo.
    echo  Backup file saved:
    echo  %backup_file%
    echo.
    echo  TIP: Copy the 'backups' folder to a USB pen-drive
    echo  or cloud drive regularly for disaster recovery!
    echo.
) else (
    echo.
    echo [ERROR] Backup failed. Please verify the system is running.
    echo.
)

pause
