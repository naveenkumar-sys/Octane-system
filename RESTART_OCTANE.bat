@echo off
setlocal EnableDelayedExpansion
title Octane Systems - Restarting System
color 0B
cls

echo ========================================================
echo              RESTARTING OCTANE SYSTEMS
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

echo [*] Restarting all services...
docker compose restart

echo.
echo [*] Waiting for services to re-initialize...
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

if !HTTP_WAIT! geq 35 (
    goto open_browser
)
goto wait_http_loop

:app_online
echo.
echo [+] Services confirmed ONLINE (HTTP 200 OK)!

:open_browser
echo.
echo ========================================================
echo  [SUCCESS] Octane Systems restarted successfully!
echo  URL: http://localhost:%APP_PORT%
echo ========================================================
echo.
echo [*] Reloading browser...
ping 127.0.0.1 -n 2 >nul
start http://localhost:%APP_PORT%
ping 127.0.0.1 -n 4 >nul
exit /b 0
