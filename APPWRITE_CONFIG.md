# Appwrite Configuration Reference for SAGE ChatApp

## Quick Configuration Checklist

```
[ ] 1. Access Appwrite Dashboard (https://cloud.appwrite.io)
[ ] 2. Select project: 69908279003c2040b279
[ ] 3. Go to Database section
[ ] 4. Create 5 collections (see APPWRITE_SETUP.md for schema)
[ ] 5. Enable Real-time for each collection
[ ] 6. Set proper permissions for each collection
[ ] 7. Update environment variables
[ ] 8. Test with sample data
```

## Collection IDs to Create

Copy and paste these exact IDs:

1. **users_collection**
2. **channels_collection**
3. **messages_collection**
4. **direct_messages_collection**
5. **channel_members_collection** (Optional)

## API Configuration

```javascript
// These are already configured in js/appwrite-config.js
const APPWRITE_CONFIG = {
    endpoint: 'https://cloud.appwrite.io/v1',
    projectId: '69908279003c2040b279',
    databaseId: '69908279003c2040b279',
    
    collections: {
        users: 'users_collection',
        channels: 'channels_collection',
        messages: 'messages_collection',
        directMessages: 'direct_messages_collection',
        members: 'channel_members_collection'
    }
};
```

## Scripts Load Order

In index.html, scripts are loaded in this order:
```html
1. <script src="https://cdn.jsdelivr.net/npm/appwrite@14.0.0/dist/appwrite.umd.js"></script>
2. <script src="js/appwrite-config.js"></script>
3. <script src="js/auth-appwrite.js"></script>
4. <script src="js/chat-appwrite.js"></script>
```

## Permissions Template

### Users Collection
```
Public: Read List
Authenticated Users: Read Own Profile
Owner: Full Access
```

### Channels Collection
```
Public: Read List
Authenticated Users: Create, Read
Creator: Full Access
```

### Messages Collection
```
Public: Read
Authenticated Users: Create (own), Read
Owner: Full Access
```

## Real-time Events to Subscribe To

```javascript
// Message events
databases.{databaseId}.collections.{messagesCollectionId}.documents

// Channel events
databases.{databaseId}.collections.{channelsCollectionId}.documents

// User events
databases.{databaseId}.collections.{usersCollectionId}.documents
```

## Database Queries Used

### List Users
```javascript
Query.equal('username', username)
Query.equal('status', 'online')
```

### List Messages
```javascript
Query.equal('channelId', channelId)
Query.orderDesc('timestamp')
Query.limit(50)
```

### List Channels
```javascript
Query.equal('type', 'channel')
Query.orderAsc('name')
```

## Error Handling

The application has built-in fallback to localStorage if Appwrite is unavailable:

- User registration: Saves to localStorage if Appwrite fails
- Message sending: Saves to localStorage if Appwrite fails
- Channel creation: Saves to localStorage if Appwrite fails
- Loading data: Falls back to localStorage if Appwrite unavailable

## CORS Configuration

If you get CORS errors:
1. Go to Appwrite Dashboard → Settings
2. Click on Domains/CORS
3. Add your domain or `*` for development
4. For production, specify exact domain

## Testing Commands

### Test User Registration
```
Username: testuser1
Password: Test@12345
```

### View in Dashboard
- Users: Database → users_collection
- Messages: Database → messages_collection
- Channels: Database → channels_collection

## Common Issues & Fixes

| Issue | Fix |
|-------|-----|
| 404 Collections not found | Verify collection IDs match exactly |
| CORS error | Add domain to Appwrite Settings → Domains |
| Real-time not updating | Enable in collection settings → Real-time |
| Messages not saving | Check browser console, verify permissions |
| Slow loading | Check network tab, verify API response time |

## Environment Variables (Production)

Create `.env.local` for production:
```
VITE_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
VITE_APPWRITE_PROJECT_ID=69908279003c2040b279
VITE_APPWRITE_DATABASE_ID=69908279003c2040b279
VITE_APPWRITE_API_KEY=your_api_key
```

## Next Steps After Setup

1. ✅ Create collections
2. ✅ Enable real-time
3. ✅ Test registration
4. ✅ Test login
5. ✅ Test messaging
6. ✅ Test channels
7. ⬜ Implement file uploads
8. ⬜ Add typing indicators
9. ⬜ Implement DMs
10. ⬜ Move auth to backend

## Support Resources

- [Appwrite Docs](https://appwrite.io/docs)
- [Database Guide](https://appwrite.io/docs/databases)
- [Real-time Guide](https://appwrite.io/docs/realtime)
- [Query Documentation](https://appwrite.io/docs/queries)

## Version Info

- Appwrite SDK: v14.0.0
- Project ID: 69908279003c2040b279
- Database ID: 69908279003c2040b279
- Last Updated: February 14, 2026
