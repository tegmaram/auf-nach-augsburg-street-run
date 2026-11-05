@echo off
setlocal
cd /d "%~dp0"

echo Auf nach Augsburg wird gestartet...
echo.

REM Browser nach einer Sekunde oeffnen, damit der Server bereit ist.
start /B cmd /c "timeout /t 1 /nobreak >nul && start "" http://localhost:8090/"

echo WLAN-/LAN-Adressen:
ipconfig | findstr /i "IPv4"
echo.
echo Lokal:  http://localhost:8090/
echo Druecke Strg+C, um den Server zu beenden.
echo.

python -m http.server 8090 --bind 0.0.0.0