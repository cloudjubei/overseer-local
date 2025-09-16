import React from 'react'
import {
  IconFolder,
  IconCollection,
  IconWorkspace,
  IconHome,
  IconFiles,
  IconChat,
  IconRobot,
  IconAntenna,
  IconBell,
  IconSettings,
  IconWarningTriangle,
  IconEdit,
  IconDelete,
  IconPlus,
  IconExclamation,
  IconCheckCircle,
  IconXCircle,
  IconStopCircle,
  IconLoader,
  ListIcon,
  BoardIcon,
  IconMenu,
  IconBack,
  IconChevron,
  IconPlay,
  IconThumbUp,
  IconThumbDown,
} from '../components/ui/Icons'

export type ProjectIcon = {
  value: string
  label: string
}

// Central list of selectable project icons.
// The `value` is stored in ProjectSpec.metadata.icon.
// Use renderProjectIcon(value) to render the matching SVG component in the UI.
export const PROJECT_ICONS: ProjectIcon[] = [
  { value: 'folder', label: 'Folder' },
  { value: 'collection', label: 'Collection' },
  { value: 'workspace', label: 'Workspace' },
  { value: 'home', label: 'Home' },
  { value: 'files', label: 'Files' },
  { value: 'chat', label: 'Chat' },
  { value: 'robot', label: 'Robot' },
  { value: 'antenna', label: 'Antenna' },
  { value: 'bell', label: 'Bell' },
  { value: 'settings', label: 'Settings' },
  { value: 'warning', label: 'Warning' },
  { value: 'edit', label: 'Edit' },
  { value: 'delete', label: 'Delete' },
  { value: 'plus', label: 'Plus' },
  { value: 'exclamation', label: 'Exclamation' },
  { value: 'check-circle', label: 'Check Circle' },
  { value: 'x-circle', label: 'X Circle' },
  { value: 'stop-circle', label: 'Stop Circle' },
  { value: 'loader', label: 'Loader' },
  { value: 'list', label: 'List' },
  { value: 'board', label: 'Board' },
  { value: 'menu', label: 'Menu' },
  { value: 'back', label: 'Back' },
  { value: 'chevron', label: 'Chevron' },
  { value: 'play', label: 'Play' },
  { value: 'thumb-up', label: 'Thumb Up' },
  { value: 'thumb-down', label: 'Thumb Down' },
]

export function renderProjectIcon(key?: string, className?: string): React.ReactNode {
  switch (key) {
    case 'collection':
      return <IconCollection className={className} />
    case 'workspace':
      return <IconWorkspace className={className} />
    case 'home':
      return <IconHome className={className} />
    case 'files':
      return <IconFiles className={className} />
    case 'chat':
      return <IconChat className={className} />
    case 'robot':
      return <IconRobot className={className} />
    case 'antenna':
      return <IconAntenna className={className} />
    case 'bell':
      return <IconBell className={className} />
    case 'settings':
      return <IconSettings className={className} />
    case 'warning':
      return <IconWarningTriangle className={className} />
    case 'edit':
      return <IconEdit className={className} />
    case 'delete':
      return <IconDelete className={className} />
    case 'plus':
      return <IconPlus className={className} />
    case 'exclamation':
      return <IconExclamation className={className} />
    case 'check-circle':
      return <IconCheckCircle className={className} />
    case 'x-circle':
      return <IconXCircle className={className} />
    case 'stop-circle':
      return <IconStopCircle className={className} />
    case 'loader':
      return <IconLoader className={className} />
    case 'list':
      return <ListIcon />
    case 'board':
      return <BoardIcon />
    case 'menu':
      return <IconMenu className={className} />
    case 'back':
      return <IconBack className={className} />
    case 'chevron':
      return <IconChevron className={className} />
    case 'play':
      return <IconPlay className={className} />
    case 'thumb-up':
      return <IconThumbUp className={className} />
    case 'thumb-down':
      return <IconThumbDown className={className} />
    case 'folder':
    default:
      return <IconFolder className={className} />
  }
}
