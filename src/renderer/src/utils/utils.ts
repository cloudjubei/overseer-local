import { twMerge } from 'tailwind-merge'
import { type ClassValue, clsx } from 'clsx'
import { ProjectSettings } from 'src/types/settings'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  notifications: {
    categoriesEnabled: {
      general: true,
      files: true,
      chat: true,
      stories: true,
      system: true,
      updates: true,
    },
  },
}
