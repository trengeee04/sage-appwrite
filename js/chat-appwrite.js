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
            // Show loading shimmers
            renderChannelShimmers();

            // Fetch channels from Appwrite
            const response = await this.databases.listDocuments(
                APPWRITE_CONFIG.databaseId,
                APPWRITE_CONFIG.collections.channels
            );

            this.channels = {}; // Reset local cache

            if (response.documents.length > 0) {
                response.documents.forEach(doc => {
                    // Members is now an array of relationship objects or IDs
                    let members = Array.isArray(doc.members) ? doc.members.map(m => m.$id || m) : [];

                    this.channels[doc.name] = {
                        id: doc.$id,
                        name: doc.name,
                        displayName: doc.displayName || doc.name,
                        icon: doc.icon || 'fa-hash',
                        description: doc.description || '',
                        type: doc.type || 'channel',
                        creator: doc.creator,
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
            // Show Shimmers
            renderMessageShimmers();

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
                members: [currentUser.id], // Send array of document IDs for relationship
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

    // Get channels the user is a member of
    getJoinedChannels() {
        const userId = authManager.currentUser?.id;
        return this.getAllChannels().filter(ch => ch.members.includes(userId) || ch.creator === userId);
    }

    // Get channels the user is NOT a member of
    getOtherChannels() {
        const userId = authManager.currentUser?.id;
        return this.getAllChannels().filter(ch => !ch.members.includes(userId) && ch.creator !== userId);
    }

    // Get channel by ID
    getChannel(channelId) {
        return Object.values(this.channels).find(ch => ch.id === channelId);
    }

    // Leave a channel
    async leaveChannel(channelId) {
        try {
            const userId = authManager.currentUser?.id;
            if (!userId) return { success: false, message: 'Not logged in' };

            const channel = this.getChannel(channelId);
            if (!channel) return { success: false, message: 'Channel not found' };

            // Cannot leave if you are the creator
            if (channel.creator === userId) {
                return { success: false, message: 'Creators cannot leave their own channel. Delete it instead.' };
            }

            // Relationship arrays in Appwrite return object IDs when updated
            const currentMembersIds = channel.members.map(m => m.$id || m);

            if (!currentMembersIds.includes(userId)) {
                return { success: false, message: 'You are not a member of this channel' };
            }

            const updatedMembers = currentMembersIds.filter(id => id !== userId);

            await this.databases.updateDocument(
                APPWRITE_CONFIG.databaseId,
                APPWRITE_CONFIG.collections.channels,
                channelId,
                {
                    members: updatedMembers
                }
            );

            return { success: true, message: 'Successfully left channel.' };
        } catch (error) {
            console.error('Leaving channel error:', error);
            return { success: false, message: 'Could not leave channel.' };
        }
    }

    // Delete a channel
    async deleteChannel(channelId) {
        try {
            const userId = authManager.currentUser?.id;
            if (!userId) return { success: false, message: 'Not logged in' };

            const channel = this.getChannel(channelId);
            if (!channel) return { success: false, message: 'Channel not found' };

            if (channel.creator !== userId) {
                return { success: false, message: 'Only the creator can delete this channel' };
            }

            await this.databases.deleteDocument(
                APPWRITE_CONFIG.databaseId,
                APPWRITE_CONFIG.collections.channels,
                channelId
            );

            // Clean up messages (optional in Appwrite if using Set Null / Cascade relationships, but manual cleanup is safe)
            /*
            const messages = this.getChannelMessages(channelId);
            for (let msg of messages) {
                await this.databases.deleteDocument(APPWRITE_CONFIG.databaseId, APPWRITE_CONFIG.collections.messages, msg.id);
            }
            */

            return { success: true, message: 'Channel deleted successfully.' };
        } catch (error) {
            console.error('Deleting channel error:', error);
            return { success: false, message: 'Could not delete channel. Check permissions.' };
        }
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

    // Join a channel
    async joinChannel(channelId) {
        try {
            const channel = this.getChannel(channelId);
            if (!channel) throw new Error('Channel not found');

            const currentUser = authManager.currentUser;
            if (channel.members.includes(currentUser.id)) return { success: true }; // Already joined

            const updatedMembers = [...channel.members, currentUser.id];

            await this.databases.updateDocument(
                APPWRITE_CONFIG.databaseId,
                APPWRITE_CONFIG.collections.channels,
                channelId,
                { members: updatedMembers }
            );

            return { success: true, message: 'Joined channel successfully' };
        } catch (error) {
            console.error('❌ Error joining channel:', error);
            return { success: false, message: error.message };
        }
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
                        // Members is now an array of relationship objects or IDs
                        let members = Array.isArray(payload.members) ? payload.members.map(m => m.$id || m) : [];

                        this.channels[payload.name] = {
                            id: payload.$id,
                            name: payload.name,
                            displayName: payload.displayName || payload.name,
                            icon: payload.icon || 'fa-hash',
                            description: payload.description || '',
                            type: payload.type || 'channel',
                            creator: payload.creator,
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

// ============================================
// Shimmer Loading UI
// ============================================

function renderChannelShimmers() {
    const list = document.getElementById('channelsList');
    if (list) list.innerHTML = Array(3).fill('<div class="shimmer-wrapper shimmer-channel"></div>').join('');

    const otherList = document.getElementById('otherChannelsList');
    if (otherList) otherList.innerHTML = Array(3).fill('<div class="shimmer-wrapper shimmer-channel"></div>').join('');
}

function renderMessageShimmers() {
    const area = document.getElementById('messagesArea');
    if (area) area.innerHTML = Array(5).fill(`
        <div class="shimmer-message">
            <div class="shimmer-wrapper shimmer-avatar"></div>
            <div class="shimmer-lines">
                <div class="shimmer-wrapper shimmer-line short"></div>
                <div class="shimmer-wrapper shimmer-line long"></div>
                <div class="shimmer-wrapper shimmer-line medium"></div>
            </div>
        </div>
    `).join('');
}

function renderMemberShimmers() {
    const list = document.getElementById('membersList');
    if (list) list.innerHTML = Array(5).fill(`
         <div class="shimmer-member">
            <div class="shimmer-wrapper shimmer-avatar"></div>
            <div class="shimmer-lines">
                <div class="shimmer-wrapper shimmer-line medium"></div>
                <div class="shimmer-wrapper shimmer-line short"></div>
            </div>
        </div>
     `).join('');
}

// Render all channels in sidebar
function renderChannels() {
    const channelsList = document.getElementById('channelsList');
    // We will dynamically create a container for "Other Channels" if it doesn't exist
    let otherChannelsList = document.getElementById('otherChannelsList');

    if (!otherChannelsList) {
        // Find the sidebar to append the new section after Your Channels
        const channelsSection = channelsList.parentElement;

        const otherSection = document.createElement('div');
        otherSection.className = 'channels-section';
        otherSection.innerHTML = `
            <h3 class="section-title">Other Channels</h3>
            <div id="otherChannelsList" class="channels-list"></div>
        `;
        channelsSection.parentElement.insertBefore(otherSection, channelsSection.nextSibling);
        otherChannelsList = document.getElementById('otherChannelsList');

        // Update the title of the original section to be clearer
        channelsSection.querySelector('.section-title').textContent = 'Your Channels';
    }

    const joinedChannels = chatManager.getJoinedChannels();
    const otherChannels = chatManager.getOtherChannels();

    // Render Joined Channels
    channelsList.innerHTML = '';
    if (joinedChannels.length === 0) {
        channelsList.innerHTML = '<div style="padding: 10px; color: #72767d; font-size: 0.9em;">Join a channel to start.</div>';
    } else {
        joinedChannels.forEach(channel => {
            const button = document.createElement('button');
            button.className = 'channel-item';
            if (chatManager.currentChannel === channel.id) button.classList.add('active');

            button.innerHTML = `
                <i class="fas ${channel.icon}"></i>
                <span>${channel.name}</span>
            `;
            button.onclick = () => selectChannel(channel.id);
            channelsList.appendChild(button);
        });
    }

    // Render Other Channels
    otherChannelsList.innerHTML = '';
    if (otherChannels.length === 0) {
        otherChannelsList.innerHTML = '<div style="padding: 10px; color: #72767d; font-size: 0.9em;">No other channels found.</div>';
    } else {
        otherChannels.forEach(channel => {
            const button = document.createElement('button');
            button.className = 'channel-item other-channel'; // Specific class for styling if needed
            if (chatManager.currentChannel === channel.id) button.classList.add('active');

            button.innerHTML = `
                <i class="fas ${channel.icon}" style="opacity: 0.5;"></i>
                <span style="opacity: 0.7;">${channel.name}</span>
            `;
            button.onclick = () => selectChannel(channel.id);
            otherChannelsList.appendChild(button);
        });
    }
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

        // Check membership to show/hide input
        const userId = authManager.currentUser?.id;
        const isMember = channel.members.includes(userId) || channel.creator === userId;
        const inputArea = document.querySelector('.message-input-area');

        if (!isMember) {
            // Hide input, show a join button placeholder in the message area instead of messages
            inputArea.style.display = 'none';
            // We don't subscribe to messages if they aren't a member (optional, but good for privacy)
            renderJoinPrompt(channel);
            return;
        } else {
            inputArea.style.display = 'flex'; // Restore input area

            // Load messages
            await chatManager.loadMessages(channelId);

            // Subscribe to real-time updates
            chatManager.subscribeToMessages(channelId);

            // Render messages
            renderMessages();
        }
    } catch (error) {
        console.error('Selecting channel error:', error);
        showNotification('Error loading channel', 'error');
    }
}

// Render join prompt instead of messages
function renderJoinPrompt(channel) {
    const messagesArea = document.getElementById('messagesArea');

    messagesArea.innerHTML = `
        <div class="messages-welcome">
            <div class="welcome-icon">
                <i class="fas ${channel.icon}"></i>
            </div>
            <h2>You are previewing #${channel.name}</h2>
            <p>${channel.description || 'Join this channel to see history and start chatting!'}</p>
            <button type="button" class="btn-primary" style="margin-top: 20px;" onclick="joinCurrentChannel()">
                Join Channel
            </button>
        </div>
    `;
}

// Global function to trigger joining the currently selected channel
async function joinCurrentChannel() {
    const channelId = chatManager.currentChannel;
    if (!channelId) return;

    showLoading(true);
    const result = await chatManager.joinChannel(channelId);
    showLoading(false);

    if (result.success) {
        showNotification(result.message, 'success');
        // Manually force a re-select to kickstart message loading immediately
        selectChannel(channelId);
    } else {
        showNotification(result.message, 'error');
    }
}

// Global function to leave the current channel
async function leaveCurrentChannel() {
    const channelId = chatManager.currentChannel;
    if (!channelId) return;

    if (!confirm('Are you sure you want to leave this channel?')) return;

    showLoading(true);
    const result = await chatManager.leaveChannel(channelId);
    showLoading(false);

    if (result.success) {
        showNotification(result.message, 'success');
        toggleMemberList(); // Close member list

        // Select first available channel or clear chat area
        const joinedChannels = chatManager.getJoinedChannels();
        if (joinedChannels.length > 0) {
            selectChannel(joinedChannels[0].id);
        } else {
            // Re-render the "Join" prompt for the detached channel
            selectChannel(channelId);
        }
    } else {
        showNotification(result.message, 'error');
    }
}

// Global function to delete the current channel
async function deleteCurrentChannel() {
    const channelId = chatManager.currentChannel;
    if (!channelId) return;

    if (!confirm('Are you ABSOLUTELY sure you want to delete this channel? This cannot be undone.')) return;

    showLoading(true);
    const result = await chatManager.deleteChannel(channelId);
    showLoading(false);

    if (result.success) {
        showNotification(result.message, 'success');
        toggleMemberList(); // Close member list

        // Reset state since it's deleted. Appwrite realtime should trigger channels refresh.
        chatManager.currentChannel = null;
        document.getElementById('channelName').textContent = 'Select a channel';
        document.getElementById('channelDescription').textContent = '';
        document.getElementById('messagesArea').innerHTML = `
            <div class="messages-welcome">
                <div class="welcome-icon">
                    <i class="fas fa-comments"></i>
                </div>
                <h2>Channel Deleted</h2>
                <p>Select another channel to start chatting</p>
            </div>
        `;
        document.querySelector('.message-input-area').style.display = 'none';

        const joinedChannels = chatManager.getJoinedChannels();
        if (joinedChannels.length > 0) selectChannel(joinedChannels[0].id);
    } else {
        showNotification(result.message, 'error');
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
    const headerTitle = document.querySelector('#rightSidebar .sidebar-header h2');

    const currentChannelId = chatManager.currentChannel;
    if (!currentChannelId) return;

    const channel = chatManager.getChannel(currentChannelId);
    if (!channel) return;

    // Get all member IDs for this channel (creator + members array)
    const membersIds = channel.members.map(m => m.$id || m); // Extract IDs from Appwrite relationship objects
    if (channel.creator && !membersIds.includes(channel.creator)) {
        membersIds.push(channel.creator);
    }
    const channelMemberIds = new Set(membersIds);

    // Show shimmers while loading
    renderMemberShimmers();

    // In a real production app, this should be a queried search, but here we can load all and filter
    const allUsers = await authManager.getAllUsers();

    // Filter users to only include members of the current channel
    const channelMembers = allUsers.filter(user => channelMemberIds.has(user.id));

    // Update member count in the header
    if (headerTitle) {
        headerTitle.textContent = `Members (${channelMembers.length})`;
    }

    membersList.innerHTML = '';

    if (channelMembers.length === 0) {
        membersList.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-tertiary); font-size: 14px;">No members found</div>';
        return;
    }

    channelMembers.forEach(user => {
        const memberEl = document.createElement('div');
        memberEl.className = 'member-item';

        // Indicate creator nicely
        const isCreator = user.id === channel.creator;
        const creatorBadge = isCreator ? '<i class="fas fa-crown" style="color: var(--warning-color); font-size: 10px; margin-left: 5px;" title="Channel Creator"></i>' : '';

        memberEl.innerHTML = `
            <div class="member-avatar">${user.avatar}</div>
            <div class="member-info">
                <h4>${user.name}${creatorBadge}</h4>
                <p class="member-status">${user.status || 'offline'}</p>
            </div>
        `;
        membersList.appendChild(memberEl);
    });

    // Render Actions for user
    const actionsContainer = document.getElementById('channelActions');
    if (actionsContainer) {
        actionsContainer.innerHTML = '';
        const currentUserId = authManager.currentUser?.id;

        if (channel.creator === currentUserId) {
            // Creator can delete the channel, but not "leave" it directly
            actionsContainer.innerHTML = `
                <button type="button" class="btn-primary flex-fill" style="background: var(--danger-color); width: 100%; border-radius: 6px; border: none; padding: 10px; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 600; transition: transform 0.2s;" onclick="deleteCurrentChannel()" onmouseover="this.style.opacity='0.9';" onmouseout="this.style.opacity='1';">
                    <i class="fas fa-trash"></i> Delete Channel
                </button>
            `;
        } else if (channelMemberIds.has(currentUserId)) {
            // Normal member can leave
            actionsContainer.innerHTML = `
                <button type="button" class="btn-primary flex-fill" style="background: transparent; border: 1px solid var(--danger-color); width: 100%; border-radius: 6px; padding: 10px; color: var(--danger-color); cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 600; transition: all 0.2s;" onclick="leaveCurrentChannel()" onmouseover="this.style.background='rgba(240, 71, 71, 0.1)'; this.style.transform='translateY(-1px)';" onmouseout="this.style.background='transparent'; this.style.transform='translateY(0)';">
                    <i class="fas fa-sign-out-alt"></i> Leave Channel
                </button>
            `;
        }
    }
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
