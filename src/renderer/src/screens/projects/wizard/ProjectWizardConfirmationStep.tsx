import React from 'react'
import { ProjectWizardCreateState } from './ProjectWizardCreateStep'
import { ProjectWizardCodeState } from './ProjectWizardCodeStep'
import { ProjectWizardGitState } from './ProjectWizardGitStep'
import { ImportMode } from './ProjectWizardImportModeStep'

interface ProjectWizardConfirmationStepProps {
  importMode?: ImportMode
  createData?: ProjectWizardCreateState | null
  codeData?: ProjectWizardCodeState | null
  gitData?: ProjectWizardGitState | null
}

export function ProjectWizardConfirmationStep({
  importMode,
  createData,
  codeData,
  gitData,
}: ProjectWizardConfirmationStepProps) {
  return (
    <div className="flex flex-col gap-6 w-[500px] py-4">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-text-high mb-2">Review Import</h2>
        <p className="text-text-low">
          Please review the details before confirming the import.
        </p>
      </div>

      <div className="bg-surface-raised p-6 rounded-xl border border-border flex flex-col gap-4 text-sm">
        {importMode && (
          <div className="flex justify-between border-b border-border pb-2">
            <span className="text-text-secondary">Import Mode</span>
            <span className="font-medium text-text-primary">
              {importMode === 'file' ? 'project.json File' : 'Local Folder'}
            </span>
          </div>
        )}

        <div className="flex justify-between border-b border-border pb-2">
          <span className="text-text-secondary">Project Title</span>
          <span className="font-medium text-text-primary">{createData?.title || 'N/A'}</span>
        </div>

        <div className="flex justify-between border-b border-border pb-2">
          <span className="text-text-secondary">Project ID</span>
          <span className="font-medium text-text-primary">{createData?.id || 'N/A'}</span>
        </div>

        <div className="flex flex-col gap-1 border-b border-border pb-2">
          <span className="text-text-secondary">Local Path</span>
          <span className="font-mono text-xs opacity-90 break-all">{createData?.path || 'N/A'}</span>
        </div>

        <div className="flex justify-between border-b border-border pb-2">
          <span className="text-text-secondary">Code Tracking</span>
          <span className="font-medium text-text-primary">
            {codeData?.isCodeProject ? `Yes (${codeData.language || 'Unknown'})` : 'No'}
          </span>
        </div>

        <div className="flex justify-between border-b border-border pb-2">
          <span className="text-text-secondary">Git Init</span>
          <span className="font-medium text-text-primary">
            {gitData?.initGit ? 'Yes (Will initialize Git)' : 'No / Already Exists'}
          </span>
        </div>

        {gitData?.repoUrl && (
          <div className="flex flex-col gap-1 pb-2">
            <span className="text-text-secondary">Remote Repo</span>
            <span className="font-mono text-xs opacity-90 break-all">{gitData.repoUrl}</span>
          </div>
        )}
      </div>
    </div>
  )
}
