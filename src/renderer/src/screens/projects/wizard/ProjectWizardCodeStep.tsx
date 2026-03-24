import React, { useState, useEffect } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@renderer/components/ui/Select'
import { KNOWN_LANGUAGES, KNOWN_FRAMEWORKS_BY_LANGUAGE } from '@renderer/services/projectsService'
import type { ProgrammingLanguage } from 'thefactory-tools'

export interface ProjectWizardCodeState {
  isCodeProject: boolean
  language: ProgrammingLanguage | 'other' | ''
  framework: string
}

interface ProjectWizardCodeStepProps {
  initialState?: Partial<ProjectWizardCodeState>
  onStateChange: (state: ProjectWizardCodeState, isValid: boolean) => void
}

export function ProjectWizardCodeStep({ initialState, onStateChange }: ProjectWizardCodeStepProps) {
  const [isCodeProject, setIsCodeProject] = useState(initialState?.isCodeProject ?? true)
  const [language, setLanguage] = useState<ProgrammingLanguage | 'other' | ''>(initialState?.language || '')
  const [framework, setFramework] = useState(initialState?.framework || '')

  useEffect(() => {
    if (!isCodeProject) {
      onStateChange({ isCodeProject, language: '', framework: '' }, true)
      return
    }

    const isValid = language !== ''
    onStateChange({ isCodeProject, language, framework }, isValid)
  }, [isCodeProject, language, framework, onStateChange])

  const availableFrameworks =
    language && language !== 'other'
      ? KNOWN_FRAMEWORKS_BY_LANGUAGE[language as keyof typeof KNOWN_FRAMEWORKS_BY_LANGUAGE] || []
      : []

  return (
    <div className="flex flex-col gap-6 w-[500px]">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-text-high mb-2">Project Type Details</h2>
        <p className="text-text-low">Tell us about the technology stack of this project.</p>
      </div>
      <div className="bg-surface-raised p-6 rounded-xl border border-border flex flex-col gap-6">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={isCodeProject}
            onChange={(e) => setIsCodeProject(e.target.checked)}
            className="w-4 h-4 text-primary bg-surface border-border rounded focus:ring-primary focus:ring-2"
          />
          <span className="text-text-main font-medium">This is a code repository</span>
        </label>

        {isCodeProject && (
          <div className="flex flex-col gap-4 pl-7 border-l-2 border-border ml-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-primary">Primary Language</label>
              <Select value={language} onValueChange={(v) => setLanguage(v as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a language" />
                </SelectTrigger>
                <SelectContent>
                  {KNOWN_LANGUAGES.map((lang) => (
                    <SelectItem key={lang} value={lang}>
                      {lang.charAt(0).toUpperCase() + lang.slice(1)}
                    </SelectItem>
                  ))}
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {availableFrameworks.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-text-primary">Framework</label>
                <Select value={framework} onValueChange={setFramework}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a framework (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {availableFrameworks.map((fw) => (
                      <SelectItem key={fw} value={fw}>
                        {fw.charAt(0).toUpperCase() + fw.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
