import type { ChatContext } from 'thefactory-tools'

export function getNotificationTitleForContext(ctx: ChatContext): string {
  switch (ctx.type) {
    case 'PROJECT':
      return 'Project chat update'
    case 'STORY':
      return 'Story chat update'
    case 'FEATURE':
      return 'Feature chat update'
    case 'PROJECT_TOPIC':
    case 'STORY_TOPIC':
      return 'Topic chat update'
    case 'AGENT_RUN':
    case 'AGENT_RUN_FEATURE':
      return 'Agent run chat update'
    default:
      return 'New assistant message'
  }
}
