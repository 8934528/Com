@echo off
chcp 65001 >nul
title Voice Communication Assistant - Vulavula Lelapa
color 0B

echo.
echo |==============================================================|
echo |     Voice Communication Assistant with Vulavula Lelapa       |
echo |==============================================================|
echo.

where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python not found!
    echo Please install Python 3.8 or higher from https://python.org
    echo.
    pause
    exit /b 1
)

python --version
echo.

if not exist "venv" (
    echo [INFO] Creating virtual environment...
    python -m venv venv
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to create virtual environment
        pause
        exit /b 1
    )
)

echo [INFO] Activating virtual environment...
call venv\Scripts\activate.bat
if %errorlevel% neq 0 (
    echo [ERROR] Failed to activate virtual environment
    pause
    exit /b 1
)

echo [INFO] Upgrading pip...
python -m pip install --upgrade pip

echo [INFO] Installing dependencies...
pip install flask flask-socketio flask-cors pyttsx3 soundfile pydub numpy python-dotenv requests

echo [INFO] Installing PyAudio...
pip install pipwin
pipwin install pyaudio

if not exist "requirements.txt" (
    echo [INFO] Creating requirements.txt...
    (
        echo Flask==2.3.3
        echo Flask-SocketIO==5.3.4
        echo Flask-CORS==4.0.0
        echo pyttsx3==2.90
        echo soundfile==0.12.1
        echo pydub==0.25.1
        echo numpy==1.24.3
        echo python-dotenv==1.0.0
        echo requests==2.31.0
    ) > requirements.txt
)

if not exist "communication.json" (
    echo [INFO] Creating communication.json...
    (
        echo {
        echo   "conversation": [],
        echo   "last_updated": "%date% %time%",
        echo   "total_messages": 0,
        echo   "vulavula_enabled": true
        echo }
    ) > communication.json
)

if not exist ".env" (
    echo [INFO] Creating .env file...
    (
        echo # Vulavula Lelapa API Configuration
        echo VULAVULA_API_KEY=your-api-key-here
        echo.
        echo FLASK_ENV=development
        echo FLASK_DEBUG=1
        echo PORT=5000
        echo HOST=0.0.0.0
    ) > .env
    echo [WARNING] Please add your Vulavula API key to .env file
)

echo.
echo |==============================================================|
echo |     Starting on http://localhost:5000                        |
echo |                                                              |
echo |     Press Ctrl+C to stop the application                     |
echo |==============================================================|
echo.

python com.py

echo.
echo [INFO] Cleaning up...
deactivate
echo [INFO] Goodbye!
pause