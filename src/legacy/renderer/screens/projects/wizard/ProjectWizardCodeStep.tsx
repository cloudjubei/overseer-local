import React, { useState, useEffect, useRef } from 'react'
import { KNOWN_LANGUAGES, KNOWN_FRAMEWORKS_BY_LANGUAGE } from '@renderer/services/projectsService'
import { coerceLanguage } from './languageCoercion'
import type { CodeIntelDetectedEnvironment, ProgrammingLanguage } from 'thefactory-tools'

export interface ProjectWizardCodeState {
  isCodeProject: boolean
  // store the raw user input for permissive editing
  languageInput: string
  // normalized/coerced value for known language behavior
  language: ProgrammingLanguage | 'other' | ''
  framework: string
}

interface ProjectWizardCodeStepProps {
  projectPath?: string
  detectEnvironment?: (dirPath: string) => Promise<CodeIntelDetectedEnvironment>
  initialState?: Partial<ProjectWizardCodeState>
  onStateChange: (state: ProjectWizardCodeState, isValid: boolean) => void
}

export function ProjectWizardCodeStep({
  projectPath,
  detectEnvironment,
  initialState,
  onStateChange,
}: ProjectWizardCodeStepProps) {
  const [isCodeProject, setIsCodeProject] = useState(initialState?.isCodeProject ?? false)
  const [languageInput, setLanguageInput] = useState<string>(
    initialState?.languageInput ?? initialState?.language ?? '',
  )
  const [language, setLanguage] = useState<ProgrammingLanguage | 'other' | ''>(
    initialState?.language || '',
  )
  const [framework, setFramework] = useState(initialState?.framework || '')
  const detectedPathRef = useRef<string | null>(null)
  const hasManualChangesRef = useRef(Boolean(initialState))

  useEffect(() => {
    if (!isCodeProject) {
      onStateChange({ isCodeProject, languageInput: '', language: '', framework: '' }, true)
      return
    }

    const isValid = language !== ''
    onStateChange({ isCodeProject, languageInput, language, framework }, isValid)
  }, [isCodeProject, languageInput, language, framework])

  useEffect(() => {
    hasManualChangesRef.current = true
  }, [isCodeProject, languageInput, framework])

  const availableFrameworks =
    language && language !== 'other'
      ? KNOWN_FRAMEWORKS_BY_LANGUAGE[language as keyof typeof KNOWN_FRAMEWORKS_BY_LANGUAGE] || []
      : []

  // keep coerced language in sync with permissive input
  useEffect(() => {
    setLanguage(coerceLanguage(languageInput) as any)
  }, [languageInput])

  useEffect(() => {
    if (!projectPath || !detectEnvironment) return
    if (detectedPathRef.current === projectPath) return
    if (hasManualChangesRef.current && initialState) return

    let cancelled = false
    detectedPathRef.current = projectPath
    ;(async () => {
      try {
        const detected = await detectEnvironment(projectPath)
        if (cancelled) return

        const detectedLanguage = detected.language || ''
        const detectedFramework = detected.frameworks?.[0] || ''
        setIsCodeProject(detected.isCodeProject)
        setLanguageInput(detectedLanguage)
        setLanguage(detectedLanguage)
        setFramework(detectedFramework)
      } catch (error) {
        console.warn('[ProjectWizardCodeStep] detectEnvironment failed', error)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [projectPath, detectEnvironment, initialState])

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
              <input
                className="ui-input"
                value={languageInput}
                onChange={(e) => setLanguageInput(e.target.value)}
                placeholder="e.g. javascript, js, typescript, python, c# (free text)"
                list="project-wizard-known-languages"
              />
              <datalist id="project-wizard-known-languages">
                {KNOWN_LANGUAGES.filter((l) => l !== 'other').map((lang) => (
                  <option key={lang} value={lang} />
                ))}
              </datalist>
              {language === 'other' && languageInput.trim() !== '' && (
                <div className="text-xs text-text-secondary">
                  Unrecognized language. We’ll save it as <span className="font-medium">other</span>
                  .
                </div>
              )}
            </div>

            {true && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-text-primary">Framework</label>
                <input
                  className="ui-input"
                  value={framework}
                  onChange={(e) => setFramework(e.target.value)}
                  placeholder="e.g. react, vue, django, spring (free text)"
                  list="project-wizard-known-frameworks"
                />
                <datalist id="project-wizard-known-frameworks">
                  {availableFrameworks
                    .filter((f) => f !== 'other')
                    .map((fw) => (
                      <option key={fw} value={fw} />
                    ))}
                  <option value="other" />
                </datalist>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
