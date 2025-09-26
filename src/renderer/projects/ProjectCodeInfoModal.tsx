import React, { useState, useEffect } from 'react'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/Select'
import type {
  ProjectCodeInfo,
  ProgrammingLanguage,
  FrameworkName,
  TestFrameworkName,
} from 'thefactory-tools'
import {
  KNOWN_FRAMEWORKS_BY_LANGUAGE,
  KNOWN_LANGUAGES,
  KNOWN_TEST_FRAMEWORKS_BY_LANGUAGE,
} from '../services/projectsService'

interface ProjectCodeInfoModalProps {
  codeInfo?: Partial<ProjectCodeInfo>
  onSave: (codeInfo: ProjectCodeInfo) => void
  onClose: () => void
}

export function ProjectCodeInfoModal({ codeInfo, onSave, onClose }: ProjectCodeInfoModalProps) {
  const [language, setLanguage] = useState<ProgrammingLanguage | undefined>(codeInfo?.language)
  const [framework, setFramework] = useState<FrameworkName | undefined>(codeInfo?.framework)
  const [testFramework, setTestFramework] = useState<TestFrameworkName | undefined>(
    codeInfo?.testFramework,
  )

  const [availableFrameworks, setAvailableFrameworks] = useState<readonly FrameworkName[]>([])
  const [availableTestFrameworks, setAvailableTestFrameworks] = useState<
    readonly TestFrameworkName[]
  >([])

  useEffect(() => {
    if (language) {
      setAvailableFrameworks(KNOWN_FRAMEWORKS_BY_LANGUAGE[language] || [])
      setAvailableTestFrameworks(KNOWN_TEST_FRAMEWORKS_BY_LANGUAGE[language] || [])
    } else {
      setAvailableFrameworks([])
      setAvailableTestFrameworks([])
    }
  }, [language])

  const handleLanguageChange = (lang: ProgrammingLanguage) => {
    setLanguage(lang)
    if (language !== lang) {
      setFramework(undefined)
      setTestFramework(undefined)
    }
  }

  const handleSave = () => {
    if (language && framework && testFramework) {
      onSave({
        language,
        framework,
        testFramework,
      })
    }
  }

  return (
    <Modal title="Project Code Info" onClose={onClose} isOpen={true} size="md">
      <div className="story-form flex flex-col gap-4">
        <div className="form-row">
          <label>Language</label>
          <Select
            value={language}
            onValueChange={(v) => handleLanguageChange(v as ProgrammingLanguage)}
          >
            <SelectTrigger className="ui-select w-full">
              <SelectValue placeholder="Select a language" />
            </SelectTrigger>
            <SelectContent className="max-h-60 overflow-y-auto">
              {KNOWN_LANGUAGES.map((lang) => (
                <SelectItem key={lang} value={lang}>
                  {lang}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="form-row">
          <label>Framework (optional)</label>
          <Select
            value={framework}
            onValueChange={(v) => setFramework(v as FrameworkName)}
            disabled={!language || availableFrameworks.length === 0}
          >
            <SelectTrigger className="ui-select w-full">
              <SelectValue placeholder="Select a framework" />
            </SelectTrigger>
            <SelectContent className="max-h-60 overflow-y-auto">
              {availableFrameworks.map((fw) => (
                <SelectItem key={fw} value={fw}>
                  {fw}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="form-row">
          <label>Test Framework (optional)</label>
          <Select
            value={testFramework}
            onValueChange={(v) => setTestFramework(v as TestFrameworkName)}
            disabled={!language || availableTestFrameworks.length === 0}
          >
            <SelectTrigger className="ui-select w-full">
              <SelectValue placeholder="Select a test framework" />
            </SelectTrigger>
            <SelectContent className="max-h-60 overflow-y-auto">
              {availableTestFrameworks.map((tfw) => (
                <SelectItem key={tfw} value={tfw}>
                  {tfw}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={!(language && framework && testFramework)}>
          Save
        </Button>
      </div>
    </Modal>
  )
}
