import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { AgentResponse, CompletionClient, CompletionMessage, Feature, Task, ToolCall } from './types.js';
import type { TaskUtils } from './taskUtils.js';
import type { FileTools } from './fileTools.js';
import type { GitManager } from './gitManager.js';
import { logger, logLLMStep } from './logger.js';

const MAX_TURNS_PER_FEATURE = 100;

// Prefer process.cwd(), but do not assume it points to a real filesystem root when packaged (asar)
const FRAMEWORK_ROOT = path.resolve(process.cwd());
const NEWLINE = '\n';

function loadAgentDocs(agent: string): string {
  // Mirror Python: docs live under packages/factory-ts/docs
  const p = path.join(FRAMEWORK_ROOT, 'packages', 'factory-ts', 'docs', `AGENT_${agent.toUpperCase()}.md`);
  return fs.readFileSync(p, 'utf8');
}

function loadProtocolExample(): string {
  try {
    const p = path.join(FRAMEWORK_ROOT, 'packages', 'factory-ts', 'docs', 'agent_response_example.json');
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    return JSON.stringify(data, null, 2);
  } catch (e) {
    return '{\n  "thoughts": "Your reasoning here...",\n  "tool_calls": [ ... ]\n}';
  }
}

const PROTOCOL_INSTRUCTIONS = (() => {
  const example = loadProtocolExample();
  return [
    'You **MUST** respond in a single, valid JSON object. This object must adhere to the following structure:',
    '```json',
    example,
    '```',
    'The thoughts field is for your reasoning, and tool_calls is a list of actions to execute.',
    'Your response will be parsed as JSON. Do not include any text outside of this JSON object.'
  ].join('\n');
})();

// Human-readable descriptions for tools to avoid duplicating them in agent docs
const TOOL_DESCRIPTIONS: Record<string, string> = {
  // Base tools
  read_files: 'Read the content of one or more files at the given relative paths. Returns an array of strings (one per file).',
  search_files: 'Search for files by name or textual content under the given path. Returns matching relative paths.',
  list_files: 'List files and directories at a relative path from the project root.',
  finish_feature: 'Mark the current feature as complete and end the run. Use only when the work fully meets the acceptance criteria.',
  block_feature: 'Stop work on the current feature and report why you are blocked (e.g., missing context, unclear requirements).',

  // Speccer
  create_feature: 'Define and add a new, atomic feature to the task. Include a concise title and a clear description.',
  finish_spec: 'Signal that the feature specification is complete for the current task.',
  block_task: 'Stop work on the task and report why you are blocked at the task level.',

  // Developer
  write_file: 'Create or overwrite a file with the given content. Always use this to write code or docs.',
  rename_file: 'Rename or move a file from one path to another.',
  delete_file: 'Delete a file. Use with caution and only when necessary.',
  run_test: 'Run the test for the current feature and return the output. Use to verify implementation.',

  // Planner
  update_feature_plan: 'Save a concise, step-by-step implementation plan for the assigned feature.',

  // Tester
  update_acceptance_criteria: 'Save a clear, verifiable list of acceptance criteria for the assigned feature.',
  update_test: 'Save the Python test script that validates the acceptance criteria for this feature.',

  // Contexter
  update_feature_context: 'Save the minimal set of file paths (relative to repo root) required to implement the feature.'
};

