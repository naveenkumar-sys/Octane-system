@echo off
setlocal EnableDelayedExpansion
title Octane Systems - Software Update
color 0B
cls

echo ========================================================
echo          OCTANE SYSTEMS - 1-CLICK SOFTWARE UPDATE
echo ========================================================
echo.

cd /d "%~dp0"

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

echo [*] Pulling latest code and features from GitHub...
git pull

echo.
echo [*] Rebuilding application containers...
docker compose up -d --build

if %errorlevel% neq 0 (
    echo.
    color 0C
    echo [ERROR] Update failed. Please check your internet connection or git status.
    echo.
    pause
    exit /b 1
)

echo.
echo [*] Waiting for updated containers to initialize...
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
    goto open_browser
)
goto wait_http_loop

:app_online
echo.
echo [+] Updated services confirmed ONLINE (HTTP 200 OK)!

:open_browser
echo.
echo ========================================================
echo  [SUCCESS] Octane Systems updated successfully!
echo  URL: http://localhost:%APP_PORT%
echo ========================================================
echo.
echo [*] Opening updated system in browser...
ping 127.0.0.1 -n 2 >nul
start http://localhost:%APP_PORT%
ping 127.0.0.1 -n 5 >nul
exit /b 0
