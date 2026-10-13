@echo off
setlocal EnableDelayedExpansion
title Octane Systems - Database Backup
color 0A
cls

echo ========================================================
echo              OCTANE SYSTEMS - DATA BACKUP
echo ========================================================
echo.

cd /d "%~dp0"

:: 1. Verify Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Docker is not running!
    echo Please start Docker Desktop first and try again.
    echo.
    pause
    exit /b 1
)

:: 2. Ensure db container is active
echo [*] Ensuring database container is active...
docker compose up -d db >nul 2>&1

set /a DB_WAIT=0
:wait_db_ready
docker compose exec -T db pg_isready -U octane_user >nul 2>&1
if %errorlevel% equ 0 goto db_ready
ping 127.0.0.1 -n 2 >nul
set /a DB_WAIT+=1
if !DB_WAIT! geq 15 goto db_ready
goto wait_db_ready

:db_ready

if not exist backups mkdir backups

:: 3. Reliable timestamp via PowerShell
for /f %%a in ('powershell -Command "Get-Date -format yyyy-MM-dd_HH-mm-ss"') do set "datestr=%%a"
for /f "delims=" %%d in ('powershell -Command "Get-Date -format 'dddd, MMMM dd, yyyy hh:mm:ss tt'"') do set "readable_date=%%d"

set "backup_file=backups\octane_backup_%datestr%.sql"

echo [*] Snapshot Timestamp: %readable_date%
echo [*] Exporting full PostgreSQL database (all data until current date/time)...
echo [*] Destination: %backup_file%
echo.

docker compose exec -T db pg_dump -U octane_user --clean --if-exists octane_systems > "%backup_file%"

if %errorlevel% equ 0 (
    :: Check file size
    for %%F in ("%backup_file%") do set "file_size=%%~zF"
    
    echo.
    echo ========================================================
    echo  [SUCCESS] Backup completed successfully!
    echo ========================================================
    echo.
    echo  Backup file saved:
    echo  %backup_file%
    echo.
    echo  Data preserved until: %readable_date%
    echo  Backup size:          !file_size! bytes
    echo.
    echo  TIP: Copy the 'backups' folder to a USB pen-drive
    echo  or cloud drive regularly for disaster recovery!
    echo.
) else (
    color 0C
    echo.
    echo [ERROR] Backup failed. Please verify that the system containers are running.
    echo.
)

pause
exit /b 0
