class VoiceAssistant {
    constructor() {
        this.isRecording = false;
        this.isSpeaking = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.conversation = [];
        this.socket = null;
        this.waveformInterval = null;
        
        this.init();
    }

    async init() {
        this.updateTime();
        setInterval(() => this.updateTime(), 60000);
        
        this.initEventListeners();
        this.initWebSocket();
        this.generateWaveform();
    }

    updateTime() {
        const now = new Date();
        document.getElementById('currentTime').textContent = 
            now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    initEventListeners() {
        document.getElementById('startBtn').addEventListener('click', () => this.startRecording());
        document.getElementById('stopBtn').addEventListener('click', () => this.stopRecording());
        document.getElementById('saveBtn').addEventListener('click', () => this.saveConversation());
        document.getElementById('clearBtn').addEventListener('click', () => this.clearConversation());
        document.getElementById('toggleHistory').addEventListener('click', () => this.toggleHistory());
        
        document.getElementById('speedControl').addEventListener('input', (e) => {
            const value = e.target.value;
            document.getElementById('speedValue').textContent = 
                value < 100 ? 'Slow' : value > 200 ? 'Fast' : 'Normal';
            this.setSpeechSpeed(value);
        });
    }

    initWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        this.socket = new WebSocket(wsUrl);
        
        this.socket.onopen = () => {
            this.updateStatus('connected');
            this.showNotification('Connected to server', 'success');
        };
        
        this.socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
        };
        
        this.socket.onclose = () => {
            this.updateStatus('disconnected');
            setTimeout(() => this.initWebSocket(), 3000);
        };
        
