@echo off
setlocal EnableDelayedExpansion
title Octane Systems - Restore Database Backup
color 0B
cls

echo ========================================================
echo             OCTANE SYSTEMS - RESTORE BACKUP
echo ========================================================
echo.

cd /d "%~dp0"

:: 1. Detect configured Port from .env (Default: 8080)
set "APP_PORT=8080"
if exist ".env" (
    for /f "usebackq tokens=1,2 delims==" %%A in (".env") do (
        set "KEY=%%A"
        set "VAL=%%B"
        if /i "!KEY!"=="PORT" set "APP_PORT=!VAL!"
    )
)

:: 2. Verify Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Docker is not running!
    echo Please start Docker Desktop first and try again.
    echo.
    pause
    exit /b 1
)

:: Ensure database container is active
echo [*] Ensuring database container is active...
docker compose up -d db >nul 2>&1

set /a DB_WAIT=0
:wait_db_ready
docker compose exec -T db pg_isready -U octane_user <nul >nul 2>&1
if %errorlevel% equ 0 goto db_ready
ping 127.0.0.1 -n 2 >nul
set /a DB_WAIT+=1
if !DB_WAIT! geq 15 goto db_ready
goto wait_db_ready

:db_ready

if not exist "backups" mkdir "backups"
if not exist "backups\safety" mkdir "backups\safety"

:: -------------------------------------------------------------
:: STEP 1: AUTOMATIC SAFETY BACKUP OF CURRENT DATA UNTIL NOW
:: -------------------------------------------------------------
echo.
echo [*] STEP 1: Creating automatic safety backup of current data...
for /f %%a in ('powershell -Command "Get-Date -format yyyy-MM-dd_HH-mm-ss"') do set "CURRENT_DATE_STR=%%a"
for /f "delims=" %%d in ('powershell -Command "Get-Date -format 'dddd, MMMM dd, yyyy hh:mm:ss tt'"') do set "readable_date=%%d"

set "SAFETY_BACKUP=backups\safety\safety_backup_before_restore_%CURRENT_DATE_STR%.sql"

docker compose exec -T db pg_dump -U octane_user --clean --if-exists octane_systems <nul > "%SAFETY_BACKUP%" 2>nul
set "safety_size=0"
if exist "%SAFETY_BACKUP%" (
    for %%F in ("%SAFETY_BACKUP%") do set "safety_size=%%~zF"
)

if !safety_size! gtr 1000 (
    echo [+] Current state safely backed up until now:
    echo     Timestamp: %readable_date%
    echo     File:      %SAFETY_BACKUP%
    echo     Size:      !safety_size! bytes
    echo     Note: Saved in backups\safety\ so pre-restore data is never lost.
) else (
    echo [!] Note: Database had no prior data or was empty.
)
echo.

:: -------------------------------------------------------------
:: STEP 2: LIST AVAILABLE BACKUPS FOR SELECTION
:: -------------------------------------------------------------
echo [*] STEP 2: Available Backups:
echo ========================================================

set /a count=0
for /f "delims=" %%F in ('dir /b /o-d /a:-d "backups\*.sql" 2^>nul') do (
    set /a count+=1
    set "file_!count!=%%F"
    set "filepath_!count!=backups\%%F"
    if !count! equ 1 (
        echo   [!count!] %%F   ^<-- [LATEST BACKUP]
    ) else (
        echo   [!count!] %%F
    )
)

set /a scount=0
for /f "delims=" %%S in ('dir /b /o-d /a:-d "backups\safety\*.sql" 2^>nul') do (
    set /a scount+=1
    set "sfile_!scount!=%%S"
    set "sfilepath_!scount!=backups\safety\%%S"
)

if !scount! gtr 0 (
    echo.
    echo   --- Pre-Restore Safety Backups [Undo Snapshots] ---
    for /L %%i in (1,1,!scount!) do (
        if %%i leq 5 (
            echo   [S%%i] !sfile_%%i!
        )
    )
)

