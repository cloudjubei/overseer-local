import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppSettings } from '@core/contexts/AppSettingsContext'
import { useActiveProject } from '@core/contexts/ProjectsContext'
import { useShortcuts } from '@core/shortcuts/ShortcutsContext'
import { CommandPalette, type CommandPaletteItem } from 'thefactory-ui/web'

/**
 * App-side command menu: wires shortcut registration, routing, and the active
 * project to the library's `<CommandPalette>`. The palette itself knows nothing
 * about React Router or our shortcut format.
 */
export default function CommandMenu() {
  const { register, prettyCombo } = useShortcuts()
  const { settings } = useAppSettings()
  const { projectId } = useActiveProject()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const combos = settings.userPreferences.shortcuts

  useEffect(() => {
    return register({
      id: 'commandMenu',
      comboKeys: combos.commandMenu,
      handler: () => setOpen(true),
      description: 'Open command menu',
    })
  }, [register, combos.commandMenu])

  const commands = useMemo<CommandPaletteItem[]>(() => {
    const close = () => setOpen(false)
    const goto = (path: string) => () => {
      close()
      navigate(path)
    }
    const projectPrefix = projectId ? `/projects/${projectId}` : null
    const list: CommandPaletteItem[] = []
    if (projectPrefix) {
      list.push(
        { id: 'go-stories', label: 'Go to stories', run: goto(`${projectPrefix}/stories`) },
        { id: 'go-chat', label: 'Go to chat', run: goto(`${projectPrefix}/chat`) },
        { id: 'go-files', label: 'Go to files', run: goto(`${projectPrefix}/files`) },
        { id: 'go-git', label: 'Go to git', run: goto(`${projectPrefix}/git`) },
        { id: 'go-tests', label: 'Go to tests', run: goto(`${projectPrefix}/tests`) },
        { id: 'go-tools', label: 'Go to tools', run: goto(`${projectPrefix}/tools`) },
        { id: 'go-timeline', label: 'Go to timeline', run: goto(`${projectPrefix}/timeline`) },
        { id: 'go-settings', label: 'Go to settings', run: goto(`${projectPrefix}/settings`) },
      )
    }
    list.push({
      id: 'new-story',
      label: 'New story',
      shortcut: combos.newStory,
      run: () => {
        close()
        if (projectPrefix) navigate(`${projectPrefix}/stories?new=1`)
      },
    })
    return list
  }, [navigate, projectId, combos.newStory])

  return (
    <CommandPalette
      open={open}
      onClose={() => setOpen(false)}
      commands={commands}
      prettyShortcut={prettyCombo}
      initialFocusRef={inputRef}
    />
  )
}
