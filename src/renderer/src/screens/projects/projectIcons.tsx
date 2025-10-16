import * as Icons from '@renderer/components/ui/icons/Icons'

export type ProjectIcon = {
  value: string
  label: string
}

// Central registry: maps kebab-case names to icon components from Icons.tsx
// Every icon exported by Icons.tsx should have an entry here to be accessible by name.
// Naming convention: kebab-case of the component minus the 'Icon' prefix (e.g., IconCheckCircle -> 'check-circle').
export const PROJECT_ICON_REGISTRY: Record<string, (props: any) => JSX.Element> = {
  // Re-exports from individual files
  'back': Icons.IconBack,
  'chevron': Icons.IconChevron,
  'delete': Icons.IconDelete,
  'edit': Icons.IconEdit,
  'error': Icons.IconError,
  'exclamation': Icons.IconExclamation,
  'play': Icons.IconPlay,
  'plus': Icons.IconPlus,

  // Inline icons from Icons.tsx
  'list': Icons.IconList,
  'board': Icons.IconBoard,
  'check-circle': Icons.IconCheckCircle,
  'x-circle': Icons.IconXCircle,
  'stop-circle': Icons.IconStopCircle,
  'loader': Icons.IconLoader,

  // Mini arrows
  'arrow-left-mini': Icons.IconArrowLeftMini,
  'arrow-right-mini': Icons.IconArrowRightMini,

  // Thumbs
  'thumb-up': Icons.IconThumbUp,
  'thumb-down': Icons.IconThumbDown,

  // App/navigation
  'home': Icons.IconHome,
  'files': Icons.IconFiles,
  'chat': Icons.IconChat,
  'robot': Icons.IconRobot,
  'timeline': Icons.IconTimeline,
  'antenna': Icons.IconAntenna,
  'bell': Icons.IconBell,
  'settings': Icons.IconSettings,
  'folder': Icons.IconFolder,
  'folder-open': Icons.IconFolderOpen,
  'workspace': Icons.IconWorkspace,
  'warning': Icons.IconWarningTriangle,
  'menu': Icons.IconMenu,
  'collection': Icons.IconCollection,

  // Build/Engineering
  'testing': Icons.IconTestTube,
  'tools': Icons.IconWrench,
  'build': Icons.IconBuild,
  'launch': Icons.IconRocket,
  'toolkit': Icons.IconToolbox,
  'infrastructure': Icons.IconInfrastructure,
  'ai-ml': Icons.IconBrain,

  // Content/Docs/Research
  'docs': Icons.IconDocument,
  'goals': Icons.IconTarget,
  'research': Icons.IconMicroscope,
  'bugs': Icons.IconBug,
  'package': Icons.IconPackage,
  'search': Icons.IconSearch,
  'ideas': Icons.IconLightbulb,

  // Platforms
  'web': Icons.IconGlobe,
  'desktop': Icons.IconMonitor,
  'mobile': Icons.IconMobile,
  'components': Icons.IconPuzzle,

  // Structure/Infra
  'archive': Icons.IconArchive,
  'foundation': Icons.IconBricks,
  'compression': Icons.IconClamp,
  'palette': Icons.IconPalette,
  'database': Icons.IconDatabase,

  // Misc
  'github': Icons.IconGitHub,
  'tests': Icons.IconTests,
  'double-up': Icons.IconDoubleUp,
  'send': Icons.IconSend,
  'attach': Icons.IconAttach,
  'checkmark-circle': Icons.IconCheckmarkCircle,
  'stop': Icons.IconStop,
  'not-allowed': Icons.IconNotAllowed,
  'hourglass': Icons.IconHourglass,
  'scroll': Icons.IconScroll,

  // New programming icons
  'code': Icons.IconCode,
  'terminal': Icons.IconTerminal,
  'function': Icons.IconFunction,
  'branch': Icons.IconBranch,
  'commit': Icons.IconCommit,
  'pull-request': Icons.IconPullRequest,
  'merge': Icons.IconMerge,
  'cpu': Icons.IconCpu,
  'server': Icons.IconServer,
  'shield': Icons.IconShield,
  'key': Icons.IconKey,

  // Finance icons
  'dollar': Icons.IconDollar,
  'credit-card': Icons.IconCreditCard,
  'wallet': Icons.IconWallet,
  'bank': Icons.IconBank,
  'chart-up': Icons.IconChartUp,
  'chart-down': Icons.IconChartDown,
  'piggy-bank': Icons.IconPiggyBank,
  'receipt': Icons.IconReceipt,
  'calculator': Icons.IconCalculator,
  'coins': Icons.IconCoins,
  'briefcase': Icons.IconBriefcase,
  'money-transfer': Icons.IconMoneyTransfer,
  'percent': Icons.IconPercent,
  'pie-chart': Icons.IconPieChart,

  // Medical icons
  'stethoscope': Icons.IconStethoscope,
  'syringe': Icons.IconSyringe,
  'pill': Icons.IconPill,
  'bandage': Icons.IconBandage,
  'heartbeat': Icons.IconHeartbeat,
  'heart-pulse': Icons.IconHeartPulse,
  'first-aid-kit': Icons.IconFirstAidKit,
  'hospital': Icons.IconHospital,
  'thermometer': Icons.IconThermometer,
  'ambulance': Icons.IconAmbulance,
  'tooth': Icons.IconTooth,
  'lungs': Icons.IconLungs,
  'dna': Icons.IconDna,

  // Business icons
  'handshake': Icons.IconHandshake,
  'presentation': Icons.IconPresentation,
  'calendar': Icons.IconCalendar,
  'users': Icons.IconUsers,
  'megaphone': Icons.IconMegaphone,
  'headset': Icons.IconHeadset,
  'shopping-cart': Icons.IconShoppingCart,
  'store': Icons.IconStore,
  'clipboard-check': Icons.IconClipboardCheck,
  'contract': Icons.IconContract,
  'bar-chart': Icons.IconBarChart,
  'target-dollar': Icons.IconTargetDollar,

  // Sports icons
  'basketball': Icons.IconBasketball,
  'soccer-ball': Icons.IconSoccerBall,
  'baseball': Icons.IconBaseball,
  'football': Icons.IconFootball,
  'tennis': Icons.IconTennis,
  'volleyball': Icons.IconVolleyball,
  'hockey': Icons.IconHockey,
  'golf': Icons.IconGolf,
  'runner': Icons.IconRunner,
  'dumbbell': Icons.IconDumbbell,

  // Construction icons
  'hard-hat': Icons.IconHardHat,
  'crane': Icons.IconCrane,
  'traffic-cone': Icons.IconTrafficCone,
  'wheelbarrow': Icons.IconWheelbarrow,
  'shovel': Icons.IconShovel,
  'hammer': Icons.IconHammer,
  'cement-mixer': Icons.IconCementMixer,
  'excavator': Icons.IconExcavator,
  'safety-vest': Icons.IconSafetyVest,
  'blueprint': Icons.IconBlueprint,
}

