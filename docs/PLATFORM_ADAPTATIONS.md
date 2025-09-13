# Platform Adaptation and Multi-Client Strategy

This document outlines the plan for extending the application to support multiple clients: the existing Electron desktop app, a new React web app, and a new React Native mobile app. The core of this strategy is a centralized backend that all clients will communicate with, enabling data synchronization and shared functionality while accommodating platform-specific needs.

## 1. Electron App Migration Plan

The current Electron application operates entirely on the local machine. The migration will involve connecting it to the new backend services while preserving its powerful offline capabilities.

- **Backend Integration**: All services currently managing local data (e.g., `projects`, `tasks`, `files`) will be refactored to communicate with a REST or GraphQL API. This includes `src/renderer/services` and parts of the main process logic.
- **Offline-First Sync**: The app will use a local database (e.g., SQLite via `better-sqlite3` or a file-based solution like PouchDB/CouchDB) as the primary source of truth for the UI. A synchronization layer will be built to push and pull changes to/from the backend when the application is online.
- **Local Agent Orchestration**: The `factory-ts` agent orchestrator will continue to run locally for performance and to leverage local file system access. However, its state, history, and outputs will be synchronized with the backend, allowing them to be viewed on other clients.
- **File Management**: While maintaining direct file system access, the app will sync file metadata and content (where appropriate) with a central storage solution (e.g., S3). A local cache will be maintained for offline access and performance.

## 2. React Web App Considerations

The web app will provide accessibility from any modern browser, sharing a significant portion of its codebase with the Electron app's renderer process.

- **Progressive Web App (PWA)**: We will implement PWA features, including:
  - **Service Workers**: For offline caching of application assets and data, providing a baseline offline experience.
  - **Web App Manifest**: To allow users to "install" the app to their home screen on desktop and mobile devices.
- **Browser Limitations**:
  - **Storage**: We will use `IndexedDB` for storing structured data, being mindful of browser-specific storage quotas.
  - **File System**: Access to the file system will be limited to user-initiated actions via the File System Access API where available, or standard file input elements otherwise.
- **Responsive Design**: The UI will be fully responsive, adapting from mobile browser viewports to large desktop screens. This will be a primary consideration in component design, likely using a utility-first CSS framework like Tailwind CSS.

## 3. React Native Mobile App Considerations

The mobile app will provide a truly native experience for iOS and Android users.

- **Navigation**: A robust navigation library like `React Navigation` will be used to manage screens, tabs, and navigation stacks, providing a native feel.
- **Native Modules**: For features requiring access to device hardware or platform-specific APIs (e.g., camera, contacts, secure storage), we will use community-maintained native modules or create our own bridges if necessary.
- **Platform-Specific UI**: We will adhere to the Human Interface Guidelines (iOS) and Material Design (Android) principles. Components will be styled or selected at runtime based on the platform (`Platform.select`) to feel at home on each OS.
- **Performance**: We will optimize for mobile performance, particularly for list rendering (`FlashList`), animations (Reanimated), and startup time.

## 4. Platform-Specific File Handling and Storage

- **Electron**: Full local file system access. A dedicated local cache directory will store files for offline use, synced with the backend.
- **Web**: Uses `IndexedDB` for structured data and the `Cache API` for file blobs. File uploads and downloads will be handled via the backend API.
- **React Native**: Uses a local database (e.g., WatermelonDB, Realm, or SQLite) for data. Files will be stored in the app's sandboxed file system using libraries like `react-native-fs`.

## 5. Authentication Flows

Authentication will be centralized through an OAuth 2.0 / OIDC provider (e.g., Auth0, Firebase Auth).

- **Electron**: Implement an OAuth flow by opening the system browser for login. A custom protocol handler (`myapp://auth`) will redirect the user back to the Electron app with the authentication tokens. Tokens will be securely stored in the OS keychain.
- **Web**: Standard web OAuth redirect flow. Tokens will be managed securely, likely using `HttpOnly` cookies to prevent XSS attacks.
- **React Native**: Use libraries like `react-native-app-auth` which leverage `SFSafariViewController` on iOS and Custom Tabs on Android for a secure OAuth flow. Tokens will be stored in the device's secure keychain.

## 6. Push Notifications Strategy

A backend service will be responsible for dispatching notifications to all clients.

- **Mobile (React Native)**: Integrate with Firebase Cloud Messaging (FCM) for Android and Apple Push Notification service (APNs) for iOS. The app will request user permission, register for a device token, and send it to our backend.
- **Web**: Use the Web Push API. A service worker will listen for push events, allowing notifications to be delivered even when the app is not in an active browser tab.
- **Electron**: While Electron doesn't have a traditional "push" mechanism, it can receive real-time updates via a WebSocket connection to the backend and use the native `Notification` API to display them to the user.

## 7. Desktop vs. Mobile UX Differences

The user experience will be tailored to the platform.

- **Layout & Density**: Desktop will feature multi-pane layouts and higher information density. Mobile will focus on single-screen tasks and a cleaner, more focused UI.
- **Input Methods**: Desktop design will prioritize mouse (hover, right-click) and keyboard (shortcuts). Mobile design will be touch-first (taps, swipes, gestures).
- **Component Adaptation**: Core UI components will be designed to be adaptive, but some will have distinct mobile-only or desktop-only implementations to provide the best experience.

## 8. Platform-Specific Build and Deployment Processes

- **Shared Logic**: Common business logic will be maintained in a shared monorepo package that can be consumed by all clients.
- **Electron**: `electron-builder` will be used to package the app for macOS, Windows, and Linux. Releases will be published via an auto-update server or platform-specific app stores.
- **Web**: The React app will be bundled using Vite and deployed to a static hosting provider like Vercel or Netlify, connected to a CI/CD pipeline.
- **React Native**: CI/CD pipelines (e.g., GitHub Actions with Fastlane) will be set up to build and deploy the app to the Apple App Store (via TestFlight) and Google Play Store (via internal testing tracks).
