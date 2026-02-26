// ============================================
// SAGE ChatApp - Collection Auto-Setup
// Creates Appwrite collections using REST API
// ============================================

async function makeAppwriteRequest(method, endpoint, body = null) {
    try {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'X-Appwrite-Project': APPWRITE_CONFIG.projectId,
                'X-Appwrite-Key': APPWRITE_CONFIG.apiKey
            }
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(`${APPWRITE_CONFIG.endpoint}${endpoint}`, options);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(`${response.status}: ${data.message || 'Unknown error'}`);
        }

        return data;
    } catch (error) {
        throw error;
    }
}

async function createCollectionsIfNeeded() {
    try {
        console.log('🔄 Checking and creating collections via REST API...');

        // Collection definitions
        const collections = [
            {
                id: 'users_collection',
                name: 'Users',
                attributes: [
                    { key: 'username', type: 'string', size: 255 },
                    { key: 'email', type: 'string', size: 255 },
                    { key: 'name', type: 'string', size: 255 },
                    { key: 'passwordHash', type: 'string', size: 512 },
                    { key: 'avatar', type: 'string', size: 255 },
                    { key: 'status', type: 'string', size: 50 },
                    { key: 'createdAt', type: 'datetime' },
                    { key: 'lastLogin', type: 'datetime' }
                ]
            },
            {
                id: 'channels_collection',
                name: 'Channels',
                attributes: [
                    { key: 'name', type: 'string', size: 255 },
                    { key: 'displayName', type: 'string', size: 255 },
                    { key: 'icon', type: 'string', size: 100 },
                    { key: 'description', type: 'string', size: 1000 },
                    { key: 'type', type: 'string', size: 50 },
                    { key: 'creator', type: 'string', size: 255 },
                    { key: 'createdAt', type: 'datetime' }
                ]
            },
            {
                id: 'messages_collection',
                name: 'Messages',
                attributes: [
                    { key: 'channelId', type: 'string', size: 255 },
                    { key: 'authorId', type: 'string', size: 255 },
                    { key: 'author', type: 'string', size: 255 },
                    { key: 'authorName', type: 'string', size: 255 },
                    { key: 'text', type: 'string', size: 5000 },
                    { key: 'timestamp', type: 'datetime' },
                    { key: 'avatar', type: 'string', size: 255 },
                    { key: 'edited', type: 'boolean' },
                    { key: 'editedAt', type: 'datetime' }
                ]
            },
            {
                id: 'direct_messages_collection',
                name: 'Direct Messages',
                attributes: [
                    { key: 'conversationId', type: 'string', size: 255 },
                    { key: 'participants', type: 'string', size: 1000 },
                    { key: 'messages', type: 'string', size: 10000 },
                    { key: 'createdAt', type: 'datetime' },
                    { key: 'lastMessage', type: 'string', size: 5000 },
                    { key: 'lastMessageTime', type: 'datetime' }
                ]
            },
            {
                id: 'channel_members_collection',
                name: 'Channel Members',
                attributes: [
                    { key: 'channelId', type: 'string', size: 255 },
                    { key: 'userId', type: 'string', size: 255 },
                    { key: 'joinedAt', type: 'datetime' },
                    { key: 'role', type: 'string', size: 50 }
                ]
            }
        ];

        // Create each collection
        for (const collection of collections) {
            try {
                // Check if collection exists
                try {
                    await makeAppwriteRequest(
                        'GET',
                        `/databases/${APPWRITE_CONFIG.databaseId}/collections/${collection.id}`
                    );
                    console.log(`✅ Collection '${collection.id}' already exists`);
                    continue;
                } catch (e) {
                    // Collection doesn't exist, proceed with creation
                }

                // Create collection
                console.log(`📝 Creating collection '${collection.id}'...`);
                await makeAppwriteRequest(
                    'POST',
                    `/databases/${APPWRITE_CONFIG.databaseId}/collections`,
                    {
                        collectionId: collection.id,
                        name: collection.name
                    }
                );
                console.log(`✅ Created collection '${collection.id}'`);

                // Add attributes
                for (const attr of collection.attributes) {
                    try {
                        if (attr.type === 'string') {
                            await makeAppwriteRequest(
                                'POST',
                                `/databases/${APPWRITE_CONFIG.databaseId}/collections/${collection.id}/attributes/string`,
                                {
                                    key: attr.key,
                                    size: attr.size || 255,
                                    required: false
                                }
                            );
                        } else if (attr.type === 'datetime') {
                            await makeAppwriteRequest(
                                'POST',
                                `/databases/${APPWRITE_CONFIG.databaseId}/collections/${collection.id}/attributes/datetime`,
                                {
                                    key: attr.key,
                                    required: false
                                }
                            );
                        } else if (attr.type === 'boolean') {
                            await makeAppwriteRequest(
                                'POST',
                                `/databases/${APPWRITE_CONFIG.databaseId}/collections/${collection.id}/attributes/boolean`,
                                {
                                    key: attr.key,
                                    required: false
                                }
                            );
                        }
                        console.log(`  ✓ Added attribute '${attr.key}'`);
                    } catch (attrError) {
                        console.log(`  ℹ Attribute '${attr.key}' exists or error: ${attrError.message}`);
                    }
                }

                console.log(`✅ Collection '${collection.id}' setup complete`);
            } catch (error) {
                console.error(`❌ Error with collection '${collection.id}':`, error.message);
            }
        }

        console.log('✅ All collections ready!');
        return true;
    } catch (error) {
        console.error('❌ Collection setup error:', error);
        return false;
    }
}

// Run on page load (after Appwrite SDK loads)
setTimeout(() => {
    console.log('🚀 Starting collection setup...');
    createCollectionsIfNeeded();
}, 2000);
