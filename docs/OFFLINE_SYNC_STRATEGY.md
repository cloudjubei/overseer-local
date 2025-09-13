# Offline-First Synchronization Strategy

This document outlines the strategy for building a robust offline-first experience across the Electron, React web, and React Native clients. The primary goal is to ensure the application is always responsive and functional, regardless of network connectivity.

## 1. Local Storage Strategy

A local database will be the source of truth for the application's UI on each client. This ensures that the app can read and write data even when offline.

- **Electron & React Native**: `SQLite` will be used as the local storage engine. It's a powerful, reliable, and performant relational database well-suited for native environments. We can use a library like `WatermelonDB` or `RxDB` which are built on top of SQLite for mobile/desktop and provide powerful synchronization features.
- **React (Web)**: `IndexedDB` will be used. It's the standard browser-based database for storing large amounts of structured data. Libraries like `Dexie.js`, or again `RxDB` (which can use an IndexedDB adapter), can simplify its usage.

Using a cross-platform database abstraction layer like `RxDB` or `WatermelonDB` is highly recommended. It would allow us to share a significant portion of the data access and synchronization logic across all platforms.

## 2. Data Synchronization Patterns

We will adopt a sync-to-cloud model where the local database synchronizes with a central backend service.

- **Pull Sync**: When the application starts or regains connectivity, it will pull the latest changes from the server. This will be an incremental sync, fetching only data that has changed since the last sync timestamp.
- **Push Sync**: Any changes made locally (creations, updates, deletions) will be immediately written to the local database and then added to a synchronization queue. This queue will be processed to push changes to the backend whenever the application is online.
- **Real-time Sync (Optional but Recommended)**: For a more collaborative experience, we can implement real-time synchronization using WebSockets (e.g., via a service like Supabase Realtime or a custom solution with Socket.io). The backend would push changes to connected clients as they happen.

## 3. Conflict Resolution

Concurrent edits are inevitable in a multi-client, offline-first system. Our strategy will be Last-Write-Wins (LWW) based on a server-authoritative timestamp.

- **Timestamps**: Every record in the database will have a `updated_at` timestamp managed by the server. When a client pushes a change, it sends the record it's modifying.
- **Server-Side Logic**: The server will compare the `updated_at` timestamp of the incoming change with the one currently in the database.
  - If the incoming record is newer, the change is accepted.
  - If the database record is newer, the change is rejected, and the client is notified of the conflict. The client must then pull the latest version of the record and re-apply its changes if necessary.
- **Logical Clocks / Vector Clocks**: For more complex scenarios, especially with peer-to-peer or multi-master replication, Lamport timestamps or Vector Clocks could be considered. However, for a client-server model, server-authoritative timestamps are simpler and usually sufficient.

## 4. Optimistic Updates and Rollback Mechanisms

The UI should feel instantaneous. To achieve this, all user actions will be immediately reflected in the UI by writing directly to the local database.

- **Optimistic UI**: When a user creates or modifies data, the UI updates instantly from the local database. The change is then queued for synchronization.
- **Pending State**: UI elements representing data that is being synced can have a "pending" or "syncing" visual state.
- **Rollback**: In the rare case of a server-side rejection (e.g., a conflict or validation error), the local database must be rolled back to the server's state. The change is reverted, and the user is notified with a clear message explaining what happened and why their change couldn't be saved.

## 5. Network Detection and Queue Management

The application must be aware of its network status to manage synchronization.

- **Network Detection**: We will use platform-specific APIs (Browser's `navigator.onLine`, React Native's `NetInfo`) to monitor network connectivity. A global state hook/service will provide this information throughout the app.
- **Synchronization Queue**: A persistent queue (stored in the local database) will hold all outgoing changes.
  - When online, a background process will work through the queue, sending requests to the backend. Successful requests are removed from the queue.
  - When offline, all changes are simply added to the queue.
  - Upon regaining connectivity, the queue processing resumes automatically.
- **Request Batching**: To optimize network usage, especially on mobile, we can batch multiple queued changes into a single HTTP request.

## 6. Incremental Sync with Timestamps/Version Vectors

Full data syncs are inefficient. We will only sync data that has changed.

- **Last Sync Timestamp**: The client will store a `last_synced_at` timestamp for each data model or table.
- **Pulling Changes**: When syncing, the client requests all records from the server that have been created or updated since its `last_synced_at` timestamp.
- **Soft Deletes**: Deletions will be handled via a "soft delete" mechanism. Instead of removing records, we'll mark them with a `deleted_at` timestamp. This ensures that deletions are properly synced to other clients. A background job on the server can periodically clean up soft-deleted records.

## 7. Cache Invalidation and Data Consistency

The local database is our primary cache.

- **Server-Driven Updates**: The primary mechanism for invalidating the cache is the sync process itself. Pushing changes from the server (either via periodic polling or real-time WebSockets) ensures the local data stays fresh.
- **Data Consistency**: By relying on a single source of truth (the local database) for the UI, we ensure internal consistency within the client. The synchronization process is responsible for maintaining consistency with the backend and other clients.

## 8. Background Sync for Mobile Platforms

On mobile, it's crucial to be able to sync data even when the app is not in the foreground.

- **React Native**: We can use libraries like `react-native-background-fetch` or `react-native-background-task` to schedule periodic background tasks. These tasks will trigger our sync logic, processing the queue and pulling down fresh data.
- **Web (Progressive Web Apps)**: For the PWA version of the web app, Service Workers with the `Background Sync API` can be used to defer network requests (like our sync queue) until the user has stable connectivity.

## 9. Offline Indicator UX Patterns

Users should be clearly informed about the application's connectivity status.

- **Global Indicator**: A subtle, non-intrusive global UI element (e.g., a small banner, toast, or icon) can indicate when the application is offline.
- **Component-Level State**: UI elements related to data that is pending sync should have a distinct visual state (e.g., a small "syncing" icon, a slightly grayed-out appearance).
- **Informative Messaging**: If an action fails due to being offline, the UI should provide clear feedback. For example, instead of a generic "Error" message, show "You are offline. Your changes have been saved and will be synced when you're back online."
