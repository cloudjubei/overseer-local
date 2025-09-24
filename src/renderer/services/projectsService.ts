import type {
  ProjectSpec,
  ReorderPayload,
  ProjectUpdate,
  ProjectSpecEditInput,
  ProjectSpecCreateInput,
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

// export type ProgrammingLanguage = 'javascript' | 'typescript' | 'python' | 'java' | 'go' | 'ruby' | 'php' | 'csharp' | 'cpp' | 'rust' | 'kotlin' | 'swift' | 'other';
// export type JavaScriptFramework = 'node' | 'express' | 'nextjs' | 'remix' | 'react' | 'vue' | 'angular' | 'svelte' | 'astro' | 'nest' | 'fastify' | 'hapi' | 'gatsby' | 'electron' | 'other';
// export type TypeScriptFramework = JavaScriptFramework;
// export type PythonFramework = 'django' | 'flask' | 'fastapi' | 'pyramid' | 'tornado' | 'other';
// export type JavaFramework = 'spring' | 'quarkus' | 'micronaut' | 'spark' | 'jakartaee' | 'play' | 'other';
// export type GoFramework = 'gin' | 'echo' | 'fiber' | 'chi' | 'beego' | 'revel' | 'other';
// export type RubyFramework = 'rails' | 'sinatra' | 'hanami' | 'other';
// export type PhpFramework = 'laravel' | 'symfony' | 'codeigniter' | 'yii' | 'cakephp' | 'zend' | 'slim' | 'other';
// export type CSharpFramework = '.net' | 'aspnet' | 'unity' | 'other';
// export type CppFramework = 'qt' | 'boost' | 'other';
// export type RustFramework = 'actix' | 'rocket' | 'axum' | 'yew' | 'tide' | 'other';
// export type KotlinFramework = 'ktor' | 'spring' | 'micronaut' | 'other';
// export type SwiftFramework = 'vapor' | 'kitura' | 'swiftui' | 'other';
// export type FrameworkName = JavaScriptFramework | TypeScriptFramework | PythonFramework | JavaFramework | GoFramework | RubyFramework | PhpFramework | CSharpFramework | CppFramework | RustFramework | KotlinFramework | SwiftFramework;
// export type FrameworksByLanguage = {
//     javascript: JavaScriptFramework[];
//     typescript: TypeScriptFramework[];
//     python: PythonFramework[];
//     java: JavaFramework[];
//     go: GoFramework[];
//     ruby: RubyFramework[];
//     php: PhpFramework[];
//     csharp: CSharpFramework[];
//     cpp: CppFramework[];
//     rust: RustFramework[];
//     kotlin: KotlinFramework[];
//     swift: SwiftFramework[];
//     other: ['other'];
// };
// export declare const KNOWN_FRAMEWORKS_BY_LANGUAGE: Readonly<FrameworksByLanguage>;
// export type JavaScriptTestFramework = 'jest' | 'vitest' | 'mocha' | 'jasmine' | 'ava' | 'tape' | 'uvu' | 'karma' | 'cypress' | 'playwright' | 'other';
// export type TypeScriptTestFramework = JavaScriptTestFramework;
// export type PythonTestFramework = 'pytest' | 'unittest' | 'nose' | 'nose2' | 'behave' | 'robot' | 'other';
// export type JavaTestFramework = 'junit' | 'testng' | 'spock' | 'other';
// export type GoTestFramework = 'gotest' | 'ginkgo' | 'testify' | 'other';
// export type RubyTestFramework = 'rspec' | 'minitest' | 'cucumber' | 'other';
// export type PhpTestFramework = 'phpunit' | 'behat' | 'codeception' | 'pest' | 'other';
// export type CSharpTestFramework = 'mstest' | 'nunit' | 'xunit' | 'other';
// export type CppTestFramework = 'gtest' | 'catch2' | 'cpputest' | 'doctest' | 'other';
// export type RustTestFramework = 'cargo' | 'libtest' | 'other';
// export type KotlinTestFramework = 'kotest' | 'spek' | 'junit' | 'other';
// export type SwiftTestFramework = 'xctest' | 'quick' | 'nimble' | 'other';
// export type TestFrameworkName = JavaScriptTestFramework | TypeScriptTestFramework | PythonTestFramework | JavaTestFramework | GoTestFramework | RubyTestFramework | PhpTestFramework | CSharpTestFramework | CppTestFramework | RustTestFramework | KotlinTestFramework | SwiftTestFramework;
// export type TestFrameworksByLanguage = {
//     javascript: JavaScriptTestFramework[];
//     typescript: TypeScriptTestFramework[];
//     python: PythonTestFramework[];
//     java: JavaTestFramework[];
//     go: GoTestFramework[];
//     ruby: RubyTestFramework[];
//     php: PhpTestFramework[];
//     csharp: CSharpTestFramework[];
//     cpp: CppTestFramework[];
//     rust: RustTestFramework[];
//     kotlin: KotlinTestFramework[];
//     swift: SwiftTestFramework[];
//     other: ['other'];
// };
// export declare const KNOWN_TEST_FRAMEWORKS_BY_LANGUAGE: Readonly<TestFrameworksByLanguage>;
// export declare const KNOWN_LANGUAGES: readonly ProgrammingLanguage[];
// export interface ProjectCodeInfo {
//     language: ProgrammingLanguage;
//     framework?: FrameworkName;
//     testFramework?: TestFrameworkName;
// }
// export interface ProjectSpec {
//     id: string;
//     title: string;
//     description: string;
//     path: string;
//     repo_url: string;
//     storyIdToDisplayIndex: Record<string, number>;
//     metadata?: Record<string, any>;
//     codeInfo?: ProjectCodeInfo;
//     createdAt: string;
//     updatedAt: string;
// }
// export type ProjectSpecCreateInput = Pick<ProjectSpec, 'title' | 'description' | 'path' | 'repo_url'> & Partial<Pick<ProjectSpec, 'metadata' | 'codeInfo'>>;
// export type ProjectSpecEditInput = Partial<ProjectSpecCreateInput>;
// export interface ReorderPayload {
//     fromIndex: number;
//     toIndex: number;
// }
