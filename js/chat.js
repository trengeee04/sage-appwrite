// ============================================
// SAGE ChatApp - Chat Module
// Real-time messaging and channels
// ============================================

class ChatManager {
    constructor() {
        this.channels = this.loadChannels();
        this.messages = this.loadMessages();
        this.directMessages = this.loadDirectMessages();
        this.currentChannel = null;
        this.currentUser = authManager.currentUser;
    }

    // Initialize default channels
    initializeDefaultChannels() {
        if (Object.keys(this.channels).length === 0) {
            const defaultChannels = {
                general: {
                    id: 'ch_general',
                    name: 'general',
                    icon: 'fa-comments',
                    description: 'General discussion',
                    type: 'channel',
                    members: [],
                    createdAt: new Date().toISOString()
                },
                announcements: {
                    id: 'ch_announcements',
                    name: 'announcements',
                    icon: 'fa-bullhorn',
                    description: 'Important announcements',
                    type: 'channel',
                    members: [],
                    createdAt: new Date().toISOString()
                },
                random: {
                    id: 'ch_random',
                    name: 'random',
                    icon: 'fa-dice',
                    description: 'Random conversations',
                    type: 'channel',
                    members: [],
                    createdAt: new Date().toISOString()
                },
                introductions: {
                    id: 'ch_introductions',
                    name: 'introductions',
                    icon: 'fa-handshake',
                    description: 'Introduce yourself',
                    type: 'channel',
                    members: [],
                    createdAt: new Date().toISOString()
                }
            };

            this.channels = defaultChannels;
            this.saveChannels();
        }
    }

    // Load channels from localStorage
    loadChannels() {
        const stored = localStorage.getItem('sage_channels');
        return stored ? JSON.parse(stored) : {};
    }

    // Save channels to localStorage
    saveChannels() {
        localStorage.setItem('sage_channels', JSON.stringify(this.channels));
    }

    // Load messages from localStorage
    loadMessages() {
        const stored = localStorage.getItem('sage_messages');
        return stored ? JSON.parse(stored) : {};
    }

    // Save messages to localStorage
    saveMessages() {
        localStorage.setItem('sage_messages', JSON.stringify(this.messages));
    }

    // Load direct messages from localStorage
    loadDirectMessages() {
        const stored = localStorage.getItem('sage_dm');
        return stored ? JSON.parse(stored) : {};
    }

    // Save direct messages to localStorage
    saveDirectMessages() {
        localStorage.setItem('sage_dm', JSON.stringify(this.directMessages));
    }

    // Get or create conversation ID between two users
    getConversationId(userId1, userId2) {
        const ids = [userId1, userId2].sort();
        return `dm_${ids[0]}_${ids[1]}`;
    }

    // Send message to channel
    sendMessage(channelId, text) {
        if (!text.trim() || !this.currentChannel) return;

        const message = {
            id: 'msg_' + Math.random().toString(36).substr(2, 9),
            author: this.currentUser.username,
            authorName: this.currentUser.name,
            authorId: this.currentUser.id,
            text: text.trim(),
            timestamp: new Date().toISOString(),
            avatar: this.currentUser.avatar,
            edited: false
        };

        // Initialize channel messages if needed
        if (!this.messages[channelId]) {
            this.messages[channelId] = [];
        }

        this.messages[channelId].push(message);
        this.saveMessages();

        return message;
    }

    // Get all messages for a channel
    getChannelMessages(channelId) {
        return this.messages[channelId] || [];
    }

    // Create new channel
    createChannel(name, description = '') {
        if (!name) return { success: false, message: 'Channel name is required' };

        const channelId = 'ch_' + Math.random().toString(36).substr(2, 9);
        const channel = {
            id: channelId,
            name: name.toLowerCase().replace(/\s+/g, '-'),
            displayName: name,
            icon: 'fa-hash',
            description: description,
            type: 'channel',
            members: [this.currentUser.id],
            createdAt: new Date().toISOString(),
            creator: this.currentUser.username
        };

        this.channels[channel.name] = channel;
        this.messages[channelId] = [];
        this.saveChannels();
        this.saveMessages();

        return { success: true, message: 'Channel created', channel };
    }

