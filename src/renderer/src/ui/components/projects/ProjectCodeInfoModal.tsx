import { useEffect, useMemo, useState } from 'react'
import {
  Button,
  Modal,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'thefactory-ui/web'
import { IconSave } from 'thefactory-ui/web/icons'
import type { ProgrammingLanguage } from '@generated/backend'

// Per-language framework / test-framework registries — duplicated from
// `thefactory-tools/projectConstants.ts` so the web doesn't have to pull the
// whole `thefactory-tools` package as a dependency. Keep in sync.
const FRAMEWORKS_BY_LANGUAGE: Record<ProgrammingLanguage, ReadonlyArray<string>> = {
  javascript: [
    'node',
    'express',
    'nextjs',
    'remix',
    'react',
    'vue',
    'angular',
    'svelte',
    'astro',
    'nest',
    'fastify',
    'hapi',
    'gatsby',
    'electron',
    'other',
  ],
  typescript: [
    'node',
    'express',
    'nextjs',
    'remix',
    'react',
    'vue',
    'angular',
    'svelte',
    'astro',
    'nest',
    'fastify',
    'hapi',
    'gatsby',
    'electron',
    'other',
  ],
  python: ['django', 'flask', 'fastapi', 'pyramid', 'tornado', 'other'],
  java: ['spring', 'quarkus', 'micronaut', 'spark', 'jakartaee', 'play', 'other'],
  go: ['gin', 'echo', 'fiber', 'chi', 'beego', 'revel', 'other'],
  ruby: ['rails', 'sinatra', 'hanami', 'other'],
  php: ['laravel', 'symfony', 'codeigniter', 'yii', 'cakephp', 'zend', 'slim', 'other'],
  csharp: ['.net', 'aspnet', 'unity', 'other'],
  cpp: ['qt', 'boost', 'other'],
  rust: ['actix', 'rocket', 'axum', 'yew', 'tide', 'other'],
  kotlin: ['ktor', 'spring', 'micronaut', 'other'],
  swift: ['vapor', 'kitura', 'swiftui', 'other'],
  other: ['other'],
}

const TEST_FRAMEWORKS_BY_LANGUAGE: Record<ProgrammingLanguage, ReadonlyArray<string>> = {
  javascript: [
    'jest',
    'vitest',
    'mocha',
    'jasmine',
    'ava',
    'tape',
    'uvu',
    'karma',
    'cypress',
    'playwright',
    'other',
  ],
  typescript: [
    'jest',
    'vitest',
    'mocha',
    'jasmine',
    'ava',
    'tape',
    'uvu',
    'karma',
    'cypress',
    'playwright',
    'other',
  ],
  python: ['pytest', 'unittest', 'nose', 'nose2', 'behave', 'robot', 'other'],
  java: ['junit', 'testng', 'spock', 'other'],
  go: ['gotest', 'ginkgo', 'testify', 'other'],
  ruby: ['rspec', 'minitest', 'cucumber', 'other'],
  php: ['phpunit', 'behat', 'codeception', 'pest', 'other'],
  csharp: ['mstest', 'nunit', 'xunit', 'other'],
  cpp: ['gtest', 'catch2', 'cpputest', 'doctest', 'other'],
  rust: ['cargo', 'libtest', 'other'],
  kotlin: ['kotest', 'spek', 'junit', 'other'],
  swift: ['xctest', 'quick', 'nimble', 'other'],
  other: ['other'],
}

export const LANGUAGES: ReadonlyArray<ProgrammingLanguage> = [
  'javascript',
  'typescript',
  'python',
  'java',
  'go',
  'ruby',
  'php',
  'csharp',
  'cpp',
  'rust',
  'kotlin',
  'swift',
  'other',
]

export type CodeInfoValue = {
  language: ProgrammingLanguage
  framework?: string
  testFramework?: string
}

export type ProjectCodeInfoModalProps = {
  codeInfo?: Partial<CodeInfoValue>
  onSave: (codeInfo: CodeInfoValue) => void
  onClose: () => void
}

/**
 * Lets the user pick a language and (optionally) a framework + test framework
 * for the project's code info. Mirrors `overseer-local`'s
 * `ProjectCodeInfoModal` 1:1 in shape; framework and testFramework are
 * optional and a "None" entry clears them.
 */
const NONE_VALUE = '__none__'

export default function ProjectCodeInfoModal({
  codeInfo,
  onSave,
  onClose,
}: ProjectCodeInfoModalProps) {
  const [language, setLanguage] = useState<ProgrammingLanguage | undefined>(codeInfo?.language)
  const [framework, setFramework] = useState<string | undefined>(codeInfo?.framework)
  const [testFramework, setTestFramework] = useState<string | undefined>(codeInfo?.testFramework)

  const availableFrameworks = useMemo(
    () => (language ? FRAMEWORKS_BY_LANGUAGE[language] : []),
    [language],
  )
  const availableTestFrameworks = useMemo(
    () => (language ? TEST_FRAMEWORKS_BY_LANGUAGE[language] : []),
    [language],
  )

  // Drop framework/testFramework when language changes — keeping the old
  // values would let the backend's validator reject the combination.
  useEffect(() => {
    if (!language) {
      setFramework(undefined)
      setTestFramework(undefined)
      return
    }
    if (framework && !FRAMEWORKS_BY_LANGUAGE[language].includes(framework)) {
      setFramework(undefined)
    }
    if (testFramework && !TEST_FRAMEWORKS_BY_LANGUAGE[language].includes(testFramework)) {
      setTestFramework(undefined)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language])

  const handleSave = () => {
    if (!language) return
    onSave({ language, framework, testFramework })
  }

  return (
    <Modal title="Project Code Info" onClose={onClose} isOpen size="md">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Language</label>
          <Select value={language} onValueChange={(v) => setLanguage(v as ProgrammingLanguage)}>
            <SelectTrigger>
              <SelectValue placeholder="Select a language" />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((lang) => (
                <SelectItem key={lang} value={lang}>
                  {lang}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Framework (optional)</label>
          <Select
            value={framework ?? NONE_VALUE}
            onValueChange={(v) => setFramework(v === NONE_VALUE ? undefined : v)}
            disabled={!language || availableFrameworks.length === 0}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a framework" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_VALUE}>None</SelectItem>
              {availableFrameworks.map((fw) => (
                <SelectItem key={fw} value={fw}>
                  {fw}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Test Framework (optional)</label>
          <Select
            value={testFramework ?? NONE_VALUE}
            onValueChange={(v) => setTestFramework(v === NONE_VALUE ? undefined : v)}
            disabled={!language || availableTestFrameworks.length === 0}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a test framework" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_VALUE}>None</SelectItem>
              {availableTestFrameworks.map((tfw) => (
                <SelectItem key={tfw} value={tfw}>
                  {tfw}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex justify-end mt-4">
        <Button
          onClick={handleSave}
          variant="secondary"
          size="icon"
          disabled={!language}
          title="Save"
          aria-label="Save"
        >
          <IconSave className="w-4 h-4" />
        </Button>
      </div>
    </Modal>
  )
}
