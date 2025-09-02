import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { AgentResponse, CompletionClient, CompletionMessage, Feature, Task, ToolCall } from './types.js';
import type { TaskUtils } from './taskUtils.js';
import type { GitManager } from './gitManager.js';
import { logger, logLLMStep } from './logger.js';

const MAX_TURNS_PER_FEATURE = 100;

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

function toolSigsForAgent(agent: string, tools: TaskUtils, git: GitManager): [Record<string, (args: any) => Promise<any> | any>, string[]] {
  const base: Record<string, [(args: any) => Promise<any> | any, string]> = {
    read_files: [ (args: { paths: string[] }) => tools.readFiles(args.paths), "read_files(paths: list[str]) -> list[str]" ],
    search_files: [ (args: { query: string; path?: string }) => tools.searchFiles(args.query, args.path ?? '.'), "search_files(query: str, path: str = '.') -> list[str]" ],
    block_feature: [ (args: { task_id: string; feature_id: string; reason: string }) => tools.blockFeature?.(args.task_id, args.feature_id, args.reason, agent, git), 'block_feature(reason: str)' ],
    finish_feature: [ (args: { task_id: string; feature_id: string }) => tools.finishFeature?.(args.task_id, args.feature_id, agent, git), 'finish_feature()' ],
    list_files: [ (args: { path: string }) => tools.listFiles(args.path), 'list_files(path: str)' ],
  };

  const agentTools: Record<string, [(args: any) => Promise<any> | any, string]> = {};

  if (agent === 'speccer') {
    agentTools.create_feature = [ (args: { task_id: string; title: string; description: string }) => tools.createFeature?.(args.task_id, args.title, args.description), 'create_feature(title: str, description: str)' ];
    agentTools.finish_spec = [ (args: { task_id: string }) => tools.finishSpec?.(args.task_id, agent, git), 'finish_spec()' ];
    agentTools.block_task = [ (args: { task_id: string; reason: string }) => tools.blockTask?.(args.task_id, args.reason, agent, git), 'block_task()' ];
  } else if (agent === 'developer') {
    agentTools.write_file = [ (args: { filename: string; content: string }) => tools.writeFile(args.filename, args.content), 'write_file(filename: str, content: str)' ];
    agentTools.rename_file = [ (args: { filename: string; new_filename: string }) => tools.renameFile(args.filename, args.new_filename), 'rename_file(filename: str, new_filename: str)' ];
    agentTools.delete_file = [ (args: { filename: string }) => tools.deleteFile(args.filename), 'delete_file(filename: str)' ];
    agentTools.run_test = [ (args: { task_id: string; feature_id: string }) => tools.runTest?.(args.task_id, args.feature_id), 'run_test() -> str' ];
  } else if (agent === 'planner') {
    agentTools.update_feature_plan = [ (args: { task_id: string; feature_id: string; plan: any }) => tools.updateFeaturePlan?.(args.task_id, args.feature_id, args.plan), 'update_feature_plan(plan: str)' ];
  } else if (agent === 'tester') {
    agentTools.update_acceptance_criteria = [ (args: { task_id: string; feature_id: string; criteria: string[] }) => tools.updateAcceptanceCriteria?.(args.task_id, args.feature_id, args.criteria), 'update_acceptance_criteria(criteria: list[str])' ];
    agentTools.update_test = [ (args: { task_id: string; feature_id: string; test: string }) => tools.updateTest?.(args.task_id, args.feature_id, args.test), 'update_test(test: str)' ];
    agentTools.run_test = [ (args: { task_id: string; feature_id: string }) => tools.runTest?.(args.task_id, args.feature_id), 'run_test() -> str' ];
  } else if (agent === 'contexter') {
    agentTools.update_feature_context = [ (args: { task_id: string; feature_id: string; context: string[] }) => tools.updateFeatureContext?.(args.task_id, args.feature_id, args.context), 'update_feature_context(context: list[str])' ];
  }

  const merged = { ...base, ...agentTools };
  const funcs: Record<string, (args: any) => Promise<any> | any> = {};
  const sigs: string[] = [];
  for (const [name, [fn, sig]] of Object.entries(merged)) {
    if (fn) {
      funcs[name] = fn;
      sigs.push(sig);
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
  tools: TaskUtils;
  git: GitManager;
  completion: CompletionClient;
  complete: (why: 'finish' | 'block' | 'max_turns', info?: any) => void;
  emit?: (e: { type: string; payload?: any }) => void; // event sink for logging/stats
}) {
  const { model, availableTools, systemPrompt, task, feature, agentType, tools, git, completion, complete, emit } = opts;
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
        await tools.blockFeature?.(task.id, feature.id, `Agent loop failed: ${e}`, agentType, git);
      } else {
        await tools.blockTask?.(task.id, `Agent loop failed: ${e}`, agentType, git);
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
    await tools.blockFeature?.(task.id, feature.id, 'Agent loop exceeded max turns', agentType, git);
  } else {
    await tools.blockTask?.(task.id, 'Agent loop exceeded max turns', agentType, git);
  }
  doEmit({ type: 'llm/messages/final', payload: { messages: messages.slice(), reason: 'max_turns' } });
  doEmit({ type: 'run/progress/snapshot', payload: { progress: 1, message: 'Max turns reached' } });
  logger.warn('Max turns reached without completion.');
  complete('max_turns');
}

