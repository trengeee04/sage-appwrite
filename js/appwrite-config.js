// ============================================
// SAGE ChatApp - Appwrite Configuration
// Database and Real-time Messaging Setup
// ============================================

// Appwrite Configuration
const APPWRITE_CONFIG = {
    endpoint: 'https://cloud.appwrite.io/v1',
    projectId: '69908279003c2040b279',
    databaseId: '69908279003c2040b279',
    
    // Collection IDs
    collections: {
        users: 'users_collection',
        channels: 'channels_collection',
        messages: 'messages_collection',
        directMessages: 'direct_messages_collection',
        members: 'channel_members_collection'
    },
    
    // Bucket ID for file uploads (optional)
    bucketId: 'chat_files'
};

// Global variables
let Query = null;
var appwriteService = null;

// Wait for Appwrite SDK to load
const initAppwriteServices = async () => {
    try {
        // Wait for Appwrite SDK
        if (typeof window.Appwrite === 'undefined') {
            setTimeout(initAppwriteServices, 100);
            return;
        }

        const { Client, Account, Databases, Query: AppwriteQuery } = window.Appwrite;
        Query = AppwriteQuery;

        // Initialize Appwrite
        appwriteService = new AppwriteService();
        console.log('✅ Appwrite services initialized');
    } catch (error) {
        console.error('❌ Appwrite initialization error:', error);
    }
};

// Initialize Appwrite
class AppwriteService {
    constructor() {
        const { Client, Account, Databases } = window.Appwrite;
        
        this.client = new Client();
        this.account = null;
        this.databases = null;
        this.realtime = null;
        
        this.initializeClient();
    }

    // Initialize Appwrite client
    initializeClient() {
        try {
            const { Account, Databases } = window.Appwrite;
            
            this.client
                .setEndpoint(APPWRITE_CONFIG.endpoint)
                .setProject(APPWRITE_CONFIG.projectId);
            
            this.account = new Account(this.client);
            this.databases = new Databases(this.client);
            this.realtime = new RealtimeService(this.client);
            
            console.log('✅ Appwrite initialized successfully');
        } catch (error) {
            console.error('❌ Appwrite initialization error:', error);
        }
    }

    // Get client instance
    getClient() {
        return this.client;
    }

    // Get databases instance
    getDatabases() {
        return this.databases;
    }

    // Get account instance
    getAccount() {
        return this.account;
    }

    // Get realtime instance
    getRealtimeService() {
        return this.realtime;
    }
}

// Real-time Service for subscriptions
class RealtimeService {
    constructor(client) {
        this.client = client;
        this.subscriptions = {};
    }

    // Subscribe to messages
    subscribeToMessages(channelId, callback) {
        const unsubscribe = this.client.subscribe(
            `databases.${APPWRITE_CONFIG.databaseId}.collections.${APPWRITE_CONFIG.collections.messages}.documents`,
            (response) => {
                const event = response.events[0];
                
                // Filter messages by channel
                if (response.payload.channelId === channelId) {
                    if (event.includes('create') || event.includes('update')) {
                        callback({
                            type: 'message',
                            action: event.includes('create') ? 'create' : 'update',
                            data: response.payload
                        });
                    } else if (event.includes('delete')) {
                        callback({
                            type: 'message',
                            action: 'delete',
                            data: response.payload
                        });
                    }
                }
            }
        );

        this.subscriptions[`messages_${channelId}`] = unsubscribe;
        return unsubscribe;
    }

    // Subscribe to channels
    subscribeToChannels(callback) {
        const unsubscribe = this.client.subscribe(
            `databases.${APPWRITE_CONFIG.databaseId}.collections.${APPWRITE_CONFIG.collections.channels}.documents`,
            (response) => {
                const event = response.events[0];
                
                if (event.includes('create') || event.includes('update')) {
                    callback({
                        type: 'channel',
                        action: event.includes('create') ? 'create' : 'update',
                        data: response.payload
                    });
                } else if (event.includes('delete')) {
                    callback({
                        type: 'channel',
                        action: 'delete',
                        data: response.payload
                    });
                }
            }
        );

        this.subscriptions.channels = unsubscribe;
        return unsubscribe;
    }

