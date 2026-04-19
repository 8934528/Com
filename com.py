import os
import json
import base64
import threading
import queue
import tempfile
import requests
from datetime import datetime
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
import wave
import io

from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit
from flask_cors import CORS
from dotenv import load_dotenv
import pyttsx3
import pyaudio
import soundfile as sf
from pydub import AudioSegment

# Load environment variables
load_dotenv()

# Configuration
CONFIG = {
    'host': os.getenv('HOST', '0.0.0.0'),
    'port': int(os.getenv('PORT', 5000)),
    'debug': os.getenv('FLASK_DEBUG', '1') == '1',
    'data_file': os.getenv('DATA_FILE', 'communication.json'),
    'audio_format': pyaudio.paInt16,
    'channels': int(os.getenv('AUDIO_CHANNELS', 1)),
    'rate': int(os.getenv('AUDIO_SAMPLE_RATE', 16000)),
    'chunk_size': int(os.getenv('AUDIO_CHUNK_SIZE', 1024)),
    'max_recording_seconds': int(os.getenv('MAX_RECORDING_SECONDS', 30)),
}

VULAVULA_API_KEY = os.getenv('VULAVULA_API_KEY')
VULAVULA_API_URL = os.getenv('VULAVULA_API_URL', 'https://api.lelapa.ai')
VULAVULA_LANG_CODE = os.getenv('VULAVULA_LANG_CODE', 'eng')
VULAVULA_ENABLE_DIARISE = os.getenv('VULAVULA_ENABLE_DIARISE', 'false').lower() == 'true'
VULAVULA_DETECT_MUSIC = os.getenv('VULAVULA_DETECT_MUSIC', 'false').lower() == 'true'


@dataclass
class Message:
    id: str
    sender: str
    content: str
    timestamp: str
    audio_data: Optional[str] = None
    
    def to_dict(self) -> Dict:
        return asdict(self)


class VulavulaSTT:
    """Vulavula Lelapa Speech-to-Text integration"""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.api_url = f"{VULAVULA_API_URL}/v1/transcribe/sync"
        
    def transcribe(self, audio_bytes: bytes, lang_code: str = None) -> Dict:
        """
        Transcribe audio using Vulavula Lelapa API
        
        Args:
            audio_bytes: Audio file bytes (WAV format recommended)
            lang_code: Language code (afr, zul, sot, eng, fra, cs-zul)
            
        Returns:
            Dict containing transcription result
        """
        if not self.api_key:
            return {'error': 'Vulavula API key not configured', 'text': ''}
        
        try:
            # audio must be in correct format
            audio = AudioSegment.from_file(io.BytesIO(audio_bytes))
            audio = audio.set_frame_rate(16000).set_channels(1).set_sample_width(2)
            
            # Export to WAV bytes
            wav_bytes = io.BytesIO()
            audio.export(wav_bytes, format='wav')
            wav_bytes.seek(0)
            
            # headers
            headers = {
                'X-CLIENT-TOKEN': self.api_key,
            }
            
            # files
            files = {
                'file': ('audio.wav', wav_bytes, 'audio/wav')
            }
            
            # parameters
            params = {}
            if lang_code:
                params['lang_code'] = lang_code
            if VULAVULA_ENABLE_DIARISE:
                params['diarise'] = 1
            if VULAVULA_DETECT_MUSIC:
                params['detect_music'] = 1
            
            # Make API request
            response = requests.post(
                self.api_url,
                headers=headers,
                files=files,
                params=params,
                timeout=180  # 3 minute timeout for long audio
            )
            
            if response.status_code == 200:
                result = response.json()
                return {
                    'success': True,
                    'text': result.get('transcription_text', ''),
                    'language': result.get('language_code', lang_code or 'unknown'),
                    'full_response': result
                }
            else:
                return {
                    'success': False,
                    'error': f"API Error {response.status_code}: {response.text}",
                    'text': ''
                }
                
        except requests.exceptions.Timeout:
            return {'success': False, 'error': 'Request timeout', 'text': ''}
        except Exception as e:
            return {'success': False, 'error': str(e), 'text': ''}
    
    def transcribe_file(self, file_path: str, lang_code: str = None) -> Dict:
        with open(file_path, 'rb') as f:
            return self.transcribe(f.read(), lang_code)


