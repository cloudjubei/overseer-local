import { ChatSidebar } from '@renderer/components/chat'
import { useActiveProject } from '@renderer/contexts/ProjectContext'

export default function ChatView() {
  const { projectId, project } = useActiveProject()
  const title = project ? `Project Chat — ${project.title}` : 'Project Chat'

  return <ChatSidebar context={{ projectId, type: 'PROJECT' }} chatContextTitle={title} />
}
