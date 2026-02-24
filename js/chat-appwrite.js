// ============================================
// SAGE ChatApp - Chat Module with Appwrite
// Real-time messaging and channels
// ============================================

class ChatManager {
    constructor() {
        this.channels = {};
        this.messages = {};
        this.currentChannel = null;
        this.databases = null;
        this.client = null;
        this.realtime = null;
        this.subscriptions = {};

        this.init();
    }

    async init() {
        // Wait for Appwrite to be initialized in appwrite-config.js
        if (window.appwriteDatabases && window.appwriteClient && window.appwriteRealtime) {
            this.databases = window.appwriteDatabases;
            this.client = window.appwriteClient;
            this.realtime = window.appwriteRealtime;

            // Only initialize if user is logged in
            if (authManager.currentUser) {
                await this.initializeDefaultChannels();
            }
        } else {
            setTimeout(() => this.init(), 100);
        }
    }

    // Initialize default channels in Appwrite
    async initializeDefaultChannels() {
        try {
            // Fetch channels from Appwrite
            // Fetch channels from Appwrite
            // Fetch channels from Appwrite
            const response = await this.databases.listDocuments(
                APPWRITE_CONFIG.databaseId,
                APPWRITE_CONFIG.collections.channels
            );

            this.channels = {}; // Reset local cache

            if (response.documents.length > 0) {
                response.documents.forEach(doc => {
                    let members = [];
                    try {
                        members = typeof doc.members === 'string' ? JSON.parse(doc.members) : doc.members || [];
                    } catch (e) {
                        members = [];
                    }

                    this.channels[doc.name] = {
                        id: doc.$id,
                        name: doc.name,
                        displayName: doc.displayName || doc.name,
                        icon: doc.icon || 'fa-hash',
                        description: doc.description || '',
                        type: doc.type || 'channel',
                        members: members,
                        createdAt: doc.createdAt
                    };
                });
            } else {
                // No channels found, maybe create defaults if permission allows?
                // For now, just log.
                console.log('ℹ️ No channels found.');
            }

            this.subscribeToChannels();
            renderChannels();

            // Select first channel if available
            const firstChannel = Object.values(this.channels)[0];
            if (firstChannel) {
                selectChannel(firstChannel.id);
            }

        } catch (error) {
            console.error('❌ Error fetching channels:', error);
            showNotification('Could not load channels', 'error');
        }
    }

    // Load messages from Appwrite
    async loadMessages(channelId) {
        try {
            const { Query } = window.Appwrite;
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
            console.error('❌ Error loading messages:', error);
            // Return empty array on error to prevent UI crash
            return [];
        }
    }

    // Send message
    async sendMessage(channelId, text) {
        if (!text.trim() || !this.currentChannel) return;

        try {
            const currentUser = authManager.currentUser;

            const messageData = {
                channelId: channelId,
                authorId: currentUser.id,
                author: currentUser.username,
                authorName: currentUser.name,
                text: text.trim(),
                timestamp: new Date().toISOString(),
                avatar: currentUser.avatar,
                edited: false,
                editedAt: null
            };

            await this.databases.createDocument(
                APPWRITE_CONFIG.databaseId,
                APPWRITE_CONFIG.collections.messages,
                window.AppwriteID.unique(),
                messageData
            );

            console.log('✅ Message sent successfully (HTTP 201):', messageData);

            // Optimistic update is not strictly needed with fast realtime, 
            // but we rely on realtime subscription to add it to the list.

        } catch (error) {
            console.error('❌ Error sending message:', error);
            showNotification('Failed to send message', 'error');
        }
    }

    // Get all messages for a channel
    getChannelMessages(channelId) {
        return this.messages[channelId] || [];
    }

