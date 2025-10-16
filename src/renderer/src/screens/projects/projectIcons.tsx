import * as Icons from '@renderer/components/ui/icons/Icons'
import { JSX } from 'react'

export type ProjectIcon = {
  value: string
  label: string
}

// Central registry: maps kebab-case names to icon components from Icons.tsx
// Every icon exported by Icons.tsx should have an entry here to be accessible by name.
// Naming convention: kebab-case of the component minus the 'Icon' prefix (e.g., IconCheckCircle -> 'check-circle').
export const PROJECT_ICON_REGISTRY: Record<string, (props: any) => JSX.Element> = {
  back: Icons.IconBack,
  chevron: Icons.IconChevron,
  delete: Icons.IconDelete,
  edit: Icons.IconEdit,
  error: Icons.IconError,
  exclamation: Icons.IconExclamation,
  play: Icons.IconPlay,
  plus: Icons.IconPlus,

  // Inline icons from Icons.tsx
  list: Icons.IconList,
  board: Icons.IconBoard,
  'check-circle': Icons.IconCheckCircle,
  'x-circle': Icons.IconXCircle,
  'stop-circle': Icons.IconStopCircle,
  loader: Icons.IconLoader,

  // Mini arrows
  'arrow-left-mini': Icons.IconArrowLeftMini,
  'arrow-right-mini': Icons.IconArrowRightMini,

  // Thumbs
  'thumb-up': Icons.IconThumbUp,
  'thumb-down': Icons.IconThumbDown,

  // App/navigation
  home: Icons.IconHome,
  files: Icons.IconFiles,
  chat: Icons.IconChat,
  robot: Icons.IconRobot,
  timeline: Icons.IconTimeline,
  antenna: Icons.IconAntenna,
  bell: Icons.IconBell,
  settings: Icons.IconSettings,
  folder: Icons.IconFolder,
  'folder-open': Icons.IconFolderOpen,
  workspace: Icons.IconWorkspace,
  warning: Icons.IconWarningTriangle,
  menu: Icons.IconMenu,
  collection: Icons.IconCollection,

  // Build/Engineering
  testing: Icons.IconTestTube,
  tools: Icons.IconWrench,
  build: Icons.IconBuild,
  launch: Icons.IconRocket,
  toolkit: Icons.IconToolbox,
  infrastructure: Icons.IconInfrastructure,
  'ai-ml': Icons.IconBrain,

  // Content/Docs/Research
  docs: Icons.IconDocument,
  goals: Icons.IconTarget,
  research: Icons.IconMicroscope,
  bugs: Icons.IconBug,
  package: Icons.IconPackage,
  search: Icons.IconSearch,
  ideas: Icons.IconLightbulb,

  // Platforms
  web: Icons.IconGlobe,
  desktop: Icons.IconMonitor,
  mobile: Icons.IconMobile,
  components: Icons.IconPuzzle,

  // Structure/Infra
  archive: Icons.IconArchive,
  foundation: Icons.IconBricks,
  compression: Icons.IconClamp,
  palette: Icons.IconPalette,
  database: Icons.IconDatabase,

  // Misc
  github: Icons.IconGitHub,
  tests: Icons.IconTests,
  'double-up': Icons.IconDoubleUp,
  send: Icons.IconSend,
  attach: Icons.IconAttach,
  'checkmark-circle': Icons.IconCheckmarkCircle,
  stop: Icons.IconStop,
  'not-allowed': Icons.IconNotAllowed,
  hourglass: Icons.IconHourglass,
  scroll: Icons.IconScroll,

  // New programming icons
  code: Icons.IconCode,
  terminal: Icons.IconTerminal,
  function: Icons.IconFunction,
  branch: Icons.IconBranch,
  commit: Icons.IconCommit,
  'pull-request': Icons.IconPullRequest,
  merge: Icons.IconMerge,
  cpu: Icons.IconCpu,
  server: Icons.IconServer,
  shield: Icons.IconShield,
  key: Icons.IconKey,

  // Finance icons
  dollar: Icons.IconDollar,
  'credit-card': Icons.IconCreditCard,
  wallet: Icons.IconWallet,
  bank: Icons.IconBank,
  'chart-up': Icons.IconChartUp,
  'chart-down': Icons.IconChartDown,
  'piggy-bank': Icons.IconPiggyBank,
  receipt: Icons.IconReceipt,
  calculator: Icons.IconCalculator,
  coins: Icons.IconCoins,
  briefcase: Icons.IconBriefcase,
  'money-transfer': Icons.IconMoneyTransfer,
  percent: Icons.IconPercent,
  'pie-chart': Icons.IconPieChart,

  // Medical icons
  stethoscope: Icons.IconStethoscope,
  syringe: Icons.IconSyringe,
  pill: Icons.IconPill,
  bandage: Icons.IconBandage,
  heartbeat: Icons.IconHeartbeat,
  'heart-pulse': Icons.IconHeartPulse,
  'first-aid-kit': Icons.IconFirstAidKit,
  hospital: Icons.IconHospital,
  thermometer: Icons.IconThermometer,
  ambulance: Icons.IconAmbulance,
  tooth: Icons.IconTooth,
  lungs: Icons.IconLungs,
  dna: Icons.IconDna,

  // Business icons
  handshake: Icons.IconHandshake,
  presentation: Icons.IconPresentation,
  calendar: Icons.IconCalendar,
  users: Icons.IconUsers,
  megaphone: Icons.IconMegaphone,
  headset: Icons.IconHeadset,
  'shopping-cart': Icons.IconShoppingCart,
  store: Icons.IconStore,
  'clipboard-check': Icons.IconClipboardCheck,
  contract: Icons.IconContract,
  'bar-chart': Icons.IconBarChart,
  'target-dollar': Icons.IconTargetDollar,

  // Sports icons
  basketball: Icons.IconBasketball,
  'soccer-ball': Icons.IconSoccerBall,
  baseball: Icons.IconBaseball,
  football: Icons.IconFootball,
  tennis: Icons.IconTennis,
  volleyball: Icons.IconVolleyball,
  hockey: Icons.IconHockey,
  golf: Icons.IconGolf,
  runner: Icons.IconRunner,
  dumbbell: Icons.IconDumbbell,

  // Construction icons
  'hard-hat': Icons.IconHardHat,
  crane: Icons.IconCrane,
  'traffic-cone': Icons.IconTrafficCone,
  wheelbarrow: Icons.IconWheelbarrow,
  shovel: Icons.IconShovel,
  hammer: Icons.IconHammer,
  'cement-mixer': Icons.IconCementMixer,
  excavator: Icons.IconExcavator,
  'safety-vest': Icons.IconSafetyVest,
  blueprint: Icons.IconBlueprint,
}

export const PROJECT_ICONS: Record<string, string> = Object.fromEntries(
  Object.keys(PROJECT_ICON_REGISTRY).map((name) => [
    name,
    name
      .split('-')
      .map((c) => c[0].toUpperCase() + c.slice(1))
      .join(' '),
  ]),
)

export function renderProjectIcon(key?: string, className?: string) {
  const name = key || 'folder'
  const Component = PROJECT_ICON_REGISTRY[name] || PROJECT_ICON_REGISTRY['folder']
  return <Component className={className} />
}
