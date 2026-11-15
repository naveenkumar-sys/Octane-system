@echo off
setlocal
title Octane Systems - Playwright E2E Test Suite
color 0B
cls

echo ========================================================
echo        OCTANE SYSTEMS - FAST PLAYWRIGHT E2E TESTING
echo ========================================================
echo.
echo Choose how you want to run the tests:
echo.
echo  [1] FASTEST: Headless Background Run (Fast, ~45s)
echo  [2] INTERACTIVE: Playwright UI Mode (Time-travel & Visual Debugger)
echo  [3] LIVE: Headed Browser Mode (Watch Chrome click live)
echo  [4] REPORT: Open Last HTML Test Report
echo  [5] Exit
echo.
set /p choice="Enter your choice (1-5) [Default: 1]: "
if "%choice%"=="" set choice=1

cd /d "%~dp0octane_frontend"

if "%choice%"=="1" (
    echo.
    echo [*] Running full test suite in fast headless mode...
    echo.
    call npx playwright test e2e/entire-application-e2e.spec.js
    goto done
)

if "%choice%"=="2" (
    echo.
    echo [*] Launching Playwright Interactive UI Mode...
    echo.
    call npx playwright test --ui
    goto done
)

if "%choice%"=="3" (
    echo.
    echo [*] Launching live Chrome headed test execution...
    echo.
    call npx playwright test e2e/entire-application-e2e.spec.js --headed
    goto done
)

if "%choice%"=="4" (
    echo.
    echo [*] Opening latest Playwright HTML report in browser...
    echo.
    call npx playwright show-report
    goto done
)

:done
echo.
echo ========================================================
echo Execution complete.
echo ========================================================
echo.
pause

