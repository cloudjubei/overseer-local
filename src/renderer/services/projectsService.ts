import type {
  ProjectSpec,
  ReorderPayload,
  ProjectUpdate,
  ProjectSpecEditInput,
  ProjectSpecCreateInput,
  ProgrammingLanguage,
  TestFrameworksByLanguage,
  FrameworksByLanguage,
} from 'thefactory-tools'

export type ProjectsService = {
  subscribe: (callback: (projectUpdate: ProjectUpdate) => Promise<void>) => () => void
  listProjects: () => Promise<ProjectSpec[]>
  getProject: (projectId: string) => Promise<ProjectSpec | undefined>
  createProject: (input: ProjectSpecCreateInput) => Promise<ProjectSpec>
  updateProject: (
    projectId: string,
    patch: ProjectSpecEditInput,
  ) => Promise<ProjectSpec | undefined>
  deleteProject: (projectId: string) => Promise<void>
  reorderStory: (projectId: string, payload: ReorderPayload) => Promise<ProjectSpec | undefined>
}

export const projectsService: ProjectsService = { ...window.projectsService }

export const KNOWN_FRAMEWORKS_BY_LANGUAGE: FrameworksByLanguage = {
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

export const KNOWN_TEST_FRAMEWORKS_BY_LANGUAGE: TestFrameworksByLanguage = {
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

export const KNOWN_LANGUAGES: ProgrammingLanguage[] = [
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