function toolSigsForAgent(agent: string, taskTools: TaskUtils, fileTools: FileTools, git: GitManager): [Record<string, (args: any) => Promise<any> | any>, string[]] {
  const base: Record<string, [(args: any) => Promise<any> | any, string]> = {
    read_files: [ (args: { paths: string[] }) => fileTools.readFiles(args.paths), "read_files(paths: list[str]) -> list[str]" ],
    search_files: [ (args: { query: string; path?: string }) => fileTools.searchFiles(args.query, args.path ?? '.'), "search_files(query: str, path: str = '.') -> list[str]" ],
    block_feature: [ (args: { task_id: string; feature_id: string; reason: string }) => taskTools.blockFeature?.(args.task_id, args.feature_id, args.reason, agent, git), 'block_feature(reason: str)' ],
    finish_feature: [ (args: { task_id: string; feature_id: string }) => taskTools.finishFeature?.(args.task_id, args.feature_id, agent, git), 'finish_feature()' ],
    list_files: [ (args: { path: string }) => fileTools.listFiles(args.path), 'list_files(path: str)' ],
  };

  const agentTools: Record<string, [(args: any) => Promise<any> | any, string]> = {};

  if (agent === 'speccer') {
    agentTools.create_feature = [ (args: { task_id: string; title: string; description: string }) => taskTools.createFeature?.(args.task_id, args.title, args.description), 'create_feature(title: str, description: str)' ];
    agentTools.finish_spec = [ (args: { task_id: string }) => taskTools.finishSpec?.(args.task_id, agent, git), 'finish_spec()' ];
    agentTools.block_task = [ (args: { task_id: string; reason: string }) => taskTools.blockTask?.(args.task_id, args.reason, agent, git), 'block_task()' ];
  } else if (agent === 'developer') {
    agentTools.write_file = [ (args: { filename: string; content: string }) => fileTools.writeFile(args.filename, args.content), 'write_file(filename: str, content: str)' ];
    agentTools.rename_file = [ (args: { filename: string; new_filename: string }) => fileTools.renameFile(args.filename, args.new_filename), 'rename_file(filename: str, new_filename: str)' ];
    agentTools.delete_file = [ (args: { filename: string }) => fileTools.deleteFile(args.filename), 'delete_file(filename: str)' ];
    agentTools.run_test = [ (args: { task_id: string; feature_id: string }) => taskTools.runTest?.(args.task_id, args.feature_id), 'run_test() -> str' ];
  } else if (agent === 'planner') {
    agentTools.update_feature_plan = [ (args: { task_id: string; feature_id: string; plan: any }) => taskTools.updateFeaturePlan?.(args.task_id, args.feature_id, args.plan), 'update_feature_plan(plan: str)' ];
  } else if (agent === 'tester') {
    agentTools.update_acceptance_criteria = [ (args: { task_id: string; feature_id: string; criteria: string[] }) => taskTools.updateAcceptanceCriteria?.(args.task_id, args.feature_id, args.criteria), 'update_acceptance_criteria(criteria: list[str])' ];
    agentTools.update_test = [ (args: { task_id: string; feature_id: string; test: string }) => taskTools.updateTest?.(args.task_id, args.feature_id, args.test), 'update_test(test: str)' ];
    agentTools.run_test = [ (args: { task_id: string; feature_id: string }) => taskTools.runTest?.(args.task_id, args.feature_id), 'run_test() -> str' ];
  } else if (agent === 'contexter') {
    agentTools.update_feature_context = [ (args: { task_id: string; feature_id: string; context: string[] }) => taskTools.updateFeatureContext?.(args.task_id, args.feature_id, args.context), 'update_feature_context(context: list[str])' ];
  }

  const merged = { ...base, ...agentTools };
  const funcs: Record<string, (args: any) => Promise<any> | any> = {};
  const sigs: string[] = [];
  for (const [name, [fn, sig]] of Object.entries(merged)) {
    if (fn) {
      funcs[name] = fn;
      const desc = TOOL_DESCRIPTIONS[name] ? ` - ${TOOL_DESCRIPTIONS[name]}` : '';
      sigs.push(`${sig}${desc}`);
    }
  }
  return [funcs, sigs];
}

