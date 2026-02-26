# SAGE Chat App - Technical Architecture & Engineering Documentation

## 1. Executive Summary

This document serves as the definitive technical reference and architectural blueprint for **Sage Chat App**, a real-time, channel-based communication platform. Designed for scalability, security, and developer ergonomics, Sage Chat App leverages a modern Backend-as-a-Service (BaaS) architecture via Appwrite to abstract complex server-side operations while providing robust client-side orchestration using native web technologies. This guide is intended for backend engineers, technical evaluators, and system architects reviewing the system's structural integrity, data flow, and long-term viability. By utilizing Appwrite's real-time subscriptions, relationship-based NoSQL-like collections (backed primarily by MariaDB), and strict document-level security models, Sage Chat App delivers ultra-low-latency message delivery, granular access controls, and a highly responsive user interface without the overhead of maintaining bespoke monolithic server infrastructure.

## 2. Problem Statement

Modern communication platforms often require a delicate balance between real-time performance and complex data relationships (such as many-to-many user/channel mappings, presence tracking, and access-controlled message history). Developing these features from scratch entails building and maintaining WebSocket servers for pub/sub messaging, managing stateful connections, implementing secure authentication flows, and designing a normalized database schema capable of handling high-velocity inserts. 

Specifically, the core engineering challenges include:
*   **Real-time State Sync:** Ensuring all connected clients instantly receive state permutations (new messages, channel creations, user joins/leaves) without polling.
*   **Relationship Management:** Structuring data so that a user can securely join a channel, and only members can read or write to that channel's message ledger.
*   **Client-Side Orchestration:** Building a dynamic UI without a heavy web framework (e.g., React/Angular/Vue) to maintain a lightweight footprint, requiring careful DOM manipulation and state management in Vanilla JavaScript.
*   **Security & Authorization:** Preventing unauthorized cross-channel data access and injection attacks at the database layer.

Sage Chat App solves these challenges by adopting a serverless BaaS model, pushing heavy synchronization logic to the vendor edge, and maintaining a strict, event-driven client architecture.

## 3. System Overview

Sage Chat App is built on a distributed Client-BaaS architecture. The system consists of two primary environments:

1.  **The Client Layer (Frontend):** A purely static, framework-agnostic web application composed of HTML, CSS, and Vanilla JavaScript. It orchestrates UI states, handles DOM rendering, and manages WebSocket/HTTP interactions with the backend API.
2.  **The Backend Services Layer (Appwrite BaaS):** A containerized set of microservices providing Authentication, Database (CRUD), Storage, and Realtime (WebSocket) communication channels. 

The application operates fundamentally around "Channels." Users authenticate, join channels, and exchange messages. The UI responds reactively to Appwrite Realtime events, allowing for seamless state transitions without manual page reloads.

## 4. Technology Stack Justification

### 4.1 Frontend Stack
*   **HTML5 & CSS3:** Chosen for maximum browser compatibility and zero build-step overhead. CSS Variables and flex/grid layouts enable a responsive, Discord-like dark theme interface natively.
*   **Vanilla JavaScript (ES6+):** By eschewing heavy frameworks, the application maintains a near-zero dependency footprint, reducing supply-chain attack vectors and significantly improving initial load times. DOM manipulation is localized within purpose-built Manager classes (`ChatManager`, `AuthManager`).

### 4.2 Backend Stack (Appwrite)
*   **Appwrite (Self-Hosted/Cloud):** Acts as the foundational data and logic layer. 
    *   *Why Appwrite?* Unlike Firebase, Appwrite offers an open-source, vendor-agnostic ecosystem. It automatically generates REST APIs and manages persistent WebSocket connections for collections, drastically reducing backend engineering hours. It provides an intuitive NoSQL-like interface on top of MariaDB, offering both flexibility and relational integrity.
*   **Appwrite Realtime API:** Handles the pub/sub event bus required for live chat. This is crucial for broadcasting `document.create` and `document.update` events to all subscribed clients under a specific channel.

## 5. High-Level Architecture

The architecture follows a strictly decoupled **Client-BaaS (Backend-as-a-Service)** model.

