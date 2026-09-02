@echo off
setlocal
echo =====================================
echo PRO Kamen CRM - Windows Test Check
echo =====================================

sc query MySQL80 | find "RUNNING" >nul && echo MySQL80: RUNNING || echo MySQL80: NOT RUNNING
powershell -NoProfile -Command "if (Test-NetConnection 127.0.0.1 -Port 3306 -InformationLevel Quiet) { 'MySQL port 3306: OPEN' } else { 'MySQL port 3306: CLOSED' }"
powershell -NoProfile -Command "if (Test-NetConnection 127.0.0.1 -Port 3000 -InformationLevel Quiet) { 'Backend/frontend port 3000: OPEN' } else { 'Backend/frontend port 3000: CLOSED' }"

echo.
echo Health endpoint:
powershell -NoProfile -Command "try { (Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3000/api/health).Content } catch { $_.Exception.Message }"
