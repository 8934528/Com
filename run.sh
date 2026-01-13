#!/bin/bash

# Voice Communication Assistant Starting Script
# Author: System Assistant
# Date: $(date)

set -e  # Exit on error

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
APP_NAME="Voice Communication Assistant"
PYTHON_CMD="python3"
VENV_DIR="venv"
REQUIREMENTS_FILE="requirements.txt"
MAIN_SCRIPT="com.py"
PORT=5000

print_header() {
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║                        $APP_NAME                         ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_status() {
    echo -e "${GREEN}[✓] $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}[!] $1${NC}"
}

print_error() {
    echo -e "${RED}[✗] $1${NC}"
}

check_dependencies() {
    print_status "Checking system dependencies..."
    
    if command -v $PYTHON_CMD &> /dev/null; then
        PYTHON_VERSION=$($PYTHON_CMD --version | cut -d' ' -f2)
        print_status "Python $PYTHON_VERSION found"
    else
        print_error "Python3 not found. Please install Python 3.8 or higher."
        exit 1
    fi
    
    if command -v pip3 &> /dev/null; then
        print_status "pip3 found"
    else
        print_warning "pip3 not found, attempting to install..."
        sudo apt-get install -y python3-pip 2>/dev/null || true
    fi
    
    if ! $PYTHON_CMD -m venv --help &> /dev/null; then
        print_warning "venv module not available, installing..."
        $PYTHON_CMD -m pip install virtualenv
    fi
}

setup_environment() {
    print_status "Setting up Python virtual environment..."
    
    if [ ! -d "$VENV_DIR" ]; then
        $PYTHON_CMD -m venv "$VENV_DIR"
        print_status "Virtual environment created"
    else
        print_status "Virtual environment already exists"
    fi
    
    source "$VENV_DIR/bin/activate"
    
    pip install --upgrade pip
    
    if [ -f "$REQUIREMENTS_FILE" ]; then
        print_status "Installing Python dependencies..."
        pip install -r "$REQUIREMENTS_FILE"
    else
        print_warning "requirements.txt not found, installing basic dependencies..."
        pip install flask flask-socketio flask-cors speechrecognition pyttsx3 pyaudio python-dotenv
    fi
}

check_audio_system() {
    print_status "Checking audio system..."
    
    if [ -z "$DISPLAY" ] && [ "$(uname)" != "Darwin" ]; then
        print_warning "No display detected. Audio features may be limited."
    fi
    
    if [ "$(uname)" == "Linux" ]; then
        if ! dpkg -l | grep -q "portaudio19-dev"; then
            print_warning "PortAudio development files not found."
            echo "To install on Ubuntu/Debian: sudo apt-get install portaudio19-dev python3-pyaudio"
        fi
    fi
}

create_missing_files() {
    print_status "Checking project structure..."
    
    if [ ! -f "communication.json" ]; then
        echo '{
  "conversations": [],
  "current": [
    {
      "id": 1,
      "role": "assistant",
      "content": "System initialized. Ready for voice communication.",
      "timestamp": "'$(date -Iseconds)'",
      "metadata": {
        "type": "system",
        "voice_type": "female"
      }
    }
  ],
  "last_saved": "'$(date -Iseconds)'",
  "total_conversations": 0,
  "total_messages": 1
}' > communication.json
        print_status "Created communication.json"
    fi
    
    if [ ! -f ".env" ]; then
        echo "# Voice Assistant Configuration
FLASK_ENV=development
FLASK_DEBUG=1
SECRET_KEY=$(openssl rand -hex 32)
AUDIO_SAMPLE_RATE=16000
MAX_CONVERSATION_LENGTH=100
AUTO_SAVE_INTERVAL=60" > .env
        print_status "Created .env configuration file"
    fi
}

start_application() {
    print_status "Starting $APP_NAME..."
    echo -e "${YELLOW}"
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║   Application Starting on http://localhost:$PORT         ║"
    echo "║                                                          ║"
    echo "║  Press Ctrl+C to stop the application                    ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    $PYTHON_CMD "$MAIN_SCRIPT"
}

cleanup() {
    print_status "Cleaning up..."
    deactivate 2>/dev/null || true
    print_status "Goodbye!"
}

main() {
    print_header
    
    trap cleanup EXIT INT TERM
    
    check_dependencies
    setup_environment
    check_audio_system
    create_missing_files
    
    start_application
}

main "$@"