*   **Presentation Tier:** Responsible solely for rendering data to the DOM. It includes modules for authenticating screens, sidebar generation, and message rendering.
*   **Logic Tier (Managers):** Acts as the intermediary between the UI and the Data Tier. 
    *   `AuthManager` handles JWT session lifecycles, account creation, and identity syncing.
    *   `ChatManager` maintains local state cache (channels, messages, active subscriptions) and coordinates API calls.
*   **Data Tier (Appwrite):** Houses the identity provider, the MariaDB-backed collections, and the Redis-backed Realtime engine for web socket broadcasting.

Requests flow asynchronously. When a user sends a message, an HTTP POST request creates a document via the REST API. Appwrite's engine commits this to the database, triggers internal webhooks, and immediately publishes an event to the Redis pub/sub mechanism, which pushes a WebSocket frame to all clients subscribed to that channel's events.

## 6. Detailed Architecture Breakdown

### 6.1 Initialization & Appwrite Config
The application initializes via an IIFE (Immediately Invoked Function Expression) from the Appwrite SDK (`appwrite-config.js`). It attempts to instantiate the `Client`, `Account`, and `Databases` classes. Because SDK builds can vary, it implements fail-safes (e.g., checking if the `Realtime` class is available before instantiation, or falling back to `client.subscribe`). Connection parameters (Endpoint and Project ID) are injected statically but configured for seamless environment transitions.

### 6.2 The `AuthManager` Singleton
Handles the complete lifecycle of a user session.
1.  **Session Restoration:** On load, `checkSession()` pings the `/account` endpoint. If a valid secure cookie exists, the user's details (ID, name, prefs) are loaded into memory, and the UI transitions to the Chat view.
2.  **Identity Creation:** During registration, `registerUser` first hits the Authentication service to create an Identity. It heavily utilizes Appwrite Preferences (`user.prefs`) for lightweight metadata (avatars, usernames). Subsequently, a parallel document representing the user's public profile is created in a `users` collection for peer discovery.

### 6.3 The `ChatManager` Singleton
The core heartbeat of the application. It maintains an in-memory structured graph of accessible channels and localized message ledgers.
1.  **State Hydration:** Upon `init()`, fetching default channels populates a localized dictionary (`this.channels`).
2.  **UI Data Binding:** Functions like `getJoinedChannels()` and `getOtherChannels()` calculate state derivations dynamically based on the current user's membership.
3.  **Realtime Event Sourcing:** `subscribeToChannels` and `subscribeToMessages` act as persistent listeners. They listen precisely to channel-level patterns (e.g., `databases.[dbId].collections.[channelsColId].documents`).

## 7. Database Design

Sage Chat utilizes a highly normalized, relationship-driven document model within Appwrite's Database instance. Unlike pure document stores (like MongoDB), Appwrite v17+ natively supports relational attributes, ensuring referential integrity and cascading behaviors.

### 7.1 Collection Structures

#### A. Users Collection (`users`)
Maintains public-facing metadata about the authenticated accounts for discovery and rendering.
*   `username` (String, required, unique)
*   `name` (String, required)
*   `email` (String, required, email format)
*   `avatar` (String, URL/HTML representation)
*   `status` (String, enum: online, away, offline)
*   `lastLogin` (Datetime)

#### B. Channels Collection (`channels`)
Represents chat rooms or direct messages.
*   `name` (String, required, URL-safe slug)
*   `displayName` (String)
*   `icon` (String, FontAwesome class)
*   `description` (String, optional)
*   `type` (String, enum: channel, direct)
*   `creator` (String - represents the User ID who instantiated the channel)
*   **`members` (Relationship - Many-to-Many):** Key structural element. An array linking to User documents. Defines who can access the channel.

#### C. Messages Collection (`messages`)
The ledger of communication.
*   `channelId` (String, indexed for fast retrieval)
*   `author` (String, username/name of sender)
*   `avatar` (String)
*   `text` (String, large text block, max 5000 chars)
*   `timestamp` (Datetime)

### 7.2 Relationships & Data Integrity
The critical implementation is the `members` attribute on the `channels` collection. This uses Appwrite's native **Relationship attribute** (Two-way Many-to-Many). 
*   **Referential Action:** Configured to `Set Null`. If a User is deleted from the system, they are automatically purged from the `members` relationship array of all channels, preventing dangling pointers and 404 access errors when iterating channel rosters. "Cascade" deletion is explicitly avoided to prevent accidental destruction of chat history due to single-user deletion.