    // Get all channels
    getAllChannels() {
        return Object.values(this.channels).filter(ch => ch.type === 'channel');
    }

    // Get channel by ID
    getChannel(channelId) {
        return Object.values(this.channels).find(ch => ch.id === channelId);
    }

    // Get channel by name
    getChannelByName(name) {
        return this.channels[name];
    }

    // Search channels
    searchChannels(query) {
        if (!query) return this.getAllChannels();
        const lowerQuery = query.toLowerCase();
        return this.getAllChannels().filter(ch => 
            ch.name.includes(lowerQuery) || 
            ch.description.includes(lowerQuery)
        );
    }
}

// Initialize chat manager
const chatManager = new ChatManager();

// ============================================
// UI Rendering Functions
// ============================================

function initializeChat() {
    // Initialize channels
    chatManager.initializeDefaultChannels();

    // Update profile in user menu
    const profileUsername = document.getElementById('profileUsername');
    if (profileUsername) {
        profileUsername.textContent = authManager.currentUser.name;
    }

    // Render channels
    renderChannels();

    // Select first channel by default
    const firstChannel = chatManager.getAllChannels()[0];
    if (firstChannel) {
        selectChannel(firstChannel.id);
    }

    // Setup event listeners
    setupEventListeners();

    showNotification(`Welcome, ${authManager.currentUser.name}!`, 'success');
}

// Render all channels in sidebar
function renderChannels() {
    const channelsList = document.getElementById('channelsList');
    const channels = chatManager.getAllChannels();

    channelsList.innerHTML = '';

    channels.forEach(channel => {
        const button = document.createElement('button');
        button.className = 'channel-item';
        button.innerHTML = `
            <i class="fas ${channel.icon}"></i>
            <span>${channel.name}</span>
        `;
        button.onclick = () => selectChannel(channel.id);
        channelsList.appendChild(button);
    });
}

// Select channel and load messages
function selectChannel(channelId) {
    // Update current channel
    chatManager.currentChannel = channelId;

    // Update active button
    document.querySelectorAll('.channel-item').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.closest('.channel-item')?.classList.add('active');

    // Get channel info
    const channels = chatManager.getAllChannels();
    const channel = channels.find(ch => ch.id === channelId);

    if (!channel) return;

    // Update header
    document.getElementById('channelName').textContent = '# ' + channel.name;
    document.getElementById('channelDescription').textContent = channel.description;

    // Load and render messages
    renderMessages();
}

// Render messages in messages area
function renderMessages() {
    const messagesArea = document.getElementById('messagesArea');
    const messages = chatManager.getChannelMessages(chatManager.currentChannel);

    if (messages.length === 0) {
        messagesArea.innerHTML = `
            <div class="messages-welcome">
                <div class="welcome-icon">
                    <i class="fas fa-comments"></i>
                </div>
                <h2>No messages yet</h2>
                <p>Start the conversation!</p>
            </div>
        `;
        return;
    }

    messagesArea.innerHTML = '';

    messages.forEach((msg, index) => {
        const isOwnMessage = msg.author === authManager.currentUser.username;
        const messageEl = document.createElement('div');
        messageEl.className = `message ${isOwnMessage ? 'own' : ''}`;

        // Show avatar only for first message or if different user
        const showAvatar = index === 0 || messages[index - 1].author !== msg.author;

        const time = new Date(msg.timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });

        messageEl.innerHTML = `
            ${showAvatar ? `<div class="message-avatar" title="${msg.authorName}">${msg.avatar}</div>` : '<div style="width: 40px;"></div>'}
            <div class="message-content">
                ${showAvatar ? `
                    <div class="message-header">
                        <span class="message-author">${msg.authorName}</span>
                        <span class="message-time">${time}</span>
                    </div>
                ` : ''}
                <div class="message-text">${escapeHtml(msg.text)}</div>
            </div>
        `;

        messagesArea.appendChild(messageEl);
    });

    // Scroll to bottom
    messagesArea.scrollTop = messagesArea.scrollHeight;
}

