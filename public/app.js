// Socket.io connection
const socket = io();

// DOM elements
const messagesContainer = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');

let isConnected = false;
let isProcessing = false;

// Auto-resize textarea
messageInput.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = this.scrollHeight + 'px';

    // Enable/disable send button
    sendButton.disabled = !this.value.trim() || isProcessing;
});

// Handle Enter key (Shift+Enter for new line)
messageInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!sendButton.disabled) {
            sendMessage();
        }
    }
});

// Send button click
sendButton.addEventListener('click', sendMessage);

// Socket connection events
socket.on('connect', () => {
    isConnected = true;
    statusIndicator.classList.add('connected');
    statusText.textContent = 'Connecté';
    sendButton.disabled = false;
    console.log('Connected to server');
});

socket.on('disconnect', () => {
    isConnected = false;
    statusIndicator.classList.remove('connected');
    statusText.textContent = 'Déconnecté';
    sendButton.disabled = true;
    console.log('Disconnected from server');
});

// Handle incoming messages
socket.on('response', (message) => {
    removeTypingIndicator();
    addMessage(message, 'assistant');
    isProcessing = false;
    sendButton.disabled = !messageInput.value.trim();
});

// Handle tool calls
socket.on('tool_call', (data) => {
    addToolCall(data.name, data.arguments);
});

// Handle tool results
socket.on('tool_result', (data) => {
    console.log('Tool result:', data.name, data.result.substring(0, 100));
});

// Handle errors
socket.on('error', (error) => {
    removeTypingIndicator();
    addMessage(`❌ Erreur: ${error}`, 'assistant');
    isProcessing = false;
    sendButton.disabled = !messageInput.value.trim();
});

// Send message function
function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || !isConnected || isProcessing) return;

    // Clear welcome message if it exists
    const welcomeMsg = document.querySelector('.welcome-message');
    if (welcomeMsg) {
        welcomeMsg.remove();
    }

    // Add user message to UI
    addMessage(message, 'user');

    // Send to server
    socket.emit('message', message);

    // Clear input
    messageInput.value = '';
    messageInput.style.height = 'auto';

    // Show typing indicator
    addTypingIndicator();

    isProcessing = true;
    sendButton.disabled = true;
}

// Add message to chat
function addMessage(content, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = sender === 'user' ? 'U' : '🤖';

    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';

    // Format code blocks
    const formattedContent = formatMessage(content);
    messageContent.innerHTML = formattedContent;

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(messageContent);

    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
}

// Format message with code blocks
function formatMessage(text) {
    // Replace code blocks with proper formatting
    text = text.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
        return `<pre><code>${escapeHtml(code.trim())}</code></pre>`;
    });

    // Replace inline code
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Replace newlines with <br>
    text = text.replace(/\n/g, '<br>');

    return text;
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Add typing indicator
function addTypingIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'message assistant';
    indicator.id = 'typing-indicator';

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = '🤖';

    const typingDiv = document.createElement('div');
    typingDiv.className = 'message-content typing-indicator';
    typingDiv.innerHTML = `
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
    `;

    indicator.appendChild(avatar);
    indicator.appendChild(typingDiv);
    messagesContainer.appendChild(indicator);
    scrollToBottom();
}

// Remove typing indicator
function removeTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) {
        indicator.remove();
    }
}

// Add tool call indicator
function addToolCall(name, args) {
    const toolDiv = document.createElement('div');
    toolDiv.className = 'tool-call';

    toolDiv.innerHTML = `
        <div class="tool-call-icon">⚡</div>
        <div>
            <span class="tool-call-name">${name}</span>
            <div class="tool-call-args">${args}</div>
        </div>
    `;

    messagesContainer.appendChild(toolDiv);
    scrollToBottom();
}

// Scroll to bottom
function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Focus input on load
window.addEventListener('load', () => {
    messageInput.focus();
});
