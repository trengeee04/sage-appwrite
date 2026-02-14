# SAGE ChatApp - Architecture Diagram

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    SAGE ChatApp Frontend                        │
│                      (Browser/Desktop)                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Appwrite Client SDK                            │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐             │
│  │   Databases  │ │   Account    │ │   Realtime   │             │
│  └──────────────┘ └──────────────┘ └──────────────┘             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
    REST API            WebSocket              Events
    (CRUD ops)         (Real-time)            (Subscriptions)
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Appwrite Cloud Services                        │
│              (cloud.appwrite.io/v1)                             │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
   Database Server      Authentication          Realtime Engine
   (Collections)          (Accounts)            (WebSocket Broker)
        │                     │                     │
        ▼                     ▼                     ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ Message Storage  │ │  User Accounts   │ │  Event Dispatcher│
│ Channel Storage  │ │  Auth Sessions   │ │  Event Listeners │
│ User Profiles    │ │  Permissions     │ │  Message Routing │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

---

## Data Flow Diagram

### User Registration Flow

```
User Input Form
    │
    ├─ Name: "John Doe"
    ├─ Username: "johndoe"
    └─ Password: "SecurePass123"
                │
                ▼
        Validate Input
                │
                ├─ Check required fields ✓
                ├─ Check username length ✓
                ├─ Check password strength ✓
                └─ Check username unique ✓
                │
                ▼
        Hash Password
                │
                └─ SHA-256 Hash
                │
                ▼
        Send to Appwrite
                │
                ├─ Success → Save to users_collection
                │            │
                │            ▼
                │         User Record Created
                │         {
                │           userId: "user_abc123",
                │           name: "John Doe",
                │           username: "johndoe",
                │           passwordHash: "9f86d0...",
                │           status: "offline",
                │           createdAt: "2026-02-14..."
                │         }
                │
                └─ Fail → Fall back to localStorage
                         │
                         ▼
                    Show Success Message
                    Redirect to Login
```

---

### Login & Authentication Flow

```
User Credentials
    │
    ├─ Username: "johndoe"
    └─ Password: "SecurePass123"
                │
                ▼
    Query users_collection
    [WHERE username = "johndoe"]
                │
    ┌───────────┴───────────┐
    │                       │
    ▼                       ▼
 Found              Not Found
    │                   │
    ▼                   ▼
Compare         Return Error
Password        "User Not Found"
    │
    ┌─────────┬─────────┐
    │         │
    ▼         ▼
 Match    Mismatch
    │         │
    ▼         ▼
Update    Return Error
Status    "Invalid Password"
to online
    │
    ▼
Create Session
    │
    ├─ Save to localStorage
    │  (sageCurrent_user)
    │
    ├─ Update UI
    │
    └─ Initialize Chat
        │
        ▼
   Show Chat Interface
```

---

### Real-time Message Flow

```
User A: Sends Message
    │
    ├─ "Hello everyone!"
    │
    ▼
POST /databases/{dbId}/collections/messages
    {
      channelId: "general",
      authorId: "user_123",
      text: "Hello everyone!",
      timestamp: "2026-02-14T..."
    }
                │
                ▼
        Appwrite Validates
                │
                ▼
        Save to messages_collection
                │
                ▼
        Emit Event: "documents.create"
                │
                ├─────────────────┬─────────────────┐
                │                 │                 │
                ▼                 ▼                 ▼
            User A         User B (Listening)   User C (Listening)
         (Sender)              │                    │
                               ▼                    ▼
                        Receive Event          Receive Event
                               │                    │
                               ├─────────┬─────────┤
                               │         │         │
                        Update Local  Same as    Same as
                        Message List  User B     User B
                               │
                               ▼
                        Re-render UI
                        (No refresh!)
```

---

### Real-time Channel Updates Flow

```
Admin Creates Channel
    │
    └─ Channel: "announcements"
                │
                ▼
        POST /databases/{dbId}/collections/channels
                │
                ▼
        Save to channels_collection
                │
                ▼
        Emit Event: "documents.create"
                │
    ┌───────────┼───────────┐
    │           │           │
    ▼           ▼           ▼
  User A     User B       User C
 Listening  Listening     Listening
    │           │           │
    ├─────────┬─┴─┬────────┬┘
    │         │   │
    ▼         ▼   ▼
Receive Channel Created Event
    │
    ▼
Add to Channel List
    │
    ▼
Update UI Automatically
(All users see new channel instantly!)
```