export async function runAgentOnTask(model: string, agentType: string, task: Task, tools: TaskUtils, git: GitManager, completion: CompletionClient, emit?: (e: { type: string; payload?: any }) => void) {
  logger.debug(`\n--- Activating Agent ${agentType} for task: [${task.id}] ${task.title} ---`);
  const agentDocs = loadAgentDocs(agentType);
  const contextFiles = ['docs/FILE_ORGANISATION.md'];
  const [funcs, sigs] = toolSigsForAgent(agentType, tools, git);
  const context = await Promise.resolve(tools.readFiles(contextFiles));
  const systemPrompt = constructSystemPrompt(agentType, task, null, agentDocs, context, sigs);

  await runConversation({
    model,
    availableTools: funcs,
    systemPrompt,
    task,
    feature: null,
    agentType,
    tools,
    git,
    completion,
    complete: () => {},
    emit,
  });
}

export async function runAgentOnFeature(model: string, agentType: string, task: Task, feature: Feature, tools: TaskUtils, git: GitManager, completion: CompletionClient, emit?: (e: { type: string; payload?: any }) => void) {
  logger.debug(`\n--- Activating Agent ${agentType} for Feature: [${feature.id}] ${feature.title} ---`);

  if (agentType === 'developer') await tools.updateFeatureStatus?.(task.id, feature.id, '~');

  const agentDocs = loadAgentDocs(agentType);
  const featureContextFiles = ['docs/FILE_ORGANISATION.md', ...(feature.context ?? [])];
  const [funcs, sigs] = toolSigsForAgent(agentType, tools, git);
  const context = await Promise.resolve(tools.readFiles(featureContextFiles));
  const systemPrompt = constructSystemPrompt(agentType, task, feature, agentDocs, context, sigs);

  if (agentType === 'developer') await tools.updateFeatureStatus?.(task.id, feature.id, '~');

  await runConversation({
    model,
    availableTools: funcs,
    systemPrompt,
    task,
    feature,
    agentType,
    tools,
    git,
    completion,
    complete: () => {},
    emit,
  });
}

