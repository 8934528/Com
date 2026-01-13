# Voice Communication Assistant

A sophisticated voice-based communication system with persistent memory, real-time audio processing, and web interface.

## Features

- **Voice Recognition**: Convert speech to text using Google's speech recognition
- **Voice Synthesis**: Convert text to speech with multiple voice options
- **Real-time Communication**: WebSocket-based bidirectional communication
- **Conversation Memory**: Save conversations to JSON file
- **Web Interface**: Modern, responsive web interface
- **Multiple Language Support**: Built-in support for various processing languages

## Project Structure

      Com/
        |
        ├── assistant.c
        ├── assistant.cpp
        ├── com.py
        ├── communication.json
        ├── index.html
        ├── README.md
        ├── requirements.txt
        ├── run.bat
        ├── run.sh
        ├── script.js
        └── style.css

## Installation

### Prerequisites

- Python 3.8+
- Node.js (for optional development)
- Microphone and speakers

### Python Setup

    bash
    mkdir Com
    cd Com

    pip install -r requirements.txt

    pip install flask flask-socketio flask-cors speechrecognition pyttsx3 pyaudio

## Starting the Application

**Using Python script:**

    bash
    python com.py

**Using bash script (Linux/Mac):**

    bash
    chmod +x run.sh
    ./run.sh

**Using batch file (Windows):**

    bash
    run.bat

## Accessing the Web Interface

1. Start the application
2. Open your browser and navigate to: ***http://localhost:5000***
3. Allow microphone access when prompted
4. Click "Start Listening" to begin voice communication

## Configuration

### Voice Settings

- Voice Type: Choose between male, female, or robotic voice
- Speech Speed: Adjust speech rate from slow to fast
- Auto-save: Conversations are automatically saved to communication.json

### Data Management

- Conversations are saved in ***communication.json***
- Each conversation includes:
    -- Timestamp
    -- Speaker (user/assistant)
    -- Message content
    -- Audio data (base64 encoded)
    -- Metadata

## API Endpoints

| Endpoint              | Method | Description               |
|-----------------------|--------|---------------------------|
| /                     | GET    | Web interface             |
| /api/conversation     | GET    | Get conversation history  |
| /api/conversation     | POST   | Save conversation         |
| /api/speak            | POST   | Text-to-speech            |
| /api/health           | GET    | Health check              |


## WebSocket Events

| Event              | Direction             | Description                   |
|--------------------|-----------------------|-------------------------------|
| audio              | Client → Server       | Send audio data               |
| text_response      | Server → Client       | Send text response            |
| audio_response     | Server → Client       | Send audio response           |
| save_conversation  | Both                  | Save conversation             |
| load_history       | Client → Server       | Load conversation history     |