if !count! equ 0 if !scount! equ 0 (
    echo.
    color 0C
    echo [ERROR] No backup SQL files found in backups folder!
    echo.
    pause
    exit /b 1
)

echo ========================================================
echo.
echo   Press ENTER to restore [1] (Latest Backup), or type a number (e.g. 2, or S1 to Undo).
echo.
set "choice=1"
set /p choice="Enter backup number to restore [Default 1]: "
if "!choice!"=="" set "choice=1"
set "choice=!choice: =!"
if "!choice!"=="" set "choice=1"

set "first_char=!choice:~0,1!"
if /i "!first_char!"=="S" (
    set "snum=!choice:~1!"
    if "!snum!"=="" set "snum=1"
    for %%V in (!snum!) do (
        set "selected_file=!sfile_%%V!"
        set "selected_path=!sfilepath_%%V!"
    )
) else (
    for %%V in (!choice!) do (
        set "selected_file=!file_%%V!"
        set "selected_path=!filepath_%%V!"
    )
)

if not defined selected_file (
    echo.
    color 0C
    echo [ERROR] Invalid selection "!choice!".
    echo.
    pause
    exit /b 1
)

echo.
echo Selected backup: !selected_path!
echo.
set "confirm=Y"
set /p confirm="Confirm restore? Existing data will be replaced by this backup (Y/N) [Default Y]: "
if /i "!confirm!" neq "Y" (
    echo.
    echo [CANCELED] Restore operation canceled. No changes were made.
    echo.
    pause
    exit /b 0
)

:: -------------------------------------------------------------
:: STEP 3: RESTORE DATABASE CLEANLY
:: -------------------------------------------------------------
echo.
echo [*] STEP 3: Preparing clean database instance...
docker compose exec -T db psql -U octane_user -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'octane_systems' AND pid <> pg_backend_pid();" <nul >nul 2>&1
docker compose exec -T db psql -U octane_user -d postgres -c "DROP DATABASE IF EXISTS octane_systems;" <nul >nul 2>&1
docker compose exec -T db psql -U octane_user -d postgres -c "CREATE DATABASE octane_systems OWNER octane_user;" <nul >nul 2>&1

echo [*] Restoring database from: !selected_path!...
docker compose exec -T db psql -U octane_user -d octane_systems < "!selected_path!" >nul 2>&1

if %errorlevel% neq 0 (
    color 0C
    echo.
    echo [ERROR] Restore command reported an issue.
    echo Please check if the file is a valid SQL dump.
    echo.
    pause
    exit /b 1
)

:: -------------------------------------------------------------
:: STEP 4: RESTART APPLICATION AND VERIFY ONLINE
:: -------------------------------------------------------------
echo.
echo [*] STEP 4: Restarting application services to synchronize database...
docker compose restart backend frontend >nul 2>&1

echo [*] Waiting for web server on http://localhost:%APP_PORT% to become ready...

set /a HTTP_WAIT=0
:wait_http_loop
set /a HTTP_WAIT+=1

set "HTTP_CODE=000"
for /f %%c in ('curl.exe -s -o NUL -w "%%{http_code}" http://localhost:%APP_PORT%/ 2^>nul') do (
    set "HTTP_CODE=%%c"
)

if "!HTTP_CODE!"=="200" goto app_online
if "!HTTP_CODE!"=="301" goto app_online
if "!HTTP_CODE!"=="302" goto app_online

<nul set /p=.
ping 127.0.0.1 -n 2 >nul

if !HTTP_WAIT! geq 35 goto open_browser
goto wait_http_loop

:app_online
echo.
echo [+] System confirmed ONLINE (HTTP 200 OK)!

:open_browser
echo.
echo ========================================================
echo  [SUCCESS] Database restored successfully!
echo  Restored from: !selected_path!
echo  System URL:    http://localhost:%APP_PORT%
echo ========================================================
echo.
echo [*] Opening restored system in browser...
ping 127.0.0.1 -n 2 >nul
start http://localhost:%APP_PORT%
echo.
echo [*] Restore complete. You can safely close this window.
echo.
pause
exit /b 0
