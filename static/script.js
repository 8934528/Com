class VoiceAssistant {
  constructor() {
    this.isRecording = false;
    this.isSpeaking = false;
    this.isPoweredOn = true;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.conversation = [];
    this.socket = null;
    this.waveformInterval = null;
    this.toast = null;
    this.audioContext = null;
    this.mediaStream = null;
    this.infoModal = null;

    this.init();
  }

  async init() {
    this.updateTime();
    setInterval(() => this.updateTime(), 60000);

    this.initEventListeners();
    this.initWebSocket();
    this.generateWaveform();
    this.initToast();
    this.initAudioLevelMonitor();
    this.initModal();

    this.loadConversationHistory();
  }

  initToast() {
    const toastElement = document.getElementById("notification");
    this.toast = new bootstrap.Toast(toastElement, {
      delay: 3000,
      autohide: true,
    });
  }

  initModal() {
    const modalElement = document.getElementById("infoModal");
    if (modalElement) {
      this.infoModal = new bootstrap.Modal(modalElement);
    }
  }

  showNotification(message, type = "info") {
    const toastBody = document.querySelector("#notification .toast-body");
    toastBody.innerHTML = `<i class="fi fi-rr-${type === "success" ? "check-circle" : type === "error" ? "circle-cross" : "info"} me-2"></i>${message}`;
    document.getElementById("notification").className =
      `toast align-items-center border-0 border-start border-${type === "success" ? "success" : type === "error" ? "danger" : "primary"}`;
    this.toast.show();
  }

  showSweetAlert(title, message, type = "info") {
    Swal.fire({
      title: title,
      text: message,
      icon: type,
      confirmButtonColor: "#7AB9A9",
      background: "#D8D6D7",
      color: "#2C0107",
      confirmButtonText: "OK",
    });
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
    document
      .getElementById("micControlBtn")
      .addEventListener("click", () => this.openMicrophoneSTT());
    document
      .getElementById("ttsBtn")
      .addEventListener("click", () => this.textToSpeech());
    document
      .getElementById("infoModalBtn")
      .addEventListener("click", () => this.showInfoModal());
    document
      .getElementById("powerSwitch")
      .addEventListener("change", (e) => this.togglePower(e.target.checked));
    document.getElementById("speedControl").addEventListener("input", (e) => {
      const value = e.target.value;
      const speedText = value < 100 ? "Slow" : value > 200 ? "Fast" : "Normal";
      document.getElementById("speedValue").textContent = speedText;
      this.setSpeechSpeed(value);
    });
    document.getElementById("ttsInput").addEventListener("keypress", (e) => {
      if (e.key === "Enter") this.textToSpeech();
    });
  }

  showInfoModal() {
    if (this.infoModal) {
      this.infoModal.show();
    }
  }

  initAudioLevelMonitor() {
    this.audioLevelInterval = null;
  }

  async startAudioLevelMonitoring(stream) {
    if (this.audioContext) {
      await this.audioContext.close();
    }

    this.audioContext = new (
      window.AudioContext || window.webkitAudioContext
    )();
    const source = this.audioContext.createMediaStreamSource(stream);
    const analyser = this.audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    this.audioLevelInterval = setInterval(() => {
      analyser.getByteFrequencyData(dataArray);
      let average = 0;
      for (let i = 0; i < dataArray.length; i++) {
        average += dataArray[i];
      }
      average = average / dataArray.length;
      const percent = Math.min(100, (average / 255) * 100);
      document.getElementById("audioLevelBar").style.width = percent + "%";
    }, 50);
  }

  stopAudioLevelMonitoring() {
    if (this.audioLevelInterval) {
      clearInterval(this.audioLevelInterval);
      this.audioLevelInterval = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    document.getElementById("audioLevelBar").style.width = "0%";
  }

  togglePower(isOn) {
    this.isPoweredOn = isOn;
    const powerStatus = document.getElementById("powerStatus");

    if (isOn) {
      powerStatus.textContent = "Connected";
      powerStatus.style.color = "#7AB9A9";
      this.initWebSocket();
      this.showSweetAlert(
        "System Online",
        "Voice assistant is now connected and ready!",
        "success",
      );
    } else {
      powerStatus.textContent = "Offline";
      powerStatus.style.color = "#ff4444";
      if (this.socket) {
        this.socket.close();
        this.socket = null;
      }
      this.updateStatus("disconnected");
      this.showSweetAlert(
        "System Offline",
        "Voice assistant has been disconnected.",
        "warning",
      );
    }
  }

  initWebSocket() {
    if (!this.isPoweredOn) return;

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
      if (this.isPoweredOn) {
        this.updateStatus("disconnected");
        this.showNotification(
          "Disconnected from server. Reconnecting...",
          "error",
        );
        setTimeout(() => this.initWebSocket(), 3000);
      }
    };

    this.socket.onerror = (error) => {
      console.error("WebSocket error:", error);
      this.showNotification("Connection error", "error");
    };
  }

  updateStatus(status) {
    const indicator = document.getElementById("statusIndicator");
    indicator.className = `status-badge status-${status}`;
    const statusText = indicator.querySelector(".status-text");
    statusText.textContent =
      status === "connected" ? "Connected" : "Disconnected";
  }

  async openMicrophoneSTT() {
    if (!this.isPoweredOn) {
      this.showSweetAlert(
        "System Offline",
        "Please turn on the system power first.",
        "warning",
      );
      return;
    }

    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.showNotification("Not connected to server", "error");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const audioChunks = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
        this.sendAudioToServer(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
        this.showNotification("Processing speech...", "info");
      };

      mediaRecorder.start();

      Swal.fire({
        title: "Listening...",
        text: "Speak now. Click OK when done.",
        icon: "info",
        confirmButtonColor: "#7AB9A9",
        background: "#D8D6D7",
        color: "#2C0107",
        confirmButtonText: "Stop & Process",
        showCancelButton: true,
        cancelButtonText: "Cancel",
      }).then((result) => {
        if (mediaRecorder.state === "recording") {
          mediaRecorder.stop();
        }
        if (
          result.dismiss === Swal.DismissReason.cancel &&
          mediaRecorder.state === "recording"
        ) {
          mediaRecorder.stop();
        }
      });

      setTimeout(() => {
        if (mediaRecorder.state === "recording") {
          mediaRecorder.stop();
        }
      }, 15000);
    } catch (error) {
      console.error("Microphone error:", error);
      this.showSweetAlert(
        "Microphone Access Denied",
        "Please allow microphone access to use voice features.",
        "error",
      );
    }
  }

  async textToSpeech() {
    const input = document.getElementById("ttsInput");
    const text = input.value.trim();

    if (!text) {
      this.showNotification("Please enter some text to speak", "error");
      return;
    }

    if (!this.isPoweredOn) {
      this.showSweetAlert(
        "System Offline",
        "Please turn on the system power first.",
        "warning",
      );
      return;
    }

    const voiceType = document.getElementById("voiceSelect").value;

    this.addMessage("user", text);

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({
          type: "text_message",
          text: text,
          voiceType: voiceType,
          timestamp: new Date().toISOString(),
        }),
      );
    } else {
      this.speakText(text);
    }

    input.value = "";
    this.showNotification("Speaking text...", "success");
  }

  async startRecording() {
    if (!this.isPoweredOn) {
      this.showSweetAlert(
        "System Offline",
        "Please turn on the system power first.",
        "warning",
      );
      return;
    }

    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.showNotification("Not connected to server", "error");
      return;
    }

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      await this.startAudioLevelMonitoring(this.mediaStream);

      this.mediaRecorder = new MediaRecorder(this.mediaStream);
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: "audio/wav" });
        this.sendAudioToServer(audioBlob);
      };

      this.mediaRecorder.start(100);
      this.isRecording = true;
      this.updateButtonStates();
      this.startWaveformAnimation();
      this.showNotification("Recording... Speak now", "success");

      setTimeout(() => {
        if (this.isRecording) {
          this.stopRecording();
        }
      }, 30000);
    } catch (error) {
      console.error("Microphone error:", error);
      this.showSweetAlert(
        "Microphone Access Denied",
        "Please allow microphone access to use voice features.",
        "error",
      );
    }
  }

  stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
      this.updateButtonStates();
      this.stopWaveformAnimation();
      this.stopAudioLevelMonitoring();
      this.showNotification("Recording stopped", "success");

      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach((track) => track.stop());
        this.mediaStream = null;
      }
    }
  }

  sendAudioToServer(audioBlob) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;

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
      case "error":
        this.showSweetAlert("Error", data.message, "error");
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
    if ("speechSynthesis" in window && this.isPoweredOn) {
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
      if (lastMessage && lastMessage.sender === "ai")
        this.speakText(lastMessage.text);
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

    startBtn.disabled =
      this.isRecording || this.isSpeaking || !this.isPoweredOn;
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

    stopBtn.innerHTML = this.isSpeaking
      ? '<span class="loading-spinner me-2"></span>Speaking...'
      : '<i class="fi fi-rr-stop me-2"></i>Stop';
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
        bar.style.height = `${Math.random() * 50 + 15}%`;
      });
    }, 80);
  }

  stopWaveformAnimation() {
    if (this.waveformInterval) {
      clearInterval(this.waveformInterval);
      this.waveformInterval = null;
      document.querySelectorAll(".bar").forEach((bar) => {
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
      this.showSweetAlert("Success", "Conversation saved to file!", "success");
    }
  }

  clearConversation() {
    Swal.fire({
      title: "Clear Conversation?",
      text: "This action cannot be undone!",
      icon: "warning",
      confirmButtonColor: "#7AB9A9",
      cancelButtonColor: "#797878",
      background: "#D8D6D7",
      color: "#2C0107",
      showCancelButton: true,
      confirmButtonText: "Yes, clear it",
      cancelButtonText: "Cancel",
    }).then((result) => {
      if (result.isConfirmed) {
        this.conversation = [];
        document.getElementById("conversationList").innerHTML =
          `<div class="message ai-message"><div class="message-header"><span class="sender ai-sender"><i class="fi fi-rr-robot me-1"></i>AI Assistant</span><span class="timestamp">${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></div><div class="message-content">Conversation cleared. Ready for new interaction.</div></div>`;
        if (this.socket && this.socket.readyState === WebSocket.OPEN)
          this.socket.send(JSON.stringify({ type: "clear_conversation" }));
        this.showSweetAlert(
          "Cleared",
          "Conversation has been cleared.",
          "success",
        );
      }
    });
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
    conversation.forEach((msg) => this.displayMessage(msg));
    this.conversation = conversation;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.voiceAssistant = new VoiceAssistant();
});
