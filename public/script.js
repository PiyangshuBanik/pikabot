// ==================== DOM Elements ====================
const chatBox = document.getElementById("chat-box");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const typingIndicator = document.getElementById("typing-indicator");
const clearChatBtn = document.getElementById("clear-chat");
const themeToggleBtn = document.getElementById("theme-toggle");

// Feature buttons
const imageBtn = document.getElementById("image-btn");
const fileBtn = document.getElementById("file-btn");
const voiceBtn = document.getElementById("voice-btn");

// File inputs
const imageInput = document.getElementById("image-input");
const fileInput = document.getElementById("file-input");

// File preview
const filePreview = document.getElementById("file-preview");
const removeFileBtn = document.getElementById("remove-file");

// ==================== Global State ====================
let chatHistory = [];
let currentFile = null;
let isRecording = false;
let recognition = null;
let currentTheme = localStorage.getItem("theme") || "dark";

// ==================== Initialize ====================
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initSpeechRecognition();
  autoResizeTextarea();
  loadChatHistory();
  
  // Remove welcome message on first interaction
  userInput.addEventListener("focus", () => {
    const welcomeMsg = document.querySelector(".welcome-message");
    if (welcomeMsg) {
      welcomeMsg.style.animation = "fadeOut 0.3s ease-out";
      setTimeout(() => welcomeMsg.remove(), 300);
    }
  }, { once: true });
});

// ==================== Theme Management ====================
function initTheme() {
  document.documentElement.setAttribute("data-theme", currentTheme);
  updateThemeIcon();
}

function toggleTheme() {
  currentTheme = currentTheme === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", currentTheme);
  localStorage.setItem("theme", currentTheme);
  updateThemeIcon();
  
  // Add transition effect
  document.body.style.transition = "background 0.3s ease";
}

function updateThemeIcon() {
  const icon = themeToggleBtn.querySelector("i");
  icon.className = currentTheme === "dark" ? "fas fa-sun" : "fas fa-moon";
}

// ==================== Chat History Management ====================
function loadChatHistory() {
  const saved = localStorage.getItem("pikabot_history");
  if (saved) {
    chatHistory = JSON.parse(saved);
    chatHistory.forEach(msg => {
      addMessageToUI(msg.text, msg.type, false);
    });
  }
}

function saveChatHistory() {
  localStorage.setItem("pikabot_history", JSON.stringify(chatHistory));
}

function clearChatHistory() {
  if (confirm("Are you sure you want to clear the chat history?")) {
    chatHistory = [];
    localStorage.removeItem("pikabot_history");
    chatBox.innerHTML = "";
    
    // Re-add welcome message
    const welcomeHTML = `
      <div class="welcome-message">
        <div class="welcome-icon">
          <i class="fas fa-bolt"></i>
        </div>
        <h2>Welcome to PikaBot!</h2>
        <p>Your intelligent AI companion powered by Google Gemini</p>
        <div class="feature-cards">
          <div class="feature-card">
            <i class="fas fa-comments"></i>
            <span>Chat</span>
          </div>
          <div class="feature-card">
            <i class="fas fa-image"></i>
            <span>Image Analysis</span>
          </div>
          <div class="feature-card">
            <i class="fas fa-file-alt"></i>
            <span>File Reading</span>
          </div>
          <div class="feature-card">
            <i class="fas fa-microphone"></i>
            <span>Voice Input</span>
          </div>
        </div>
      </div>
    `;
    chatBox.innerHTML = welcomeHTML;
  }
}

// ==================== Message Functions ====================
function addMessageToUI(text, type, animate = true) {
  // Remove welcome message if it exists
  const welcomeMsg = chatBox.querySelector(".welcome-message");
  if (welcomeMsg) welcomeMsg.remove();

  const messageDiv = document.createElement("div");
  messageDiv.className = `message ${type}`;
  
  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.innerHTML = type === "user" 
    ? '<i class="fas fa-user"></i>' 
    : '<i class="fas fa-robot"></i>';
  
  const content = document.createElement("div");
  content.className = "message-content";
  
  // Format text with markdown-like styling
  const formattedText = formatMessage(text);
  content.innerHTML = formattedText;
  
  messageDiv.appendChild(avatar);
  messageDiv.appendChild(content);
  
  if (!animate) {
    messageDiv.style.animation = "none";
  }
  
  chatBox.appendChild(messageDiv);
  chatBox.scrollTop = chatBox.scrollHeight;
  
  return messageDiv;
}

function formatMessage(text) {
  // Basic formatting: bold, italic, code blocks
  let formatted = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code style="background: var(--surface); padding: 2px 6px; border-radius: 4px;">$1</code>')
    .replace(/\n/g, '<br>');
  
  return formatted;
}

function showTyping() {
  typingIndicator.classList.add("active");
}

function hideTyping() {
  typingIndicator.classList.remove("active");
}

