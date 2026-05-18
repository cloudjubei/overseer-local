import React, { useState } from 'react'
import { Button } from 'thefactory-ui/web'
import { IconPlus } from 'thefactory-ui/web/icons'
import { ProjectWizardModal } from './projects/wizard/ProjectWizardModal'
import { useProjectContext } from '../contexts/ProjectContext'

export default function OnboardingView() {
  const [isWizardOpen, setIsWizardOpen] = useState(false)
  const { setActiveProjectId } = useProjectContext()

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
        <Button
          variant="primary"
          size="lg"
          onClick={() => setIsWizardOpen(true)}
          className="w-full"
        >
          <IconPlus className="w-5 h-5" />
          Create First Project
        </Button>
      </div>

      <ProjectWizardModal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onComplete={(projectId) => {
          setIsWizardOpen(false)
          if (projectId) {
            setActiveProjectId(projectId)
          }
        }}
        initialGroupId={null}
      />
    </div>
  )
}
