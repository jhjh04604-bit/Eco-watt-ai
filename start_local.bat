@echo off
title EcoWatt - Local Server
cd /d "%~dp0"

echo ====================================================================
echo   ⚡ EcoWatt: Smart IoT Energy Monitor & AI Bill Optimizer
echo ====================================================================
echo.
echo Starting local web server on port 8080...
echo Opening browser: http://localhost:8080/web_dashboard/login.html
echo.
echo [Tip] Press Ctrl + C in this terminal window anytime to stop the server.
echo ====================================================================

:: Launch default browser in the background
start "" "http://localhost:8080/web_dashboard/login.html"

:: Run local python web server
python -m http.server 8080
if %ERRORLEVEL% NEQ 0 (
    echo Python not found, trying node http-server or direct browser...
    start "" "web_dashboard\login.html"
)
pause
