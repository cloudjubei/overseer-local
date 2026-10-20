import type { ReactNode } from 'react'
import type { LaunchModelChipSlot, RunModelChipSlot } from 'thefactory-ui/headless'
import type { ChatContext } from 'thefactory-ui/headless/api'
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

/**
 * The model chip on a launch card opened outside a chat — a story's Run, a
 * feature request's start: a chooser for the run about to start, read through
 * the chat its work belongs to, never changing what that chat runs on.
 */
export function renderLaunchModelChip(
  { model, onPick, cli, onPickCli, api, onPickApi, effort, onPickEffort }: LaunchModelChipSlot,
  chatContext: ChatContext,
): ReactNode {
  return (
    <ModelChipConnected
      chatContext={chatContext}
      editable
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