class VulavulaTranslator:
    """Vulavula Lelapa Translation integration"""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.api_url = f"{VULAVULA_API_URL}/v1/translate/process"
    
    def translate(self, text: str, source_lang: str, target_lang: str) -> Dict:
        """
        Translate text using Vulavula API
        
        Args:
            text: Text to translate
            source_lang: Source language code (e.g., 'zul_Latn')
            target_lang: Target language code (e.g., 'eng_Latn')
            
        Returns:
            Dict containing translation result
        """
        if not self.api_key:
            return {'error': 'Vulavula API key not configured', 'translated_text': text}
        
        try:
            headers = {
                'Content-Type': 'application/json',
                'X-CLIENT-TOKEN': self.api_key
            }
            
            payload = {
                'input_text': text,
                'source_lang': source_lang,
                'target_lang': target_lang
            }
            
            response = requests.post(
                self.api_url,
                headers=headers,
                json=payload,
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                translations = result.get('translation', [])
                if translations:
                    return {
                        'success': True,
                        'translated_text': translations[0].get('translated_text', text),
                        'full_response': result
                    }
                return {'success': False, 'translated_text': text, 'error': 'No translation result'}
            else:
                return {
                    'success': False,
                    'translated_text': text,
                    'error': f"API Error {response.status_code}"
                }
                
        except Exception as e:
            return {'success': False, 'translated_text': text, 'error': str(e)}


class VoiceAssistant:
    """Main voice assistant class handling speech recognition and synthesis"""
    
    def __init__(self):
        self.app = Flask(__name__)
        CORS(self.app)
        self.socketio = SocketIO(self.app, cors_allowed_origins="*", async_mode='threading')
        
        self.stt_client = VulavulaSTT(VULAVULA_API_KEY) if VULAVULA_API_KEY else None
        self.translator = VulavulaTranslator(VULAVULA_API_KEY) if VULAVULA_API_KEY else None
        
        self.fallback_recognizer = None
        try:
            import speech_recognition as sr
            self.fallback_recognizer = sr.Recognizer()
            print("Fallback speech recognition initialized")
        except Exception as e:
            print(f"Fallback speech recognition not available: {e}")
        
        self.engine = pyttsx3.init()
        self.audio = pyaudio.PyAudio()
        self.is_listening = False
        self.audio_queue = queue.Queue()
        self.conversation: List[Dict] = []
        self.conversation_lock = threading.Lock()
        
        self.voices = {
            'male': 0,
            'female': 1,
            'robotic': 2
        }
        
        self.setup_routes()
        self.setup_socket_events()
        self.load_conversation()
        
        self.audio_thread = threading.Thread(target=self.process_audio_queue, daemon=True)
        self.audio_thread.start()
        
        # Language mapping for translation
        self.lang_map = {
            'english': 'eng_Latn',
            'zulu': 'zul_Latn',
            'xhosa': 'xho_Latn',
            'afrikaans': 'afr_Latn',
            'sesotho': 'sot_Latn',
            'tswana': 'tsn_Latn',
            'tsonga': 'tso_Latn',
            'swati': 'ssw_Latn',
            'swahili': 'swh_Latn',
            'northern_sotho': 'nso_Latn'
        }
        
    def setup_routes(self):
        @self.app.route('/')
        def index():
            return render_template('index.html')
        
        @self.app.route('/api/conversation', methods=['GET'])
        def get_conversation():
            return jsonify(self.conversation)
        
        @self.app.route('/api/health', methods=['GET'])
        def health_check():
            return jsonify({
                'status': 'healthy',
                'timestamp': datetime.now().isoformat(),
                'conversation_count': len(self.conversation),
                'vulavula_available': self.stt_client is not None,
                'vulavula_api_key_configured': bool(VULAVULA_API_KEY)
            })
        
        @self.app.route('/api/languages', methods=['GET'])
        def get_languages():
            return jsonify(list(self.lang_map.keys()))
    
    def setup_socket_events(self):
        @self.socketio.on('connect')
        def handle_connect():
            print(f"Client connected: {request.sid}")
            emit('connected', {
                'message': 'Connected to voice assistant',
                'vulavula_available': self.stt_client is not None,
                'api_configured': bool(VULAVULA_API_KEY)
            })
        
        @self.socketio.on('audio')
        def handle_audio(data):
            """Handle incoming audio data with Vulavula STT"""
            try:
                audio_bytes = base64.b64decode(data['audio'])
                voice_type = data.get('voice_type', 'female')
                lang_code = data.get('lang_code', VULAVULA_LANG_CODE)
                translate_to = data.get('translate_to', None)
                
                recognized_text = ""
                confidence = 0
                
                # Try Vulavula STT first
                if self.stt_client:
                    result = self.stt_client.transcribe(audio_bytes, lang_code)
                    if result.get('success'):
                        recognized_text = result.get('text', '')
                        confidence = 0.9
                        print(f"Vulavula recognized: {recognized_text}")
                    else:
                        print(f"Vulavula error: {result.get('error')}")
                        
                        # Fallback to Google STT
                        if self.fallback_recognizer:
                            recognized_text = self._fallback_recognize(audio_bytes)
                else:
                    recognized_text = self._fallback_recognize(audio_bytes)
                
                if not recognized_text:
                    recognized_text = "I couldn't understand what you said. Could you please repeat?"
                
                # Translate if requested
                original_text = recognized_text
                if translate_to and translate_to in self.lang_map and self.translator:
                    source_lang = 'eng_Latn'  # Assume English as source
                    target_lang = self.lang_map[translate_to]
                    translation = self.translator.translate(recognized_text, source_lang, target_lang)
                    if translation.get('success'):
                        recognized_text = translation.get('translated_text', recognized_text)
                        print(f"Translated to {translate_to}: {recognized_text}")
                
                self.add_message('user', recognized_text, audio_data=data.get('audio'))
                
                response = self.process_query(recognized_text)
                
                response_audio = self.synthesize_speech(response, voice_type, return_audio=True)
                
                emit('text_response', {
                    'text': response,
                    'original_text': original_text if translate_to else None,
                    'timestamp': datetime.now().isoformat()
                })
                
                if response_audio:
                    emit('audio_response', {
                        'audio': response_audio,
                        'timestamp': datetime.now().isoformat()
                    })
                    
                self.save_conversation_to_file()
                    
            except Exception as e:
                print(f"Error processing audio: {e}")
                emit('error', {'message': f'Error processing audio: {e}'})
        
        @self.socketio.on('text_message')
        def handle_text_message(data):
            """Handle text message"""
            text = data.get('text', '')
            voice_type = data.get('voice_type', 'female')
            translate_to = data.get('translate_to', None)
            
            if text:
                original_text = text
                
                # Translate if requested
                if translate_to and translate_to in self.lang_map and self.translator:
                    source_lang = 'eng_Latn'
                    target_lang = self.lang_map[translate_to]
                    translation = self.translator.translate(text, source_lang, target_lang)
                    if translation.get('success'):
                        text = translation.get('translated_text', text)
                
                self.add_message('user', text)
                response = self.process_query(text)
                
                response_audio = self.synthesize_speech(response, voice_type, return_audio=True)
                
                emit('text_response', {
                    'text': response,
                    'original_text': original_text if translate_to else None,
                    'timestamp': datetime.now().isoformat()
                })
                
                if response_audio:
                    emit('audio_response', {
                        'audio': response_audio,
                        'timestamp': datetime.now().isoformat()
                    })
                    
                self.save_conversation_to_file()
        
        @self.socketio.on('save_conversation')
        def handle_save_conversation(data):
            if 'conversation' in data:
                with self.conversation_lock:
                    self.conversation = data['conversation']
                self.save_conversation_to_file()
                emit('conversation_saved', {'status': 'success'})
        
        @self.socketio.on('load_history')
        def handle_load_history():
            self.load_conversation()
            emit('conversation_update', {'conversation': self.conversation})
        
        @self.socketio.on('clear_conversation')
        def handle_clear_conversation():
            with self.conversation_lock:
                self.conversation = []
            self.save_conversation_to_file()
            emit('conversation_cleared', {'status': 'success'})
        
        @self.socketio.on('save_to_file')
        def handle_save_to_file(data):
            if 'conversation' in data:
                self.save_conversation_to_file(data['conversation'])
                emit('file_saved', {'status': 'success'})
        
        @self.socketio.on('translate_text')
        def handle_translate_text(data):
            text = data.get('text', '')
            source_lang = data.get('source_lang', 'eng_Latn')
            target_lang = data.get('target_lang', 'zul_Latn')
            
            if self.translator and text:
                result = self.translator.translate(text, source_lang, target_lang)
                emit('translation_result', {
                    'original': text,
                    'translated': result.get('translated_text', text),
                    'success': result.get('success', False)
                })
    
    def _fallback_recognize(self, audio_bytes: bytes) -> str:
        if not self.fallback_recognizer:
            return ""
        
        try:
            temp_wav = tempfile.mktemp(suffix='.wav')
            with open(temp_wav, 'wb') as f:
                f.write(audio_bytes)
            
            import speech_recognition as sr
            with sr.AudioFile(temp_wav) as source:
                audio_data = self.fallback_recognizer.record(source)
                text = self.fallback_recognizer.recognize_google(audio_data)
            
            os.unlink(temp_wav)
            return text
            
        except Exception as e:
            print(f"Fallback recognition error: {e}")
            return ""
    
    def add_message(self, sender: str, content: str, **kwargs):
        """Add a message to the conversation"""
        message = {
            'id': str(len(self.conversation) + 1),
            'sender': sender,
            'content': content,
            'timestamp': datetime.now().isoformat(),
            **kwargs
        }
        
        with self.conversation_lock:
            self.conversation.append(message)
        
        self.socketio.emit('new_message', message)
    
    def process_query(self, text: str) -> str:
        """Process user query and generate response"""
        text_lower = text.lower()
        
        # Intent-based responses
        if any(word in text_lower for word in ['hello', 'hi', 'hey']):
            return "Hello! How can I assist you today?"
        
        elif any(word in text_lower for word in ['how are you', 'how are you doing']):
            return "I'm doing great, thank you for asking! How can I help you?"
        
        elif any(word in text_lower for word in ['what is your name', 'who are you']):
            return "I'm your Voice Communication Assistant powered by Vulavula Lelapa. You can call me Com!"
        
        elif any(word in text_lower for word in ['time', 'current time']):
            return f"The current time is {datetime.now().strftime('%I:%M %p')}"
        
        elif any(word in text_lower for word in ['date', 'today']):
            return f"Today's date is {datetime.now().strftime('%B %d, %Y')}"
        
        elif any(word in text_lower for word in ['thank', 'thanks']):
            return "You're welcome! Is there anything else I can help with?"
        
        elif any(word in text_lower for word in ['bye', 'goodbye', 'exit']):
            return "Goodbye! Have a great day!"
        
        elif any(word in text_lower for word in ['help', 'what can you do']):
            return "I can help you with voice communication. You can talk to me and I'll respond. Try saying 'hello' or ask me about the time. I also support translation between English, Zulu, Xhosa, Afrikaans, and other South African languages!"
        
        elif any(word in text_lower for word in ['translate', 'how do you say']):
            return "I can translate text for you! Just tell me what you want to translate and to which language."
        
        # Default response
        default_responses = [
            f"I understand you said: '{text}'. Could you please elaborate?",
            f"That's interesting! Tell me more about '{text}'.",
            f"I've noted your question about '{text}'. How else can I assist?",
            f"Regarding '{text}', I'd be happy to help. What specifically would you like to know?"
        ]
        
        import random
        return random.choice(default_responses)
    
    def synthesize_speech(self, text: str, voice_type: str = 'female', return_audio: bool = False) -> Optional[str]:
        """Convert text to speech"""
        try:
            voices = self.engine.getProperty('voices')
            if voice_type in self.voices:
                voice_index = self.voices[voice_type]
                if voice_index < len(voices):
                    self.engine.setProperty('voice', voices[voice_index].id)
            
            self.engine.setProperty('rate', 175)
            
            if return_audio:
                temp_wav = tempfile.mktemp(suffix='.wav')
                
                self.engine.save_to_file(text, temp_wav)
                self.engine.runAndWait()
                
                with open(temp_wav, 'rb') as f:
                    audio_bytes = f.read()
                
                audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')
                os.unlink(temp_wav)
                return audio_base64
            else:
                self.engine.say(text)
                self.engine.runAndWait()
                return None
                
        except Exception as e:
            print(f"Speech synthesis error: {e}")
            return None
    
    def process_audio_queue(self):
        while True:
            try:
                if not self.audio_queue.empty():
                    audio_data = self.audio_queue.get()
            except Exception as e:
                print(f"Audio processing error: {e}")
    
    def save_conversation_to_file(self, conversation: Optional[List[Dict]] = None):
        data_to_save = conversation if conversation is not None else self.conversation
        
        try:
            with open(CONFIG['data_file'], 'w') as f:
                json.dump({
                    'conversation': data_to_save,
                    'last_updated': datetime.now().isoformat(),
                    'total_messages': len(data_to_save),
                    'vulavula_enabled': self.stt_client is not None
                }, f, indent=2)
            print(f"Conversation saved to {CONFIG['data_file']}")
        except Exception as e:
            print(f"Error saving conversation: {e}")
    
    def load_conversation(self):
        """Load conversation from JSON file"""
        try:
            if os.path.exists(CONFIG['data_file']):
                with open(CONFIG['data_file'], 'r') as f:
                    data = json.load(f)
                    self.conversation = data.get('conversation', [])
                print(f"Loaded {len(self.conversation)} messages from {CONFIG['data_file']}")
        except Exception as e:
            print(f"Error loading conversation: {e}")
            self.conversation = []
    
    def run(self):
        print("=" * 60)
        print("Voice Communication Assistant with Vulavula Lelapa STT")
        print("=" * 60)
        print(f"Server: http://{CONFIG['host']}:{CONFIG['port']}")
        print(f"Data file: {CONFIG['data_file']}")
        print(f"Vulavula API: {'Configured' if VULAVULA_API_KEY else 'Not configured'}")
        print(f"STT Provider: {'Vulavula' if self.stt_client else 'Fallback (Google)'}")
        print("Press Ctrl+C to stop")
        print("=" * 60)
        
        self.socketio.run(
            self.app,
            host=CONFIG['host'],
            port=CONFIG['port'],
            debug=CONFIG['debug'],
            allow_unsafe_werkzeug=True
        )


def main():
    os.makedirs('static/audio', exist_ok=True)
    
    assistant = VoiceAssistant()
    
    try:
        assistant.run()
    except KeyboardInterrupt:
        print("\nShutting down...")
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if hasattr(assistant, 'audio'):
            assistant.audio.terminate()
        print("Goodbye!")


if __name__ == "__main__":
    main()