function constructSystemPrompt(agent: string, task: Task, feature: Feature | null, agentSystemPrompt: string, context: string, toolSignatures: string[]): string {
  const plan = feature && (agent === 'developer' || agent === 'tester' || agent === 'contexter' || agent === 'planner') ? feature.plan : undefined;
  const acceptance = feature && (agent === 'developer' || agent === 'tester') ? feature.acceptance : undefined
  const acceptanceStr = acceptance?.map((c, i) => `${i + 1}. ${c}`).join('\n');
  const toolSignaturesStr = toolSignatures.map(sig => `- ${sig}`).join('\n');

  const featureBlock = feature ? `#ASSIGNED FEATURE: ${feature.title} (ID: ${feature.id})${NEWLINE}##DESCRIPTION: ${feature.description}${NEWLINE}` : '';
  const featureRejection = feature?.rejection ? `##REJECTION REASON:${NEWLINE}${feature.rejection}${NEWLINE}` : '';
  const taskRejection = task.rejection ? `##REJECTION REASON:${NEWLINE}${task.rejection}` : '';

  return [
    agentSystemPrompt,
    `#CURRENT TASK (ID: ${task.id})`,
    '##TITLE:',
    task.title,
    '##DESCRIPTION:',
    task.description,
    taskRejection,
    '',
    featureBlock,
    featureRejection,
    plan ? '#THE PLAN' + plan : '',
    '',
    acceptanceStr ? '#ACCEPTANCE CRITERIA:' + acceptanceStr : '',
    '',
    '#TOOL SIGNATURES:',
    `${toolSignaturesStr}`,
    '',
    '#RESPONSE FORMAT INSTRUCTIONS:',
    PROTOCOL_INSTRUCTIONS,
    '',
    '#CONTEXT FILES PROVIDED:',
    context,
    '',
    'Begin now.'
  ].join('\n');
}

async function runConversation(opts: {
  model: string;
  availableTools: Record<string, (args: any) => Promise<any> | any>;
  systemPrompt: string;
  task: Task;
  feature: Feature | null;
  agentType: string;
  taskTools: TaskUtils;
  git: GitManager;
  completion: CompletionClient;
  complete: (why: 'finish' | 'block' | 'max_turns', info?: any) => void;
  emit?: (e: { type: string; payload?: any }) => void; // event sink for logging/stats
}) {
  const { model, availableTools, systemPrompt, task, feature, agentType, taskTools, git, completion, complete, emit } = opts;
  const doEmit = (e: { type: string; payload?: any }) => { try { emit?.(e); } catch {} };

  const messages: CompletionMessage[] = [{ role: 'user', content: systemPrompt }];
  // Initial snapshot (contains the system/user bootstrap prompt)
  doEmit({ type: 'llm/messages/init', payload: { messages: messages.slice() } });

  for (let i = 0; i < MAX_TURNS_PER_FEATURE; i++) {
    try {
      // Emit snapshot of request context before calling the LLM
      doEmit({ type: 'llm/messages/snapshot', payload: { messages: messages.slice(), turn: i } });
      const startedAt = Date.now();
      const res = await completion({ model, messages, response_format: { type: 'json_object' } });
      const durationMs = Date.now() - startedAt;

      const assistant = { role: 'assistant' as const, content: res.message.content };
      messages.push(assistant);
      // Emit assistant message and timing
      doEmit({ type: 'llm/message', payload: { message: assistant, turn: i, durationMs } });

      // Parse and log succinct info to console via logger
      let parsed: AgentResponse | undefined;
      try { parsed = JSON.parse(assistant.content) as AgentResponse; } catch (e) { parsed = undefined; }
      const toolCalls: ToolCall[] = parsed?.tool_calls ?? [];
      logLLMStep({ turn: i, thoughts: parsed?.thoughts, toolCalls, durationMs, tag: agentType });

      if (!toolCalls.length) {
        // No tool calls; continue loop. Emit snapshot for completeness
        doEmit({ type: 'llm/messages/snapshot', payload: { messages: messages.slice(), turn: i, note: 'no_tool_calls' } });
        // progress hint
        doEmit({ type: 'run/progress/snapshot', payload: { progress: Math.min(0.99, (i + 1) / MAX_TURNS_PER_FEATURE), message: `Turn ${i + 1} complete` } });
        continue;
      }

      const toolOutputs: string[] = [];

      for (const call of toolCalls) {
        const toolName = (call.tool_name || call.tool || call.name || 'unknown_tool');
        const args = (call.arguments || call.parameters || {}) as Record<string, any>;

        if (availableTools[toolName]) {
          // Inject task_id and feature_id as Python orchestrator does via inspect signature
          if (!('task_id' in args)) args.task_id = task.id;
          if (feature && !('feature_id' in args)) args.feature_id = feature.id;

          const result = await Promise.resolve(availableTools[toolName](args));
          toolOutputs.push(`Tool ${toolName} returned: ${result}`);
        } else {
          toolOutputs.push(`Error: Tool '${toolName}' not found.`);
        }

        // Termination tools mirror Python
        if (['finish_feature', 'block_feature', 'finish_spec', 'block_task'].includes(toolName)) {
          // Final conversation snapshot before termination
          doEmit({ type: 'llm/messages/final', payload: { messages: messages.slice(), tool: toolName } });
          complete(toolName === 'block_feature' || toolName === 'block_task' ? 'block' : 'finish');
          return;
        }
      }

      const toolResultMsg: CompletionMessage = { role: 'user', content: '--- TOOL RESULTS ---\n' + toolOutputs.join('\n') };
      messages.push(toolResultMsg);
      // Emit user/tool results message appended
      doEmit({ type: 'llm/message', payload: { message: toolResultMsg, turn: i, source: 'tools' } });
      // progress hint after tools
      doEmit({ type: 'run/progress/snapshot', payload: { progress: Math.min(0.99, (i + 1) / MAX_TURNS_PER_FEATURE), message: `Turn ${i + 1} tool calls processed` } });
    } catch (e) {
      // On error: block task/feature, same as Python
      if (feature) {
        await taskTools.blockFeature?.(task.id, feature.id, `Agent loop failed: ${e}`, agentType, git);
      } else {
        await taskTools.blockTask?.(task.id, `Agent loop failed: ${e}`, agentType, git);
      }
      doEmit({ type: 'llm/messages/error', payload: { error: String(e), messages: messages.slice() } });
      doEmit({ type: 'run/progress/snapshot', payload: { progress: undefined, message: 'Error encountered' } });
      logger.error('Agent loop error:', e as any);
      complete('block', e);
      return;
    }
  }

  // Max turns reached -> block
  if (feature) {
    await taskTools.blockFeature?.(task.id, feature.id, 'Agent loop exceeded max turns', agentType, git);
  } else {
    await taskTools.blockTask?.(task.id, 'Agent loop exceeded max turns', agentType, git);
  }
  doEmit({ type: 'llm/messages/final', payload: { messages: messages.slice(), reason: 'max_turns' } });
  doEmit({ type: 'run/progress/snapshot', payload: { progress: 1, message: 'Max turns reached' } });
  logger.warn('Max turns reached without completion.');
  complete('max_turns');
}

