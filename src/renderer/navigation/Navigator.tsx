import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { NavigationView } from '../types'
import type { FeatureFormValues } from '../components/stories/FeatureForm'

export type StoriesRoute =
  | { name: 'list' }
  | { name: 'details'; storyId: string; highlightFeatureId?: string; highlightStory?: boolean }

export type ModalRoute =
  | { type: 'story-create' }
  | { type: 'story-edit'; storyId: string }
  | {
      type: 'feature-create'
      storyId: string
      initialValues?: Partial<FeatureFormValues>
      focusDescription?: boolean
    }
  | { type: 'feature-edit'; storyId: string; featureId: string }
  | { type: 'llm-config-add' }
  | { type: 'llm-config-edit'; id: string }
  | { type: 'github-credentials-add' }
  | { type: 'github-credentials-edit'; id: string }
  | { type: 'projects-manage'; mode?: 'list' | 'create' | 'edit'; projectId?: string }

export type NavigatorState = {
  currentView: NavigationView
  storiesRoute: StoriesRoute
}
export type ModalState = {
  modal: ModalRoute | null
}

export type NavigatorApi = NavigatorState &
  ModalState & {
    openModal: (m: ModalRoute) => void
    closeModal: () => void
    navigateView: (v: NavigationView) => void
    navigateStoryDetails: (
      storyId: string,
      highlightFeatureId?: string,
      highlightStory?: boolean,
    ) => void
    navigateAgentRun: (runId: string) => void
  }

function viewPrefixToView(prefix: string): NavigationView {
  switch (prefix) {
    case 'files':
      return 'Files'
    case 'chat':
      return 'Chat'
    case 'settings':
      return 'Settings'
    case 'notifications':
      return 'Notifications'
    case 'agents':
      return 'Agents'
    case 'all-agents':
      return 'AllAgents'
    case 'live-data':
      return 'LiveData'
    case 'project-timeline':
      return 'ProjectTimeline'
    case 'tools':
      return 'Tools'
    case 'tests':
      return 'Tests'
    case 'home':
    default:
      return 'Home'
  }
}

const uuidRegex =
  /[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}/

function parseHash(hashRaw: string): NavigatorState {
  const raw = (hashRaw || '').replace(/^#/, '')

  const [prefixRaw] = raw.split('/')
  const prefix = prefixRaw || 'home'

  const currentView: NavigationView = viewPrefixToView(prefix)

  let storiesRoute: StoriesRoute = { name: 'list' }
  let m: RegExpExecArray | null
  if (
    (m =
      /^story\/([0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12})(?:\/highlight-story)?(?:\/highlight-feature\/([0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}))?/.exec(
        raw,
      ))
  ) {
    const storyId = m[1]
    const highlightFeatureId = m[2] || undefined
    const highlightStory = raw.includes('/highlight-story') ? true : undefined
    storiesRoute = { name: 'details', storyId, highlightFeatureId, highlightStory }
  }

  return { currentView, storiesRoute }
}

const NavigatorContext = createContext<NavigatorApi | null>(null)

export function NavigatorProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<NavigatorState>(() => parseHash(window.location.hash))
  const [modal, setModal] = useState<ModalState>({ modal: null })

  useEffect(() => {
    const onHash = () => {
      const next = parseHash(window.location.hash)
      setState(next)
    }
    window.addEventListener('hashchange', onHash)
    onHash()
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const openModal = useCallback((m: ModalRoute) => {
    setModal({ modal: m })
  }, [])

  const closeModal = useCallback(() => {
    setModal({ modal: null })
  }, [])

  const navigateView = useCallback((v: NavigationView) => {
    switch (v) {
      case 'Home':
        window.location.hash = '#home'
        break
      case 'Files':
        window.location.hash = '#files'
        break
      case 'Chat':
        window.location.hash = '#chat'
        break
      case 'Settings':
        window.location.hash = '#settings'
        break
      case 'Notifications':
        window.location.hash = '#notifications'
        break
      case 'Agents':
        window.location.hash = '#agents'
        break
      case 'AllAgents':
        window.location.hash = '#all-agents'
        break
      case 'LiveData':
        window.location.hash = '#live-data'
        break
      case 'ProjectTimeline':
        window.location.hash = '#project-timeline'
        break
      case 'Tests':
        window.location.hash = '#tests'
        break
    }
  }, [])

  const navigateStoryDetails = useCallback(
    (storyId: string, highlightFeatureId?: string, highlightStory: boolean = false) => {
      let hash = `#story/${storyId}`
      if (highlightFeatureId) {
        hash += `/highlight-feature/${highlightFeatureId}`
      } else if (highlightStory) {
        hash += `/highlight-story`
      }
      window.location.hash = hash
    },
    [],
  )

  const navigateAgentRun = useCallback((runId: string) => {
    window.location.hash = `#agents/run/${runId}`
  }, [])

  const value = useMemo<NavigatorApi>(
    () => ({
      ...state,
      ...modal,
      openModal,
      closeModal,
      navigateView,
      navigateStoryDetails,
      navigateAgentRun,
    }),
    [state, modal, openModal, closeModal, navigateView, navigateStoryDetails, navigateAgentRun],
  )

  return <NavigatorContext.Provider value={value}>{children}</NavigatorContext.Provider>
}

export function useNavigator(): NavigatorApi {
  const ctx = useContext(NavigatorContext)
  if (!ctx) throw new Error('useNavigator must be used within NavigatorProvider')
  return ctx
}
