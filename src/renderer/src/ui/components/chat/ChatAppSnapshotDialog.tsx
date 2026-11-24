import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  navCurrentReply,
  parseAppElementPick,
  parseBridgeMessage,
  bridgeMessageName,
  useProjectAppView,
  useProjectDataBridge,
  useScreenshotAnnotation,
  type AppDeepLink,
  type AppNote,
  type BridgeRequest,
} from 'thefactory-ui/headless'
import { useApi, type ChatContext } from 'thefactory-ui/headless/api'
import { Button, ProjectAppView, ScreenshotAnnotationPanel } from 'thefactory-ui/web'
import { createAppSnapshotAdapter } from '@services/appSnapshotAdapter'

export default function ChatAppSnapshotDialog({
  context,
  projectId,
  onClose,
  addNote,
  noteIds,
}: {
  context: ChatContext
  projectId: string
  onClose: () => void
  addNote: (note: AppNote) => void
  noteIds: () => string[]
}): React.JSX.Element {
  const dialog = useRef<HTMLDialogElement>(null)
  const surface = useRef<HTMLDivElement>(null)
  const { url, key, error } = useProjectAppView(projectId)
  const dataBridge = useProjectDataBridge(projectId)
  const { uploadChatFile } = useApi()
  const [route, setRoute] = useState<AppDeepLink | null>(null)
  const [picking, setPicking] = useState(true)
  const pickSession = useMemo(() => ({ url, key, route }), [url, key, route])
  const activePick = useRef<typeof pickSession | null>(null)
  const mountedApp = useRef<typeof pickSession | null>(null)
  const loadedFrame = useRef<EventTarget | null>(null)
  const stopPicking = (): void => {
    activePick.current = null
    setPicking(false)
  }
  useLayoutEffect(() => {
    const previous = mountedApp.current
    mountedApp.current = pickSession
    if (
      error ||
      (previous?.url &&
        (previous.url !== url ||
          previous.key !== key ||
          (previous.route && previous.route !== route)))
    ) {
      setPicking(false)
      return
    }
    activePick.current = url && !error && picking ? pickSession : null
    return () => {
      activePick.current = null
    }
  }, [pickSession, url, key, route, error, picking])
  const service = window.appSnapshot
  const adapter = useMemo(
    () => (service ? createAppSnapshotAdapter(service, () => surface.current) : null),
    [service],
  )
  const screenshot = useScreenshotAnnotation(
    {
      adapter: url && !picking ? adapter : null,
      launch: () => ({ context, projectId, route }),
      upload: uploadChatFile,
      onNote: addNote,
    },
    noteIds,
  )
  const draft = screenshot?.draft
  const cancelSnapshot = useCallback(() => draft?.cancel(), [draft])
  useLayoutEffect(() => {
    const modal = dialog.current
    modal?.showModal()
    return () => modal?.close()
  }, [])
  // Drop a frozen image when the app changes route or remounts; confirmed
  // notes are already on the originating composer and are not affected.
  useLayoutEffect(() => {
    return cancelSnapshot
  }, [route, key, cancelSnapshot])
  const setAppRoute = (next: AppDeepLink): void => {
    if (JSON.stringify(next) === JSON.stringify(route)) return
    if (route) stopPicking()
    cancelSnapshot()
    setRoute(next)
  }
  // ProjectAppView drives pick.set, but its normalized element callback drops
  // the bridge's `additive` flag. Read the validated frame notification here
  // so a plain pick exits on both sides, while Shift-picks keep the mode active.
  useLayoutEffect(() => {
    if (!url) return
    const origin = new URL(url).origin
    const receive = (event: MessageEvent): void => {
      if (activePick.current !== pickSession || event.origin !== origin) return
      const frame = surface.current?.querySelector('iframe')
      if (!frame?.contentWindow || frame.contentWindow !== event.source) return
      const message = parseBridgeMessage(event.data)
      if (message?.type !== 'overseer:pick.selected' || message.id !== undefined) return
      // The bridge exits on a plain pick independently of whether its note data is accepted.
      const payload = message.payload as { additive?: unknown } | null | undefined
      if (payload?.additive !== true) stopPicking()
      const pick = parseAppElementPick(message.payload)
      if (!pick) return
      addNote({
        id: crypto.randomUUID(),
        projectId,
        ...(route ? { view: route.view, params: route.params } : {}),
        comment: '',
        targets: [
          {
            kind: 'element',
            selector: pick.selector,
            outerHtml: pick.outerHtml,
            ...(pick.rect ? { rect: { ...pick.rect, space: 'app-viewport' } } : {}),
          },
        ],
      })
    }
    window.addEventListener('message', receive)
    return () => window.removeEventListener('message', receive)
  }, [addNote, pickSession, projectId, route, url])
  const handleBridge = (req: BridgeRequest): unknown => {
    if (bridgeMessageName(req.type) === 'nav.current')
      return navCurrentReply(route, window.location.href)
    return dataBridge(req)
  }

  return (
    <dialog
      ref={dialog}
      data-chat-app-snapshot
      aria-label="App for this chat"
      onCancel={(event) => {
        event.preventDefault()
        stopPicking()
        cancelSnapshot()
        onClose()
      }}
      className="fixed inset-0 m-auto w-[min(92vw,80rem)] max-w-none h-[92vh] overflow-auto rounded-lg border border-(--border-subtle) bg-(--surface-raised) text-(--text-primary) backdrop:bg-black/50"
    >
      <div className="flex items-center justify-between gap-2 p-2">
        <span className="font-medium">App for this chat</span>
        <div className="flex gap-2">
          <Button
            disabled={!url || !!error}
            onClick={() => {
              cancelSnapshot()
              if (picking) stopPicking()
              else setPicking(true)
            }}
          >
            {picking ? 'Stop picking' : 'Pick element'}
          </Button>
          <Button
            onClick={() => {
              stopPicking()
              cancelSnapshot()
              onClose()
            }}
          >
            Close app
          </Button>
        </div>
      </div>
      <div
        ref={surface}
        data-project-id={projectId}
        className="h-[52vh]"
        onLoadCapture={(event) => {
          cancelSnapshot()
          if (loadedFrame.current === event.target) stopPicking()
          loadedFrame.current = event.target
        }}
      >
        <ProjectAppView
          url={url}
          remountKey={key}
          title="Project app"
          style={{ width: '100%', height: '100%' }}
          onBridgeMessage={handleBridge}
          onNavChanged={setAppRoute}
          onExitPickMode={stopPicking}
          pickMode={picking && !error}
          fallback={
            <p className="p-4">{error ? 'App view unavailable.' : 'Opening project app…'}</p>
          }
        />
      </div>
      <div
        className="max-h-[28vh] overflow-auto p-2"
        data-app-capture-ready={
          screenshot?.snapshot.canCapture && !screenshot.unavailableReason ? '' : undefined
        }
      >
        {screenshot && <ScreenshotAnnotationPanel view={screenshot} />}
      </div>
    </dialog>
  )
}
