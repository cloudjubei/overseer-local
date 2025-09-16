export type ProjectIcon = {
  value: string
  label: string
}

// Project icon options aligned with SVG icons in ui/Icons.tsx
// Store the key in metadata.icon, and render the matching SVG in the UI
export const PROJECT_ICONS: ProjectIcon[] = [
  { value: 'folder', label: 'Folder' },
  { value: 'collection', label: 'Collection' },
  { value: 'workspace', label: 'Workspace' },
]
