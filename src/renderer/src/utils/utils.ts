import { twMerge } from 'tailwind-merge'
import { type ClassValue, clsx } from 'clsx'
import { ProjectSettings } from 'src/types/settings'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  notifications: {
    notificationsEnabled: {
      agent_runs: true,
      chat_messages: true,
      git_changes: true,
    },
    badgesEnabled: {
      agent_runs: true,
      chat_messages: true,
      git_changes: true,
    },
  },
}
