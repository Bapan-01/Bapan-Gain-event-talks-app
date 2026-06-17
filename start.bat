@echo off
title BigQuery Release Notes Hub Server
echo ===================================================
echo Starting BigQuery Release Notes Hub...
echo ===================================================

:: Navigate to the script's directory
cd /d "%~dp0"

:: Check if virtual environment exists, activate if it does
if exist venv\Scripts\activate.bat (
    echo Activating virtual environment...
    call venv\Scripts\activate.bat
)

:: Wait 2 seconds for Flask to bind, then launch browser
start "" cmd /c "timeout /t 2 >nul && start http://127.0.0.1:5000"

:: Start the Flask web application
echo Running python app.py...
python app.py

pause
