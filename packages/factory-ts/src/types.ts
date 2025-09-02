export type Status = '+' | '-' | '~' | '?';
export interface Feature {
  id: string;
  status: Status;
  title: string;
  description: string;
  plan?: string;
  context?: string[];
  acceptance?: string[];
  dependencies?: string[];
  rejection?: string;
}
export interface Task {
  id: string;
  title: string;
  description: string;
  status?: Status;
  rejection?: string;
  features: Feature[];
  featureIdToDisplayIndex?: Record<string, number>;
}

export interface ToolCall {
  tool_name?: string;
  tool?: string;
  name?: string;
  arguments?: Record<string, any>;
  parameters?: Record<string, any>;
}
export interface AgentResponse {
  thoughts?: string;
  tool_calls?: ToolCall[];
}

export type CompletionMessage = { role: 'user' | 'assistant'; content: string };
export type CompletionClient = (args: { model: string; messages: CompletionMessage[]; response_format?: { type: 'json_object' } }) => Promise<{ message: { content: string } }>

export interface GitManager {
  checkoutBranch: (name: string, create?: boolean) => Promise<void> | void;
  pull: (name: string) => Promise<void> | void;
  stageFiles?: (paths: string[]) => Promise<void> | void;
  stage_files?: (paths: string[]) => Promise<void> | void; // compatibility
  commit: (message: string) => Promise<void> | void;
  push: () => Promise<void> | void;
}

export interface TaskUtils {
  setProjectRoot: (p: string) => void;
  getProjectRoot?: () => string | any;
  getTask: (taskId: string) => Promise<Task> | Task;
  saveTask?: (task: Task) => Promise<void> | void;
  updateTaskStatus?: (taskId: string, status: Status) => Promise<Task> | Task;

  // Developer
  readFiles: (paths: string[]) => Promise<string> | string;
  listFiles: (path: string) => Promise<string[]> | string[];
  writeFile: (filename: string, content: string) => Promise<any> | any;
  renameFile: (filename: string, newFilename: string) => Promise<any> | any;
  deleteFile: (filename: string) => Promise<any> | any;
  searchFiles: (query: string, path?: string) => Promise<string[]> | string[];

  // Feature ops
  updateFeatureStatus?: (taskId: string, featureId: string, status: Status) => Promise<Feature | undefined> | Feature | undefined;
  blockFeature?: (taskId: string, featureId: string, reason: string, agentType: string, git: GitManager) => Promise<Feature | undefined> | Feature | undefined;
  blockTask?: (taskId: string, reason: string, agentType: string, git: GitManager) => Promise<Task> | Task;
  finishFeature?: (taskId: string, featureId: string, agentType: string, git: GitManager) => Promise<any> | any;
  finishSpec?: (taskId: string, agentType: string, git: GitManager) => Promise<any> | any;

  // Tester
  getTest?: (taskId: string, featureId: string) => Promise<string> | string;
  updateAcceptanceCriteria?: (taskId: string, featureId: string, criteria: string[]) => Promise<Feature | undefined> | Feature | undefined;
  updateTest?: (taskId: string, featureId: string, test: string) => Promise<any> | any;
  deleteTest?: (taskId: string, featureId: string) => Promise<any> | any;
  runTest?: (taskId: string, featureId: string) => Promise<string> | string;

  // Orchestrator helpers
  findNextAvailableFeature: (task: Task, exclude: Set<string>, ignoreDeps: boolean) => Feature | undefined;
  createFeature?: (taskId: string, title: string, description: string) => Promise<Feature> | Feature;
  updateFeaturePlan?: (taskId: string, featureId: string, plan: any) => Promise<Feature | undefined> | Feature | undefined;
  updateFeatureContext?: (taskId: string, featureId: string, context: string[]) => Promise<Feature | undefined> | Feature | undefined;
}
