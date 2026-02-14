// ============================================
// SAGE ChatApp - Chat Module with Appwrite
// Real-time messaging and channels
// ============================================

class ChatManager {
    constructor() {
        this.channels = {};
        this.messages = {};
        this.directMessages = {};
        this.currentChannel = null;
        this.currentUser = authManager.currentUser;
        this.databases = appwriteService.getDatabases();
        this.realtimeService = appwriteService.getRealtimeService();
        this.messageSubscriptions = {};
        this.channelSubscription = null;
    }

    // Initialize default channels in Appwrite
    async initializeDefaultChannels() {
        try {
            // Fetch existing channels from Appwrite
            const response = await this.databases.listDocuments(
                APPWRITE_CONFIG.databaseId,
                APPWRITE_CONFIG.collections.channels
            );

            if (response.documents.length > 0) {
                response.documents.forEach(doc => {
                    this.channels[doc.name] = {
                        id: doc.$id,
                        name: doc.name,
                        displayName: doc.displayName || doc.name,
                        icon: doc.icon || 'fa-hash',
                        description: doc.description || '',
                        type: doc.type || 'channel',
                        members: doc.members || [],
                        createdAt: doc.createdAt
                    };
                });
                return;
            }

            // Create default channels if none exist
            const defaultChannels = [
                {
                    name: 'general',
                    displayName: 'General',
                    icon: 'fa-comments',
                    description: 'General discussion',
                    type: 'channel'
                },
                {
                    name: 'announcements',
                    displayName: 'Announcements',
                    icon: 'fa-bullhorn',
                    description: 'Important announcements',
                    type: 'channel'
                },
                {
                    name: 'random',
                    displayName: 'Random',
                    icon: 'fa-dice',
                    description: 'Random conversations',
                    type: 'channel'
                },
                {
                    name: 'introductions',
                    displayName: 'Introductions',
                    icon: 'fa-handshake',
                    description: 'Introduce yourself',
                    type: 'channel'
                }
            ];

            for (const ch of defaultChannels) {
                const channelId = 'ch_' + Math.random().toString(36).substr(2, 9);
                const channelData = {
                    ...ch,
                    creator: this.currentUser.id,
                    members: [this.currentUser.id],
                    createdAt: new Date().toISOString()
                };

                try {
                    await this.databases.createDocument(
                        APPWRITE_CONFIG.databaseId,
                        APPWRITE_CONFIG.collections.channels,
                        channelId,
                        channelData
                    );

                    this.channels[ch.name] = {
                        id: channelId,
                        ...channelData
                    };
                } catch (error) {
                    console.warn(`Creating channel ${ch.name}:`, error);
                }
            }

            console.log('Default channels initialized');
        } catch (error) {
            console.warn('Initializing channels:', error);
            // Fallback to local channels
            this.loadChannels();
        }
    }

    // Load channels from localStorage (fallback)
    loadChannels() {
        const stored = localStorage.getItem('sage_channels');
        if (stored) {
            this.channels = JSON.parse(stored);
        } else if (Object.keys(this.channels).length === 0) {
            this.initializeDefaultChannelsLocal();
        }
    }

    // Initialize default channels locally
    initializeDefaultChannelsLocal() {
        this.channels = {
            general: {
                id: 'ch_general',
                name: 'general',
                displayName: 'General',
                icon: 'fa-comments',
                description: 'General discussion',
                type: 'channel',
                members: [this.currentUser.id],
                createdAt: new Date().toISOString()
            },
            announcements: {
                id: 'ch_announcements',
                name: 'announcements',
                displayName: 'Announcements',
                icon: 'fa-bullhorn',
                description: 'Important announcements',
                type: 'channel',
                members: [this.currentUser.id],
                createdAt: new Date().toISOString()
            },
            random: {
                id: 'ch_random',
                name: 'random',
                displayName: 'Random',
                icon: 'fa-dice',
                description: 'Random conversations',
                type: 'channel',
                members: [this.currentUser.id],
                createdAt: new Date().toISOString()
            },
            introductions: {
                id: 'ch_introductions',
                name: 'introductions',
                displayName: 'Introductions',
                icon: 'fa-handshake',
                description: 'Introduce yourself',
                type: 'channel',
                members: [this.currentUser.id],
                createdAt: new Date().toISOString()
            }
        };
        this.saveChannels();
    }

    // Save channels to localStorage
    saveChannels() {
        localStorage.setItem('sage_channels', JSON.stringify(this.channels));
    }

