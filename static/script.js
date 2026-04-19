class VoiceAssistant {
  constructor() {
    this.isRecording = false;
    this.isSpeaking = false;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.conversation = [];
    this.socket = null;
    this.waveformInterval = null;
    this.toast = null;

    this.init();
  }

  async init() {
    this.updateTime();
    setInterval(() => this.updateTime(), 60000);

    this.initEventListeners();
    this.initWebSocket();
    this.generateWaveform();
    this.initToast();

    // Load saved conversation from server
    this.loadConversationHistory();
  }

  initToast() {
    const toastElement = document.getElementById("notification");
    this.toast = new bootstrap.Toast(toastElement, {
      delay: 3000,
      autohide: true,
    });
  }

  showNotification(message, type = "info") {
    const toastBody = document.querySelector("#notification .toast-body");
    toastBody.innerHTML = `<i class="fi fi-rr-${type === "success" ? "check-circle" : type === "error" ? "circle-cross" : "info"} me-2"></i>${message}`;
    document.getElementById("notification").className =
      `toast align-items-center text-bg-dark border-0 border-start border-${type === "success" ? "success" : type === "error" ? "danger" : "primary"}`;
    this.toast.show();
  }

  updateTime() {
    const now = new Date();
    document.getElementById("currentTime").textContent = now.toLocaleTimeString(
      [],
      { hour: "2-digit", minute: "2-digit" },
    );
  }

  initEventListeners() {
    document
      .getElementById("startBtn")
      .addEventListener("click", () => this.startRecording());
    document
      .getElementById("stopBtn")
      .addEventListener("click", () => this.stopRecording());
    document
      .getElementById("saveBtn")
      .addEventListener("click", () => this.saveConversation());
    document
      .getElementById("clearBtn")
      .addEventListener("click", () => this.clearConversation());
    document
      .getElementById("toggleHistory")
      .addEventListener("click", () => this.toggleHistory());

    document.getElementById("speedControl").addEventListener("input", (e) => {
      const value = e.target.value;
      const speedText = value < 100 ? "Slow" : value > 200 ? "Fast" : "Normal";
      document.getElementById("speedValue").textContent = speedText;
      this.setSpeechSpeed(value);
    });
  }

  initWebSocket() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    this.socket = new WebSocket(wsUrl);

    this.socket.onopen = () => {
      this.updateStatus("connected");
      this.showNotification("Connected to server", "success");
    };

    this.socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleMessage(data);
    };

    this.socket.onclose = () => {
      this.updateStatus("disconnected");
      this.showNotification(
        "Disconnected from server. Reconnecting...",
        "error",
      );
      setTimeout(() => this.initWebSocket(), 3000);
    };

    this.socket.onerror = (error) => {
      console.error("WebSocket error:", error);
      this.showNotification("Connection error", "error");
    };
  }

  updateStatus(status) {
    const indicator = document.getElementById("statusIndicator");
    indicator.className = `status-badge d-inline-flex align-items-center gap-2 px-3 py-2 rounded-pill status-${status}`;
    const statusText = indicator.querySelector(".status-text");
    statusText.textContent =
      status === "connected" ? "Connected" : "Disconnected";
  }

  async startRecording() {
    try {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        this.showNotification("Not connected to server", "error");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: "audio/wav" });
        this.sendAudioToServer(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      this.mediaRecorder.start(100);
      this.isRecording = true;
      this.updateButtonStates();
      this.startWaveformAnimation();
      this.showNotification("Recording... Speak now", "success");

      // Auto-stop after 30 seconds
      setTimeout(() => {
        if (this.isRecording) {
          this.stopRecording();
        }
      }, 30000);
    } catch (error) {
      console.error("Microphone error:", error);
      this.showNotification(
        "Microphone access denied. Please use text input.",
        "error",
      );
      this.showTextInputDialog();
    }
  }

  showTextInputDialog() {
    const text = prompt(
      "Speech recognition not available. Enter your message:",
    );
    if (text && this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({
          type: "text_message",
          text: text,
          voiceType: document.getElementById("voiceSelect").value,
          lang_code: document.getElementById("languageSelect").value,
          translate_to: document.getElementById("translateSelect").value,
          timestamp: new Date().toISOString(),
        }),
      );
    }
  }

  stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
      this.updateButtonStates();
      this.stopWaveformAnimation();
      this.showNotification("Recording stopped", "success");
    }
  }

  sendAudioToServer(audioBlob) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.showNotification("Not connected to server", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64Audio = reader.result.split(",")[1];
      const message = {
        type: "audio",
        audio: base64Audio,
        voiceType: document.getElementById("voiceSelect").value,
        lang_code: document.getElementById("languageSelect").value,
        translate_to: document.getElementById("translateSelect").value,
        timestamp: new Date().toISOString(),
      };
      this.socket.send(JSON.stringify(message));
    };
    reader.readAsDataURL(audioBlob);
  }

  handleMessage(data) {
    switch (data.type) {
      case "text_response":
        this.addMessage("ai", data.text, data.timestamp);
        if (data.original_text) {
          this.addSystemMessage(`[Translated from: ${data.original_text}]`);
        }
        this.speakText(data.text);
        break;

      case "audio_response":
        this.playAudioResponse(data.audio);
        break;

      case "conversation_update":
        this.updateConversationList(data.conversation);
        break;

      case "translation_result":
        this.showNotification(`Translation: ${data.translated}`, "success");
        break;

      case "error":
        this.showNotification(data.message, "error");
        break;

      case "connected":
        if (data.vulavula_available) {
          this.showNotification("STT is available!", "success");
        }
        break;
    }
  }

  addSystemMessage(text) {
    const conversationList = document.getElementById("conversationList");
    const messageDiv = document.createElement("div");
    messageDiv.className = "message ai-message opacity-50";
    messageDiv.innerHTML = `
            <div class="message-header">
                <span class="sender"><i class="fi fi-rr-info me-1"></i>System</span>
                <span class="timestamp">${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
            <div class="message-content small">${this.escapeHtml(text)}</div>
        `;
    conversationList.appendChild(messageDiv);
    conversationList.scrollTop = conversationList.scrollHeight;

    setTimeout(() => {
      messageDiv.style.opacity = "0.3";
    }, 3000);
  }

  addMessage(sender, text, timestamp) {
    const message = {
      sender,
      text,
      timestamp: timestamp || new Date().toISOString(),
    };

    this.conversation.push(message);
    this.displayMessage(message);

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({
          type: "save_conversation",
          conversation: this.conversation,
        }),
      );
    }
  }

  displayMessage(message) {
    const conversationList = document.getElementById("conversationList");

    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${message.sender === "user" ? "user-message" : "ai-message"}`;

    const timestamp = new Date(message.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    const icon = message.sender === "user" ? "fi fi-rr-user" : "fi fi-rr-robot";

    messageDiv.innerHTML = `
            <div class="message-header">
                <span class="sender ${message.sender === "user" ? "" : "ai-sender"}">
                    <i class="${icon} me-1"></i>${message.sender === "user" ? "You" : "AI Assistant"}
                </span>
                <span class="timestamp">${timestamp}</span>
            </div>
            <div class="message-content">${this.escapeHtml(message.text)}</div>
        `;

    conversationList.appendChild(messageDiv);
    conversationList.scrollTop = conversationList.scrollHeight;
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  speakText(text) {
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = document.getElementById("speedControl").value / 175;

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
    if ("speechSynthesis" in window && this.isSpeaking) {
      speechSynthesis.cancel();
      const lastMessage = this.conversation[this.conversation.length - 1];
      if (lastMessage && lastMessage.sender === "ai") {
        this.speakText(lastMessage.text);
      }
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
    const startBtn = document.getElementById("startBtn");
    const stopBtn = document.getElementById("stopBtn");

    startBtn.disabled = this.isRecording || this.isSpeaking;
    stopBtn.disabled = !this.isRecording && !this.isSpeaking;

    if (this.isRecording) {
      startBtn.innerHTML =
        '<span class="loading-spinner me-2"></span>Recording...';
      document.body.classList.add("recording-active");
    } else {
      startBtn.innerHTML =
        '<i class="fi fi-rr-microphone me-2"></i>Start Listening';
      document.body.classList.remove("recording-active");
    }

    if (this.isSpeaking) {
      stopBtn.innerHTML =
        '<span class="loading-spinner me-2"></span>Speaking...';
    } else {
      stopBtn.innerHTML = '<i class="fi fi-rr-stop me-2"></i>Stop';
    }
  }

  generateWaveform() {
    const waveform = document.getElementById("waveform");
    waveform.innerHTML = "";

    for (let i = 0; i < 40; i++) {
      const bar = document.createElement("div");
      bar.className = "bar";
      waveform.appendChild(bar);
    }
  }

  startWaveformAnimation() {
    this.stopWaveformAnimation();
    const bars = document.querySelectorAll(".bar");

    this.waveformInterval = setInterval(() => {
      bars.forEach((bar) => {
        const randomHeight = Math.random() * 50 + 15;
        bar.style.height = `${randomHeight}%`;
      });
    }, 80);
  }

  stopWaveformAnimation() {
    if (this.waveformInterval) {
      clearInterval(this.waveformInterval);
      this.waveformInterval = null;

      const bars = document.querySelectorAll(".bar");
      bars.forEach((bar) => {
        bar.style.height = "20%";
      });
    }
  }

  saveConversation() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({
          type: "save_to_file",
          conversation: this.conversation,
        }),
      );
      this.showNotification("Conversation saved to file", "success");
    }
  }

  clearConversation() {
    if (confirm("Are you sure you want to clear all conversation?")) {
      this.conversation = [];
      document.getElementById("conversationList").innerHTML = `
                <div class="message ai-message">
                    <div class="message-header">
                        <span class="sender ai-sender"><i class="fi fi-rr-robot me-1"></i>AI Assistant</span>
                        <span class="timestamp">${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <div class="message-content">
                        Conversation cleared. Ready for new interaction.
                    </div>
                </div>
            `;

      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: "clear_conversation" }));
      }

      this.showNotification("Conversation cleared", "success");
    }
  }

  toggleHistory() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: "load_history" }));
      this.showNotification("Loading conversation history...", "info");
    }
  }

  loadConversationHistory() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: "load_history" }));
    }
  }

  updateConversationList(conversation) {
    const conversationList = document.getElementById("conversationList");
    conversationList.innerHTML = "";

    conversation.forEach((msg) => {
      this.displayMessage(msg);
    });

    this.conversation = conversation;
  }
}

// Initialize on DOM load
document.addEventListener("DOMContentLoaded", () => {
  window.voiceAssistant = new VoiceAssistant();
});