        this.socket.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.showNotification('Connection error', 'error');
        };
    }

    updateStatus(status) {
        const indicator = document.getElementById('statusIndicator');
        indicator.className = `status-indicator status-${status}`;
        indicator.querySelector('.status-text').textContent = 
            status === 'connected' ? 'Connected to server' : 'Disconnected from server';
    }

    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };
            
            this.mediaRecorder.onstop = () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
                this.sendAudioToServer(audioBlob);
                stream.getTracks().forEach(track => track.stop());
            };
            
            this.mediaRecorder.start();
            this.isRecording = true;
            this.updateButtonStates();
            this.startWaveformAnimation();
            this.showNotification('Recording started... Speak now', 'success');
            
            setTimeout(() => {
                if (this.isRecording) {
                    this.stopRecording();
                }
            }, 10000);
            
        } catch (error) {
            console.error('Error accessing microphone:', error);
            this.showNotification('Microphone access denied', 'error');
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            this.updateButtonStates();
            this.stopWaveformAnimation();
            this.showNotification('Recording stopped', 'success');
        }
    }

    sendAudioToServer(audioBlob) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            this.showNotification('Not connected to server', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            const base64Audio = reader.result.split(',')[1];
            const message = {
                type: 'audio',
                audio: base64Audio,
                voiceType: document.getElementById('voiceSelect').value,
                timestamp: new Date().toISOString()
            };
            this.socket.send(JSON.stringify(message));
        };
        reader.readAsDataURL(audioBlob);
    }

    handleMessage(data) {
        switch (data.type) {
            case 'text_response':
                this.addMessage('ai', data.text, data.timestamp);
                this.speakText(data.text);
                break;
                
            case 'audio_response':
                this.playAudioResponse(data.audio);
                break;
                
            case 'conversation_update':
                this.updateConversationList(data.conversation);
                break;
                
            case 'error':
                this.showNotification(data.message, 'error');
                break;
        }
    }

    addMessage(sender, text, timestamp) {
        const message = {
            sender,
            text,
            timestamp: timestamp || new Date().toISOString()
        };
        
        this.conversation.push(message);
        this.displayMessage(message);
        
        // Send conversation update to server
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: 'save_conversation',
                conversation: this.conversation
            }));
        }
    }

    displayMessage(message) {
        const conversationList = document.getElementById('conversationList');
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${message.sender === 'user' ? 'user-message' : 'ai-message'}`;
        
        const timestamp = new Date(message.timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        messageDiv.innerHTML = `
            <div class="message-header">
                <span class="sender ${message.sender === 'user' ? '' : 'ai-sender'}">
                    ${message.sender === 'user' ? 'You' : 'AI Assistant'}
                </span>
                <span class="timestamp">${timestamp}</span>
            </div>
            <div class="message-content">${this.escapeHtml(message.text)}</div>
        `;
        
        conversationList.appendChild(messageDiv);
        conversationList.scrollTop = conversationList.scrollHeight;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    speakText(text) {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = document.getElementById('speedControl').value / 175;
            
            utterance.onstart = () => {
                this.isSpeaking = true;
                this.updateButtonStates();
            };
            
            utterance.onend = () => {
                this.isSpeaking = false;
                this.updateButtonStates();
            };
            
            speechSynthesis.speak(utterance);
        }
    }

    setSpeechSpeed(speed) {
        if ('speechSynthesis' in window && this.isSpeaking) {
            speechSynthesis.cancel();
            this.speakText(this.conversation[this.conversation.length - 1]?.text || '');
        }
    }

    playAudioResponse(base64Audio) {
        const audio = new Audio(`data:audio/wav;base64,${base64Audio}`);
        audio.play();
        
        audio.onplay = () => {
            this.isSpeaking = true;
            this.updateButtonStates();
        };
        
        audio.onended = () => {
            this.isSpeaking = false;
            this.updateButtonStates();
        };
    }

    updateButtonStates() {
        const startBtn = document.getElementById('startBtn');
        const stopBtn = document.getElementById('stopBtn');
        
        startBtn.disabled = this.isRecording || this.isSpeaking;
        stopBtn.disabled = !this.isRecording && !this.isSpeaking;
        
        startBtn.innerHTML = this.isRecording ? 
            '<i class="fas fa-circle"></i> Recording...' : 
            '<i class="fas fa-microphone"></i> Start Listening';
    }

    generateWaveform() {
        const waveform = document.getElementById('waveform');
        waveform.innerHTML = '';
        
        for (let i = 0; i < 50; i++) {
            const bar = document.createElement('div');
            bar.className = 'bar';
            bar.style.setProperty('--i', i);
            waveform.appendChild(bar);
        }
    }

    startWaveformAnimation() {
        this.stopWaveformAnimation();
        const bars = document.querySelectorAll('.bar');
        
        this.waveformInterval = setInterval(() => {
            bars.forEach(bar => {
                const randomHeight = Math.random() * 60 + 20;
                bar.style.height = `${randomHeight}%`;
            });
        }, 100);
    }

    stopWaveformAnimation() {
        if (this.waveformInterval) {
            clearInterval(this.waveformInterval);
            this.waveformInterval = null;
            
            const bars = document.querySelectorAll('.bar');
            bars.forEach(bar => {
                bar.style.height = '20%';
            });
        }
    }

    saveConversation() {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: 'save_to_file',
                conversation: this.conversation
            }));
            this.showNotification('Conversation saved to file', 'success');
        }
    }

    clearConversation() {
        if (confirm('Are you sure you want to clear all conversation?')) {
            this.conversation = [];
            document.getElementById('conversationList').innerHTML = `
                <div class="message ai-message">
                    <div class="message-header">
                        <span class="sender ai-sender">AI Assistant</span>
                        <span class="timestamp" id="currentTime">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div class="message-content">
                        Conversation cleared. Ready for new interaction.
                    </div>
                </div>
            `;
            
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                this.socket.send(JSON.stringify({
                    type: 'clear_conversation'
                }));
            }
            
            this.showNotification('Conversation cleared', 'success');
        }
    }

    toggleHistory() {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: 'load_history'
            }));
        }
    }

    updateConversationList(conversation) {
        const conversationList = document.getElementById('conversationList');
        conversationList.innerHTML = '';
        
        conversation.forEach(msg => {
            this.displayMessage(msg);
        });
        
        this.conversation = conversation;
    }

    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.className = `notification ${type} show`;
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.voiceAssistant = new VoiceAssistant();
});
