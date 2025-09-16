import {
  BoardIcon,
  IconAntenna,
  IconBack,
  IconBell,
  IconChat,
  IconCheckCircle,
  IconChevron,
  IconCollection,
  IconDelete,
  IconEdit,
  IconExclamation,
  IconFiles,
  IconFolder,
  IconHome,
  IconLoader,
  IconMenu,
  IconPlay,
  IconPlus,
  IconRobot,
  IconSettings,
  IconStopCircle,
  IconThumbDown,
  IconThumbUp,
  IconWarningTriangle,
  IconWorkspace,
  IconXCircle,
  ListIcon,
  IconTestTube,
  IconWrench,
  IconBuild,
  IconRocket,
  IconToolbox,
  IconInfrastructure,
  IconBrain,
  IconDocument,
  IconTarget,
  IconMicroscope,
  IconBug,
  IconPackage,
  IconSearch,
  IconLightbulb,
  IconGlobe,
  IconMonitor,
  IconMobile,
  IconPuzzle,
  IconArchive,
  IconBricks,
  IconClamp,
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
  // Emoji-translated project icons
  { value: 'testing', label: 'Testing' },
  { value: 'tools', label: 'Tools' },
  { value: 'build', label: 'Build' },
  { value: 'launch', label: 'Launch' },
  { value: 'toolkit', label: 'Toolkit' },
  { value: 'infrastructure', label: 'Infrastructure' },
  { value: 'ai-ml', label: 'AI/ML' },
  { value: 'docs', label: 'Docs' },
  { value: 'goals', label: 'Goals' },
  { value: 'research', label: 'Research' },
  { value: 'bugs', label: 'Bugs' },
  { value: 'package', label: 'Package' },
  { value: 'search', label: 'Search' },
  { value: 'ideas', label: 'Ideas' },
  { value: 'web', label: 'Web' },
  { value: 'desktop', label: 'Desktop' },
  { value: 'mobile', label: 'Mobile' },
  { value: 'components', label: 'Components' },
  { value: 'archive', label: 'Archive' },
  { value: 'foundation', label: 'Foundation' },
  { value: 'compression', label: 'Compression' },
]

export function renderProjectIcon(key?: string, className?: string) {
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
    // Emoji-translated icons
    case 'testing':
      return <IconTestTube className={className} />
    case 'tools':
      return <IconWrench className={className} />
    case 'build':
      return <IconBuild className={className} />
    case 'launch':
      return <IconRocket className={className} />
    case 'toolkit':
      return <IconToolbox className={className} />
    case 'infrastructure':
      return <IconInfrastructure className={className} />
    case 'ai-ml':
      return <IconBrain className={className} />
    case 'docs':
      return <IconDocument className={className} />
    case 'goals':
      return <IconTarget className={className} />
    case 'research':
      return <IconMicroscope className={className} />
    case 'bugs':
      return <IconBug className={className} />
    case 'package':
      return <IconPackage className={className} />
    case 'search':
      return <IconSearch className={className} />
    case 'ideas':
      return <IconLightbulb className={className} />
    case 'web':
      return <IconGlobe className={className} />
    case 'desktop':
      return <IconMonitor className={className} />
    case 'mobile':
      return <IconMobile className={className} />
    case 'components':
      return <IconPuzzle className={className} />
    case 'archive':
      return <IconArchive className={className} />
    case 'foundation':
      return <IconBricks className={className} />
    case 'compression':
      return <IconClamp className={className} />
    case 'folder':
    default:
      return <IconFolder className={className} />
  }
}
