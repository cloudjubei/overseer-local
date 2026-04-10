import React, { useState } from 'react'
import { Button } from '@renderer/components/ui/Button'
import { IconFolder, IconDocument } from '@renderer/components/ui/icons/Icons'
import { projectsService } from '@renderer/services/projectsService'
import { ProjectWizardCreateState } from './ProjectWizardCreateStep'
import { ProjectWizardCodeState } from './ProjectWizardCodeStep'
import { ProjectWizardGitState } from './ProjectWizardGitStep'

export type ImportMode = 'file' | 'folder'

export interface ImportExtractedData {
  importMode: ImportMode
  createData?: Partial<ProjectWizardCreateState>
  codeData?: Partial<ProjectWizardCodeState>
  gitData?: Partial<ProjectWizardGitState>
}

interface ProjectWizardImportModeStepProps {
  onStateChange: (data: ImportExtractedData | null, isValid: boolean) => void
}

export function ProjectWizardImportModeStep({ onStateChange }: ProjectWizardImportModeStepProps) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [mode, setMode] = useState<ImportMode | null>(null)

  const handleImportFile = async () => {
    setError(null)
    setLoading(true)
    try {
      const p = await projectsService.selectFile([{ name: 'Project JSON', extensions: ['json'] }])
      if (!p) {
        setLoading(false)
        return
      }

      const content = await projectsService.readFileOutside(p)
      let parsed: any
      try {
        parsed = JSON.parse(content)
      } catch (e) {
        throw new Error('Selected file is not valid JSON.')
      }

      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid project definition structure.')
      }

      // Extract details
      const dirPath = p.substring(0, Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\')))
      const createData: Partial<ProjectWizardCreateState> = {
        title: parsed.title || '',
        id: parsed.id || '',
        description: parsed.description || '',
        icon: parsed.metadata?.icon || 'folder',
        path: dirPath,
      }
      
      const codeData: Partial<ProjectWizardCodeState> = {
        isCodeProject: !!parsed.codeInfo,
        languageInput: parsed.codeInfo?.language || '',
        language: parsed.codeInfo?.language || '',
        framework: parsed.codeInfo?.frameworks?.[0] || '',
      }

      const gitData: Partial<ProjectWizardGitState> = {
        repoUrl: parsed.repo_url || '',
        initGit: false, // Don't init git automatically for imported files, usually they exist
      }

      setMode('file')
      setSelectedPath(p)
      onStateChange({ importMode: 'file', createData, codeData, gitData }, true)
    } catch (e: any) {
      setError(e.message || 'Failed to read project.json')
      onStateChange(null, false)
    } finally {
      setLoading(false)
    }
  }

  const handleImportFolder = async () => {
    setError(null)
    setLoading(true)
    try {
      const p = await projectsService.selectDirectory()
      if (!p) {
        setLoading(false)
        return
      }

      const isValidDir = await projectsService.checkDirectoryExists(p)
      if (!isValidDir) {
        throw new Error('Selected path is not a valid directory or is unreadable.')
      }

      // Check for git
      const gitPathUnix = p + '/.git'
      const gitPathWin = p + '\\.git'
      const hasGitUnix = await projectsService.checkDirectoryExists(gitPathUnix)
      const hasGitWin = await projectsService.checkDirectoryExists(gitPathWin)
      const hasGit = hasGitUnix || hasGitWin

      const folderName = p.split(/[/\\\\]/).pop() || 'Imported Project'

      const createData: Partial<ProjectWizardCreateState> = {
        title: folderName,
        id: folderName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        path: p,
        icon: 'folder',
      }

      const gitData: Partial<ProjectWizardGitState> = {
        initGit: !hasGit, 
        repoUrl: '', // Could try parsing .git/config, but standard check is enough for prefill
      }

      setMode('folder')
      setSelectedPath(p)
      onStateChange({ importMode: 'folder', createData, gitData }, true)
    } catch (e: any) {
      setError(e.message || 'Failed to validate local folder')
      onStateChange(null, false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 w-[500px] py-4">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-text-high mb-2">Import Project</h2>
        <p className="text-text-low">
          Select an existing project definition file or an existing local folder.
        </p>
      </div>

      <div className="flex gap-4">
        <button
          onClick={handleImportFile}
          disabled={loading}
          className={`flex-1 flex flex-col items-center justify-center p-6 border rounded-xl bg-surface-raised hover:bg-surface-overlay transition-colors ${
            mode === 'file' ? 'border-brand-500 bg-brand-500/10' : 'border-border'
          }`}
        >
          <IconDocument className="w-10 h-10 text-brand-500 mb-3" />
          <h3 className="font-semibold text-text-primary">project.json</h3>
          <p className="text-sm text-text-secondary text-center mt-2">
            Import from an existing Overseer project definition file.
          </p>
        </button>

        <button
          onClick={handleImportFolder}
          disabled={loading}
          className={`flex-1 flex flex-col items-center justify-center p-6 border rounded-xl bg-surface-raised hover:bg-surface-overlay transition-colors ${
            mode === 'folder' ? 'border-brand-500 bg-brand-500/10' : 'border-border'
          }`}
        >
          <IconFolder className="w-10 h-10 text-blue-500 mb-3" />
          <h3 className="font-semibold text-text-primary">Local Folder</h3>
          <p className="text-sm text-text-secondary text-center mt-2">
            Import a folder. We'll automatically detect Git metadata if present.
          </p>
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-md text-sm">
          {error}
        </div>
      )}

      {selectedPath && !error && (
        <div className="p-3 bg-brand-500/10 text-brand-700 dark:text-brand-300 rounded-md text-sm border border-brand-500/20">
          <span className="font-medium">Selected {mode === 'file' ? 'File' : 'Folder'}:</span>
          <br />
          <span className="font-mono text-xs opacity-90 break-all">{selectedPath}</span>
        </div>
      )}
    </div>
  )
}