---

## File Architecture

```
Frontend Files
│
├─ index.html
│  └─ Loads Appwrite SDK
│  └─ Loads auth-appwrite.js
│  └─ Loads chat-appwrite.js
│
├─ js/
│  ├─ appwrite-config.js
│  │  ├─ APPWRITE_CONFIG (credentials)
│  │  ├─ AppwriteService (client initialization)
│  │  └─ RealtimeService (subscription manager)
│  │
│  ├─ auth-appwrite.js
│  │  ├─ AuthManager (register/login)
│  │  ├─ Password hashing
│  │  ├─ User status tracking
│  │  └─ UI handlers (forms)
│  │
│  └─ chat-appwrite.js
│     ├─ ChatManager (channels/messages)
│     ├─ Message subscription handler
│     ├─ Channel subscription handler
│     └─ UI rendering (messages/channels)
│
└─ css/
   └─ styles.css (unchanged)
```

---

## Database Schema Diagram

```
┌──────────────────────────────────┐
│   users_collection               │
├──────────────────────────────────┤
│ userId        (String, PK)       │
│ name          (String)           │
│ username      (String, UNIQUE)   │
│ email         (String, OPTIONAL) │
│ passwordHash  (String)           │
│ avatar        (String)           │
│ status        (ENUM)             │
│ createdAt     (DateTime)         │
│ lastLogin     (DateTime)         │
└──────────────────────────────────┘
           │
           │ (Many to Many)
           │
┌──────────────────────────────────┐
│ channel_members_collection        │
├──────────────────────────────────┤
│ channelId     (String, FK)       │
│ userId        (String, FK)       │
│ joinedAt      (DateTime)         │
│ role          (ENUM)             │
└──────────────────────────────────┘
           │
           │ (One to Many)
           │
┌──────────────────────────────────┐
│ channels_collection              │
├──────────────────────────────────┤
│ $id           (String, PK)       │
│ name          (String, UNIQUE)   │
│ displayName   (String)           │
│ icon          (String)           │
│ description   (String)           │
│ type          (ENUM)             │
│ creator       (String, FK→User)  │
│ members       (String Array)     │
│ createdAt     (DateTime)         │
│ updatedAt     (DateTime)         │
└──────────────────────────────────┘
           │
           │ (One to Many)
           │
┌──────────────────────────────────┐
│ messages_collection              │
├──────────────────────────────────┤
│ $id           (String, PK)       │
│ channelId     (String, FK, INDEX)│
│ authorId      (String, FK→User)  │
│ author        (String)           │
│ authorName    (String)           │
│ text          (String)           │
│ timestamp     (DateTime)         │
│ avatar        (String)           │
│ edited        (Boolean)          │
│ editedAt      (DateTime)         │
│ reactions     (JSON)             │
└──────────────────────────────────┘
```

---

## Real-time Subscription Architecture

```
Appwrite Cloud (WebSocket Server)
              │
              │ WebSocket Connection
              │
    ┌─────────┴─────────┐
    │                   │
    ▼                   ▼
 Message             Channel
 Events              Events
    │                   │
    │                   │
    ├─ documents.create │
    ├─ documents.update │
    └─ documents.delete │
    │                   │
    └─────────┬─────────┘
              │
              ▼
    RealtimeService
    (In Browser)
              │
              ├─ subscribeToMessages()
              ├─ subscribeToChannels()
              ├─ subscribeToUserStatus()
              │
              ▼
    Event Callbacks
              │
              ├─ renderMessages()
              ├─ renderChannels()
              └─ updateMemberStatus()
              │
              ▼
        DOM Update
        (Instant, no refresh)
```

---

## Authentication & Permission Flow

```
User Action
    │
    ▼
Frontend Validation
    ├─ Required fields check
    ├─ Input format check
    └─ Password strength check
    │
    ▼
Send to Appwrite
    │
    ▼
Appwrite Server Validation
    ├─ Data type check
    ├─ Unique constraint check
    ├─ Permission check
    └─ Business logic check
    │
    ┌────────┬────────┐
    │        │
    ▼        ▼
Success   Fail
    │        │
    ├─ ✓    └─ Return Error
    │        │
    └─►Save  └─ Log Failed Attempt
    │        │
    ▼        ▼
Update UI  Show Error Message
(Secured)
```

