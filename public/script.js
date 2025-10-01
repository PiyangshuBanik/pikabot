class GeminiBotClient {
    constructor() {
        this.chatContainer = document.getElementById('chat-container');
        this.userInput = document.getElementById('user-input');
        this.fileInput = document.getElementById('file-input');
        this.filePreview = document.getElementById('file-preview');
        this.previewImage = document.getElementById('preview-image');
        this.sendBtn = document.getElementById('send-btn');
        this.voiceBtn = document.getElementById('voice-btn');
        this.loadingModal = document.getElementById('loading-modal');
        this.audioPlayer = document.getElementById('audio-player');
        
        // State management
        this.isRecording = false;
        this.voiceRepliesEnabled = true;
        this.currentFile = null;
        this.recognition = null;
        this.messageCount = 0;
        this.imageCount = 0;
        this.voiceCount = 0;
        
        this.initializeApp();
        this.setupEventListeners();
        this.initializeSpeechRecognition();
        this.updateSettings();
    }

    initializeApp() {
        // Remove welcome message if exists
        const welcomeMsg = this.chatContainer.querySelector('.welcome-message');
        if (welcomeMsg) {
            // Keep welcome message initially
        }
        
        // Set initial status
        this.updateStatus('Connected', 'success');
        
        // Initialize settings
        this.updateSliderValues();
    }

    setupEventListeners() {
        // Send message on Enter
        this.userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Settings sliders
        document.getElementById('temperature').addEventListener('input', this.updateSliderValues);
        document.getElementById('max-tokens').addEventListener('input', this.updateSliderValues);
        
        // Model selection
        document.getElementById('model-select').addEventListener('change', this.updateSettings);
        
        // File input change
        this.fileInput.addEventListener('change', this.handleFileSelect);
    }

    updateSliderValues = () => {
        const tempSlider = document.getElementById('temperature');
        const tokensSlider = document.getElementById('max-tokens');
        document.getElementById('temp-value').textContent = tempSlider.value;
        document.getElementById('tokens-value').textContent = tokensSlider.value;
    }

    updateSettings = () => {
        // Update any settings that need to be applied
        console.log('Settings updated');
    }

    initializeSpeechRecognition() {
        if ('webkitSpeechRecognition' in window) {
            this.recognition = new webkitSpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = false;
            this.recognition.lang = 'en-US';
            
            this.recognition.onstart = () => {
                this.isRecording = true;
                this.voiceBtn.classList.add('recording');
                this.updateStatus('Listening...', 'warning');
            };
            
            this.recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                this.userInput.value = transcript;
                this.sendMessage();
            };
            
            this.recognition.onend = () => {
                this.isRecording = false;
                this.voiceBtn.classList.remove('recording');
                this.updateStatus('Connected', 'success');
            };
            
            this.recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                this.isRecording = false;
                this.voiceBtn.classList.remove('recording');
                this.updateStatus('Speech Error', 'error');
                setTimeout(() => this.updateStatus('Connected', 'success'), 3000);
            };
        }
    }

    updateStatus(text, type) {
        const statusText = document.getElementById('status-text');
        const statusDot = document.getElementById('status-dot');
        
        statusText.textContent = text;
        statusDot.className = 'status-dot';
        
        switch(type) {
            case 'success':
                statusDot.style.background = 'var(--success-color)';
                statusDot.style.boxShadow = '0 0 10px var(--success-color)';
                break;
            case 'warning':
                statusDot.style.background = 'var(--warning-color)';
                statusDot.style.boxShadow = '0 0 10px var(--warning-color)';
                break;
            case 'error':
                statusDot.style.background = 'var(--danger-color)';
                statusDot.style.boxShadow = '0 0 10px var(--danger-color)';
                break;
        }
    }

    showLoading(text = 'Processing your request...') {
        document.getElementById('loading-text').textContent = text;
        this.loadingModal.style.display = 'flex';
    }

    hideLoading() {
        this.loadingModal.style.display = 'none';
    }

    appendMessage(content, sender, type = 'text', imageUrl = null) {
        // Remove welcome message if it exists
        const welcomeMsg = this.chatContainer.querySelector('.welcome-message');
        if (welcomeMsg) {
            welcomeMsg.remove();
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;

        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.innerHTML = sender === 'user' ? '<i class="fas fa-user"></i>' : '<i class="fas fa-robot"></i>';

        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';

        if (type === 'text') {
            messageContent.innerHTML = this.formatMessage(content);
        } else if (type === 'image') {
            const img = document.createElement('img');
            img.src = imageUrl;
            img.className = 'message-image';
            img.alt = 'Uploaded image';
            messageContent.appendChild(img);
            if (content) {
                const textDiv = document.createElement('div');
                textDiv.innerHTML = this.formatMessage(content);
                messageContent.appendChild(textDiv);
            }
        }

        // Add message actions for bot messages
        if (sender === 'bot') {
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'message-actions';
            
            const copyBtn = document.createElement('button');
            copyBtn.className = 'message-action-btn';
            copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy';
            copyBtn.onclick = () => this.copyToClipboard(content);
            
            const speakBtn = document.createElement('button');
            speakBtn.className = 'message-action-btn';
            speakBtn.innerHTML = '<i class="fas fa-volume-up"></i> Speak';
            speakBtn.onclick = () => this.speakText(content);
            
            actionsDiv.appendChild(copyBtn);
            actionsDiv.appendChild(speakBtn);
            messageContent.appendChild(actionsDiv);
        }

        messageDiv.appendChild(avatar);
        messageDiv.appendChild(messageContent);
        
        this.chatContainer.appendChild(messageDiv);
        this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
        
        // Update stats
        if (sender === 'user') {
            this.messageCount++;
            document.getElementById('message-count').textContent = this.messageCount;
        }
    }

    formatMessage(text) {
        // Convert markdown-like formatting to HTML
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>');
    }

    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            this.showToast('Text copied to clipboard!', 'success');
        }).catch(err => {
            console.error('Failed to copy text: ', err);
            this.showToast('Failed to copy text', 'error');
        });
    }

    speakText(text) {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 0.8;
            utterance.pitch = 1;
            utterance.volume = 0.8;
            speechSynthesis.speak(utterance);
        }
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--card-bg);
            color: var(--primary-text);
            padding: 15px 20px;
            border-radius: 10px;
            border: 1px solid var(--border-color);
            z-index: 1001;
            animation: slideInRight 0.3s ease-out;
        `;
        
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    showTypingIndicator() {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message bot';
        typingDiv.id = 'typing-indicator';
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.innerHTML = '<i class="fas fa-robot"></i>';
        
        const typingContent = document.createElement('div');
        typingContent.className = 'typing-indicator';
        typingContent.innerHTML = `
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        `;
        
        typingDiv.appendChild(avatar);
        typingDiv.appendChild(typingContent);
        
        this.chatContainer.appendChild(typingDiv);
        this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
    }

    hideTypingIndicator() {
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    async sendMessage() {
        const message = this.userInput.value.trim();
        if (!message && !this.currentFile) return;

        this.sendBtn.disabled = true;
        
        try {
            // Show user message
            if (message) {
                this.appendMessage(message, 'user');
            }
            
            if (this.currentFile) {
                this.appendMessage('', 'user', 'image', this.currentFile.url);
                this.imageCount++;
                document.getElementById('image-count').textContent = this.imageCount;
            }

            this.userInput.value = '';
            this.showTypingIndicator();
            this.updateStatus('Processing...', 'warning');

            const formData = new FormData();
            formData.append('message', message);
            formData.append('model', document.getElementById('model-select').value);
            formData.append('temperature', document.getElementById('temperature').value);
            formData.append('maxTokens', document.getElementById('max-tokens').value);
            
            if (this.currentFile) {
                formData.append('image', this.currentFile.file);
            }

            const response = await fetch('/api/chat', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            this.hideTypingIndicator();
            this.appendMessage(data.reply, 'bot');
            
            // Play voice reply if enabled
            if (this.voiceRepliesEnabled && data.audioUrl) {
                this.playAudioReply(data.audioUrl);
            }
            
            this.updateStatus('Connected', 'success');

        } catch (error) {
            console.error('Error sending message:', error);
            this.hideTypingIndicator();
            this.appendMessage('Sorry, I encountered an error. Please try again.', 'bot');
            this.updateStatus('Error', 'error');
            setTimeout(() => this.updateStatus('Connected', 'success'), 3000);
        } finally {
            this.sendBtn.disabled = false;
            this.removeFile();
        }
    }

    async generateImage() {
        const prompt = this.userInput.value.trim();
        if (!prompt) {
            this.showToast('Please enter a description for the image to generate', 'warning');
            return;
        }

        this.showLoading('Generating image...');
        
        try {
            const response = await fetch('/api/generate-image', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ prompt })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            this.hideLoading();
            this.appendMessage(prompt, 'user');
            this.appendMessage('Here\'s your generated image:', 'bot', 'image', data.imageUrl);
            this.userInput.value = '';
            
        } catch (error) {
            console.error('Error generating image:', error);
            this.hideLoading();
            this.showToast('Failed to generate image. Please try again.', 'error');
        }
    }

    async analyzeImage() {
        if (!this.currentFile) {
            this.showToast('Please select an image to analyze', 'warning');
            return;
        }

        this.showLoading('Analyzing image...');
        
        try {
            const formData = new FormData();
            formData.append('image', this.currentFile.file);
            formData.append('action', 'analyze');

            const response = await fetch('/api/analyze-image', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            this.hideLoading();
            this.appendMessage('', 'user', 'image', this.currentFile.url);
            this.appendMessage(data.analysis, 'bot');
            this.removeFile();
            
        } catch (error) {
            console.error('Error analyzing image:', error);
            this.hideLoading();
            this.showToast('Failed to analyze image. Please try again.', 'error');
        }
    }

    startVoiceRecording() {
        if (!this.recognition) {
            this.showToast('Speech recognition not supported in this browser', 'error');
            return;
        }

        if (this.isRecording) {
            this.recognition.stop();
        } else {
            this.recognition.start();
            this.voiceCount++;
            document.getElementById('voice-count').textContent = this.voiceCount;
        }
    }

    toggleVoiceReply() {
        this.voiceRepliesEnabled = !this.voiceRepliesEnabled;
        const toggleText = document.getElementById('voice-toggle-text');
        toggleText.textContent = this.voiceRepliesEnabled ? 'Voice ON' : 'Voice OFF';
        
        this.showToast(
            `Voice replies ${this.voiceRepliesEnabled ? 'enabled' : 'disabled'}`, 
            'info'
        );
    }

    playAudioReply(audioUrl) {
        this.audioPlayer.src = audioUrl;
        this.audioPlayer.play().catch(error => {
            console.error('Error playing audio:', error);
        });
    }

    toggleFileInput() {
        this.fileInput.click();
    }

    handleFileSelect = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            this.showToast('Please select an image file', 'error');
            return;
        }

        if (file.size > 10 * 1024 * 1024) { // 10MB limit
            this.showToast('File size must be less than 10MB', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            this.currentFile = {
                file: file,
                url: e.target.result
            };
            
            this.previewImage.src = e.target.result;
            this.filePreview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }

    removeFile() {
        this.currentFile = null;
        this.filePreview.style.display = 'none';
        this.fileInput.value = '';
    }

    clearChat() {
        if (confirm('Are you sure you want to clear the chat?')) {
            this.chatContainer.innerHTML = `
                <div class="welcome-message">
                    <i class="fas fa-sparkles"></i>
                    <h3>Welcome to GeminiBot AI</h3>
                    <p>I can help you with text, images, voice, and much more!</p>
                </div>
            `;
            
            // Reset stats
            this.messageCount = 0;
            this.imageCount = 0;
            this.voiceCount = 0;
            document.getElementById('message-count').textContent = '0';
            document.getElementById('image-count').textContent = '0';
            document.getElementById('voice-count').textContent = '0';
        }
    }
}

// Global functions for HTML onclick events
let bot;

window.addEventListener('DOMContentLoaded', () => {
    bot = new GeminiBotClient();
});

function sendMessage() {
    if (bot) bot.sendMessage();
}

function startVoiceRecording() {
    if (bot) bot.startVoiceRecording();
}

function toggleFileInput() {
    if (bot) bot.toggleFileInput();
}

function handleFileSelect(event) {
    if (bot) bot.handleFileSelect(event);
}

function removeFile() {
    if (bot) bot.removeFile();
}

function generateImage() {
    if (bot) bot.generateImage();
}

function analyzeImage() {
    if (bot) bot.analyzeImage();
}

function toggleVoiceReply() {
    if (bot) bot.toggleVoiceReply();
}

function clearChat() {
    if (bot) bot.clearChat();
}