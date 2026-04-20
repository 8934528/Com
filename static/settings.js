class SettingsManager {
    constructor() {
        this.settings = {
            tts: {
                enable_ssml: true,
                enable_neural_tts: false,
                enable_voice_cloning: false,
                enable_emotion_control: false,
                default_speech_rate: 1.0,
                default_pitch: 1.0,
                default_volume: 1.0,
                emotion_style: 'neutral'
            },
            stt: {
                enable_noise_reduction: true,
                enable_real_time_lang_detection: true,
                enable_speaker_diarization: false,
                enable_model_adaptation: false,
                custom_vocabulary: []
            },
            conversation: {
                enable_context_awareness: true,
                enable_conversation_mode: false,
                enable_cache_management: true,
                max_context_messages: 10,
                cache_ttl: 86400
            },
            privacy: {
                enable_audio_logging: false,
                auto_delete_audio: true,
                retention_days: 7
            }
        };
        this.init();
    }

    init() {
        this.loadSettings();
        this.setupEventListeners();
    }

    loadSettings() {
        const savedSettings = localStorage.getItem('voice_assistant_settings');
        if (savedSettings) {
            try {
                const parsed = JSON.parse(savedSettings);
                this.settings = this.mergeSettings(this.settings, parsed);
            } catch (e) {
                console.error('Error loading settings:', e);
            }
        }
        this.applySettingsToUI();
    }

    mergeSettings(defaultSettings, userSettings) {
        const merged = { ...defaultSettings };
        for (const key in userSettings) {
            if (merged[key] && typeof merged[key] === 'object') {
                merged[key] = this.mergeSettings(merged[key], userSettings[key]);
            } else {
                merged[key] = userSettings[key];
            }
        }
        return merged;
    }

    applySettingsToUI() {
        // TTS Settings
        const ssmlCheckbox = document.getElementById('enableSSML');
        if (ssmlCheckbox) ssmlCheckbox.checked = this.settings.tts.enable_ssml;
        
        const neuralTtsCheckbox = document.getElementById('enableNeuralTTS');
        if (neuralTtsCheckbox) neuralTtsCheckbox.checked = this.settings.tts.enable_neural_tts;
        
        const voiceCloningCheckbox = document.getElementById('enableVoiceCloning');
        if (voiceCloningCheckbox) voiceCloningCheckbox.checked = this.settings.tts.enable_voice_cloning;
        
        const emotionControlCheckbox = document.getElementById('enableEmotionControl');
        if (emotionControlCheckbox) emotionControlCheckbox.checked = this.settings.tts.enable_emotion_control;
        
        const speechRateSlider = document.getElementById('defaultSpeechRate');
        if (speechRateSlider) speechRateSlider.value = this.settings.tts.default_speech_rate;
        
        const pitchSlider = document.getElementById('defaultPitch');
        if (pitchSlider) pitchSlider.value = this.settings.tts.default_pitch;
        
        const volumeSlider = document.getElementById('defaultVolume');
        if (volumeSlider) volumeSlider.value = this.settings.tts.default_volume;
        
        const emotionSelect = document.getElementById('emotionStyle');
        if (emotionSelect) emotionSelect.value = this.settings.tts.emotion_style;

        // STT Settings
        const noiseReductionCheckbox = document.getElementById('enableNoiseReduction');
        if (noiseReductionCheckbox) noiseReductionCheckbox.checked = this.settings.stt.enable_noise_reduction;
        
        const langDetectionCheckbox = document.getElementById('enableRealTimeLangDetection');
        if (langDetectionCheckbox) langDetectionCheckbox.checked = this.settings.stt.enable_real_time_lang_detection;
        
        const speakerDiarizationCheckbox = document.getElementById('enableSpeakerDiarization');
        if (speakerDiarizationCheckbox) speakerDiarizationCheckbox.checked = this.settings.stt.enable_speaker_diarization;
        
        const modelAdaptationCheckbox = document.getElementById('enableModelAdaptation');
        if (modelAdaptationCheckbox) modelAdaptationCheckbox.checked = this.settings.stt.enable_model_adaptation;
        
        const vocabularyTextarea = document.getElementById('customVocabulary');
        if (vocabularyTextarea) vocabularyTextarea.value = this.settings.stt.custom_vocabulary.join(', ');

        // Conversation Settings
        const contextAwarenessCheckbox = document.getElementById('enableContextAwareness');
        if (contextAwarenessCheckbox) contextAwarenessCheckbox.checked = this.settings.conversation.enable_context_awareness;
        
        const conversationModeCheckbox = document.getElementById('enableConversationMode');
        if (conversationModeCheckbox) conversationModeCheckbox.checked = this.settings.conversation.enable_conversation_mode;
        
        const cacheManagementCheckbox = document.getElementById('enableCacheManagement');
        if (cacheManagementCheckbox) cacheManagementCheckbox.checked = this.settings.conversation.enable_cache_management;
        
        const maxContextInput = document.getElementById('maxContextMessages');
        if (maxContextInput) maxContextInput.value = this.settings.conversation.max_context_messages;
        
        const cacheTtlInput = document.getElementById('cacheTTL');
        if (cacheTtlInput) cacheTtlInput.value = this.settings.conversation.cache_ttl;

        // Privacy Settings
        const audioLoggingCheckbox = document.getElementById('enableAudioLogging');
        if (audioLoggingCheckbox) audioLoggingCheckbox.checked = this.settings.privacy.enable_audio_logging;
        
        const autoDeleteCheckbox = document.getElementById('autoDeleteAudio');
        if (autoDeleteCheckbox) autoDeleteCheckbox.checked = this.settings.privacy.auto_delete_audio;
        
        const retentionInput = document.getElementById('retentionDays');
        if (retentionInput) retentionInput.value = this.settings.privacy.retention_days;

        // display values
        this.updateDisplayValues();
    }

    updateDisplayValues() {
        const speechRateSpan = document.getElementById('speechRateValue');
        if (speechRateSpan) speechRateSpan.textContent = this.settings.tts.default_speech_rate;
        
        const pitchSpan = document.getElementById('pitchValue');
        if (pitchSpan) pitchSpan.textContent = this.settings.tts.default_pitch;
        
        const volumeSpan = document.getElementById('volumeValue');
        if (volumeSpan) volumeSpan.textContent = this.settings.tts.default_volume;
    }

    setupEventListeners() {
        const speechRateSlider = document.getElementById('defaultSpeechRate');
        if (speechRateSlider) {
            speechRateSlider.addEventListener('input', (e) => {
                document.getElementById('speechRateValue').textContent = e.target.value;
            });
        }
        
        const pitchSlider = document.getElementById('defaultPitch');
        if (pitchSlider) {
            pitchSlider.addEventListener('input', (e) => {
                document.getElementById('pitchValue').textContent = e.target.value;
            });
        }
        
        const volumeSlider = document.getElementById('defaultVolume');
        if (volumeSlider) {
            volumeSlider.addEventListener('input', (e) => {
                document.getElementById('volumeValue').textContent = e.target.value;
            });
        }

        const saveBtn = document.getElementById('saveSettingsBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveSettings());
        }
    }

    saveSettings() {
        // TTS settings
        this.settings.tts.enable_ssml = document.getElementById('enableSSML')?.checked || false;
        this.settings.tts.enable_neural_tts = document.getElementById('enableNeuralTTS')?.checked || false;
        this.settings.tts.enable_voice_cloning = document.getElementById('enableVoiceCloning')?.checked || false;
        this.settings.tts.enable_emotion_control = document.getElementById('enableEmotionControl')?.checked || false;
        this.settings.tts.default_speech_rate = parseFloat(document.getElementById('defaultSpeechRate')?.value || 1.0);
        this.settings.tts.default_pitch = parseFloat(document.getElementById('defaultPitch')?.value || 1.0);
        this.settings.tts.default_volume = parseFloat(document.getElementById('defaultVolume')?.value || 1.0);
        this.settings.tts.emotion_style = document.getElementById('emotionStyle')?.value || 'neutral';

        // STT settings
        this.settings.stt.enable_noise_reduction = document.getElementById('enableNoiseReduction')?.checked || false;
        this.settings.stt.enable_real_time_lang_detection = document.getElementById('enableRealTimeLangDetection')?.checked || false;
        this.settings.stt.enable_speaker_diarization = document.getElementById('enableSpeakerDiarization')?.checked || false;
        this.settings.stt.enable_model_adaptation = document.getElementById('enableModelAdaptation')?.checked || false;
        
        const vocabularyText = document.getElementById('customVocabulary')?.value || '';
        this.settings.stt.custom_vocabulary = vocabularyText.split(',').map(item => item.trim()).filter(item => item);

        // Conversation settings
        this.settings.conversation.enable_context_awareness = document.getElementById('enableContextAwareness')?.checked || false;
        this.settings.conversation.enable_conversation_mode = document.getElementById('enableConversationMode')?.checked || false;
        this.settings.conversation.enable_cache_management = document.getElementById('enableCacheManagement')?.checked || false;
        this.settings.conversation.max_context_messages = parseInt(document.getElementById('maxContextMessages')?.value || 10);
        this.settings.conversation.cache_ttl = parseInt(document.getElementById('cacheTTL')?.value || 86400);

        this.settings.privacy.enable_audio_logging = document.getElementById('enableAudioLogging')?.checked || false;
        this.settings.privacy.auto_delete_audio = document.getElementById('autoDeleteAudio')?.checked || false;
        this.settings.privacy.retention_days = parseInt(document.getElementById('retentionDays')?.value || 7);

        localStorage.setItem('voice_assistant_settings', JSON.stringify(this.settings));
        
        this.sendSettingsToServer();
        
        if (window.voiceAssistant) {
            window.voiceAssistant.showSweetAlert('Success', 'Settings saved successfully!', 'success');
        } else {
            Swal.fire({
                title: 'Success',
                text: 'Settings saved successfully!',
                icon: 'success',
                confirmButtonColor: '#7AB9A9',
                background: '#D8D6D7',
                color: '#2C0107'
            });
        }
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('settingsModal'));
        if (modal) modal.hide();
    }

    sendSettingsToServer() {
        fetch('/api/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(this.settings)
        }).catch(error => console.error('Error saving settings to server:', error));
    }

    getSetting(category, key) {
        return this.settings[category]?.[key];
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.settingsManager = new SettingsManager();
    
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    
    if (settingsBtn && settingsModal) {
        settingsBtn.addEventListener('click', () => {
            const modal = new bootstrap.Modal(settingsModal);
            modal.show();
        });
    }
});