export async function runAgentOnTask(model: string, agentType: string, task: Task, taskTools: TaskUtils, fileTools: FileTools, git: GitManager, completion: CompletionClient, emit?: (e: { type: string; payload?: any }) => void) {
  logger.debug(`\n--- Activating Agent ${agentType} for task: [${task.id}] ${task.title} ---`);
  const agentDocs = loadAgentDocs(agentType);
  const contextFiles = ['docs/FILE_ORGANISATION.md'];
  const [funcs, sigs] = toolSigsForAgent(agentType, taskTools, fileTools, git);
  const context = await Promise.resolve(fileTools.readFiles(contextFiles));
  const systemPrompt = constructSystemPrompt(agentType, task, null, agentDocs, context, sigs);

  await runConversation({
    model,
    availableTools: funcs,
    systemPrompt,
    task,
    feature: null,
    agentType,
    taskTools,
    git,
    completion,
    complete: () => {},
    emit,
  });
}

export async function runAgentOnFeature(model: string, agentType: string, task: Task, feature: Feature, taskTools: TaskUtils, fileTools: FileTools, git: GitManager, completion: CompletionClient, emit?: (e: { type: string; payload?: any }) => void) {
  logger.debug(`\n--- Activating Agent ${agentType} for Feature: [${feature.id}] ${feature.title} ---`);

  if (agentType === 'developer') await taskTools.updateFeatureStatus?.(task.id, feature.id, '~');

  const agentDocs = loadAgentDocs(agentType);
  const featureContextFiles = ['docs/FILE_ORGANISATION.md', ...(feature.context ?? [])];
  const [funcs, sigs] = toolSigsForAgent(agentType, taskTools, fileTools, git);
  const context = await Promise.resolve(fileTools.readFiles(featureContextFiles));
  const systemPrompt = constructSystemPrompt(agentType, task, feature, agentDocs, context, sigs);

  if (agentType === 'developer') await taskTools.updateFeatureStatus?.(task.id, feature.id, '~');

  await runConversation({
    model,
    availableTools: funcs,
    systemPrompt,
    task,
    feature,
    agentType,
    taskTools,
    git,
    completion,
    complete: () => {},
    emit,
  });
}

