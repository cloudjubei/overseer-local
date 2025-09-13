import React, { ReactNode, useEffect } from 'react'
import { MemoryRouter } from 'react-router-dom'
import type { ProviderFactoryOptions } from '../previewTypes'
import { asWrapper, createPreviewRegistry } from '../previewRegistry'

// Theme provider: apply data-theme to <html> (light/dark)
function themeWrapper(theme: 'light' | 'dark' | 'system') {
  return (node: ReactNode) => {
    // apply to documentElement
    const el = document.documentElement
    const prev = el.getAttribute('data-theme')
    const value = theme === 'system' ? '' : theme
    if (value) el.setAttribute('data-theme', value)
    else el.removeAttribute('data-theme')

    return <>{node}</>
  }
}

// Router provider
function RouterProvider({ children }: { children: ReactNode }) {
  return <MemoryRouter initialEntries={['/']}>{children}</MemoryRouter>
}

// Simple box wrapper to simulate app chrome spacing
function Frame({ children }: { children: ReactNode }) {
  return <div style={{ padding: 16, background: 'var(--surface, transparent)' }}>{children}</div>
}

// Registry with sensible defaults
export function createDefaultMocksRegistry() {
  const registry = createPreviewRegistry()

  registry.register('theme', (opts: ProviderFactoryOptions) => ({
    wrap: themeWrapper((opts.theme ?? 'light') as any),
  }))

  registry.register(
    'router',
    asWrapper((node) => <RouterProvider>{node}</RouterProvider>),
  )

  // A subtle frame wrapper; can be opted-in by declaring 'frame'
  registry.register(
    'frame',
    asWrapper((node) => <Frame>{node}</Frame>),
  )

  // Example in-memory tasks service context for previews.
  // We don't try to override app imports; instead, components that want this can declare 'tasksMock'.
  const TasksContext = React.createContext<{ tasks: any[]; addTask: (t: any) => void } | null>(null)
  function TasksProvider({ children }: { children: ReactNode }) {
    const [tasks, setTasks] = React.useState<any[]>([
      { id: 'T-1', title: 'Sample task', status: 'Todo', priority: 'P2' },
      { id: 'T-2', title: 'Make previews awesome', status: 'In Progress', priority: 'P1' },
    ])
    const addTask = (t: any) => setTasks((s) => [...s, t])
    return <TasksContext.Provider value={{ tasks, addTask }}>{children}</TasksContext.Provider>
  }
  ;(globalThis as any).__PreviewTasksContext = TasksContext
  registry.register(
    'tasksMock',
    asWrapper((node) => <TasksProvider>{node}</TasksProvider>),
  )

  // Notifications mock
  const NotificationsContext = React.createContext<{ items: any[]; push: (n: any) => void } | null>(
    null,
  )
  function NotificationsProvider({ children }: { children: ReactNode }) {
    const [items, setItems] = React.useState<any[]>([])
    const push = (n: any) => setItems((s) => [...s, { id: String(Date.now()), ...n }])
    return (
      <NotificationsContext.Provider value={{ items, push }}>
        {children}
      </NotificationsContext.Provider>
    )
  }
  ;(globalThis as any).__PreviewNotificationsContext = NotificationsContext
  registry.register(
    'notificationsMock',
    asWrapper((node) => <NotificationsProvider>{node}</NotificationsProvider>),
  )

  // LLM config mock
  const LLMConfigContext = React.createContext<{ providers: any[] } | null>(null)
  function LLMConfigProvider({ children }: { children: ReactNode }) {
    const [providers] = React.useState<any[]>([
      { id: 'openai', name: 'OpenAI', model: 'gpt-4o-mini' },
    ])
    return <LLMConfigContext.Provider value={{ providers }}>{children}</LLMConfigContext.Provider>
  }
  ;(globalThis as any).__PreviewLLMConfigContext = LLMConfigContext
  registry.register(
    'llmMock',
    asWrapper((node) => <LLMConfigProvider>{node}</LLMConfigProvider>),
  )

  return registry
}

export type {}
