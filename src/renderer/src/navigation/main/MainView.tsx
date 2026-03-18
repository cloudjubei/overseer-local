import React, { useEffect, useMemo, useRef, useState } from 'react'
import FilesView from '../../screens/FilesView'
import SettingsView from '../../screens/SettingsView'
import ChatView from '../../screens/ChatView'
import StoriesView from '../../screens/StoriesView'
import LiveDataView from '../../screens/LiveDataView'
import ProjectTimelineView from '../../screens/ProjectTimelineView'
import ToolsScreen from '../../screens/ToolsView'
import TestsView from '../../screens/TestsView'
import GitView from '../../screens/GitView'
import { useNavigator } from '../Navigator'
import { IconMenu } from '../../components/ui/icons/Icons'
import SidebarView from '../sidebar/SidebarView'
import { useMediaQuery } from '../utils'

export default function MainView() {
  const { currentView } = useNavigator()
  const isMobile = useMediaQuery('(max-width: 768px)')
  const [mobileOpen, setMobileOpen] = useState<boolean>(false)
  const mobileTriggerRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!isMobile) setMobileOpen(false)
  }, [isMobile])

  const renderedView = useMemo(() => {
    if (currentView === 'Files')
      return (
        <div key="Files" className="flex flex-col flex-1 min-h-0 view-transition">
          <FilesView />
        </div>
      )
    if (currentView === 'Settings')
      return (
        <div key="Settings" className="flex flex-col flex-1 min-h-0 view-transition">
          <SettingsView />
        </div>
      )
    if (currentView === 'Chat')
      return (
        <div key="Chat" className="flex flex-col flex-1 min-h-0 view-transition">
          <ChatView />
        </div>
      )
    if (currentView === 'Git')
      return (
        <div key="Git" className="flex flex-col flex-1 min-h-0 view-transition">
          <GitView />
        </div>
      )
    if (currentView === 'Tests')
      return (
        <div key="Tests" className="flex flex-col flex-1 min-h-0 view-transition">
          <TestsView />
        </div>
      )
    if (currentView === 'LiveData')
      return (
        <div key="LiveData" className="flex flex-col flex-1 min-h-0 view-transition">
          <LiveDataView />
        </div>
      )
    if (currentView === 'ProjectTimeline')
      return (
        <div key="ProjectTimeline" className="flex flex-col flex-1 min-h-0 view-transition">
          <ProjectTimelineView />
        </div>
      )
    if (currentView === 'Tools')
      return (
        <div key="Tools" className="flex flex-col flex-1 min-h-0 view-transition">
          <ToolsScreen />
        </div>
      )
    return (
      <div key="Home" className="flex flex-col flex-1 min-h-0 view-transition">
        <StoriesView />
      </div>
    )
  }, [currentView])

  return (
    <div className="flex h-full w-full min-w-0">
      {isMobile ? (
        <>
          {mobileOpen && (
            <>
              <div
                className="fixed inset-0 z-20 bg-black/30 backdrop-blur-sm"
                onClick={() => setMobileOpen(false)}
                aria-hidden
              />
              <div className="fixed inset-y-0 left-0 z-30" style={{ width: 260 }}>
                <SidebarView
                  isMobile={true}
                  mobileOpen={mobileOpen}
                  setMobileOpen={setMobileOpen}
                  mobileTriggerRef={mobileTriggerRef}
                />
              </div>
            </>
          )}
        </>
      ) : (
        <SidebarView
          isMobile={false}
          mobileOpen={false}
          setMobileOpen={setMobileOpen}
          mobileTriggerRef={mobileTriggerRef}
        />
      )}

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="md:hidden sticky top-0 z-10 flex items-center gap-2 border-b border-neutral-200 bg-white px-3 py-2 dark:border-neutral-800 dark:bg-neutral-900">
          <button
            ref={mobileTriggerRef}
            type="button"
            className="nav-trigger"
            onClick={() => setMobileOpen(true)}
            aria-label="Open sidebar"
          >
            <IconMenu />
          </button>
          <div className="text-sm font-semibold">{currentView}</div>
        </div>

        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">{renderedView}</div>
      </main>
    </div>
  )
}
