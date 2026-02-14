# Step-by-Step Collection Creation Guide

## How to Create Collections in Appwrite Dashboard

### Prerequisites
- Logged into https://cloud.appwrite.io
- Project selected: `69908279003c2040b279`
- In Database section

---

## Collection 1: users_collection

### Create Collection
1. Click **Create Collection**
2. Collection ID: `users_collection`
3. Click Create

### Add Attributes

| Attribute | Type | Settings |
|-----------|------|----------|
| userId | String | Required, No Index |
| name | String | Required |
| username | String | Required, **Create Index** → Unique |
| email | String | Optional |
| passwordHash | String | Required |
| avatar | String | Optional |
| status | String | Optional, Enum: `["online", "offline", "away"]` |
| createdAt | DateTime | Optional |
| lastLogin | DateTime | Optional |

### Set Permissions
1. Go to Collection → Permissions
2. Click **Add Permission**
3. Set:
   - **Role**: Public
   - **Permission**: Read
   - **Resource**: Collection
4. Click **Add Permission** again
5. Set:
   - **Role**: Users
   - **Permission**: Read, Write (Own documents)

---

## Collection 2: channels_collection

### Create Collection
1. Click **Create Collection**
2. Collection ID: `channels_collection`
3. Click Create

### Add Attributes

| Attribute | Type | Settings |
|-----------|------|----------|
| name | String | Required, **Create Index** → Unique |
| displayName | String | Optional |
| icon | String | Optional |
| description | String | Optional |
| type | String | Optional, Enum: `["channel", "dm"]` |
| creator | String | Optional |
| members | String Array | Optional |
| createdAt | DateTime | Optional |
| updatedAt | DateTime | Optional |

### Set Permissions
1. Go to Collection → Permissions
2. Click **Add Permission**
3. Set:
   - **Role**: Public
   - **Permission**: Read
   - **Resource**: Collection

---

## Collection 3: messages_collection

### Create Collection
1. Click **Create Collection**
2. Collection ID: `messages_collection`
3. Click Create

### Add Attributes

| Attribute | Type | Settings |
|-----------|------|----------|
| channelId | String | Required, **Create Index** |
| authorId | String | Required |
| author | String | Optional |
| authorName | String | Optional |
| text | String | Required |
| timestamp | DateTime | Optional |
| avatar | String | Optional |
| edited | Boolean | Optional |
| editedAt | DateTime | Optional |
| reactions | JSON | Optional |

### Set Permissions
1. Go to Collection → Permissions
2. Click **Add Permission**
3. Set:
   - **Role**: Public
   - **Permission**: Read
   - **Resource**: Collection
4. Click **Add Permission**
5. Set:
   - **Role**: Users
   - **Permission**: Create, Write (Own documents)

---

## Collection 4: direct_messages_collection

### Create Collection
1. Click **Create Collection**
2. Collection ID: `direct_messages_collection`
3. Click Create

### Add Attributes

| Attribute | Type | Settings |
|-----------|------|----------|
| conversationId | String | Required, **Create Index** |
| participants | String Array | Optional |
| lastMessage | String | Optional |
| lastMessageTime | DateTime | Optional |
| createdAt | DateTime | Optional |
| updatedAt | DateTime | Optional |

### Set Permissions
1. Go to Collection → Permissions
2. Click **Add Permission**
3. Set:
   - **Role**: Users
   - **Permission**: Create, Read, Write, Delete

---

## Collection 5: channel_members_collection (Optional)

### Create Collection
1. Click **Create Collection**
2. Collection ID: `channel_members_collection`
3. Click Create

### Add Attributes

| Attribute | Type | Settings |
|-----------|------|----------|
| channelId | String | Required |
| userId | String | Required |
| joinedAt | DateTime | Optional |
| role | String | Optional, Enum: `["admin", "member", "moderator"]` |

### Set Permissions
1. Go to Collection → Permissions
2. Click **Add Permission**
3. Set:
   - **Role**: Users
   - **Permission**: Create, Read, Write (Own documents)

---

## Enable Real-time for Each Collection

### For Each Collection:

1. Go to Collection → Settings
2. Find **Real-time Subscriptions**
3. Toggle **Enable Real-time**
4. Select **All Events** (or specific events):
   - ✅ Create
   - ✅ Update
   - ✅ Delete

### Collections to Enable Real-time:
- ✅ **users_collection** - For user status updates
- ✅ **channels_collection** - For channel changes
- ✅ **messages_collection** - For real-time messages
- ✅ **direct_messages_collection** - For DM updates
- ❓ **channel_members_collection** - Optional, for membership changes

---

## How to Create an Index