    // Load messages from Appwrite
    async loadMessages(channelId) {
        try {
            const response = await this.databases.listDocuments(
                APPWRITE_CONFIG.databaseId,
                APPWRITE_CONFIG.collections.messages,
                [
                    Query.equal('channelId', channelId),
                    Query.orderDesc('timestamp'),
                    Query.limit(50)
                ]
            );

            this.messages[channelId] = response.documents.reverse().map(doc => ({
                id: doc.$id,
                author: doc.author,
                authorName: doc.authorName,
                authorId: doc.authorId,
                text: doc.text,
                timestamp: doc.timestamp,
                avatar: doc.avatar,
                edited: doc.edited || false,
                editedAt: doc.editedAt || null
            }));

            return this.messages[channelId];
        } catch (error) {
            console.warn('Loading messages:', error);
            // Fallback to localStorage
            return this.loadMessagesLocal(channelId);
        }
    }

    // Load messages from localStorage (fallback)
    loadMessagesLocal(channelId) {
        const stored = localStorage.getItem('sage_messages');
        const messages = stored ? JSON.parse(stored) : {};
        return messages[channelId] || [];
    }

    // Save messages to localStorage (fallback)
    saveMessages() {
        localStorage.setItem('sage_messages', JSON.stringify(this.messages));
    }

    // Send message
    async sendMessage(channelId, text) {
        if (!text.trim() || !this.currentChannel) return;

        const messageId = 'msg_' + Math.random().toString(36).substr(2, 9);
        const messageData = {
            channelId: channelId,
            authorId: this.currentUser.id,
            author: this.currentUser.username,
            authorName: this.currentUser.name,
            text: text.trim(),
            timestamp: new Date().toISOString(),
            avatar: this.currentUser.avatar,
            edited: false,
            editedAt: null
        };

        try {
            // Save to Appwrite
            const response = await this.databases.createDocument(
                APPWRITE_CONFIG.databaseId,
                APPWRITE_CONFIG.collections.messages,
                messageId,
                messageData
            );

            console.log('Message sent:', response);

            // Initialize channel messages if needed
            if (!this.messages[channelId]) {
                this.messages[channelId] = [];
            }

            this.messages[channelId].push({
                id: messageId,
                ...messageData
            });

            this.saveMessages();
            return response;
        } catch (error) {
            console.warn('Sending message to Appwrite:', error);
            
            // Fallback: Save to localStorage only
            if (!this.messages[channelId]) {
                this.messages[channelId] = [];
            }

            const message = {
                id: messageId,
                ...messageData
            };

            this.messages[channelId].push(message);
            this.saveMessages();
            return message;
        }
    }

    // Get all messages for a channel
    getChannelMessages(channelId) {
        return this.messages[channelId] || [];
    }