    // Subscribe to user status
    subscribeToUserStatus(userId, callback) {
        const unsubscribe = this.client.subscribe(
            `databases.${APPWRITE_CONFIG.databaseId}.collections.${APPWRITE_CONFIG.collections.users}.documents`,
            (response) => {
                if (response.payload.$id === userId) {
                    callback({
                        type: 'user',
                        data: response.payload
                    });
                }
            }
        );

        this.subscriptions[`user_${userId}`] = unsubscribe;
        return unsubscribe;
    }

    // Unsubscribe from a channel
    unsubscribe(key) {
        if (this.subscriptions[key]) {
            this.subscriptions[key]();
            delete this.subscriptions[key];
        }
    }

    // Unsubscribe all
    unsubscribeAll() {
        Object.keys(this.subscriptions).forEach(key => {
            this.subscriptions[key]();
        });
        this.subscriptions = {};
    }
}

// ============================================
// Collection Schema Setup Guide
// ============================================
/*
MANUAL SETUP REQUIRED IN APPWRITE DASHBOARD:

1. USERS COLLECTION (users_collection)
   Attributes:
   - userId (String) - Primary Key
   - name (String) - Required
   - username (String) - Required, Unique
   - email (String) - Required, Unique
   - passwordHash (String) - Required
   - avatar (String)
   - status (String) - Enum: online, offline, away
   - createdAt (DateTime)
   - lastLogin (DateTime)
   - permissions: Public can read list, only self can update

2. CHANNELS COLLECTION (channels_collection)
   Attributes:
   - channelId (String) - Primary Key
   - name (String) - Required, Unique
   - displayName (String)
   - icon (String)
   - description (String)
   - type (String) - Enum: channel, dm
   - creator (String) - UserID
   - members (String Array) - UserIDs
   - createdAt (DateTime)
   - updatedAt (DateTime)
   - permissions: Public can read list

3. MESSAGES COLLECTION (messages_collection)
   Attributes:
   - messageId (String) - Primary Key
   - channelId (String) - Required, Index
   - authorId (String) - Required
   - author (String)
   - authorName (String)
   - text (String) - Required
   - timestamp (DateTime)
   - avatar (String)
   - edited (Boolean)
   - editedAt (DateTime)
   - reactions (JSON) - Optional
   - permissions: Author can update/delete, public can read

4. DIRECT_MESSAGES COLLECTION (direct_messages_collection)
   Attributes:
   - dmId (String) - Primary Key
   - conversationId (String) - Required, Index
   - participants (String Array) - 2 UserIDs
   - messages (String Array) - Message IDs
   - createdAt (DateTime)
   - updatedAt (DateTime)
   - lastMessage (String)
   - lastMessageTime (DateTime)

5. CHANNEL_MEMBERS COLLECTION (channel_members_collection)
   Attributes:
   - memberId (String) - Primary Key
   - channelId (String) - Required
   - userId (String) - Required
   - joinedAt (DateTime)
   - role (String) - Enum: admin, member, moderator
   - permissions: Members can only see their own

STEPS TO CREATE COLLECTIONS:
1. Go to Appwrite Dashboard
2. Navigate to Database
3. Create each collection with the schema above
4. Set appropriate permissions for each
5. Enable real-time for: messages, channels, users
*/

// Helper function to setup collections (optional - manual setup recommended)
async function setupCollections() {
    try {
        const databases = appwriteService.getDatabases();
        
        // Create Users Collection
        console.log('Setting up collections...');
        // Note: Collections should be created through Appwrite Dashboard for best results
        
        showNotification('Collections should be created via Appwrite Dashboard', 'info');
    } catch (error) {
        console.error('Collection setup error:', error);
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { appwriteService, APPWRITE_CONFIG, setupCollections, Query };
}

// Make Query globally available
window.AppwriteQuery = () => Query;
window.getAppwriteService = () => appwriteService;

// Initialize on document load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAppwriteServices);
} else {
    initAppwriteServices();
}
