# Voice Communication Assistant with Vulavula Lelapa STT

An AI-powered voice communication system with persistent memory, featuring Vulavula Lelapa Speech-to-Text and Translation capabilities for South African languages.

---

## Features

- **Voice Recognition** -  Convert speech to text using speech recognition STT API
- **Multi-language Support** - English, isiZulu, Sesotho, Afrikaans, isiXhosa, and more
- **Real-time Translation** - Translate between South African languages
- **Persistent Memory** - Conversations saved to JSON
- **Text-to-Speech** - Multiple voice options (male, female, robotic)
- **Modern UI** - Bootstrap 5 with Flaticon icons
- **WebSocket Support** - Real-time bidirectional communication

## Supported Languages

### Speech-to-Text (STT)

- South African English (`eng`)
- isiZulu (`zul`)
- Sesotho (`sot`)
- Afrikaans (`afr`)
- African French (`fra`)
- Code-switched isiZulu (`cs-zul`)

### Translation

- English (`eng_Latn`)
- isiZulu (`zul_Latn`)
- isiXhosa (`xho_Latn`)
- Afrikaans (`afr_Latn`)
- Sesotho (`sot_Latn`)
- Kiswahili (`swh_Latn`)

---

## Installation

### Prerequisites

- Python 3.8+
- pip
- PortAudio (Linux/Mac) or appropriate audio drivers (Windows)

### Quick Start

1. **Clone the repository**

        bash
        git clone <repository-url>

        cd Com

2. Set up environment variables

        bash
        cp .env.example .env
        # Edit .env and add your Vulavula API key

3. Run the application

`**Linux/Mac:**

        bash
        chmod +x run.sh
        ./run.sh

`**Windows:**

        bash
        run.bat

4. Open your browser

Navigate to `http://localhost:5000`

## API Configuration

### Vulavula Lelapa API

Get your API key from **Vulavula Lelapa**

Add to `.env`:

        text
        VULAVULA_API_KEY=your-api-key-here
        VULAVULA_LANG_CODE=eng

---

## Project Structure

        Com/
        ├── com.py              # Main Flask application with Vulavula integration
        ├── index.html          # Frontend UI with Bootstrap
        ├── script.js           # Client-side JavaScript
        ├── style.css           # Custom styling (27% animation, 5% hover)
        ├── requirements.txt    # Python dependencies
        ├── run.sh              # Linux/Mac launcher
        ├── run.bat             # Windows launcher
        ├── .env                # Environment variables
        ├── .gitignore          # Git ignore file
        └── communication.json  # Conversation storage

---

## Usage

- `Start Listening` - Click the "Start Listening" button and speak
- `Select Language` - Choose STT language from dropdown
- `Enable Translation` - Select target language for real-time translation
- `Adjust Speed` - Control speech synthesis speed
- `Save Conversation` - Click "Save" to persist conversation
- `View History` - Click "History" to load previous conversations

## Development

Running in Debug Mode

        bash
        export FLASK_DEBUG=1
        python com.py

## Testing STT

        bash
        curl -X POST http://localhost:5000/api/recognize \
        -F "audio=@test.wav"

## Testing Translation

        bash
        curl -X POST http://localhost:5000/api/translate \
        -H "Content-Type: application/json" \
        -d '{"text":"Hello","source":"eng_Latn","target":"zul_Latn"}'



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