    // Create new channel
    async createChannel(name, description = '') {
        if (!name) return { success: false, message: 'Channel name is required' };

        const channelId = 'ch_' + Math.random().toString(36).substr(2, 9);
        const channelName = name.toLowerCase().replace(/\s+/g, '-');

        const channelData = {
            name: channelName,
            displayName: name,
            icon: 'fa-hash',
            description: description,
            type: 'channel',
            creator: this.currentUser.id,
            members: [this.currentUser.id],
            createdAt: new Date().toISOString()
        };

        try {
            // Save to Appwrite
            const response = await this.databases.createDocument(
                APPWRITE_CONFIG.databaseId,
                APPWRITE_CONFIG.collections.channels,
                channelId,
                channelData
            );

            this.channels[channelName] = {
                id: channelId,
                ...channelData
            };

            this.messages[channelId] = [];
            this.saveChannels();
            this.saveMessages();

            return { success: true, message: 'Channel created', channel: this.channels[channelName] };
        } catch (error) {
            console.warn('Creating channel in Appwrite:', error);
            
            // Fallback: Save to localStorage
            this.channels[channelName] = {
                id: channelId,
                ...channelData
            };
            this.messages[channelId] = [];
            this.saveChannels();
            this.saveMessages();

            return { success: true, message: 'Channel created', channel: this.channels[channelName] };
        }
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

    // Subscribe to real-time messages
    subscribeToMessages(channelId) {
        try {
            if (this.messageSubscriptions[channelId]) {
                return; // Already subscribed
            }

            this.messageSubscriptions[channelId] = this.realtimeService.subscribeToMessages(
                channelId,
                (update) => {
                    console.log('Message update:', update);
                    
                    if (update.type === 'message') {
                        if (update.action === 'create') {
                            if (!this.messages[channelId]) {
                                this.messages[channelId] = [];
                            }
                            this.messages[channelId].push(update.data);
                        } else if (update.action === 'update') {
                            const index = this.messages[channelId].findIndex(m => m.id === update.data.id);
                            if (index !== -1) {
                                this.messages[channelId][index] = update.data;
                            }
                        } else if (update.action === 'delete') {
                            this.messages[channelId] = this.messages[channelId].filter(m => m.id !== update.data.id);
                        }
                        
                        // Re-render messages
                        if (this.currentChannel === channelId) {
                            renderMessages();
                        }
                    }
                }
            );

            console.log('Subscribed to messages for channel:', channelId);
        } catch (error) {
            console.warn('Subscribing to messages:', error);
        }
    }

    // Unsubscribe from messages
    unsubscribeFromMessages(channelId) {
        try {
            if (this.messageSubscriptions[channelId]) {
                this.realtimeService.unsubscribe(`messages_${channelId}`);
                delete this.messageSubscriptions[channelId];
            }
        } catch (error) {
            console.warn('Unsubscribing from messages:', error);
        }
    }

    // Subscribe to channels
    subscribeToChannels() {
        try {
            if (this.channelSubscription) {
                return;
            }

            this.channelSubscription = this.realtimeService.subscribeToChannels((update) => {
                console.log('Channel update:', update);
                
                if (update.type === 'channel') {
                    if (update.action === 'create' || update.action === 'update') {
                        this.channels[update.data.name] = {
                            id: update.data.$id,
                            ...update.data
                        };
                        renderChannels();
                    }
                }
            });

            console.log('Subscribed to channels');
        } catch (error) {
            console.warn('Subscribing to channels:', error);
        }
    }

    // Cleanup on logout
    cleanup() {
        try {
            this.realtimeService.unsubscribeAll();
            this.messageSubscriptions = {};
            this.channelSubscription = null;
        } catch (error) {
            console.warn('Cleanup error:', error);
        }
    }
}

// Initialize chat manager
const chatManager = new ChatManager();

// ============================================
// UI Rendering Functions
// ============================================

async function initializeChat() {
    try {
        // Initialize channels from Appwrite
        await chatManager.initializeDefaultChannels();

        // Update profile in user menu
        const profileUsername = document.getElementById('profileUsername');
        if (profileUsername) {
            profileUsername.textContent = authManager.currentUser.name;
        }

        // Render channels
        renderChannels();

        // Subscribe to channel updates
        chatManager.subscribeToChannels();

        // Select first channel by default
        const firstChannel = chatManager.getAllChannels()[0];
        if (firstChannel) {
            selectChannel(firstChannel.id);
        }

        // Setup event listeners
        setupEventListeners();

        showNotification(`Welcome, ${authManager.currentUser.name}!`, 'success');
    } catch (error) {
        console.error('Chat initialization error:', error);
        showNotification('Error initializing chat', 'error');
    }
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
async function selectChannel(channelId) {
    try {
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
        document.getElementById('channelName').textContent = '# ' + channel.displayName;
        document.getElementById('channelDescription').textContent = channel.description;

        // Load messages from Appwrite
        await chatManager.loadMessages(channelId);

        // Subscribe to real-time updates
        chatManager.subscribeToMessages(channelId);

        // Render messages
        renderMessages();
    } catch (error) {
        console.error('Selecting channel error:', error);
        showNotification('Error loading channel', 'error');
    }
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

    messagesArea.scrollTop = messagesArea.scrollHeight;
}

// Send message
function sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value;

    if (!text.trim()) return;

    chatManager.sendMessage(chatManager.currentChannel, text);

    input.value = '';
    input.focus();

    renderMessages();

    showNotification('Message sent!', 'success');
}

// Show create channel modal
function showCreateChannelModal() {
    const name = prompt('Enter channel name:');
    if (!name) return;

    const description = prompt('Enter channel description (optional):');

    (async () => {
        const result = await chatManager.createChannel(name, description || '');
        if (result.success) {
            renderChannels();
            showNotification(result.message, 'success');
        } else {
            showNotification(result.message, 'error');
        }
    })();
}

// Toggle user menu
function toggleUserMenu() {
    const userMenu = document.getElementById('userMenu');
    userMenu.classList.toggle('active');

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.fab-menu') && !e.target.closest('.user-menu')) {
            userMenu.classList.remove('active');
        }
    });
}

// Logout user
async function logout() {
    if (confirm('Are you sure you want to logout?')) {
        chatManager.cleanup();
        await authManager.logout();
        showAuthContainer(true);
        showNotification('Logged out successfully', 'success');
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
async function renderMembers() {
    const membersList = document.getElementById('membersList');
    const allUsers = await authManager.getAllUsers();

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

// Placeholder functions
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
    document.getElementById('messageInput')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

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
