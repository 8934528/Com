import os
import json
import base64
import threading
import queue
import numpy as np
from datetime import datetime
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
import wave
import io

from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit
from flask_cors import CORS
import speech_recognition as sr
import pyttsx3
import pyaudio

CONFIG = {
    'host': '0.0.0.0',
    'port': 5000,
    'debug': True,
    'data_file': 'communication.json',
    'audio_format': pyaudio.paInt16,
    'channels': 1,
    'rate': 16000,
    'chunk_size': 1024,
    'silence_threshold': 500,
    'silence_duration': 2.0
}

@dataclass
class Message:
    id: str
    sender: str
    content: str
    timestamp: str
    audio_data: Optional[str] = None
    
    def to_dict(self) -> Dict:
        return asdict(self)

class VoiceAssistant:
    """Main voice assistant class handling speech recognition and synthesis"""
    
    def __init__(self):
        self.app = Flask(__name__)
        CORS(self.app)
        self.socketio = SocketIO(self.app, cors_allowed_origins="*", async_mode='threading')
        
        self.recognizer = sr.Recognizer()
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
        
    def setup_routes(self):
        """Setup Flask routes"""
        @self.app.route('/')
        def index():
            return render_template('index.html')
        
        @self.app.route('/api/conversation', methods=['GET'])
        def get_conversation():
            return jsonify(self.conversation)
        
        @self.app.route('/api/conversation', methods=['POST'])
        def save_conversation():
            data = request.json
            if data and 'conversation' in data:
                self.save_conversation_to_memory(data['conversation'])
                return jsonify({'status': 'success'})
            return jsonify({'status': 'error', 'message': 'Invalid data'}), 400
        
        @self.app.route('/api/speak', methods=['POST'])
        def speak_text():
            data = request.json
            if data and 'text' in data:
                voice_type = data.get('voice_type', 'female')
                self.synthesize_speech(data['text'], voice_type)
                return jsonify({'status': 'success'})
            return jsonify({'status': 'error'}), 400
        
        @self.app.route('/api/health', methods=['GET'])
        def health_check():
            return jsonify({
                'status': 'healthy',
                'timestamp': datetime.now().isoformat(),
                'conversation_count': len(self.conversation)
            })
    
    def setup_socket_events(self):
        """Setup SocketIO events"""
        @self.socketio.on('connect')
        def handle_connect():
            print(f"Client connected: {request.sid}")
            emit('connected', {'message': 'Connected to voice assistant'})
        
        @self.socketio.on('audio')
        def handle_audio(data):
            """Handle incoming audio data"""
            try:
                audio_bytes = base64.b64decode(data['audio'])
                voice_type = data.get('voice_type', 'female')
                
                audio_data = sr.AudioData(audio_bytes, 16000, 2)
                
                try:
                    text = self.recognizer.recognize_google(audio_data)
                    print(f"Recognized: {text}")
                    
                    self.add_message('user', text, audio_data=data.get('audio'))
                    
                    response = self.process_query(text)
                    
                    response_audio = self.synthesize_speech(response, voice_type, return_audio=True)
                    
                    emit('text_response', {
                        'text': response,
                        'timestamp': datetime.now().isoformat()
                    })
                    
                    if response_audio:
                        emit('audio_response', {
                            'audio': response_audio,
                            'timestamp': datetime.now().isoformat()
                        })
                        
                    self.save_conversation_to_file()
                    
                except sr.UnknownValueError:
                    error_msg = "Sorry, I couldn't understand the audio"
                    emit('error', {'message': error_msg})
                except sr.RequestError as e:
                    error_msg = f"Speech recognition error: {e}"
                    emit('error', {'message': error_msg})
                    
            except Exception as e:
                print(f"Error processing audio: {e}")
                emit('error', {'message': 'Error processing audio'})
        
        @self.socketio.on('save_conversation')
        def handle_save_conversation(data):
            """Save conversation from client"""
            if 'conversation' in data:
                with self.conversation_lock:
                    self.conversation = data['conversation']
                self.save_conversation_to_file()
                emit('conversation_saved', {'status': 'success'})
        
        @self.socketio.on('load_history')
        def handle_load_history():
            """Load conversation history"""
            self.load_conversation()
            emit('conversation_update', {'conversation': self.conversation})
        
        @self.socketio.on('clear_conversation')
        def handle_clear_conversation():
            """Clear conversation"""
            with self.conversation_lock:
                self.conversation = []
            self.save_conversation_to_file()
            emit('conversation_cleared', {'status': 'success'})
        
        @self.socketio.on('save_to_file')
        def handle_save_to_file(data):
            """Save conversation to JSON file"""
            if 'conversation' in data:
                self.save_conversation_to_file(data['conversation'])
                emit('file_saved', {'status': 'success'})
    
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
        
        responses = {
            'hello': "Hello! How can I assist you today?",
            'hi': "Hi there! What can I do for you?",
            'how are you': "I'm doing great, thank you for asking! How can I help you?",
            'what is your name': "I'm your Voice Communication Assistant. You can call me Com!",
            'time': f"The current time is {datetime.now().strftime('%I:%M %p')}",
            'date': f"Today's date is {datetime.now().strftime('%B %d, %Y')}",
            'thank you': "You're welcome! Is there anything else I can help with?",
            'bye': "Goodbye! Have a great day!"
        }
        
        for keyword, response in responses.items():
            if keyword in text_lower:
                return response
        
        default_responses = [
            "I understand you said: {}. Could you please elaborate?",
            "That's interesting! Tell me more about {}.",
            "I've noted your question about {}. How else can I assist?",
            "Regarding {}, I'd be happy to help. What specifically would you like to know?"
        ]
        
        import random
        response_template = random.choice(default_responses)
        return response_template.format(text)
    
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
                import tempfile
                import wave as wav_lib
                
                with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp_file:
                    tmp_path = tmp_file.name
                
                self.engine.save_to_file(text, tmp_path)
                self.engine.runAndWait()
                
                with open(tmp_path, 'rb') as f:
                    audio_bytes = f.read()
                
                os.unlink(tmp_path)
                
                return base64.b64encode(audio_bytes).decode('utf-8')
            else:
                self.engine.say(text)
                self.engine.runAndWait()
                return None
                
        except Exception as e:
            print(f"Speech synthesis error: {e}")
            return None
    
    def process_audio_queue(self):
        """Process audio queue in background thread"""
        while True:
            try:
                if not self.audio_queue.empty():
                    audio_data = self.audio_queue.get()
                    pass
            except Exception as e:
                print(f"Audio processing error: {e}")
    
    def save_conversation_to_memory(self, conversation: List[Dict]):
        """Save conversation to memory"""
        with self.conversation_lock:
            self.conversation = conversation
    
    def save_conversation_to_file(self, conversation: Optional[List[Dict]] = None):
        """Save conversation to JSON file"""
        data_to_save = conversation if conversation is not None else self.conversation
        
        try:
            with open(CONFIG['data_file'], 'w') as f:
                json.dump({
                    'conversation': data_to_save,
                    'last_updated': datetime.now().isoformat(),
                    'total_messages': len(data_to_save)
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
    
    def start_listening(self):
        """Start listening for audio input"""
        if self.is_listening:
            return
        
        self.is_listening = True
        stream = self.audio.open(
            format=CONFIG['audio_format'],
            channels=CONFIG['channels'],
            rate=CONFIG['rate'],
            input=True,
            frames_per_buffer=CONFIG['chunk_size']
        )
        
        print("Started listening...")
        
        frames = []
        silent_frames = 0
        max_silent_frames = int(CONFIG['silence_duration'] * CONFIG['rate'] / CONFIG['chunk_size'])
        
        while self.is_listening:
            try:
                data = stream.read(CONFIG['chunk_size'])
                audio_data = np.frombuffer(data, dtype=np.int16)
                
                if np.abs(audio_data).mean() < CONFIG['silence_threshold']:
                    silent_frames += 1
                    if silent_frames > max_silent_frames and len(frames) > 0:
                        audio_bytes = b''.join(frames)
                        self.audio_queue.put(audio_bytes)
                        frames = []
                        silent_frames = 0
                else:
                    silent_frames = 0
                    frames.append(data)
                    
            except Exception as e:
                print(f"Error in audio stream: {e}")
                break
        
        stream.stop_stream()
        stream.close()
        print("Stopped listening")
    
    def run(self):
        """Run the Flask application"""
        print(f"Starting Voice Assistant on {CONFIG['host']}:{CONFIG['port']}")
        print(f"Data file: {CONFIG['data_file']}")
        print("Press Ctrl+C to stop")
        
        self.socketio.run(
            self.app,
            host=CONFIG['host'],
            port=CONFIG['port'],
            debug=CONFIG['debug'],
            allow_unsafe_werkzeug=True
        )

class ConversationManager:
    """Manages conversation history and persistence"""
    
    def __init__(self, data_file: str = 'communication.json'):
        self.data_file = data_file
        self.conversations = []
        self.current_conversation = []
        self.load_data()
    
    def load_data(self):
        """Load conversation data from JSON file"""
        try:
            if os.path.exists(self.data_file):
                with open(self.data_file, 'r') as f:
                    data = json.load(f)
                    self.conversations = data.get('conversations', [])
                    self.current_conversation = data.get('current', [])
        except Exception as e:
            print(f"Error loading data: {e}")
            self.conversations = []
            self.current_conversation = []
    
    def save_data(self):
        """Save conversation data to JSON file"""
        try:
            data = {
                'conversations': self.conversations,
                'current': self.current_conversation,
                'last_saved': datetime.now().isoformat(),
                'total_conversations': len(self.conversations),
                'total_messages': len(self.current_conversation)
            }
            
            with open(self.data_file, 'w') as f:
                json.dump(data, f, indent=2, default=str)
            
            return True
        except Exception as e:
            print(f"Error saving data: {e}")
            return False
    
    def add_message(self, role: str, content: str, metadata: Optional[Dict] = None):
        """Add a message to current conversation"""
        message = {
            'id': len(self.current_conversation) + 1,
            'role': role,
            'content': content,
            'timestamp': datetime.now().isoformat(),
            'metadata': metadata or {}
        }
        
        self.current_conversation.append(message)
        self.save_data()
        return message
    
    def archive_conversation(self, title: Optional[str] = None):
        """Archive current conversation"""
        if not self.current_conversation:
            return False
        
        conversation = {
            'id': len(self.conversations) + 1,
            'title': title or f"Conversation {len(self.conversations) + 1}",
            'messages': self.current_conversation.copy(),
            'created': datetime.now().isoformat(),
            'message_count': len(self.current_conversation)
        }
        
        self.conversations.append(conversation)
        self.current_conversation = []
        self.save_data()
        return True
    
    def get_conversation_summary(self) -> Dict:
        """Get summary of all conversations"""
        return {
            'total_conversations': len(self.conversations),
            'total_messages': sum(len(conv['messages']) for conv in self.conversations),
            'recent_messages': self.current_conversation[-10:] if self.current_conversation else []
        }

class AudioProcessor:
    """Handles audio processing and feature extraction"""
    
    def __init__(self, sample_rate: int = 16000, chunk_size: int = 1024):
        self.sample_rate = sample_rate
        self.chunk_size = chunk_size
        self.audio_buffer = []
        self.silence_threshold = 500
        self.speech_started = False
    
    def process_chunk(self, audio_data: bytes) -> Dict[str, Any]:
        """Process audio chunk and extract features"""
        audio_array = np.frombuffer(audio_data, dtype=np.int16)
        
        features = {
            'amplitude': np.abs(audio_array).mean(),
            'energy': np.sum(audio_array.astype(np.float32) ** 2),
            'zero_crossing_rate': np.sum(np.diff(np.sign(audio_array)) != 0) / len(audio_array),
            'is_silent': np.abs(audio_array).mean() < self.silence_threshold,
            'timestamp': datetime.now().isoformat()
        }
        
        return features
    
    def detect_speech(self, audio_features: List[Dict]) -> bool:
        """Detect if speech is present based on features"""
        if not audio_features:
            return False
        
        recent_features = audio_features[-5:]
        silent_count = sum(1 for f in recent_features if f['is_silent'])
        
        return silent_count / len(recent_features) < 0.6

def main():
    """Main entry point"""
    print("=" * 60)
    print("Voice Communication Assistant")
    print("=" * 60)
    
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
