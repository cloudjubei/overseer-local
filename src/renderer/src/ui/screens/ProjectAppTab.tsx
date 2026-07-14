import { useCallback, useState } from 'react'
import {
  useActiveProject,
  useProjectAppView,
  useProjectDataBridge,
  useChats,
  useStories,
  formatChatTitle,
  bridgeMessageName,
  type BridgeRequest,
} from 'thefactory-ui/headless'
import type { ChatContext } from 'thefactory-ui/headless/api'
import { ModelChipConnected, ProjectAppView } from 'thefactory-ui/web'
import ChatSidebarPanelConnected from '@ui/components/chat/ChatSidebarPanelConnected'

/**
 * Desktop peer of the App tab. Mirrors web's `ProjectAppTab` — the Electron renderer is Chromium,
 * so it reuses the web `ProjectAppView` with the activity-model chip floated over its top-right.
 * When the embedded app requests one (`overseer:chat.requestSidebar`), a docked chat sidebar is
 * shown beside the surface; "Discuss" (`overseer:chat.discuss`) opens a seeded project-topic chat
 * and SENDS the seed (live agent response), and "Create story" (`overseer:story.create`) hands a
 * finding to the standard story flow. All other `overseer:*` requests pass through to
 * `useProjectDataBridge`. Desktop is big-screen only — no bottom sheet.
 */
export default function ProjectAppTab() {
  const { projectId, project } = useActiveProject()
  const { url, key, error } = useProjectAppView(projectId)
  // The embedded app declares (via `overseer:app.capabilities`) whether its background activities are
  // API-only (a `requiresApi` activity, e.g. knowledge-analyze). When so, the activity chip disables CLI
  // and the bridge never sends a CLI model for this app.
  const [activitiesApiOnly, setActivitiesApiOnly] = useState(false)
  // Activity types the app allows on a CLI agent even when it's otherwise API-only (e.g. the trainer's
  // deep-research `research-training-papers`). When any exist, the chip offers CLI and the bridge sends
  // the CLI model for just those launches.
  const [cliActivities, setCliActivities] = useState<string[] | undefined>(undefined)
  const dataBridge = useProjectDataBridge(projectId, { activitiesApiOnly, cliActivities })
  const { createProjectTopic, sendMessage } = useChats()
  const { createStory, createFeature, stories } = useStories()

  const [sidebarEnabled, setSidebarEnabled] = useState(false)
  const [chatContext, setChatContext] = useState<ChatContext | null>(null)
  const [chatTitle, setChatTitle] = useState<string>('Chat')
  const [collapsed, setCollapsed] = useState(true)

  const onBridgeMessage = useCallback(
    async (req: BridgeRequest) => {
      const name = bridgeMessageName(req.type)
      if (name === 'app.capabilities') {
        const { activitiesApiOnly: apiOnly, cliActivities: cliActs } = (req.payload ?? {}) as {
          activitiesApiOnly?: boolean
          cliActivities?: string[]
        }
        setActivitiesApiOnly(!!apiOnly)
        setCliActivities(Array.isArray(cliActs) ? cliActs : undefined)
        return { ok: true }
      }
      if (name === 'chat.requestSidebar') {
        setSidebarEnabled(true)
        setChatContext((c) => c ?? (projectId ? { type: 'PROJECT', projectId } : null))
        return { ok: true }
      }
      if (name === 'chat.discuss') {
        if (!projectId) return { error: 'No active project' }
        const { title, seed, systemPrompt } = (req.payload ?? {}) as {
          title?: string
          seed?: string
          systemPrompt?: string
        }
        const chat = await createProjectTopic(
          projectId,
          (title ?? '').trim() || 'Discussion',
          systemPrompt,
        )
        setSidebarEnabled(true)
        setChatContext(chat.context)
        setChatTitle(chat.title ?? title ?? 'Discussion')
        setCollapsed(false)
        // Fire-and-forget: the bridge answer means "the chat is open and the seed is sent" — awaiting the
        // completion round-trip here made long first replies blow the bridge timeout, so the app showed
        // "Could not open chat" while the chat was in fact streaming.
        if (seed && seed.trim()) void sendMessage(chat.context, seed).catch(() => {})
        return { context: chat.context }
      }
      if (name === 'story.create') {
        const { title, description } = (req.payload ?? {}) as { title?: string; description?: string }
        if (!(title ?? '').trim()) return { error: 'A story needs a title' }
        const story = await createStory({ title: title!.trim(), description: description ?? '' })
        return { storyId: story.id }
      }
      if (name === 'story.feature.create') {
        // A feature inside a find-or-create STORY (matched by title) — the embedded-app "work on this"
        // seam for recurring buckets like "implement missing model components".
        const { storyTitle, storyDescription, feature } = (req.payload ?? {}) as {
          storyTitle?: string
          storyDescription?: string
          feature?: { title?: string; description?: string }
        }
        if (!(storyTitle ?? '').trim()) return { error: 'A story needs a title' }
        if (!(feature?.title ?? '').trim()) return { error: 'A feature needs a title' }
        const wanted = storyTitle!.trim().toLowerCase()
        const existing = stories.find((s) => (s.title ?? '').trim().toLowerCase() === wanted)
        const story =
          existing ?? (await createStory({ title: storyTitle!.trim(), description: storyDescription ?? '' }))
        const updated = await createFeature(story.id, {
          status: '-',
          title: feature!.title!.trim(),
          description: feature!.description ?? '',
          context: [],
        })
        const added = [...(updated.features ?? [])]
          .reverse()
          .find((f) => f.title === feature!.title!.trim())
        return { storyId: story.id, featureId: added?.id }
      }
      return dataBridge(req)
    },
    [dataBridge, projectId, createProjectTopic, sendMessage, createStory, createFeature, stories],
  )

  const effectiveTitle = chatContext
    ? formatChatTitle({ context: chatContext, chatTitle, projectName: project?.title })
    : 'Chat'

  return (
    <div className="flex w-full h-full bg-(--bg-surface)">
      <div className="flex-1 min-h-0">
        <ProjectAppView
          url={url}
          remountKey={key}
          onBridgeMessage={onBridgeMessage}
          topRightOverlay={
            <ModelChipConnected
              editable
              mode="activity"
              apiOnly={activitiesApiOnly && !cliActivities?.length}
            />
          }
          fallback={
            <div className="flex h-full items-center justify-center p-8 text-center text-(--text-secondary)">
              <div>
                <p className="text-base font-medium text-(--text-primary)">
                  {error ? 'App view unavailable' : 'No app to view yet'}
                </p>
                <p className="mt-2 text-sm">
                  {error
                    ? error.message
                    : 'Run a story to scaffold this project’s app surface, then come back to this tab.'}
                </p>
              </div>
            </div>
          }
          style={{ width: '100%', height: '100%' }}
        />
      </div>
      {sidebarEnabled && chatContext && (
        <ChatSidebarPanelConnected
          context={chatContext}
          chatContextTitle={effectiveTitle}
          collapsed={collapsed}
          onCollapsedChange={setCollapsed}
        />
      )}
    </div>
  )
}