When setting attribute as Unique or Indexed:

1. Click on the **Attribute Row**
2. Find **Index** dropdown
3. Select:
   - **Unique** - For unique usernames, emails
   - **Fulltext** - For searchable text
   - **Key** - For regular indexing

Example: In users_collection, username should be Unique

---

## Verification Checklist

After creating all collections:

```
✅ Collection Created
├─ [ ] users_collection (with 9 attributes)
├─ [ ] channels_collection (with 8 attributes)
├─ [ ] messages_collection (with 10 attributes)
├─ [ ] direct_messages_collection (with 6 attributes)
└─ [ ] channel_members_collection (with 4 attributes)

✅ Indexes Created
├─ [ ] username in users_collection (Unique)
├─ [ ] name in channels_collection (Unique)
├─ [ ] channelId in messages_collection
└─ [ ] conversationId in direct_messages_collection

✅ Real-time Enabled
├─ [ ] users_collection - All Events
├─ [ ] channels_collection - All Events
├─ [ ] messages_collection - All Events
└─ [ ] direct_messages_collection - All Events

✅ Permissions Set
├─ [ ] Public read on users_collection
├─ [ ] Public read on channels_collection
├─ [ ] Public read on messages_collection
├─ [ ] Users can create messages
└─ [ ] Users can manage own data
```

---

## API Attribute Types

When creating attributes, available types are:

| Type | Description |
|------|-------------|
| String | Text (up to 256 chars) |
| Integer | Whole numbers |
| Float | Decimal numbers |
| Boolean | True/False |
| DateTime | Date and time |
| Email | Email format |
| URL | Web address |
| IP | IP address |
| JSON | JSON object |
| String Array | Array of strings |
| Integer Array | Array of integers |
| Enum | Dropdown selection |

---

## Common Creation Mistakes

### ❌ Mistake: Wrong Collection ID
- **Wrong**: `users` (should be `users_collection`)
- **Fix**: Use exact ID from APPWRITE_CONFIG

### ❌ Mistake: Missing Index on username
- **Wrong**: username as regular String
- **Fix**: Create Index → Unique for username

### ❌ Mistake: Real-time not enabled
- **Wrong**: Collection created but real-time disabled
- **Fix**: Go to Settings → Enable Real-time

### ❌ Mistake: Incorrect permissions
- **Wrong**: No public read permission
- **Fix**: Add Public role with Read permission

### ❌ Mistake: Wrong attribute type
- **Wrong**: Using Email type for all strings
- **Fix**: Use String for username, Email for email only

---

## Testing After Creation

### Test 1: Create a User
```javascript
// In browser console
await appwriteService.getDatabases().createDocument(
    '69908279003c2040b279',
    'users_collection',
    'test_user_1',
    {
        userId: 'user_123',
        name: 'Test User',
        username: 'testuser',
        email: 'test@example.com',
        avatar: 'TU',
        status: 'online',
        createdAt: new Date().toISOString()
    }
);
```

### Test 2: Create a Channel
```javascript
await appwriteService.getDatabases().createDocument(
    '69908279003c2040b279',
    'channels_collection',
    'general_ch_1',
    {
        name: 'general',
        displayName: 'General',
        description: 'General discussion',
        type: 'channel',
        creator: 'user_123',
        members: ['user_123'],
        createdAt: new Date().toISOString()
    }
);
```

### Test 3: Send a Message
```javascript
await appwriteService.getDatabases().createDocument(
    '69908279003c2040b279',
    'messages_collection',
    'msg_1',
    {
        channelId: 'general_ch_1',
        authorId: 'user_123',
        author: 'testuser',
        authorName: 'Test User',
        text: 'Hello, this is a test message!',
        avatar: 'TU',
        timestamp: new Date().toISOString(),
        edited: false
    }
);
```

---

## Troubleshooting Collection Creation

### Issue: "Collection with this ID already exists"
**Solution**: Delete the existing collection or use a different ID

### Issue: "Cannot create unique index"
**Solution**: The attribute might not support unique, check attribute type

### Issue: "Permission denied"
**Solution**: Check you're in correct project, verify user role is Admin

### Issue: Real-time not available
**Solution**: Upgrade plan if needed, refresh page and try again

---

## Next Steps

1. ✅ Create all 5 collections with attributes
2. ✅ Create indexes for unique fields
3. ✅ Enable real-time for each
4. ✅ Set proper permissions
5. ✅ Test collection creation
6. 🔄 Run the SAGE ChatApp
7. 🧪 Test registration and messaging

---

**Time to complete**: ~15-20 minutes
**Difficulty**: Easy
**Prerequisites**: Appwrite account with project

Good luck! 🚀
