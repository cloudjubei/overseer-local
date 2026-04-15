# 06 - Mobile App (Deferred)

## Summary

A React Native app for Android and iOS that mirrors Overseer's capabilities. **This item is deferred to a separate planning chat** due to significant open questions around local execution, database choices, and platform-specific adapters.

**Repository:** `thefactory-overseer-mobile`
**Status:** Deferred -- to be planned in a separate dedicated chat

---

## Why Deferred

`thefactory-tools` and `thefactory-db` are Node.js libraries that rely on `fs`, `child_process`, `pg`, `chokidar`, `dockerode`, etc. These do not exist in React Native. Making them work on mobile requires either:

1. An adapter/abstraction layer with React Native implementations for each Node.js API (significant refactoring)
2. Running everything through the backend (defeats the goal of local-first mobile)
3. Alternative libraries (isomorphic-git, PGlite, expo-file-system, etc.) that may not have feature parity

The decision on which path to take -- and whether the mobile app should truly be local-first or backend-connected -- should be made after Phase 1 (backend + web + desktop hybrid) is complete, when we understand the client-server boundary better.

---

## Key Questions to Resolve in Separate Chat

### Local execution

- Which features must work offline on mobile?
- Is `isomorphic-git` sufficient for git operations on mobile?
- Can tree-sitter WASM work in React Native's JS runtime (Hermes/JSC)?
- Can LLM completion calls (direct HTTP to providers) work from mobile? (Yes, but API key management is a concern)

### Database

- **PGlite** (Postgres compiled to WASM): closest to current thefactory-db, but experimental on mobile
- **SQLite** (expo-sqlite): battle-tested on mobile, but means a second DB implementation for search
- **Remote Postgres only**: mobile connects to backend's DB (requires network)
- **Hybrid**: SQLite for local/offline, sync to Postgres backend when connected

### UI

- React Native uses different rendering primitives than React DOM -- no UI component sharing
- **NativeWind** could keep the Tailwind mental model for styling
- Need a full separate component library for mobile
- Navigation: React Navigation (standard for RN) vs Expo Router

### Build and distribution

- Expo (managed workflow) vs bare React Native
- App Store / Play Store distribution
- Code signing, certificates, review process

---

## What We Know

- The mobile app should be a **complete reflection** of overseer-local's capabilities
- It should be **as local-enabled as possible**
- It should also be able to connect to the backend (hybrid, same as desktop)
- The core value prop (projects, stories, chat, completions) is portable -- it's mostly data and HTTP calls
- File operations, git, tests, and code intel are the hard parts for mobile

---

## Prerequisite

Phase 1 must be complete before tackling mobile seriously. By then we will have:
- A stable backend API that mobile can consume
- A clear understanding of which operations must be local vs can be remote
- The service interface abstractions from overseer-local's hybrid mode, which mobile can implement
