@echo off
chcp 65001 >nul
title Voice Communication Assistant - Windows Launcher
color 0B

echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║           Voice Communication Assistant                  ║
echo ╚══════════════════════════════════════════════════════════╝
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
pip install flask flask-socketio flask-cors pyttsx3 soundfile pydub numpy

echo [INFO] Installing PyAudio (might need manual installation)...
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
    ) > requirements.txt
)

if not exist "communication.json" (
    echo [INFO] Creating communication.json...
    (
        echo {
        echo   "conversations": [],
        echo   "current": [
        echo     {
        echo       "id": 1,
        echo       "role": "assistant",
        echo       "content": "Windows system initialized with improved audio processing.",
        echo       "timestamp": "%date% %time%",
        echo       "metadata": {
        echo         "type": "system",
        echo         "voice_type": "female"
        echo       }
        echo     }
        echo   ],
        echo   "last_saved": "%date% %time%",
        echo   "total_conversations": 0,
        echo   "total_messages": 1
        echo }
    ) > communication.json
)

echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║     Starting on http://localhost:5000                    ║
echo ║                                                          ║
echo ║     Press Ctrl+C to stop the application                 ║
echo ╚══════════════════════════════════════════════════════════╝
echo.

python com.py

echo.
echo [INFO] Cleaning up...
deactivate
echo [INFO] Goodbye!
pause
