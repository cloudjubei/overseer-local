import { Button, Surface, Tooltip } from 'thefactory-ui/web'
import { IconBranch, IconInfo } from 'thefactory-ui/web/icons'
import { OVERSEER_AUTOMATION_TOOLTIP } from 'thefactory-ui/headless'

export type OverseerGitPanelProps = {
  onOpen: () => void
}

export default function OverseerGitPanel({ onOpen }: OverseerGitPanelProps) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">Overseer Git</h3>
        <Tooltip content={<span className="max-w-xs">{OVERSEER_AUTOMATION_TOOLTIP}</span>}>
          <span
            className="inline-flex h-5 w-5 items-center justify-center rounded opacity-70 hover:opacity-100"
            aria-label="About this view"
          >
            <IconInfo className="h-4 w-4" />
          </span>
        </Tooltip>
      </div>

      <Surface className="flex flex-col gap-3 p-4">
        <p className="text-sm opacity-80">
          Inspect the overseer repo&apos;s working tree, branches, and commit log. Mutations
          are handled automatically; this view is read-only.
        </p>
        <div>
          <Button variant="primary" onClick={onOpen}>
            <IconBranch className="h-4 w-4" />
            <span>Open Git</span>
          </Button>
        </div>
      </Surface>
    </section>
  )
}
