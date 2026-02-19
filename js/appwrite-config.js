// ============================================
// SAGE ChatApp - Appwrite Configuration
// Database and Real-time Messaging Setup
// ============================================

// Appwrite Configuration
const APPWRITE_CONFIG = {
    endpoint: 'https://cloud.appwrite.io/v1',
    projectId: '6784f3ac003b5c912256',
    databaseId: '6784f57b0000a70f1b79',

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
let client = null;
let account = null;
let databases = null;
let realtime = null;

// Initialize Appwrite SDK
const initAppwrite = () => {
    try {
        const { Client, Account, Databases, Realtime, ID } = window.Appwrite;
        console.log('SDK Keys:', Object.keys(window.Appwrite));


        client = new Client();
        client
            .setEndpoint(APPWRITE_CONFIG.endpoint)
            .setProject(APPWRITE_CONFIG.projectId);

        account = new Account(client);
        databases = new Databases(client);

        if (Realtime) {
            realtime = new Realtime(client);
        } else {
            console.warn('Realtime class not found in SDK, falling back to client.subscribe');
            realtime = client;
        }

        // Export for other modules
        window.appwriteClient = client;
        window.appwriteAccount = account;
        window.appwriteDatabases = databases;
        window.appwriteRealtime = realtime; // Export Service Instance
        window.AppwriteID = ID;             // Export ID helper

        console.log('✅ Appwrite SDK initialized (Databases)');
    } catch (error) {
        console.error('❌ Appwrite SDK initialization error:', error);
    }
};

// Initialize on load
if (window.Appwrite) {
    initAppwrite();
} else {
    window.addEventListener('load', initAppwrite);
}

// Export for other modules (via window for legacy script loading)
// Assigned inside initAppwrite

