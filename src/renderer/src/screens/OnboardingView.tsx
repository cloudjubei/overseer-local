import React, { useState } from 'react'
import { ProjectWizardModal } from './projects/wizard/ProjectWizardModal'
import { IconPlus } from '../components/ui/icons/Icons'

export default function OnboardingView() {
  const [isWizardOpen, setIsWizardOpen] = useState(false)

  return (
    <div className="flex h-full w-full flex-col items-center justify-center p-8 text-center bg-neutral-50 dark:bg-neutral-900">
      <div className="max-w-md space-y-6">
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">
          Welcome to The Factory
        </h1>
        <p className="text-lg text-neutral-600 dark:text-neutral-400">
          Get started by creating your first project. A project connects to your source code
          repository and organizes your tasks and AI context.
        </p>
        <button
          onClick={() => setIsWizardOpen(true)}
          className="btn btn-primary inline-flex items-center justify-center gap-2 px-6 py-3 text-lg w-full"
        >
          <IconPlus className="w-5 h-5" />
          Create First Project
        </button>
      </div>

      <ProjectWizardModal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onComplete={() => setIsWizardOpen(false)}
        initialGroupId={null}
      />
    </div>
  )
}
