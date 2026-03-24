import React, { useState, useEffect } from 'react'

export interface ProjectWizardGitState {
  initGit: boolean
  repoUrl: string
}

interface ProjectWizardGitStepProps {
  initialState?: Partial<ProjectWizardGitState>
  onStateChange: (state: ProjectWizardGitState, isValid: boolean) => void
}

export function ProjectWizardGitStep({ initialState, onStateChange }: ProjectWizardGitStepProps) {
  const [initGit, setInitGit] = useState(initialState?.initGit ?? true)
  const [repoUrl, setRepoUrl] = useState(initialState?.repoUrl || '')

  useEffect(() => {
    // Basic validation: if they provide a remote url, it should probably be a valid url
    // but we can just let it be empty or non-empty for now.
    const isValid = true
    onStateChange({ initGit, repoUrl }, isValid)
  }, [initGit, repoUrl])

  return (
    <div className="flex flex-col gap-6 w-[500px]">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-text-high mb-2">Source Control</h2>
        <p className="text-text-low">Set up Git tracking and link a remote repository.</p>
      </div>

      <div className="bg-surface-raised p-6 rounded-xl border border-border flex flex-col gap-6">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={initGit}
            onChange={(e) => setInitGit(e.target.checked)}
            className="w-4 h-4 text-primary bg-surface border-border rounded focus:ring-primary focus:ring-2"
          />
          <span className="text-text-main font-medium">Initialize Git repository</span>
        </label>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-primary">Remote Repository URL</label>
          <input
            type="text"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/user/repo.git (optional)"
            className="ui-input flex-1"
          />
          <p className="text-xs text-text-low mt-1">
            Leave blank if you don't have a remote repository yet.
          </p>
        </div>
      </div>
    </div>
  )
}