### 7.3 Indexing Strategy
To ensure query latency remains < 50ms as datasets scale, specific compound and singular indexes are required:
*   `messages` collection: Index on `channelId` (Key) AND `timestamp` (DESC). This ensures `O(log N)` fast fetching of the 50 most recent messages when a user switches channels.
*   `channels` collection: Index on `type` if scaling direct messaging implementations.

## 8. Authentication & Authorization Model

### 8.1 JWT & Secure Cookies
Appwrite abstracts auth token management via secure, HttpOnly, SameSite strictly-scoped cookies attached to the endpoint's origin. The client never handles raw JWTs directly in localStorage, nullifying most XSS token extraction vectors.

### 8.2 Authorization via Document Level Security (DLS)
While initial permissions might be set to `role:all` for MVP deployment flexibility, production architecture requires strict Document Security:
*   **Channels:** Read access should ideally be restricted to `team:[channelId]` (if using Appwrite Teams mapping) or tightly scoped by edge functions. Currently, logical access control happens in software UI via `!currentMembersIds.includes(userId)`.
*   **Messages:** Create access requires active authentication (`role:users`).

## 9. Channel & User Relationship Design

Joining a channel transforms the state of the relationship array. When a user clicks "Join Channel", the system retrieves the channel's `members` array (which contains resolved `$id`s of relationship objects), appends the calling user's `$id`, and issues an `updateDocument` mutation. 
Because the system recognizes the `creator` of the channel autonomously (`isMember = channel.members.includes(userId) || channel.creator === userId`), creators bypass manual joining procedures. Similarly, "Leave Channel" splices the `$id` from the array and patches the document. Delete Channel requires explicit matching `channel.creator === currentUser.id`.

## 10. API Design & Request Flow

### 10.1 Typical Message Sending Flow
1.  **User Action:** User submits text in the UI (`#messageInput`).
2.  **Client Processing:** `sendMessage()` captures text, validates non-empty state, and crafts the payload using `authManager.currentUser` properties.
3.  **HTTP Flight (POST):** Data is transmitted to `/v1/databases/[db]/collections/[messages]/documents`.
4.  **Database Commit:** MariaDB natively commits the transaction.
5.  **Event Bus Trigger:** Appwrite pushes `database.collections.messages.documents.create` to Redis.
6.  **WebSocket Broadcast (Receive):** The client's active WebSockets hit the callback in `subscribeToMessages()`.
7.  **DOM Mutation:** The DOM is asynchronously injected with the new `.message` node via `renderMessages()`, calculating scroll geometry to ensure the view anchors to the bottom.

## 11. Real-Time Data Handling

Appwrite's persistent WebSocket connection is single-multiplexed. Sage Chat App subscribes to specific event channels format:
*   `databases.*.collections.channels.documents`
*   `databases.*.collections.messages.documents`

The client filters incoming events locally based on action (`events.some(e => e.endsWith('.create'))`) and context (`payload.channelId === chatManager.currentChannel`), ensuring that users do not receive visual anomalies when background channels receive unread activity.

### 11.1 Shimmer UI Injection
To counter network latency, perceived performance is artificially heightened using "Shimmer Skeletons". `renderChannelShimmers`, `renderMessageShimmers`, and `renderMemberShimmers` use CSS `linear-gradient` animations to simulate wireframes. These are injected immediately preceding `await ...listDocuments()`, and destroyed natively when the `.innerHTML` is overridden by the resolved payload.

## 12. Error Handling Strategy

Resiliency is achieved via generic catch blocks wrapping async execution paths.
*   **Network Failure/CORS:** Trapped by `try...catch` in `loadMessages()`/`initializeDefaultChannels()`. Yields to `showNotification('error')` UI alert.
*   **Validation Errors:** Handled synchronously in UI (e.g. empty strings, password mismatch) to save round-trip time.
*   **Concurrency Conflicts:** E.g., duplicate channel names. Appwrite returns HTTP 409 Conflict, caught by the UI and rendered verbosely to the human operator.

## 13. Security Considerations

