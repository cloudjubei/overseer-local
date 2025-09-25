import React from 'react'
import { ChatSidebar } from '../components/Chat'
import { useActiveProject } from '../contexts/ProjectContext'

export default function ChatView() {
  const { projectId, project } = useActiveProject()
  const title = project ? `Project Chat — ${project.title}` : 'Project Chat'

  return <ChatSidebar context={{ projectId, type: 'project' }} chatContextTitle={title} />
}
