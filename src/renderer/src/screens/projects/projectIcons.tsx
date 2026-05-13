// Re-export from the package — the registry lives in thefactory-ui so the
// project-icon picker stays in sync across desktop / web / future-mobile.
export {
  PROJECT_ICON_REGISTRY,
  PROJECT_ICONS,
  renderProjectIcon,
  type ProjectIconKey as ProjectIcon,
} from 'thefactory-ui/web'
