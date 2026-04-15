# 02 - thefactory-overseer-web

## Summary

A browser-based React web application that provides the same project management, chat, stories, and agent capabilities as `overseer-local`, consuming the `thefactory-backend` API. This is a pure client -- all business logic runs server-side.

**Repository:** `thefactory-overseer-web`
**Dependencies:** `thefactory-backend` (API), types from `thefactory-tools` (build-time only)
**Phase:** 1 (developed alongside backend and overseer-local hybrid mode)

---

## Why This Exists

The desktop app requires installation and is limited to one machine. A web app lets users access their projects from any browser, collaborate, and reduces onboarding friction. It also validates the backend API design since the web app is 100% dependent on it.

---

## Architecture

```
Browser
┌─────────────────────────────────────────┐
│        thefactory-overseer-web          │
│                                         │
│  ┌──────────┐  ┌──────────────────────┐ │
│  │ React UI │  │  API Client Layer    │ │
│  │ (screens,│  │  (HTTP + WebSocket)  │ │
│  │  comps)  │  │                      │ │
│  └────┬─────┘  └──────────┬───────────┘ │
│       │                   │             │
│  ┌────┴───────────────────┴───────────┐ │
│  │     Contexts / State Management    │ │
│  └────────────────────────────────────┘ │
└─────────────────────────────────────────┘
         │ HTTP/WS │
         ▼         ▼
┌─────────────────────────────────────────┐
│          thefactory-backend             │
└─────────────────────────────────────────┘
```

---

## Tech Stack

- **Framework:** React 19 + TypeScript (same as overseer-local renderer)
- **Bundler:** Vite (the renderer already uses Vite via electron-vite)
- **Styling:** Tailwind CSS 4 (same as overseer-local)
- **Components:** Radix UI primitives (same as overseer-local) -- consider expanding to shadcn/ui for a richer set
- **Routing:** React Router (replacing the hash-based navigation in overseer-local)
- **API client:** Typed fetch wrapper + native WebSocket (or a library like `reconnecting-websocket`)
- **State management:** React Context (matching overseer-local's pattern) -- evaluate Zustand if context nesting becomes unwieldy

---

## Relationship to overseer-local's Renderer

The web app's UI is structurally very similar to overseer-local's renderer (`overseer-local/src/renderer/src/`). The key differences:

### What changes

| overseer-local | web app |
|---|---|
| `window.*Service` (IPC via preload) | HTTP/WebSocket API client |
| Hash-based navigation (`Navigator.tsx`) | React Router |
| Electron-specific features (native dialogs, OS notifications, `sharp`) | Web equivalents (file input, Web Notifications API, browser image handling) |
| Local file paths in UI | Server-relative paths or virtual paths |

### What stays the same

- Screen structure: Home, Stories, Chat, Git, Files, Tests, Settings, Tools, Timeline
- Component library: `components/ui/*` (Button, Modal, Input, Toast, Select, etc.)
- Context pattern: Projects, Stories, Chats, Files, Git, Agents, LLMConfigs, etc.
- Tailwind styling and Radix primitives
- Markdown rendering (react-markdown, remark-gfm, etc.)

### Migration strategy

1. **Copy the renderer** as the starting point for the web app
2. **Replace service layer:** swap `window.*Service` objects with an API client that makes HTTP/WS calls to the backend
3. **Replace navigation:** swap `Navigator.tsx` hash routing with React Router
4. **Remove Electron dependencies:** anything from `@electron-toolkit`, preload references, native dialogs
5. **Adjust file-related UIs:** file upload replaces local file picking, paths are server-relative

This is the most pragmatic approach. The two codebases will diverge over time, but they start from the same foundation.

---

## API Client Layer

The web app needs a service layer that mirrors the IPC surface but talks HTTP/WS:

```typescript
// Example: replaces window.projectsService
const projectsService = {
  list: () => api.get<Project[]>('/projects'),
  get: (id: string) => api.get<Project>(`/projects/${id}`),
  create: (data: ProjectInput) => api.post<Project>('/projects', data),
  update: (id: string, data: ProjectPatch) => api.put<Project>(`/projects/${id}`, data),
  delete: (id: string) => api.delete(`/projects/${id}`),
  subscribe: (callback: (projects: Project[]) => void) => ws.on('projects:updated', callback),
}
```

This pattern repeats for every domain (stories, chats, completions, files, git, etc.). The subscribe methods connect to WebSocket channels instead of IPC.

A single `ApiClient` class can handle:
- Base URL configuration
- Auth token management (attach to every request)
- Request/response serialization
- Error handling and retry logic
- WebSocket connection lifecycle and reconnection

---

## Screens

All screens from overseer-local apply to the web app, with these notes:

| Screen | Web-specific considerations |
|---|---|
| **Home / Stories** | No changes needed beyond API client swap |
| **Chat** | Streaming completions via WebSocket instead of IPC events |
| **Files** | File upload via form data; no native file picker dialogs; file tree rendered from server data |
| **Git** | All operations are server-side; no local repo access. Commit graph, diffs, and merge UI work the same |
| **Tests** | Server runs tests; results streamed back. Cannot run tests locally |
| **Settings** | No Electron-specific settings (window behavior, etc.); add backend connection settings |
| **Tools** | Tool execution is server-side; preview/execute via API |
| **Timeline** | No changes |
| **Project wizard** | Directory selection replaced with: choose from server workspace, import from git URL, or upload |

---

## Web-Specific Features (not in desktop)

- **URL-based deep links:** `/projects/:id/stories/:storyId` etc.
- **Browser notifications:** via Web Notifications API (with permission prompt)
- **Responsive layout:** the desktop app has a fixed sidebar; web should be responsive for various screen sizes
- **Login/signup flow:** web needs auth UI that the desktop app doesn't have currently

---

## Open Questions

1. **Hosting:** static SPA served from CDN/backend, or SSR (Next.js/Remix)? SPA is simpler and matches the current architecture.
2. **Offline support:** any requirement for PWA/service worker? Initially probably not -- the web app is backend-dependent by design.
3. **Collaborative features:** if multiple users can access the same project, the web app needs conflict resolution UX. Defer to later.
4. **File editing:** does the web app need a code editor (Monaco/CodeMirror)? The desktop app shows file content but editing is done via agents. Same model for web, or add direct editing?

---

## Implementation Strategy

### Step 1: Scaffold the project

- Vite + React + TypeScript + Tailwind + Radix
- React Router setup
- API client skeleton with auth

### Step 2: Port the service layer

- Create typed API client matching each `window.*Service` interface
- WebSocket client for subscriptions
- Test against backend API

### Step 3: Port screens incrementally

Priority order (by dependency and user value):
1. Auth/login (web-only, needed first)
2. Projects + project wizard (entry point)
3. Stories + features (core workflow)
4. Chat + completions (core value prop)
5. Settings + LLM configs
6. Files
7. Git
8. Tests
9. Tools, Timeline, Live Data

### Step 4: Polish

- Responsive design
- Loading states and error handling
- Browser notifications
- Deep linking
