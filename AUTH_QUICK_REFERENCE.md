# 🔐 SAGE ChatApp Authentication Quick Reference

## ✅ What's Been Set Up

### 1. **Server**
- Express.js server on `localhost:3000`
- Static file serving for HTML/CSS/JS
- Health check endpoint at `/health`

### 2. **Appwrite Integration**
- Latest SDK (appwrite@latest) loaded via CDN
- Credentials configured:
  - Project ID: `69908279003c2040b279`
  - Database ID: `69908279003c2040b279`
  - Endpoint: `https://cloud.appwrite.io/v1`

### 3. **Authentication System**
- AuthManager class with register/login functionality
- Username-based authentication
- Password hashing (SHA-256)
- User status tracking (online/offline)
- localStorage fallback for offline support

### 4. **Query Helper**
- Appwrite Query imported and exported
- Available globally via `window.AppwriteQuery()`
- Used for database filtering (e.g., `Query.equal('username', 'user')`)

---

## 📖 Basic Usage Examples

### **Register a User**
```javascript
// In browser console:
const result = await authManager.registerUser(
    'John Doe',      // name
    'johndoe',       // username
    'password123'    // password
);

console.log(result);
// {
//   success: true,
//   message: "Account created successfully",
//   user: { id: 'user_xxx', name: 'John Doe', username: 'johndoe' }
// }
```

### **Login a User**
```javascript
const result = await authManager.loginUser('johndoe', 'password123');

console.log(result);
// {
//   success: true,
//   message: "Login successful",
//   user: { id: 'user_xxx', name: 'John Doe', username: 'johndoe', ... }
// }

// User is now stored in localStorage
console.log(authManager.currentUser);
```

### **Check if User is Logged In**
```javascript
if (authManager.isAuthenticated()) {
    console.log('User:', authManager.currentUser);
} else {
    console.log('Not logged in');
}
```

### **Logout a User**
```javascript
await authManager.logout();
// User status changed to 'offline' in Appwrite
// Session cleared from localStorage
```

### **Get All Users**
```javascript
const users = await authManager.getAllUsers();
console.log(users);
// [
//   { id: 'user_xxx', name: 'John Doe', username: 'johndoe', avatar: 'JD', status: 'online' },
//   { id: 'user_yyy', name: 'Jane Smith', username: 'janesmith', avatar: 'JS', status: 'offline' },
//   ...
// ]
```

### **Get Specific User**
```javascript
const user = await authManager.getUserByUsername('johndoe');
console.log(user);
// { id: 'user_xxx', name: 'John Doe', username: 'johndoe', avatar: 'JD', status: 'online' }
```

### **Use Query Helper**
```javascript
const Query = window.AppwriteQuery();

if (Query) {
    // Query is available for use in database operations
    const response = await appwriteService.getDatabases().listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.users,
        [Query.equal('username', 'johndoe')]
    );
    console.log(response);
}
```

---

## 🗄️ Collections That Need to Be Created

You must create these in Appwrite Dashboard:

1. **users_collection** - User profiles
2. **channels_collection** - Chat channels
3. **messages_collection** - Messages (enable real-time ✅)
4. **direct_messages_collection** - Private messages
5. **channel_members_collection** - Channel membership

See `COLLECTION_SETUP_GUIDE.md` for detailed field specifications.

---

## 🚦 Current Limitations

⚠️ **Users are stored in localStorage only** until you:
1. Create collections in Appwrite Dashboard
2. Enable real-time for required collections
3. Grant proper access permissions

When collections are created:
- Users auto-save to `users_collection`
- Queries work properly
- Real-time subscriptions activate

---

## 📂 File Locations

| File | Purpose |
|------|---------|
| `js/appwrite-config.js` | Appwrite SDK initialization & Query helper |
| `js/auth-appwrite.js` | AuthManager class with register/login |
| `js/chat-appwrite.js` | Chat functionality with real-time |
| `server.js` | Express server |
| `package.json` | Dependencies |

---

## 🔗 Available Global Functions

```javascript
// Get AuthManager instance
authManager

// Get Appwrite Service
appwriteService = getAppwriteService()

// Get Query helper
Query = window.AppwriteQuery()

// Get Databases instance
const databases = appwriteService.getDatabases()

// Get Account instance
const account = appwriteService.getAccount()

// Get Realtime Service
const realtime = appwriteService.getRealtimeService()
```

---

## 📱 UI Components

The HTML includes:
- **Login Form** - For existing users
- **Register Form** - For new users
- **Auth Container** - Shows login/register
- **Chat Container** - Shows chat (hidden until login)
- **Notifications** - Shows alerts/messages
- **Loading Spinner** - Shows during operations

---

## ✨ Key Features Implemented

✅ **Registration**
- Username validation (min 3 characters)
- Password strength meter
- Password confirmation
- Avatar generation (initials)

✅ **Login**
- Username/password authentication
- Automatic status update to 'online'
- Session persistence
- Last login tracking

✅ **Logout**
- Status update to 'offline'
- Session cleanup
- localStorage clear

✅ **Offline Support**
- localStorage fallback
- Auto-sync when online
- Works without Appwrite

✅ **Real-time Ready**
- Subscription framework
- Status updates
- Message delivery

---

## 🧪 Quick Test

**In browser console:**

```javascript
// 1. Register
await authManager.registerUser('Test User', 'testuser', 'password123');

// 2. Login
await authManager.loginUser('testuser', 'password123');

// 3. Check session
console.log(authManager.currentUser);

// 4. Logout
await authManager.logout();

// 5. Verify logged out
console.log(authManager.isAuthenticated());
```

---

## 🐛 Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Server won't start | Run `npm install` then `npm start` |
| Can't access localhost:3000 | Check if port 3000 is in use |
| Appwrite SDK not loading | Check for CORB errors in console |
| Query returns null | Ensure appwrite-config.js loads first |
| Users not in Appwrite | Create collections in Dashboard |
| Can't login | Verify user was registered first |

---

## 📞 Support

For detailed setup:
- See `APPWRITE_AUTH_SETUP.md` - Complete setup guide
- See `APPWRITE_CONFIG.md` - Configuration reference
- See `COLLECTION_SETUP_GUIDE.md` - Collection creation
- See `ARCHITECTURE.md` - System design

---

**Server Status:** ✅ Running on localhost:3000
**Appwrite Status:** ✅ SDK Loaded
**Database:** ⏳ Waiting for collection creation
**Authentication:** ✅ Ready to use

