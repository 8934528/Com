# Environment Configuration (.env)

This document explains how to create and configure the .env file for the Voice Communication Assistant project.

---

## Important Security Notice

- Never commit your `.env` file to GitHub or any public repository
- Ensure `.env` is included in `.gitignore`
- Do not remove `.env` from `.gitignore` under any circumstances
- API keys and secrets must remain private

## What is the `.env` file?

The `.env` file stores environment variables used to configure the application without hardcoding sensitive data into the source code.

It includes:

- API keys
- Service URLs
- Application settings
- Feature toggles

---

## How to Create the `.env` File

1. In the root folder of your project, create a new file:

        .env

2. Copy the template below and paste it into your `.env` file
3. Replace placeholder values with your actual API keys and configuration

---

## `.env` Template

        # =========================
        # Vulavula Lelapa API
        # =========================
        VULAVULA_API_KEY=your-api-key-here

        # =========================
        # Application Configuration
        # =========================
        FLASK_ENV=development
        FLASK_DEBUG=1
        SECRET_KEY=your-secret-key
        PORT=5000
        HOST=0.0.0.0

        # =========================
        # Audio Configuration
        # =========================
        AUDIO_SAMPLE_RATE=16000
        AUDIO_CHANNELS=1
        AUDIO_CHUNK_SIZE=1024
        MAX_RECORDING_SECONDS=30

        # =========================
        # Speech Recognition Configuration
        # =========================
        STT_PROVIDER=vulavula
        FALLBACK_STT=google

        # =========================
        # Vulavula Configuration
        # =========================
        VULAVULA_API_URL=https://api.lelapa.ai
        VULAVULA_LANG_CODE=eng
        VULAVULA_ENABLE_DIARISE=false
        VULAVULA_DETECT_MUSIC=false

        # =========================
        # Google Cloud API
        # =========================
        GOOGLE_CLOUD_API_KEY=your-google-api-key
        GOOGLE_CLOUD_PROJECT_ID=your-project-id

        # =========================
        # Gemini API
        # =========================
        GEMINI_API_KEY=your-gemini-api-key
        GEMINI_PROJECT_NUMBER=your-project-number

        # =========================
        # Azure Speech (Optional - for Neural TTS)
        # =========================
        AZURE_SPEECH_KEY=
        AZURE_SPEECH_REGION=

        # =========================
        # OpenAI API (Optional)
        # =========================
        OPENAI_API_KEY=your-openai-api-key

        # =========================
        # Whisper API
        # =========================
        WHISPER_API_KEY=your-whisper-api-key
        WHISPER_API_URL=https://api.whisper-api.com

        # =========================
        # Lemonfox API
        # =========================
        LEMONFOX_API_KEY=your-lemonfox-api-key
        LEMONFOX_API_URL=https://api.lemonfox.ai/v1
        LEMONFOX_API_TRANSSCRIPTIONS_URL=https://api.lemonfox.ai/v1/audio/transcriptions
        LEMONFOX_OUTPUT_URL=https://output.lemonfox.ai/wikipedia_ai.mp3
        LEMONFOX_TTS_URL=https://api.lemonfox.ai/v1/audio/speech
        LEMONFOX_IMAGES_URL=https://api.lemonfox.ai/v1/images/generations

        # =========================
        # Cache Settings
        # =========================
        ENABLE_TTS_CACHE=true
        CACHE_TTL=86400
        MAX_CACHE_SIZE=500

        # =========================
        # Advanced STT Settings
        # =========================
        ENABLE_NOISE_REDUCTION=true
        ENABLE_REAL_TIME_LANG_DETECTION=true
        ENABLE_SPEAKER_DIARIZATION=false

        # =========================
        # Advanced TTS Settings
        # =========================
        ENABLE_SSML=true
        DEFAULT_SPEECH_RATE=1.0
        DEFAULT_PITCH=1.0
        DEFAULT_VOLUME=1.0

        # =========================
        # Conversation Settings
        # =========================
        MAX_CONVERSATION_LENGTH=100
        AUTO_SAVE_INTERVAL=60
        DATA_FILE=communication.json
        SETTINGS_FILE=settings.json
        ENABLE_CONTEXT_AWARENESS=true
        MAX_CONTEXT_MESSAGES=10

---

## Explanation of Key Sections

1. API Keys

These are required to connect to external services:

- `VULAVULA_API_KEY` -> Speech-to-Text & language processing
- `GOOGLE_CLOUD_API_KEY` -> Advanced cloud features
- `GEMINI_API_KEY` -> AI capabilities
- `OPENAI_API_KEY` -> Optional AI processing
- `WHISPER_API_KEY` -> Speech recognition fallback
- `LEMONFOX_API_KEY` -> TTS and media generation

2. Application Settings

Controls how the app runs:

- `FLASK_ENV` -> development/production mode
- `FLASK_DEBUG` -> enables debug logs
- `SECRET_KEY` -> used for session security

---