export async function runOrchestrator(opts: {
  model: string;
  agentType: 'developer' | 'tester' | 'planner' | 'contexter' | 'speccer';
  taskId: string; 
  featureId?: string; 
  projectDir?: string;
  taskTools: TaskUtils;
  fileTools: FileTools;
  git: GitManager;
  completion: CompletionClient;
  emit?: (e: { type: string; payload?: any }) => void;
}) {
  const { model, agentType, taskId, projectDir, taskTools, fileTools, git, completion, emit } = opts;

  if (projectDir) taskTools.setProjectRoot(projectDir);
  if (projectDir) fileTools.setProjectRoot(projectDir);

  const currentTask: Task = await taskTools.getTask(taskId);
  if (!currentTask) {
    logger.warn('No available tasks to work on in the repository.');
    return;
  }

  logger.debug(`Selected Task: [${currentTask.id}] ${currentTask.title}`);

  const branch = `features/${currentTask.id}`;
  try {
    await git.checkoutBranch(branch, true);
  } catch (e) {
    logger.warn(`Could not create or checkout branch '${branch}': ${e}`);
    await git.checkoutBranch(branch, false);
  }
  try {
    await git.pull(branch);
  } catch (e) {
    logger.warn(`Could not pull branch '${branch}': ${e}`);
  }

  const processed = new Set<string>();

  if (agentType === 'speccer') {
    const freshTask = await taskTools.getTask(currentTask.id);
    await runAgentOnTask(model, agentType, freshTask, taskTools, fileTools, git, completion, emit);
    return;
  }

  while (true) {
    const freshTask = await taskTools.getTask(currentTask.id);
    const next = taskTools.findNextAvailableFeature(freshTask, processed, agentType !== 'developer');
    if (!next) {
      logger.debug(`\nNo more available features for task ${freshTask.id}.`);
      break;
    }
    await runAgentOnFeature(model, agentType, freshTask, next, taskTools, fileTools, git, completion, emit);
    processed.add(next.id);
  }
}

// --- Isolated Runner (mimic Python run.py) ---

function shouldIgnoreCopy(relPath: string): boolean {
  // Ignore common build, cache, and IDE artifacts for TypeScript/Node/Electron projects
  // Preserve .git (do NOT ignore)
  const parts = relPath.split(path.sep);
  const name = parts[parts.length - 1] || relPath;

  // If path is within .git, do not ignore (preserve repo history/branches)
  if (parts.includes('.git')) return false;

  const dirIgnore = new Set([
    // Package managers and caches
    'node_modules', '.pnpm', '.pnp', '.pnp.cjs', '.pnp.js', '.npm', '.yarn', '.yarn-cache', '.yarnrc',
    // Build/output directories
    'dist', 'build', 'out', 'release', 'storybook-static',
    // Framework-specific
    '.next', 'next', '.nuxt', '.svelte-kit',
    // Bundlers and dev servers caches
    '.vite', '.rollup.cache', '.parcel-cache', '.webpack',
    // Test/coverage
    'coverage', '.nyc_output',
    // Monorepo/turbo caches
    '.turbo',
    // Generic caches
    '.cache', '.eslintcache', '.rpt2_cache', '.tscache',
    // Editors/IDE
    '.idea', '.vscode',
    // Python (from original mirror)
    'venv', '__pycache__',
    // Logs and temp
    'logs', 'tmp', 'temp',
    // Factory runtime state: Avoid copying .factory so isolated runs don't produce duplicate history
    '.factory'
  ]);

  // If any path segment matches an ignored dir name
  if (parts.some(p => dirIgnore.has(p))) return true;

  // Ignore specific file patterns
  const lower = name.toLowerCase();
  if (lower === '.ds_Store'.toLowerCase() || lower === 'thumbs.db') return true;
  if (lower.endsWith('.log')) return true; // npm/yarn/pnpm debug logs
  if (lower.endsWith('.pyc')) return true; // Python bytecode files
  if (lower.endsWith('.tsbuildinfo')) return true; // TypeScript incremental build info

  // Ignore Electron asar content markers when encountered as path segments
  if (parts.some(p => p.endsWith('.asar') || p.endsWith('.asar.unpacked'))) return true;

  return false;
}