---

## Offline Support Architecture

```
User Action (Offline)
    │
    ▼
Try Appwrite API
    │
    ├─ Connection Failed
    │
    ▼
Fall back to localStorage
    │
    ├─ Save locally
    │
    ▼
Show Success (Optimistic UI)
    │
User goes Online
    │
    ▼
Automatic Sync
    │
    ├─ Send cached messages
    ├─ Upload changes
    ├─ Fetch latest data
    │
    ▼
Merge with Server Data
    │
    ▼
Update UI
    │
    └─ Data fully synced ✓
```

---

## Real-time Message Sequence

```
Time  │  User A            │  Appwrite          │  User B
      │  (Client)          │  (Server)          │  (Client)
      │
  0ms │  Send Message      │                    │
      │  (POST)            │                    │
      │─────────────────►  │                    │
      │                    │ Validate           │
 10ms │                    │ Save to DB         │
      │                    │ Emit Event         │
      │                    │                    ├──────────┐
 15ms │  ◄─────────────────│ (WebSocket)        │ Listen   │
      │  Response (201)    │                    │          │
      │  (optimistic)      │                    │          │
      │                    │                    │          ▼
 20ms │  Update UI         │                    │ Receive Event
      │  (show message)    │                    │
      │                    │                    ├──────────┐
 25ms │                    │                    │ Process  │
      │                    │                    │          ▼
      │                    │                    │ Update UI
 30ms │ ◄───────────────────────────────────────┘ (render)
      │ Confirmed sync                          │
      │                                         │
 35ms │ Real-time Update   │                    │
      │ ◄───────────────────                    │
      │ (if any edits)     │                    │
      │                    │                    │
```

---

## Scalability Architecture

```
Single Server
├─ Appwrite Instance
├─ Database
└─ Users: 100

                    ▼

Scaled Architecture
├─ Load Balancer
│  ├─ Appwrite Instance 1
│  ├─ Appwrite Instance 2
│  └─ Appwrite Instance 3
│
├─ Database Cluster
│  ├─ Primary DB
│  └─ Replicas
│
├─ Cache Layer (Redis)
│  └─ Session cache
│
├─ CDN
│  └─ Static assets
│
└─ Users: 10,000+
```

---

## Security Layers

```
User Request
    │
    ▼
Browser Validation (Layer 1)
├─ Input format check
├─ Required fields
└─ Client-side rules
    │
    ▼
HTTPS/TLS (Layer 2)
├─ Encrypted transport
└─ Prevents man-in-middle
    │
    ▼
API Key Authentication (Layer 3)
├─ Project validation
└─ API key verification
    │
    ▼
Server Validation (Layer 4)
├─ Data type check
├─ Length validation
└─ Business logic
    │
    ▼
Permission Check (Layer 5)
├─ Role validation
├─ Resource access
└─ Collection permissions
    │
    ▼
Database Execution (Layer 6)
├─ Constraint check
├─ Unique validation
└─ Transaction management
    │
    ▼
Audit Logging (Layer 7)
└─ All actions logged
```

---

## Technology Stack

```
Frontend
├─ HTML5
├─ CSS3 (Custom Styling)
├─ JavaScript (Vanilla)
├─ Appwrite SDK (v14.0.0)
└─ Font Awesome Icons

Backend
├─ Appwrite Cloud
├─ PostgreSQL Database
├─ WebSocket Server
├─ REST API
└─ Real-time Engine

Infrastructure
├─ Cloud Storage
├─ Load Balancing
├─ Auto-scaling
├─ Monitoring
└─ Logging
```

---

## Performance Optimization Strategy

```
Frontend Optimization
├─ Lazy load messages
├─ Virtual scrolling
├─ Debounce search
└─ Cache user list

API Optimization
├─ Query pagination
├─ Index frequently used fields
├─ Connection pooling
└─ Response caching

Database Optimization
├─ Collection indexes
├─ Query optimization
├─ Archive old data
└─ Regular cleanup
```

---

This architecture provides a solid foundation for a scalable, 
real-time chat application with offline support and modern 
security practices.

---

**Last Updated**: February 14, 2026
**Version**: 1.0
**Status**: Complete