// ==================== Send Message ====================
async function sendMessage() {
  const message = userInput.value.trim();
  
  if (!message && !currentFile) return;
  
  // Clear input
  userInput.value = "";
  autoResizeTextarea();
  
  // Add user message
  if (message) {
    addMessageToUI(message, "user");
    chatHistory.push({ text: message, type: "user" });
  }
  
  // Show typing indicator
  showTyping();
  
  try {
    let response;
    
    if (currentFile) {
      // Handle file upload
      response = await handleFileUpload(message);
    } else {
      // Regular chat
      response = await fetch("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
    }
    
    if (!response.ok) {
      throw new Error("Server error");
    }
    
    const data = await response.json();
    const botReply = data.reply || data.message || "I apologize, but I couldn't process that request.";
    
    // Hide typing and show response
    hideTyping();
    addMessageToUI(botReply, "bot");
    chatHistory.push({ text: botReply, type: "bot" });
    saveChatHistory();
    
  } catch (error) {
    hideTyping();
    console.error("Error:", error);
    addMessageToUI("❌ Sorry, I encountered an error. Please try again.", "bot");
  }
  
  // Clear current file
  if (currentFile) {
    clearFilePreview();
  }
}

// ==================== File Upload Handlers ====================
async function handleFileUpload(prompt) {
  const formData = new FormData();
  formData.append("prompt", prompt || "Please analyze this file");
  
  if (currentFile.type === "image") {
    formData.append("image", currentFile.file);
    return fetch("/analyze-image", {
      method: "POST",
      body: formData,
    });
  } else {
    formData.append("file", currentFile.file);
    return fetch("/read-file", {
      method: "POST",
      body: formData,
    });
  }
}

function handleImageUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  if (!file.type.startsWith("image/")) {
    alert("Please select a valid image file");
    return;
  }
  
  currentFile = { type: "image", file };
  showFilePreview(file.name, "image");
  imageInput.value = ""; // Reset input
}

function handleFileUploadBtn(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  currentFile = { type: "file", file };
  showFilePreview(file.name, "file");
  fileInput.value = ""; // Reset input
}

function showFilePreview(filename, type) {
  const icon = type === "image" ? "fa-image" : "fa-file-alt";
  filePreview.querySelector(".preview-text").innerHTML = `
    <i class="fas ${icon}"></i>
    <span>${filename}</span>
  `;
  filePreview.style.display = "block";
  userInput.focus();
}

function clearFilePreview() {
  currentFile = null;
  filePreview.style.display = "none";
}

// ==================== Voice Recognition ====================
function initSpeechRecognition() {
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      userInput.value = transcript;
      autoResizeTextarea();
    };
    
    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      stopRecording();
    };
    
    recognition.onend = () => {
      stopRecording();
    };
  }
}

function toggleVoiceRecording() {
  if (!recognition) {
    alert("Speech recognition is not supported in your browser");
    return;
  }
  
  if (isRecording) {
    recognition.stop();
  } else {
    recognition.start();
    startRecording();
  }
}

function startRecording() {
  isRecording = true;
  voiceBtn.classList.add("active");
  voiceBtn.innerHTML = '<i class="fas fa-stop"></i>';
}

function stopRecording() {
  isRecording = false;
  voiceBtn.classList.remove("active");
  voiceBtn.innerHTML = '<i class="fas fa-microphone"></i>';
}

// ==================== Textarea Auto-resize ====================
function autoResizeTextarea() {
  userInput.style.height = "auto";
  userInput.style.height = Math.min(userInput.scrollHeight, 120) + "px";
}

// ==================== Event Listeners ====================
sendBtn.addEventListener("click", sendMessage);

userInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

userInput.addEventListener("input", autoResizeTextarea);

clearChatBtn.addEventListener("click", clearChatHistory);
themeToggleBtn.addEventListener("click", toggleTheme);

// Feature buttons
imageBtn.addEventListener("click", () => imageInput.click());
fileBtn.addEventListener("click", () => fileInput.click());
voiceBtn.addEventListener("click", toggleVoiceRecording);

// File inputs
imageInput.addEventListener("change", handleImageUpload);
fileInput.addEventListener("change", handleFileUploadBtn);

// Remove file
removeFileBtn.addEventListener("click", clearFilePreview);

// ==================== Keyboard Shortcuts ====================
document.addEventListener("keydown", (e) => {
  // Ctrl/Cmd + K to clear chat
  if ((e.ctrlKey || e.metaKey) && e.key === "k") {
    e.preventDefault();
    clearChatHistory();
  }
  
  // Ctrl/Cmd + / to focus input
  if ((e.ctrlKey || e.metaKey) && e.key === "/") {
    e.preventDefault();
    userInput.focus();
  }
});

// ==================== Online/Offline Status ====================
window.addEventListener("online", () => {
  addMessageToUI("🟢 Connection restored", "bot");
});

window.addEventListener("offline", () => {
  addMessageToUI("🔴 Connection lost. Please check your internet.", "bot");
});

// ==================== Add CSS for fade out animation ====================
const style = document.createElement("style");
style.textContent = `
  @keyframes fadeOut {
    from {
      opacity: 1;
      transform: scale(1);
    }
    to {
      opacity: 0;
      transform: scale(0.9);
    }
  }
`;
document.head.appendChild(style);