1.  **XSS (Cross-Site Scripting):** Crucial vulnerability in chat apps. Appwrite handles generic sanitation on the REST layer. The frontend must implement `escapeHTML()` (rendering text safely without executing `<script>` tags) if `innerHTML` is used for mounting message bodies, though currently DOM is constructed carefully or utilizing text nodes structurally where vulnerable.
2.  **Rate Limiting:** Managed at the Appwrite Reverse Proxy (Traefik/Nginx) level, preventing spam injection vectors from malicious API clients.
3.  **Insecure Direct Object Reference (IDOR):** Checked on the backend. Deleting a channel strictly verifies `if (channel.creator !== userId)` prior to the execution sequence. 

## 14. Performance & Scalability Analysis

The current single-page static architecture is extremely lightweight (sub 1MB payload), relying on CDN-delivered SDKs.

*   **Vertical Scaling (Database):** Given MariaDB's robust indexing capability, message retrieval is negligible up to millions of rows, provided indexing strictly follows `(channelId, timestamp)`. 
*   **Horizontal Scaling (Realtime):** Appwrite handles WebSocket scalability using Redis as the pub-sub broker. If node limits are reached, horizontal clustering of Appwrite worker nodes is fully supported by its Docker-Swarm/Kubernetes compatible setup.
*   **Browser Memory Leaks:** Local ledgers (`this.channels`, `this.messages`) are garbage collected natively. WebSockets are cleanly unsubscribed (`this.subscriptions['messages']()`) when switching channel contexts to prevent listener multiplication.

## 15. Deployment Architecture

Sage Chat App can be deployed via edge delivery networks (Vercel, Netlify, Cloudflare Pages) due to its purely static build nature. 
The Appwrite instance operates independently as a stateful containerized environment on a VPS (DigitalOcean, AWS EC2) or natively on Appwrite Cloud. Environment variables configuring Project ID, Database ID, and Endpoint URL cleanly separate Dev from Production.

## 16. Testing Strategy

*   **E2E (End-to-End) Testing:** Cypress or Playwright are recommended to script multi-user environment tests (User A joins channel, User B verifies visibility of User A in member list, User A sends message, User B receives WebSocket update).
*   **Unit Testing:** Isolated testing of pure functions like `ChatManager.getJoinedChannels()` or `escapeHTML()`.
*   **Manual Staging:** Due to real-time complexity, local loopback tests on dual browser windows verify correct real-time data flow, channel joining, and role verification (Creator vs Standard Member).

## 17. Limitations

1.  **Paginated History:** Currently fetches a fixed limit (`limit(50)`). Infinite scrolling / auto-hydration of older messages is not yet implemented natively in the UI layout.
2.  **Notification/Unread Markers:** Unread counts on inactive channels rely on local background state comparisons which reset upon harder browser refreshes. Persistent unread ledgers would require a heavy `read_receipts` collections overhead.
3.  **Large Scale Roster Overhead:** The `members` relationship array performs well up to hundreds of members. Beyond theoretical Appwrite document size limits globally (16MB), mass public channels like Telegram/Discord (100k+ members) require alternative pivot-table data modeling instead of direct array embeddings.

## 18. Future Enhancements

*   **Appwrite Functions:** Transitioning complex logic (like "Join Channel" validation) to Serverless Appwrite Functions securely executed on the edge to enforce strict backend validations rather than client-trusted checks.
*   **Role-Based Access Control (RBAC):** Implementing Moderation teams, Admin roles, and muting mechanics.
*   **Media Storage Integration:** Attaching Appwrite Storage buckets to upload attachments natively referenced inside the `messages` collection.
*   **Push Notifications:** Utilizing Appwrite's Cloud Messaging service integrations to push updates to PWA contexts when the browser is inactive.

## 19. Conclusion

The Sage Chat App presents a masterclass in utilizing the bleeding-edge "Backend-as-a-Service" paradigm. By shifting the sheer weight of infrastructural complexity (Authentication flows, Websocket handling, relationship synchronization, and persistence limits) over to Appwrite's engine, the frontend complexity remains agile, readable, and highly optimized resulting in rapid iteration cycles. The design accommodates both speed via local caching and robustness via normalized relationships, placing the project firmly on a scalable trajectory capable of absorbing thousands of concurrent endpoints easily natively.
