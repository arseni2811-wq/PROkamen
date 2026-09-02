@echo off
setlocal
set "PID_FILE=%~dp0backend\.test-server.pid"

if not exist "%PID_FILE%" (
  echo No PRO Kamen test-server PID file was found. Nothing was stopped.
  exit /b 0
)

set /p TEST_PID=<"%PID_FILE%"
echo Stopping only PRO Kamen test server process tree: %TEST_PID%
taskkill /PID %TEST_PID% /T >nul 2>&1
if errorlevel 1 (
  echo The recorded process is not running. Removing stale PID file.
) else (
  echo PRO Kamen test server stopped.
)
del "%PID_FILE%" >nul 2>&1
