import React from 'react'
import { NavigationView } from '@renderer/types'
import {
  IconHome,
  IconFiles,
  IconChat,
  IconRobot,
  IconAntenna,
  IconSettings,
  IconTimeline,
  IconToolbox,
  IconTests,
  IconBranch,
} from '../../components/ui/icons/Icons'

export type NavDef = {
  id: string
  label: string
  view: NavigationView
  icon: React.ReactNode
  accent?: 'brand' | 'purple' | 'teal' | 'gray'
}

export const NAV_ITEMS: NavDef[] = [
  { id: 'home', label: 'Home', view: 'Home', icon: <IconHome />, accent: 'brand' },
  {
    id: 'files',
    label: 'Files',
    view: 'Files',
    icon: <IconFiles />,
    accent: 'purple',
  },
  { id: 'chats', label: 'Chat', view: 'Chat', icon: <IconChat />, accent: 'teal' },
  {
    id: 'git',
    label: 'Git',
    view: 'Git',
    icon: <IconBranch />,
    accent: 'purple',
  },
  {
    id: 'tests',
    label: 'Tests',
    view: 'Tests',
    icon: <IconTests />,
    accent: 'teal',
  },
  {
    id: 'live-data',
    label: 'Live Data',
    view: 'LiveData',
    icon: <IconAntenna />,
    accent: 'brand',
  },
  {
    id: 'project-timeline',
    label: 'Timeline',
    view: 'ProjectTimeline',
    icon: <IconTimeline />,
    accent: 'purple',
  },
  {
    id: 'tools',
    label: 'Tools',
    view: 'Tools',
    icon: <IconToolbox />,
    accent: 'brand',
  },
  {
    id: 'settings',
    label: 'Settings',
    view: 'Settings',
    icon: <IconSettings />,
    accent: 'gray',
  },
]

export const GROUP_NAV_ITEMS: NavDef[] = [
  { id: 'home', label: 'Home', view: 'Home', icon: <IconHome />, accent: 'brand' },
  { id: 'chats', label: 'Chat', view: 'Chat', icon: <IconChat />, accent: 'teal' },
  { id: 'tools', label: 'Tools', view: 'Tools', icon: <IconToolbox />, accent: 'brand' },
]
