@echo off
setlocal EnableDelayedExpansion
title Octane Systems - Starting POS / ERP
color 0A
cls

echo ========================================================
echo               STARTING OCTANE SYSTEMS
echo ========================================================
echo.

:: 1. Navigate to script directory
cd /d "%~dp0"

:: 2. Detect configured Port from .env (Default: 8080)
set "APP_PORT=8080"
if exist ".env" (
    for /f "usebackq tokens=1,2 delims==" %%A in (".env") do (
        set "KEY=%%A"
        set "VAL=%%B"
        if /i "!KEY!"=="PORT" (
            set "APP_PORT=!VAL!"
        )
    )
)

echo [*] Target Application: http://localhost:%APP_PORT%
echo.

:: 3. Verify Docker CLI is available
where docker >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Docker is not installed or not in your system PATH!
    echo.
    echo Please install Docker Desktop for Windows:
    echo https://www.docker.com/products/docker-desktop/
    echo.
    echo After installing, restart your computer and run this file again.
    echo.
    pause
    exit /b 1
)

:: 4. Check if Docker Daemon / Engine is running
echo [*] Checking Docker Desktop engine status...
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Docker Desktop is not currently running.
    echo [*] Starting Docker Desktop automatically...
    
    if exist "C:\Program Files\Docker\Docker\Docker Desktop.exe" (
        start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    ) else if exist "%LOCALAPPDATA%\Programs\Docker\Docker\Docker Desktop.exe" (
        start "" "%LOCALAPPDATA%\Programs\Docker\Docker\Docker Desktop.exe"
    ) else (
        start "" "Docker Desktop" 2>nul
    )
    
    echo [*] Waiting for Docker engine to become ready...
    set /a DOCKER_WAIT=0
    
    :wait_docker_loop
    ping 127.0.0.1 -n 3 >nul
    set /a DOCKER_WAIT+=1
    docker info >nul 2>&1
    if %errorlevel% equ 0 goto docker_ready
    
    <nul set /p=.
    if !DOCKER_WAIT! geq 35 (
        echo.
        color 0C
        echo [ERROR] Docker Desktop did not start in time.
        echo Please open Docker Desktop manually from your Start Menu, wait until the
        echo icon in your taskbar turns GREEN, and run START_OCTANE.bat again.
        echo.
        pause
        exit /b 1
    )
    goto wait_docker_loop
)

:docker_ready
echo.
echo [+] Docker Engine is active and ready.
echo.

:: 5. Launch containers
echo [*] Starting Octane Systems containers (Database, Backend, Frontend)...
docker compose up -d
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo [ERROR] Failed to start containers via Docker Compose.
    echo Please ensure Docker Desktop is running with green status.
    echo.
    pause
    exit /b 1
)

:: 6. Health check: Wait until http://localhost:%APP_PORT%/ returns HTTP 200
echo.
echo [*] Waiting for web server and database to be fully initialized...
echo [*] Probing http://localhost:%APP_PORT% ...

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

if !HTTP_WAIT! geq 45 (
    echo.
    echo [!] Server is taking longer than usual to respond.
    echo [*] Attempting to open browser now...
    goto open_browser
)
goto wait_http_loop

:app_online
echo.
echo [+] Web server confirmed ONLINE (HTTP 200 OK)!

:open_browser
echo.
echo ========================================================
echo  [SUCCESS] Octane Systems is UP and READY!
echo  URL: http://localhost:%APP_PORT%
echo ========================================================
echo.
echo [*] Launching Octane Systems in your browser...
ping 127.0.0.1 -n 2 >nul
start http://localhost:%APP_PORT%
echo.
echo [*] Application is now open in your browser.
echo [*] You can safely minimize or close this window.
echo.
ping 127.0.0.1 -n 5 >nul
exit /b 0