async function copyTree(src: string, dest: string) {
  // Recursively copy, respecting ignore patterns and skipping asar/virtual entries
  let stat: fs.Stats;
  try {
    stat = fs.statSync(src);
  } catch (e: any) {
    throw new Error(`Source path does not exist or is not accessible: ${src} (${e?.code || e})`);
    }
  if (!stat.isDirectory()) throw new Error(`Source ${src} is not a directory`);
  fs.mkdirSync(dest, { recursive: true });

  const walk = (from: string, to: string) => {
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(from, { withFileTypes: true });
    } catch (e: any) {
      // Skip unreadable directories (e.g., asar virtuals)
      logger.warn(`copyTree: Skipping unreadable directory ${from}: ${e?.code || e}`);
      return;
    }
    for (const entry of entries) {
      const rel = path.relative(src, path.join(from, entry.name));
      if (shouldIgnoreCopy(rel)) continue;
      const srcPath = path.join(from, entry.name);
      const dstPath = path.join(to, entry.name);

      // Skip any path that traverses into an asar archive
      if (srcPath.includes('.asar')) continue;

      try {
        if (entry.isDirectory()) {
          fs.mkdirSync(dstPath, { recursive: true });
          walk(srcPath, dstPath);
        } else if (entry.isSymbolicLink()) {
          // Resolve symlink target and copy contents (best-effort)
          try {
            const linkTarget = fs.readlinkSync(srcPath);
            const resolved = path.resolve(path.dirname(srcPath), linkTarget);
            const st = fs.statSync(resolved);
            if (st.isDirectory()) {
              fs.mkdirSync(dstPath, { recursive: true });
              walk(resolved, dstPath);
            } else {
              fs.copyFileSync(resolved, dstPath);
            }
          } catch {
            // Fallback: copy file bytes of the link itself (as file)
            try { fs.copyFileSync(srcPath, dstPath); } catch {}
          }
        } else if (entry.isFile()) {
          fs.copyFileSync(srcPath, dstPath);
        }
      } catch (e: any) {
        // Skip problematic entries (e.g., ENOENT due to virtualized packaging paths)
        if (e && (e.code === 'ENOENT' || e.code === 'EBUSY' || e.code === 'EPERM')) {
          logger.warn(`copyTree: Skipping ${srcPath}: ${e.code}`);
          continue;
        }
        throw e;
      }
    }
  };

  walk(src, dest);
}

function stripAsarSegments(p: string): string {
  // Remove any trailing segments that include .asar and return a real FS ancestor
  const parts = p.split(path.sep);
  const idx = parts.findIndex(seg => seg.includes('.asar'));
  if (idx >= 0) {
    // Try app.asar.unpacked sibling first
    const prefix = parts.slice(0, idx).join(path.sep);
    const resourcesDir = prefix; // parent directory of *.asar
    // If Resources/app.asar.unpacked exists, prefer it as the effective root for reading extra files
    const unpacked = path.join(resourcesDir, 'app.asar.unpacked');
    try {
      const st = fs.statSync(unpacked);
      if (st.isDirectory()) return unpacked;
    } catch {}
    // Otherwise return the resources dir
    return resourcesDir || path.sep;
  }
  return p;
}

