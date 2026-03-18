import React from 'react'
import { WizardFlowType } from './ProjectWizardModal'
import { IconPlus, IconFolder } from '@renderer/components/ui/icons/Icons'

interface ProjectWizardTypeStepProps {
  onSelect: (type: WizardFlowType) => void
}

export function ProjectWizardTypeStep({ onSelect }: ProjectWizardTypeStepProps) {
  return (
    <div className="flex flex-col gap-6 w-full h-full p-4 flex-1 items-center justify-center">
      <div className="text-center mb-4">
        <h2 className="text-xl font-semibold mb-2">How would you like to start?</h2>
        <p className="text-text-secondary text-sm">
          You can either create a brand new project structure or import an existing repository.
        </p>
      </div>

      <div className="flex w-full max-w-2xl gap-6 flex-col sm:flex-row">
        {/* Create New Project Card */}
        <button
          onClick={() => onSelect('create')}
          className="group flex-1 flex flex-col items-center justify-center p-8 rounded-xl border border-border bg-surface-raised hover:border-brand-500 hover:bg-[color-mix(in_srgb,var(--accent-primary)_10%,transparent)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 text-left"
        >
          <div className="w-16 h-16 flex items-center justify-center rounded-full bg-surface-overlay border border-border mb-4 group-hover:border-brand-500 group-hover:text-brand-500 transition-colors">
            <IconPlus className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-medium mb-2 group-hover:text-brand-500 transition-colors">Create a New Project</h3>
          <p className="text-sm text-text-secondary text-center group-hover:text-text-primary transition-colors">
            Initialize a fresh codebase with a local directory and a new remote repository.
          </p>
        </button>

        {/* Import Existing Project Card */}
        <button
          onClick={() => onSelect('import')}
          className="group flex-1 flex flex-col items-center justify-center p-8 rounded-xl border border-border bg-surface-raised hover:border-brand-500 hover:bg-[color-mix(in_srgb,var(--accent-primary)_10%,transparent)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 text-left"
        >
          <div className="w-16 h-16 flex items-center justify-center rounded-full bg-surface-overlay border border-border mb-4 group-hover:border-brand-500 group-hover:text-brand-500 transition-colors">
            <IconFolder className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-medium mb-2 group-hover:text-brand-500 transition-colors">Import an Existing Project</h3>
          <p className="text-sm text-text-secondary text-center group-hover:text-text-primary transition-colors">
            Bring in an existing project from a local folder or clone from a remote repository.
          </p>
        </button>
      </div>
    </div>
  )
}