export async function runOrchestrator(opts: {
  model: string;
  agentType: 'developer' | 'tester' | 'planner' | 'contexter' | 'speccer';
  taskId: string; // required to mirror Python CLI behavior path used here
  projectDir?: string | null;
  tools: TaskUtils;
  git: GitManager;
  completion: CompletionClient;
  emit?: (e: { type: string; payload?: any }) => void;
}) {
  const { model, agentType, taskId, projectDir, tools, git, completion, emit } = opts;

  // Configure project root for task utils
  if (projectDir) tools.setProjectRoot(projectDir);

  const currentTask: Task = await Promise.resolve(tools.getTask(taskId));
  if (!currentTask) {
    logger.warn('No available tasks to work on in the repository.');
    return;
  }

  logger.debug(`Selected Task: [${currentTask.id}] ${currentTask.title}`);

  const branch = `features/${currentTask.id}`;
  try {
    await Promise.resolve(git.checkoutBranch(branch, true));
  } catch (e) {
    logger.warn(`Could not create or checkout branch '${branch}': ${e}`);
    await Promise.resolve(git.checkoutBranch(branch, false));
  }
  try {
    await Promise.resolve(git.pull(branch));
  } catch (e) {
    logger.warn(`Could not pull branch '${branch}': ${e}`);
  }

  const processed = new Set<string>();

  if (agentType === 'speccer') {
    const freshTask = await Promise.resolve(tools.getTask(currentTask.id));
    await runAgentOnTask(model, agentType, freshTask, tools, git, completion, emit);
    return;
  }

  while (true) {
    const freshTask = await Promise.resolve(tools.getTask(currentTask.id));
    const next = tools.findNextAvailableFeature(freshTask, processed, agentType !== 'developer');
    if (!next) {
      logger.debug(`\nNo more available features for task ${freshTask.id}.`);
      break;
    }
    await runAgentOnFeature(model, agentType, freshTask, next, tools, git, completion, emit);
    processed.add(next.id);
  }
}

// --- Isolated Runner (mimic Python run.py) ---

function shouldIgnoreCopy(relPath: string): boolean {
  // Mirror Python ignore patterns: venv, __pycache__, *.pyc, .idea
  const parts = relPath.split(path.sep);
  if (parts.includes('venv')) return true;
  if (parts.includes('__pycache__')) return true;
  if (parts.includes('.idea')) return true;
  if (relPath.endsWith('.pyc')) return true;
  return false;
}

async function copyTree(src: string, dest: string) {
  // Recursively copy, respecting ignore patterns
  const stat = fs.statSync(src);
  if (!stat.isDirectory()) throw new Error(`Source ${src} is not a directory`);
  fs.mkdirSync(dest, { recursive: true });

  const walk = (from: string, to: string) => {
    for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
      const rel = path.relative(src, path.join(from, entry.name));
      if (shouldIgnoreCopy(rel)) continue;
      const srcPath = path.join(from, entry.name);
      const dstPath = path.join(to, entry.name);
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
    }
  };

  walk(src, dest);
}

export async function runIsolatedOrchestrator(opts: {
  model: string;
  agentType: 'developer' | 'tester' | 'planner' | 'contexter' | 'speccer';
  taskId: string;
  projectDir?: string | null; // child project relative to repo root
  toolsFactory: (projectRoot: string) => TaskUtils; // tools bound to projectRoot
  gitFactory: (projectRoot: string) => GitManager;  // git bound to projectRoot
  completion: CompletionClient;
  emit?: (e: { type: string; payload?: any }) => void;
}) {
  const { model, agentType, taskId, projectDir, toolsFactory, gitFactory, completion, emit } = opts;

  // Determine repo root: assume current working directory is repo root
  const repoRoot = FRAMEWORK_ROOT;

  // Create temp workspace
  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'factory-ts-'));
  const workspace = path.join(tmpBase, 'workspace');

  logger.info(`Copying repository from '${repoRoot}' to temporary workspace: '${workspace}'`);
  try {
    await copyTree(repoRoot, workspace);
  } catch (e) {
    logger.error(`FATAL: Failed to copy repository to temporary directory: ${e}`);
    // best-effort cleanup
    try { fs.rmSync(tmpBase, { recursive: true, force: true }); } catch {}
    return;
  }

  // Resolve the project directory inside the workspace
  const workspaceProjectDir = projectDir ? path.join(workspace, projectDir) : workspace;
  const tools = toolsFactory(workspaceProjectDir);
  const git = gitFactory(workspaceProjectDir);

  try {
    await runOrchestrator({
      model,
      agentType,
      taskId,
      projectDir: workspaceProjectDir,
      tools,
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
