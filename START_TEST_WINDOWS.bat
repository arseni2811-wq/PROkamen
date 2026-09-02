@echo off
setlocal
title PRO Kamen CRM - Windows Test

echo =====================================
echo PRO Kamen CRM - WINDOWS TEST
echo Database: pro_erp_test only
echo =====================================

sc query MySQL80 | find "RUNNING" >nul
if errorlevel 1 (
  echo MySQL80 is not running. Starting it...
  net start MySQL80
  if errorlevel 1 (
    echo Failed to start MySQL80. Run this file as administrator or start the service manually.
    pause
    exit /b 1
  )
) else (
  echo MySQL80 is already running.
)

if not exist "%~dp0backend\.env" (
  echo Missing backend\.env. See WINDOWS_TEST_README.md.
  pause
  exit /b 1
)

powershell -NoProfile -Command "if (Test-NetConnection 127.0.0.1 -Port 3000 -InformationLevel Quiet) { exit 0 } else { exit 1 }"
if not errorlevel 1 (
  echo Port 3000 is already in use. Use CHECK_TEST_WINDOWS.bat or STOP_TEST_WINDOWS.bat first.
  pause
  exit /b 1
)

start "PRO Kamen Backend TEST" cmd /k "cd /d \"%~dp0backend\" && set NODE_ENV=development && npm run start:test:windows"
echo Backend test server is starting at http://localhost:3000
echo CRM: http://localhost:3000/crm/crm/login.html
pause
