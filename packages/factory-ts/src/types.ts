export type Status = '-' | '~' | '+' | '?' ;

export type Feature = {
  id: string;
  status: Status;
  title: string;
  description: string;
  plan?: string;
  context?: string[];
  acceptance?: string[];
  rejection?: string;
};

export type Task = {
  id: string;
  title: string;
  description: string;
  status: Status;
  features: Feature[];
  rejection?: string;
  featureIdToDisplayIndex?: Record<string, number>;
};

export type ToolCall = {
  tool_name?: string;
  tool?: string;
  name?: string;
  arguments?: Record<string, any>;
  parameters?: Record<string, any>;
};

export type AgentResponse = {
  thoughts: string;
  tool_calls: ToolCall[];
};

export type GitManager = {
  checkoutBranch: (name: string, create?: boolean) => Promise<void> | void;
  pull: (name?: string) => Promise<void> | void;
  stageAll?: () => Promise<void> | void;
  commit?: (message: string) => Promise<void> | void;
  push?: () => Promise<void> | void;
};

export type TaskUtils = {
  setProjectRoot: (p: string) => void;
  getTask: (taskId: string) => Promise<Task> | Task;
  findNextPendingTask: () => Promise<Task | null> | Task | null;
  findNextAvailableFeature: (task: Task, excludeIds?: Set<string>, ignoreDependencies?: boolean) => Feature | null;
  updateTaskStatus?: (taskId: string, status: Status) => Promise<Task> | Task;
  updateFeatureStatus?: (taskId: string, featureId: string, status: Status) => Promise<Feature | null> | Feature | null;
  // Generic file tools
  readFiles: (paths: string[]) => Promise<string> | string;
  searchFiles: (query: string, path?: string) => Promise<string[]> | string[];
  listFiles: (path: string) => Promise<string[]> | string[];
  writeFile?: (filename: string, content: string) => Promise<void> | void;
  renameFile?: (filename: string, newFilename: string) => Promise<void> | void;
  deleteFile?: (filename: string) => Promise<void> | void;
  // Tester tools
  runTest?: (taskId: string, featureId: string) => Promise<string> | string;
  updateTest?: (taskId: string, featureId: string, test: string) => Promise<string> | string;
  updateAcceptanceCriteria?: (taskId: string, featureId: string, criteria: string[]) => Promise<Feature | null> | Feature | null;
  // Planner/Contexter
  updateFeaturePlan?: (taskId: string, featureId: string, plan: any) => Promise<Feature | null> | Feature | null;
  updateFeatureContext?: (taskId: string, featureId: string, context: string[]) => Promise<Feature | null> | Feature | null;
  // Spec
  createFeature?: (taskId: string, title: string, description: string) => Promise<Feature> | Feature;
  // Finish/Block
  finishFeature?: (taskId: string, featureId: string, agentType: string, git: GitManager) => Promise<string> | string;
  blockFeature?: (taskId: string, featureId: string, reason: string, agentType: string, git: GitManager) => Promise<Feature | null> | Feature | null;
  finishSpec?: (taskId: string, agentType: string, git: GitManager) => Promise<string> | string;
  blockTask?: (taskId: string, reason: string, agentType: string, git: GitManager) => Promise<Task> | Task;
};

export type CompletionMessage = { role: 'user' | 'assistant'; content: string };

export type CompletionClient = (opts: {
  model: string;
  messages: CompletionMessage[];
  response_format?: { type: 'json_object' };
}) => Promise<{ message: { content: string } }>;