export const PROJECT_ICON_NAMES = Object.keys(PROJECT_ICON_REGISTRY)

// Central list of selectable project icons for the Project selector UI.
// This is a curated subset; not all registered icons must appear here.
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
  { value: 'database', label: 'Database' },
  { value: 'palette', label: 'Palette' },

  // Curated medical subset
  { value: 'stethoscope', label: 'Stethoscope' },
  { value: 'pill', label: 'Pill' },
  { value: 'syringe', label: 'Syringe' },
  { value: 'first-aid-kit', label: 'First Aid Kit' },
  { value: 'hospital', label: 'Hospital' },

  // Curated sports subset
  { value: 'basketball', label: 'Basketball' },
  { value: 'soccer-ball', label: 'Soccer Ball' },
  { value: 'baseball', label: 'Baseball' },
  { value: 'football', label: 'Football' },
  { value: 'tennis', label: 'Tennis' },
  { value: 'volleyball', label: 'Volleyball' },
  { value: 'hockey', label: 'Hockey' },
  { value: 'golf', label: 'Golf' },
  { value: 'runner', label: 'Runner' },
  { value: 'dumbbell', label: 'Dumbbell' },
]

export function renderProjectIcon(key?: string, className?: string) {
  const name = key || 'folder'
  const Component = PROJECT_ICON_REGISTRY[name] || PROJECT_ICON_REGISTRY['folder']
  return <Component className={className} />
}
