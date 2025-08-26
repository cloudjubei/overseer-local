# UI Standards and Conventions

This document defines standards for creating and styling views in the Electron renderer (React + TypeScript). It aims to ensure consistency across screens, modals, and UI components.

Scope
- Screens under src/renderer/screens
- Task modals under src/renderer/tasks
- Shared UI components under src/renderer/components
- Hooks under src/renderer/hooks
- Services under src/renderer/services
- Navigation under src/renderer/navigation

Core Principles
1) Separation of concerns
- Screens/components focus on presentational UI.
- Logic goes into hooks (src/renderer/hooks) and IPC/data access goes into services (src/renderer/services).
- Do not call window.* APIs directly in screens/components; call services instead.

2) Centralized navigation
- Use Navigator (src/renderer/navigation/Navigator.tsx) as the single source of truth for the current view and modal state.
- Do not parse location.hash manually; use Navigator helpers and hooks.

3) Predictable layouts and overflow
- Compose layouts with flexbox; ensure min-w-0 and min-h-0 on flexible containers to avoid overflow bugs.
- Only the innermost scrolling region should use overflow-auto; avoid stacking multiple overflow contexts.

4) Accessibility and semantics
- Prefer semantic elements (header, nav, main, section, footer) where applicable.
- Ensure interactive controls are keyboard accessible and labelled (aria-label, aria-labelledby).
- Modals must trap focus, support Esc to close, and restore focus when dismissed.

5) Type safety and naming
- Components: PascalCase (e.g., DocumentsView, ChatView).
- Hooks: camelCase prefixed with use (e.g., useDocsIndex, useChats).
- Services: camelCase suffixed with Service (e.g., chatService).
- Shared types live in src/renderer/types.ts. Export only what is used by multiple modules.

6) Styling approach
- Use utility-first classNames and project styles provided in src/index.css.
- Prefer className composition in components; avoid inline style objects except for dynamic values that cannot be expressed via classes.
- Keep global styles minimal and generic; scope specific styling to components.

7) Testability and evolvability
- Extract side-effectful or complex logic into hooks/services to simplify mocking and testing.
- Keep screens thin; favor small, reusable leaf components for complex UI pieces.


Folder and File Placement
- Screens: src/renderer/screens/<Name>View.tsx (e.g., TasksView.tsx, DocumentsView.tsx)
- Modals for tasks: src/renderer/tasks/<Name>View.tsx (e.g., TaskCreateView.tsx)
- Shared UI components: src/renderer/components/... (e.g., components/ui/Modal.tsx)
- Hooks: src/renderer/hooks/useFeatureName.ts
- Services: src/renderer/services/featureService.ts
- Navigation helpers and modal host: src/renderer/navigation/


Standard Screen Structure
- Each screen is a functional component that renders layout and delegates data/logic to hooks.
- Use a top-level flex column with min-h-0 to allow children to scroll properly.
- Only the content area scrolls (overflow-auto).

Template

import React from 'react'
import { useToast } from '../components/ui' // if needed
import { useNavigator } from '../navigation' // if navigation helpers are needed
// Import your feature hook(s) and services via hooks/services

export default function ExampleView() {
  // const { openModal, navigateTo } = useNavigator()
  // const { data, isLoading, error } = useExample()

  return (
    <div className="flex flex-col min-h-0 w-full">
      <header className="shrink-0 px-4 py-2 border-b">
        <h1 className="text-lg font-semibold">Example</h1>
      </header>

      {/* The scrollable content region */}
      <main className="flex-1 min-h-0 overflow-auto p-4">
        {/* Render lists or details here; avoid additional overflow unless necessary */}
      </main>
    </div>
  )
}


Sidebar + Content Pattern
- Use a parent flex row; sidebar has fixed width and its own overflow-y-auto.
- Content area must include min-w-0 and min-h-0.

<div className="flex min-h-0 w-full">
  <aside className="w-64 shrink-0 border-r overflow-y-auto">
    {/* Sidebar items here */}
  </aside>
  <section className="flex-1 min-w-0 min-h-0 overflow-auto">
    {/* Main content that can scroll */}
  </section>
</div>


