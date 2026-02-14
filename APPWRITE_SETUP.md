# SAGE ChatApp - Appwrite Integration Setup Guide

## Overview
This document provides complete instructions for setting up and configuring your SAGE ChatApp with Appwrite backend for real-time messaging.

## Your Credentials
- **Project ID**: `69908279003c2040b279`
- **Database ID**: `69908279003c2040b279`

## Step 1: Appwrite Dashboard Setup

### 1.1 Access Your Appwrite Dashboard
1. Go to https://cloud.appwrite.io
2. Log in with your account
3. Select your project: **SAGE ChatApp**

### 1.2 Create Collections

Navigate to **Database** in your dashboard and create the following collections:

#### Collection 1: **users_collection**
```
Collection ID: users_collection

Attributes:
├── userId (String) - Primary Key
├── name (String) - Required
├── username (String) - Required, Unique Index
├── email (String) - Optional
├── passwordHash (String) - Required
├── avatar (String)
├── status (String) - Enum: [online, offline, away]
├── createdAt (DateTime)
└── lastLogin (DateTime)

Permissions:
- Users: Read
- Public: Read Users List
- Own user: Full Access
```

#### Collection 2: **channels_collection**
```
Collection ID: channels_collection

Attributes:
├── $id (String) - Primary Key
├── name (String) - Required, Unique Index
├── displayName (String)
├── icon (String)
├── description (String)
├── type (String) - Enum: [channel, dm]
├── creator (String)
├── members (String Array)
├── createdAt (DateTime)
└── updatedAt (DateTime)

Permissions:
- Users: Read
- Public: Read Channel List
- Creator: Full Access
```

#### Collection 3: **messages_collection**
```
Collection ID: messages_collection

Attributes:
├── $id (String) - Primary Key
├── channelId (String) - Required, Index
├── authorId (String) - Required
├── author (String)
├── authorName (String)
├── text (String) - Required
├── timestamp (DateTime)
├── avatar (String)
├── edited (Boolean)
├── editedAt (DateTime)
└── reactions (JSON) - Optional

Permissions:
- Users: Read
- Public: Read Messages
- Author: Full Access
```

#### Collection 4: **direct_messages_collection**
```
Collection ID: direct_messages_collection

Attributes:
├── $id (String) - Primary Key
├── conversationId (String) - Required, Index
├── participants (String Array) - 2 User IDs
├── lastMessage (String)
├── lastMessageTime (DateTime)
├── createdAt (DateTime)
└── updatedAt (DateTime)

Permissions:
- Participants: Full Access
- Others: No Access
```

#### Collection 5: **channel_members_collection** (Optional)
```
Collection ID: channel_members_collection

Attributes:
├── $id (String) - Primary Key
├── channelId (String) - Required
├── userId (String) - Required
├── joinedAt (DateTime)
└── role (String) - Enum: [admin, member, moderator]

Permissions:
- Members: Read Own Records
- Admin: Full Access
```

### 1.3 Enable Real-time Subscriptions

For each collection, enable real-time:
1. Go to the collection settings
2. Find **Real-time Subscriptions**
3. Enable it for:
   - `messages_collection` - ALL EVENTS
   - `channels_collection` - ALL EVENTS
   - `users_collection` - ALL EVENTS

### 1.4 Create API Key (If needed for Server-side)

1. Go to **Settings** → **API Keys**
2. Create a new API Key with scope:
   - `databases.read`
   - `databases.write`
   - `collections.read`
   - `documents.read`
   - `documents.write`

## Step 2: Project File Structure

Your project now has:

```
SAGE_ChatApp3/
├── index.html
├── css/
│   └── styles.css
├── js/
│   ├── appwrite-config.js      ← NEW: Appwrite configuration
│   ├── auth-appwrite.js         ← NEW: Appwrite authentication
│   ├── chat-appwrite.js         ← NEW: Appwrite chat with real-time
│   ├── auth.js                  ← OLD: Keep as fallback
│   └── chat.js                  ← OLD: Keep as fallback
```

## Step 3: File Descriptions

### appwrite-config.js
- Initializes Appwrite client with your credentials
- Manages real-time subscriptions
- Handles message and channel real-time updates

### auth-appwrite.js
- User registration with password hashing
- Login with Appwrite database validation
- User status management (online/offline)
- Fallback to localStorage if Appwrite is unavailable

### chat-appwrite.js
- Channel management with Appwrite storage
- Message sending and retrieval from Appwrite
- Real-time message subscriptions
- Real-time channel subscriptions
- Fallback to localStorage for offline support

