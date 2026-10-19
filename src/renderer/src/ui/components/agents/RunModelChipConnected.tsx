import type { ReactNode } from 'react'
import type { RunModelChipSlot } from 'thefactory-ui/headless'
import { ModelChipConnected } from 'thefactory-ui/web'

/**
 * The run's model chip on a run's page: the chat chip as a chooser for the run
 * — the API, or a CLI with its model and login — read from the run and sent as
 * its new model, never changing what the run's chat runs on. Its picker says
 * when a pick takes effect.
 */
export function renderRunModelChip({
  chatContext,
  note,
  model,
  onPick,
  cli,
  onPickCli,
  api,
  onPickApi,
  effort,
  onPickEffort,
}: RunModelChipSlot): ReactNode {
  return (
    <ModelChipConnected
      chatContext={chatContext}
      editable
      note={note}
      overrideModel={model}
      onOverrideModel={onPick}
      overrideCli={cli}
      onOverrideCli={onPickCli}
      overrideApi={api}
      onOverrideApi={onPickApi}
      overrideEffort={effort}
      onOverrideEffort={onPickEffort}
    />
  )
}
