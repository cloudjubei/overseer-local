import type { ChatContext } from 'thefactory-tools'

export function getNotificationTitleForContext(ctx: ChatContext): string {
  switch (ctx.type) {
    case 'GROUP':
      return 'Group chat update'
    case 'GROUP_TOPIC':
      return 'Group Topic chat update'
    case 'PROJECT':
      return 'Project chat update'
    case 'PROJECT_TOPIC':
      return 'Project Topic chat update'
    case 'STORY':
      return 'Story chat update'
    case 'STORY_TOPIC':
      return 'Story Topic chat update'
    case 'AGENT_RUN_STORY':
      return 'Agent story run chat update'
    case 'FEATURE':
      return 'Feature chat update'
    case 'AGENT_RUN_FEATURE':
      return 'Agent feature run chat update'
    default:
      return 'New assistant message'
  }
}