## Step 4: Security Considerations

### Important: Client-side Security
⚠️ **NOTE**: Currently, the authentication is client-side only. For production:

1. **Move authentication to backend**
   - Use Appwrite's server SDKs
   - Store sensitive data server-side
   - Implement JWT-based auth

2. **Enable API Key restrictions**
   - Limit to specific collections
   - Set proper CORS origins
   - Use API keys only for testing

3. **Implement proper permissions**
   - Set collection-level security
   - User-specific access controls
   - Audit logging

### Environment Variables (for production)
Create a `.env` file:
```
APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=69908279003c2040b279
APPWRITE_DATABASE_ID=69908279003c2040b279
APPWRITE_API_KEY=your_api_key_here
```

## Step 5: Testing the Integration

### Test Registration
1. Open the app in browser
2. Switch to Register form
3. Fill in details:
   - Name: `Test User`
   - Username: `testuser`
   - Password: `Test@1234`
4. Check Appwrite Dashboard → users_collection for new user

### Test Login
1. Log in with created credentials
2. Check `lastLogin` timestamp in users_collection
3. Verify status changed to `online`

### Test Messaging
1. Select a channel
2. Send a message
3. Check Appwrite Dashboard → messages_collection
4. Verify real-time updates (if enabled)

### Test Channels
1. Create a new channel
2. Check channels_collection in dashboard
3. Send message and verify it appears in messages_collection

## Step 6: Troubleshooting

### Issue: Collections Not Found
**Solution**: 
- Verify collection IDs match exactly in `appwrite-config.js`
- Ensure collections are created in correct database
- Check database ID is correct

### Issue: Real-time Updates Not Working
**Solution**:
- Enable real-time subscriptions in collection settings
- Check browser console for WebSocket errors
- Verify Appwrite endpoint is accessible

### Issue: Messages Not Saving
**Solution**:
- Check Appwrite Dashboard → Activity → Logs
- Verify permissions are set correctly
- Check browser console for API errors
- Falls back to localStorage if Appwrite fails

### Issue: CORS Errors
**Solution**:
- Go to Settings → CORS
- Add your domain or `*` for development
- For production, specify exact origin

## Step 7: Advanced Features

### Enable File Uploads
1. Create a bucket in Storage
2. Update `APPWRITE_CONFIG.bucketId` in appwrite-config.js
3. Implement file upload in message handler

### Implement Search
```javascript
// Example: Search messages
const results = await chatManager.databases.listDocuments(
    APPWRITE_CONFIG.databaseId,
    APPWRITE_CONFIG.collections.messages,
    [
        Query.search('text', 'search term'),
        Query.equal('channelId', channelId)
    ]
);
```

### Add Message Reactions
```javascript
// Add reaction support in messages_collection
reactions: {
    "👍": ["userId1", "userId2"],
    "❤️": ["userId3"]
}
```

### Direct Messages
Use `direct_messages_collection` to implement DM functionality:
```javascript
async sendDirectMessage(recipientId, text) {
    const conversationId = chatManager.getConversationId(
        this.currentUser.id, 
        recipientId
    );
    // Save to direct_messages_collection
}
```

## Step 8: Production Deployment

### Before Going Live:

1. **Security Audit**
   - Move auth to backend
   - Remove sensitive data from frontend
   - Implement rate limiting
   - Add input validation

2. **Performance**
   - Implement message pagination
   - Cache user data
   - Optimize database queries
   - Use CDN for static files

3. **Monitoring**
   - Set up error tracking (Sentry)
   - Monitor API usage
   - Track real-time connections
   - Log user activities

4. **Backup & Recovery**
   - Set up automated backups
   - Test restore procedures
   - Document disaster recovery plan

## Next Steps

1. Create the collections as described in Step 1.2
2. Test the application with sample data
3. Implement error handling for production
4. Add additional features (file upload, typing indicators, etc.)
5. Deploy to production with proper security measures

## Useful Links

- [Appwrite Documentation](https://appwrite.io/docs)
- [Appwrite SDK Reference](https://appwrite.io/docs/references)
- [Real-time Documentation](https://appwrite.io/docs/realtime)
- [Database Queries](https://appwrite.io/docs/databases)

## Support

For issues or questions:
1. Check Appwrite logs in Dashboard
2. Review browser console for errors
3. Check network tab for API requests
4. Refer to Appwrite documentation

---

**Last Updated**: February 14, 2026
**Version**: 1.0
**Status**: Ready for testing
