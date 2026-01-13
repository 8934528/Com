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

if exist "requirements.txt" (
    echo [INFO] Installing dependencies from requirements.txt...
    pip install -r requirements.txt
) else (
    echo [INFO] Installing basic dependencies...
    pip install flask flask-socketio flask-cors speechrecognition pyttsx3 pyaudio python-dotenv
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
        echo       "content": "Windows system initialized. Ready for voice communication.",
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

if not exist ".env" (
    echo [INFO] Creating .env file...
    (
        echo # Voice Assistant Configuration
        echo FLASK_ENV=development
        echo FLASK_DEBUG=1
        echo SECRET_KEY=windows_secret_key_change_in_production
        echo AUDIO_SAMPLE_RATE=16000
        echo MAX_CONVERSATION_LENGTH=100
        echo AUTO_SAVE_INTERVAL=60
    ) > .env
)

echo [INFO] Checking audio system...
python -c "import pyaudio" 2>nul
if %errorlevel% neq 0 (
    echo [WARNING] PyAudio may have issues on Windows.
    echo You may need to install it manually:
    echo pip install pipwin
    echo pipwin install pyaudio
    echo.
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