    // Create new channel
    async createChannel(name, description = '') {
        if (!name) return { success: false, message: 'Channel name is required' };

        try {
            const channelName = name.toLowerCase().replace(/\s+/g, '-');
            const currentUser = authManager.currentUser;

            const channelData = {
                name: channelName,
                displayName: name,
                icon: 'fa-hash',
                description: description,
                type: 'channel',
                creator: currentUser.id,
                members: JSON.stringify([currentUser.id]), // Store as JSON string
                createdAt: new Date().toISOString()
            };

            await this.databases.createDocument(
                APPWRITE_CONFIG.databaseId,
                APPWRITE_CONFIG.collections.channels,
                window.AppwriteID.unique(),
                channelData
            );

            return { success: true, message: 'Channel created' };

        } catch (error) {
            console.error('❌ Error creating channel:', error);
            return { success: false, message: error.message };
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

    // Search channels
    searchChannels(query) {
        if (!query) return this.getAllChannels();
        const lowerQuery = query.toLowerCase();
        return this.getAllChannels().filter(ch =>
            ch.name.includes(lowerQuery) ||
            (ch.description && ch.description.toLowerCase().includes(lowerQuery))
        );
    }

    // Subscribe to real-time messages
    subscribeToMessages(channelId) {
        // Unsubscribe from previous channel messages if any
        if (this.subscriptions['current_messages']) {
            this.subscriptions['current_messages']();
            delete this.subscriptions['current_messages'];
        }

        try {
            // Channel subscription: databases.<DB_ID>.collections.<COLL_ID>.documents
            const channelString = `databases.${APPWRITE_CONFIG.databaseId}.collections.${APPWRITE_CONFIG.collections.messages}.documents`;

            console.log('🔌 Generated Channel String:', channelString);

            // DEBUG: Subscribe to account channel to test basic connectivity
            this.realtime.subscribe('account', (response) => {
                console.log('👤 DEBUG: Account Event Received:', response);
            });

            const unsubscribe = this.realtime.subscribe(
                channelString,
                (response) => {
                    const events = response.events;
                    const payload = response.payload;
                    console.log('📨 Realtime Event Received:', events[0]);
                    console.log('📨 Message Payload:', payload);
                    console.log('🔍 Event Channel Source:', response.channels);

                    // Filter messages by channel
                    // Standard Appwrite uses 'documents' instead of 'rows', checking both
                    if (payload.channelId === channelId) {
                        // Check for event types
                        const isCreate = events.some(e => e.endsWith('.create'));
                        const isUpdate = events.some(e => e.endsWith('.update'));
                        const isDelete = events.some(e => e.endsWith('.delete'));

                        if (isCreate) {
                            if (!this.messages[channelId]) this.messages[channelId] = [];

                            // Adapt payload to message structure
                            const newMessage = {
                                id: payload.$id,
                                author: payload.author,
                                authorName: payload.authorName,
                                authorId: payload.authorId,
                                text: payload.text,
                                timestamp: payload.timestamp,
                                avatar: payload.avatar,
                                edited: payload.edited,
                                editedAt: payload.editedAt
                            };

                            // Avoid duplicates
                            if (!this.messages[channelId].find(m => m.id === newMessage.id)) {
                                this.messages[channelId].push(newMessage);
                                console.log('📥 New Message Added to Chat:', newMessage.text, 'by', newMessage.authorName);
                            }

                        } else if (isUpdate) {
                            // Handle update
                            const index = this.messages[channelId]?.findIndex(m => m.id === payload.$id);
                            if (index !== -1 && index !== undefined) {
                                this.messages[channelId][index] = {
                                    ...this.messages[channelId][index],
                                    text: payload.text,
                                    edited: payload.edited,
                                    editedAt: payload.editedAt
                                };
                            }
                        } else if (isDelete) {
                            // Handle delete
                            this.messages[channelId] = this.messages[channelId].filter(m => m.id !== payload.$id);
                        }

                        // Re-render
                        if (this.currentChannel === channelId) {
                            renderMessages();
                        }
                    }
                }
            );

            this.subscriptions['current_messages'] = unsubscribe;
            console.log(`📡 Subscribed to messages for ${channelId}`);

        } catch (error) {
            console.error('❌ Subscription error:', error);
        }
    }

    // Subscribe to channels list updates
    subscribeToChannels() {
        if (this.subscriptions['channels']) return;

        try {
            const channelString = `databases.${APPWRITE_CONFIG.databaseId}.collections.${APPWRITE_CONFIG.collections.channels}.documents`;

            console.log('🔌 Generated Channel String (Channels):', channelString);

            const unsubscribe = this.realtime.subscribe(
                channelString,
                (response) => {
                    const events = response.events;
                    const payload = response.payload;
                    console.log('📡 Realtime Channel Event:', events[0], payload);

                    const isCreate = events.some(e => e.endsWith('.create'));
                    const isUpdate = events.some(e => e.endsWith('.update'));
                    const isDelete = events.some(e => e.endsWith('.delete'));

                    if (isCreate || isUpdate) {
                        let members = [];
                        try {
                            members = typeof payload.members === 'string' ? JSON.parse(payload.members) : payload.members || [];
                        } catch (e) {
                            members = [];
                        }

                        this.channels[payload.name] = {
                            id: payload.$id,
                            name: payload.name,
                            displayName: payload.displayName || payload.name,
                            icon: payload.icon || 'fa-hash',
                            description: payload.description || '',
                            type: payload.type || 'channel',
                            members: members,
                            createdAt: payload.createdAt
                        };
                        renderChannels();
                    } else if (isDelete) {
                        delete this.channels[payload.name];
                        renderChannels();
                    }
                }
            );

            this.subscriptions['channels'] = unsubscribe;
            console.log('📡 Subscribed to global channel updates');

        } catch (error) {
            console.error('❌ Channel subscription error:', error);
        }
    }

    // Cleanup
    cleanup() {
        Object.values(this.subscriptions).forEach(unsub => unsub());
        this.subscriptions = {};
        this.messages = {};
        this.channels = {};
        this.currentChannel = null;
    }
}

// Initialize chat manager
const chatManager = new ChatManager();

// ============================================
// UI Rendering Functions
// ============================================

async function initializeChat() {
    // Auth manager calls this when session is valid.
    // ChatManager init relies on window.appwrite* which usually is ready by now.
    // Explicitly re-trigger init to be sure
    chatManager.init();

    const profileUsername = document.getElementById('profileUsername');
    if (profileUsername && authManager.currentUser) {
        profileUsername.textContent = authManager.currentUser.name;
    }

    showNotification(`Welcome, ${authManager.currentUser.name}!`, 'success');
}

// Render all channels in sidebar
function renderChannels() {
    const channelsList = document.getElementById('channelsList');
    const channels = chatManager.getAllChannels();

    channelsList.innerHTML = '';

    if (channels.length === 0) {
        channelsList.innerHTML = '<div style="padding: 10px; color: #72767d; font-size: 0.9em;">No channels found.</div>';
    }

    channels.forEach(channel => {
        const button = document.createElement('button');
        button.className = 'channel-item';
        // Add active class if it matches current channel
        if (chatManager.currentChannel === channel.id) {
            button.classList.add('active');
        }

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
        if (chatManager.currentChannel === channelId) return;

        chatManager.currentChannel = channelId;

        // Update active button UI
        document.querySelectorAll('.channel-item').forEach(btn => {
            btn.classList.remove('active');
        });

        // Find the button again (DOM might have changed) or update active state during render
        renderChannels();

        // Get channel info
        const channel = chatManager.getChannel(channelId);
        if (!channel) return;

        // Update header
        document.getElementById('channelName').textContent = '# ' + channel.displayName;
        document.getElementById('channelDescription').textContent = channel.description;

        // Load messages
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

    messagesArea.innerHTML = '';

    if (!messages || messages.length === 0) {
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
}

// Show create channel modal
function showCreateChannelModal() {
    const name = prompt('Enter channel name:');
    if (!name) return;

    const description = prompt('Enter channel description (optional):');

    // Fire and forget
    chatManager.createChannel(name, description || '')
        .then(result => {
            if (result.success) {
                showNotification(result.message, 'success');
            } else {
                showNotification(result.message, 'error');
            }
        });
}


// Logout user
async function logout() {
    if (confirm('Are you sure you want to logout?')) {
        chatManager.cleanup();
        await authManager.logout();
    }
}

// Toggle member list
function toggleMemberList() {
    const rightSidebar = document.getElementById('rightSidebar');
    rightSidebar.classList.toggle('active');
    if (rightSidebar.classList.contains('active')) {
        renderMembers();
    }
}

// Render members list (Available users in the system)
async function renderMembers() {
    const membersList = document.getElementById('membersList');
    // For now, load all users. In a real app, this should be channel members.
    // However, checking channel members requires more complex permissions/queries.
    // We will list all users for demonstration.
    const allUsers = await authManager.getAllUsers();

    membersList.innerHTML = '';

    allUsers.forEach(user => {
        const memberEl = document.createElement('div');
        memberEl.className = 'member-item';
        memberEl.innerHTML = `
            <div class="member-avatar">${user.avatar}</div>
            <div class="member-info">
                <h4>${user.name}</h4>
                <p class="member-status">${user.status || 'offline'}</p>
            </div>
        `;
        membersList.appendChild(memberEl);
    });
}

// Utility function to escape HTML
function escapeHtml(text) {
    if (!text) return '';
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

// Toggle user menu
function toggleUserMenu() {
    const menu = document.getElementById('userMenu');
    menu.classList.toggle('active');
}

// Close user menu when clicking outside
document.addEventListener('click', (e) => {
    const menu = document.getElementById('userMenu');
    const fab = document.getElementById('fabMenu');
    
    if (menu.classList.contains('active') && 
        !menu.contains(e.target) && 
        !fab.contains(e.target)) {
        menu.classList.remove('active');
    }
});

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
            if (chatManager.currentChannel === channel.id) {
                button.classList.add('active');
            }
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

// Call setup listeners on load (if not called by auth)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupEventListeners);
} else {
    setupEventListeners();
}

// Auto-load chat if user is authenticated
// Auto-load chat if user is authenticated
window.addEventListener('load', () => {
    const checkAuth = () => {
        if (window.authManager && window.authManager.isAuthenticated()) {
            initializeChat();
        } else if (!window.authManager) {
            // Retry if authManager not yet loaded
            setTimeout(checkAuth, 100);
        }
    };
    checkAuth();
});
