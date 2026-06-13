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
  const dataBridge = useProjectDataBridge(projectId)
  const { createProjectTopic, sendMessage } = useChats()
  const { createStory } = useStories()

  const [sidebarEnabled, setSidebarEnabled] = useState(false)
  const [chatContext, setChatContext] = useState<ChatContext | null>(null)
  const [chatTitle, setChatTitle] = useState<string>('Chat')
  const [collapsed, setCollapsed] = useState(true)

  const onBridgeMessage = useCallback(
    async (req: BridgeRequest) => {
      const name = bridgeMessageName(req.type)
      if (name === 'chat.requestSidebar') {
        setSidebarEnabled(true)
        setChatContext((c) => c ?? (projectId ? { type: 'PROJECT', projectId } : null))
        return { ok: true }
      }
      if (name === 'chat.discuss') {
        if (!projectId) return { error: 'No active project' }
        const { title, seed } = (req.payload ?? {}) as { title?: string; seed?: string }
        const chat = await createProjectTopic(projectId, (title ?? '').trim() || 'Discussion')
        setSidebarEnabled(true)
        setChatContext(chat.context)
        setChatTitle(chat.title ?? title ?? 'Discussion')
        setCollapsed(false)
        if (seed && seed.trim()) await sendMessage(chat.context, seed)
        return { context: chat.context }
      }
      if (name === 'story.create') {
        const { title, description } = (req.payload ?? {}) as { title?: string; description?: string }
        if (!(title ?? '').trim()) return { error: 'A story needs a title' }
        const story = await createStory({ title: title!.trim(), description: description ?? '' })
        return { storyId: story.id }
      }
      return dataBridge(req)
    },
    [dataBridge, projectId, createProjectTopic, sendMessage, createStory],
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
          topRightOverlay={<ModelChipConnected editable mode="activity" />}
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