function resolveElectronRealRoot(): string | undefined {
  // Try to use Electron-specific hints without importing electron here
  const candidates: (string | undefined)[] = [];
  // 1) Explicit env override
  candidates.push(process.env.FACTORY_REPO_ROOT);
  // 2) process.resourcesPath (exposed in Electron)
  // @ts-ignore - not typed in Node
  const resourcesPath = (process as any).resourcesPath as string | undefined;
  if (resourcesPath) candidates.push(resourcesPath);
  // 3) PORTABLE_EXECUTABLE_DIR (Windows portable)
  candidates.push(process.env.PORTABLE_EXECUTABLE_DIR);
  // 4) app root env usually set by bundlers
  candidates.push(process.env.APPDIR);

  for (const c of candidates) {
    if (!c) continue;
    const real = stripAsarSegments(path.resolve(c));
    try {
      const st = fs.statSync(real);
      if (st.isDirectory()) return real;
    } catch {}
  }
  return undefined;
}

function resolveRepoRootHint(hint?: string): string {
  if (hint && path.isAbsolute(hint)) return hint;

  // If hint is relative, resolve relative to current working dir
  if (hint) return path.resolve(hint);

  // Prefer Electron real root if available
  const electronRoot = resolveElectronRealRoot();
  if (electronRoot) return electronRoot;

  const cwd = FRAMEWORK_ROOT;
  // If cwd includes an asar, move up to its parent directory to avoid virtual FS
  if (cwd.includes('.asar')) {
    const real = stripAsarSegments(cwd);
    try {
      const st = fs.statSync(real);
      if (st.isDirectory()) return real;
    } catch {}
    return os.tmpdir();
  }

  return cwd;
}

export async function runIsolatedOrchestrator(opts: {
  model: string;
  agentType: 'developer' | 'tester' | 'planner' | 'contexter' | 'speccer';
  projectId: string; 
  taskId: string;
  featureId?: string; 
  taskTools: TaskUtils,
  fileTools: FileTools,
  gitFactory: (projectRoot: string) => GitManager;  // git bound to projectRoot
  completion: CompletionClient;
  emit?: (e: { type: string; payload?: any }) => void;
}) {
  const { model, agentType, projectId, taskId, featureId, taskTools, fileTools, gitFactory, completion, emit } = opts;

  const projectDir = await taskTools.getProjectDir(projectId);

  // Create temp workspace
  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'factory-ts-'));
  // Keep a subfolder to host the copied source
  const workspace = path.join(tmpBase, 'workspace');

  logger.info(`Copying repository from '${projectDir}' to temporary workspace: '${workspace}'`);
  try {
    await copyTree(projectDir, workspace);
  } catch (e) {
    logger.error(`FATAL: Failed to copy repository to temporary directory from '${projectDir}' -> '${workspace}': ${e}`);
    // best-effort cleanup
    try { fs.rmSync(tmpBase, { recursive: true, force: true }); } catch {}
    return;
  }

  // Ensure the isolated workspace does not create or track local history in VCS.
  // We do not delete histories; we simply ignore them in the temp workspace.
  try {
    const giPath = path.join(workspace, '.gitignore');
    const ignoreLine = '.factory/';
    let existing = '';
    try { existing = fs.readFileSync(giPath, 'utf8'); } catch {}
    if (!existing.split(/\r?\n/).some(line => line.trim() === ignoreLine)) {
      const prefix = existing && !existing.endsWith('\n') ? '\n' : '';
      fs.writeFileSync(giPath, existing + prefix + ignoreLine + '\n', 'utf8');
      logger.info('Added .factory/ to isolated workspace .gitignore to avoid duplicate history runs.');
    }
  } catch (e) {
    logger.warn(`Failed to update isolated workspace .gitignore: ${e}`);
  }

  const git = gitFactory(workspace);

  try {
    await runOrchestrator({
      model,
      agentType,
      taskId,
      featureId,
      projectDir: workspace,
      taskTools,
      fileTools,
      git,
      completion,
      emit,
    });
  } catch (e) {
    logger.error(`An error occurred while running the agent orchestrator: ${e}`);
  } finally {
    // Cleanup temporary directory
    try {
      fs.rmSync(tmpBase, { recursive: true, force: true });
      logger.info('Agent run finished. Temporary directory cleaned up.');
    } catch (e) {
      logger.warn(`Failed to cleanup temporary directory '${tmpBase}': ${e}`);
    }
  }
}