Modals: Contract and Usage
- All modals must accept an optional onRequestClose?: () => void prop and call it when they want to close.
- Do not call window.close(); let the parent control closing.
- Render modals through the global ModalHost mounted in App, using Navigator's openModal/closeModal.
- Use components/ui/Modal for consistent styling and accessibility.

Example modal skeleton

import React from 'react'
import { Modal } from '../components/ui'

type Props = { onRequestClose?: () => void }

export default function ExampleCreateView({ onRequestClose }: Props) {
  return (
    <Modal title="Create Example" onClose={onRequestClose}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); /* submit */ onRequestClose?.() }}>
        {/* Form fields */}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={() => onRequestClose?.()}>Cancel</button>
          <button type="submit" className="btn-primary">Create</button>
        </div>
      </form>
    </Modal>
  )
}


Hooks and Services
- Hooks manage component state and side effects; they subscribe/unsubscribe to services as needed in useEffect with cleanup.
- Services encapsulate window.* IPC calls with typed functions and minimal transformation.
- Errors should be caught in hooks/services and surfaced to UI; use Toasts for user-visible error/info.

Hook pattern

import { useEffect, useState } from 'react'
import { exampleService } from '../services/exampleService'

export function useExample() {
  const [data, setData] = useState<Thing[] | null>(null)
  const [isLoading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await exampleService.list()
        if (!cancelled) setData(res)
      } catch (e) {
        if (!cancelled) setError(e as Error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  return { data, isLoading, error }
}


Styling Conventions
- Base: Use project-wide styles in src/index.css for resets/base layout.
- Utilities: Prefer utility classes (e.g., flex, min-h-0, min-w-0, overflow-auto, p-4) for layout.
- Spacing: Use small, consistent gaps (gap-2/3/4) and padding (p-2/3/4) for readable density.
- Buttons: Use shared button classes (e.g., btn-primary, btn-secondary) if available; otherwise, define in a shared component.
- Scroll areas: Only one overflow-auto per region; ensure the nearest flex parent has min-h-0 and/or min-w-0 as appropriate.


Navigation Rules
- Use Navigator context for reading currentView and for changing views (navigateToX helpers, or setHash via Navigator API).
- For modals, use openModal/closeModal from Navigator instead of rendering local modal roots.
- Do not implement custom hash parsing; rely on Navigator.


Accessibility Checklist
- All interactive elements are reachable via keyboard (Tab/Shift+Tab) and have visible focus states.
- Provide aria-labels for icon-only buttons.
- Modals trap focus and close on Escape.
- Inputs are associated with labels via for/id or aria-labelledby.


Async/IPC and Errors
- Wrap all service calls with try/catch in hooks; use Toasts to surface human-friendly messages.
- Never allow unhandled promise rejections; always await async calls inside effects or event handlers.
- Be explicit about loading states to prevent layout jank.


Naming Checklist
- Screens: <Feature>View.tsx (e.g., DocumentsView.tsx)
- Modals: <Thing><Action>View.tsx (e.g., TaskCreateView.tsx)
- Hooks: use<Thing><Action>.ts (e.g., useDocsIndex.ts)
- Services: <thing>Service.ts (e.g., chatService.ts)


When Creating a New Screen
1) Place the file under src/renderer/screens as <Name>View.tsx
2) Start with the standard screen template.
3) Add a hook for logic; introduce a service if you need IPC.
4) Ensure correct layout semantics: min-h-0/min-w-0, overflow only on scrollable area.
5) Wire navigation via Navigator; do not parse the URL hash yourself.
6) Add accessibility labels and keyboard handling.

When Creating a New Modal
1) Place the file under src/renderer/tasks or components if generic.
2) Accept onRequestClose and call it to close.
3) Use Modal from components/ui.
4) Keep the modal logic thin; move data access to hooks/services.
5) Show toasts on success/failure if appropriate.


References
- Navigation: src/renderer/navigation/Navigator.tsx, ModalHost.tsx
- UI Utilities: src/renderer/components/ui
- Hooks: src/renderer/hooks
- Services: src/renderer/services
- Types: src/renderer/types.ts
- Global styles: src/index.css