// Send message
function sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value;

    if (!text.trim()) return;

    // Send message
    chatManager.sendMessage(chatManager.currentChannel, text);

    // Clear input
    input.value = '';
    input.focus();

    // Re-render messages
    renderMessages();

    showNotification('Message sent!', 'success');
}

// Show create channel modal
function showCreateChannelModal() {
    const name = prompt('Enter channel name:');
    if (!name) return;

    const description = prompt('Enter channel description (optional):');

    const result = chatManager.createChannel(name, description || '');
    if (result.success) {
        renderChannels();
        showNotification(result.message, 'success');
    } else {
        showNotification(result.message, 'error');
    }
}

// Toggle user menu
function toggleUserMenu() {
    const userMenu = document.getElementById('userMenu');
    userMenu.classList.toggle('active');

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.fab-menu') && !e.target.closest('.user-menu')) {
            userMenu.classList.remove('active');
        }
    });
}

// Logout user
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        authManager.logout();
        showAuthContainer(true);
        showNotification('Logged out successfully', 'success');
        // Reset UI
        document.getElementById('loginFormElement').reset();
    }
}

// Toggle member list
function toggleMemberList() {
    const rightSidebar = document.getElementById('rightSidebar');
    rightSidebar.classList.toggle('active');
    renderMembers();
}

// Render members list
function renderMembers() {
    const membersList = document.getElementById('membersList');
    const allUsers = authManager.getAllUsers();

    membersList.innerHTML = '';

    allUsers.forEach(user => {
        const memberEl = document.createElement('div');
        memberEl.className = 'member-item';
        memberEl.innerHTML = `
            <div class="member-avatar">${user.avatar}</div>
            <div class="member-info">
                <h4>${user.name}</h4>
                <p class="member-status">${user.status}</p>
            </div>
        `;
        membersList.appendChild(memberEl);
    });
}

// Utility function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Placeholder functions for additional features
function initiateCall() {
    showNotification('Voice call feature coming soon!', 'info');
}

function initiateVideoCall() {
    showNotification('Video call feature coming soon!', 'info');
}

function attachFile() {
    showNotification('File attachment feature coming soon!', 'info');
}

function showEmojiPicker() {
    showNotification('Emoji picker feature coming soon!', 'info');
}

function showSettingsModal() {
    showNotification('Settings coming soon!', 'info');
}

function showProfile() {
    showNotification(`Profile: ${authManager.currentUser.name}`, 'info');
}

function showSettings() {
    showNotification('Settings coming soon!', 'info');
}

function showAbout() {
    showNotification('SAGE ChatApp v1.0 - Professional Chat Application', 'info');
}

function toggleChannelInfo() {
    showNotification('Channel info coming soon!', 'info');
}

// Setup event listeners
function setupEventListeners() {
    // Send message on Enter key
    document.getElementById('messageInput')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Search channels
    document.getElementById('searchChannels')?.addEventListener('input', (e) => {
        const query = e.target.value;
        const results = chatManager.searchChannels(query);
        const channelsList = document.getElementById('channelsList');

        channelsList.innerHTML = '';

        results.forEach(channel => {
            const button = document.createElement('button');
            button.className = 'channel-item';
            button.innerHTML = `
                <i class="fas ${channel.icon}"></i>
                <span>${channel.name}</span>
            `;
            button.onclick = () => selectChannel(channel.id);
            channelsList.appendChild(button);
        });
    });

    // Focus on message input when page loads
    setTimeout(() => {
        document.getElementById('messageInput')?.focus();
    }, 500);
}

// Auto-load chat if user is authenticated
window.addEventListener('load', () => {
    if (authManager.isAuthenticated()) {
        setTimeout(() => {
            initializeChat();
        }, 100);
    }
});