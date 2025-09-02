import fs from 'node:fs';
import path from 'node:path';
import { AgentResponse, CompletionClient, CompletionMessage, Feature, GitManager, Task, TaskUtils, ToolCall } from './types.js';

const MAX_TURNS_PER_FEATURE = 100;

const FRAMEWORK_ROOT = path.resolve(process.cwd());
const NEWLINE = '\n';

function loadAgentDocs(agent: string): string {
  const p = path.join(FRAMEWORK_ROOT, 'packages', 'factory-ts', 'docs', `AGENT_${agent.toUpperCase()}.md`);
  return fs.readFileSync(p, 'utf8');
}

function loadProtocolExample(): string {
  try {
    const p = path.join(FRAMEWORK_ROOT, 'packages', 'factory-ts', 'docs', 'agent_response_example.json');
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    return JSON.stringify(data, null, 2);
  } catch {
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

function toolSigsForAgent(agent: string, tools: TaskUtils, git: GitManager): [Record<string, Function>, string[]] {
  const base: Record<string, [Function, string]> = {
    read_files: [tools.readFiles, "read_files(paths: list[str]) -> list[str]" as any],
    search_files: [tools.searchFiles, "search_files(query: str, path: str = '.') -> list[str]"],
    block_feature: [ (args: { task_id: string; feature_id: string; reason: string }) => tools.blockFeature?.(args.task_id, args.feature_id, args.reason, agent, git), 'block_feature(reason: str)'],
    finish_feature: [ (args: { task_id: string; feature_id: string }) => tools.finishFeature?.(args.task_id, args.feature_id, agent, git), 'finish_feature()'],
    list_files: [tools.listFiles, 'list_files(path: str)']
  };

  const agentTools: Record<string, [Function, string]> = {};
  if (agent === 'speccer') {
    agentTools.create_feature = [ (args: { task_id: string; title: string; description: string }) => tools.createFeature?.(args.task_id, args.title, args.description), 'create_feature(title: str, description: str)'];
    agentTools.finish_spec = [ (args: { task_id: string }) => tools.finishSpec?.(args.task_id, agent, git), 'finish_spec()'];
    agentTools.block_task = [ (args: { task_id: string; reason: string }) => tools.blockTask?.(args.task_id, args.reason, agent, git), 'block_task()'];
  } else if (agent === 'developer') {
    if (tools.writeFile) agentTools.write_file = [ tools.writeFile, 'write_file(filename: str, content: str)' ];
    if (tools.renameFile) agentTools.rename_file = [ tools.renameFile, 'rename_file(filename: str, new_filename: str)' ];
    if (tools.deleteFile) agentTools.delete_file = [ tools.deleteFile, 'delete_file(filename: str)' ];
    if (tools.runTest) agentTools.run_test = [ (args: { task_id: string; feature_id: string }) => tools.runTest?.(args.task_id, args.feature_id), 'run_test() -> str' ];
  } else if (agent === 'planner') {
    if (tools.updateFeaturePlan) agentTools.update_feature_plan = [ (args: { task_id: string; feature_id: string; plan: any }) => tools.updateFeaturePlan?.(args.task_id, args.feature_id, args.plan), 'update_feature_plan(plan: str)' ];
  } else if (agent === 'tester') {
    if (tools.updateAcceptanceCriteria) agentTools.update_acceptance_criteria = [ (args: { task_id: string; feature_id: string; criteria: string[] }) => tools.updateAcceptanceCriteria?.(args.task_id, args.feature_id, args.criteria), 'update_acceptance_criteria(criteria: list[str])' ];
    if (tools.updateTest) agentTools.update_test = [ (args: { task_id: string; feature_id: string; test: string }) => tools.updateTest?.(args.task_id, args.feature_id, args.test), 'update_test(test: str)' ];
    if (tools.runTest) agentTools.run_test = [ (args: { task_id: string; feature_id: string }) => tools.runTest?.(args.task_id, args.feature_id), 'run_test() -> str' ];
  } else if (agent === 'contexter') {
    if (tools.updateFeatureContext) agentTools.update_feature_context = [ (args: { task_id: string; feature_id: string; context: string[] }) => tools.updateFeatureContext?.(args.task_id, args.feature_id, args.context), 'update_feature_context(context: list[str])' ];
  }

  const all = { ...base, ...agentTools } as Record<string, [Function, string]>;
  const functions: Record<string, Function> = {};
  const sigs: string[] = [];
  for (const [name, [fn, sig]] of Object.entries(all)) {
    if (fn) {
      functions[name] = fn;
      sigs.push(sig);
    }
  }
  return [functions, sigs];
}

function constructSystemPrompt(agent: string, task: Task, feature: Feature | null, agentSystemPrompt: string, context: string, toolSignatures: string[]): string {
  const plan = feature && (agent === 'developer' || agent === 'tester' || agent === 'contexter' || agent === 'planner') ? (feature.plan ?? 'EMPTY') : '';
  const acceptance = feature && (agent === 'developer' || agent === 'tester') ? (feature.acceptance ?? []) : [];
  const acceptanceStr = acceptance.map((c, i) => `${i + 1}. ${c}`).join('\n');
  const toolSignaturesStr = toolSignatures.map(sig => `- ${sig}`).join('\n');

  const featureBlock = feature ? `#ASSIGNED FEATURE: ${feature.title} (ID: ${feature.id}\n##DESCRIPTION: ${feature.description}\n` : '';
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
    '#THE PLAN',
    plan,
    '',
    '#ACCEPTANCE CRITERIA:',
    acceptanceStr,
    '',
    '#TOOL SIGNATURES:',
    `'${toolSignaturesStr}'`,
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
  availableTools: Record<string, Function>;
  systemPrompt: string;
  task: Task;
  feature: Feature | null;
  agentType: string;
  tools: TaskUtils;
  git: GitManager;
  complete: (why: 'finish' | 'block' | 'max_turns', info?: any) => void;
  completion: CompletionClient;
}) {
  const { model, availableTools, systemPrompt, task, feature, agentType, tools, git, complete, completion } = opts;
  const messages: CompletionMessage[] = [{ role: 'user', content: systemPrompt }];

  for (let i = 0; i < MAX_TURNS_PER_FEATURE; i++) {
    try {
      const res = await completion({ model, messages, response_format: { type: 'json_object' } });
      const assistant = { role: 'assistant' as const, content: res.message.content };
      messages.push(assistant);

      const parsed = JSON.parse(assistant.content) as AgentResponse;
      const thoughts = parsed.thoughts ?? 'No thoughts provided.';
      const toolCalls = parsed.tool_calls ?? [];

      if (!toolCalls.length) continue;

      const toolOutputs: string[] = [];
      for (const call of toolCalls) {
        const toolName = (call.tool_name || call.tool || call.name || 'unknown_tool');
        const args = (call.arguments || call.parameters || {}) as Record<string, any>;

        if (availableTools[toolName]) {
          const fn = availableTools[toolName];
          // inject task_id/feature_id if the tool expects them
          if (!('task_id' in args)) args.task_id = task.id;
          if (feature && !('feature_id' in args)) args.feature_id = feature.id;
          const result = await Promise.resolve(fn(args));
          toolOutputs.push(`Tool ${toolName} returned: ${result}`);
        } else {
          toolOutputs.push(`Error: Tool '${toolName}' not found.`);
        }

        if (['finish_feature', 'block_feature', 'finish_spec', 'block_task'].includes(toolName)) {
          complete(toolName === 'block_feature' || toolName === 'block_task' ? 'block' : 'finish');
          return;
        }
      }

      messages.push({ role: 'user', content: '--- TOOL RESULTS ---\n' + toolOutputs.join('\n') });
    } catch (e) {
      // Block on error, mirroring Python behavior
      if (feature) {
        await tools.blockFeature?.(task.id, feature.id, `Agent loop failed: ${e}`, agentType, git);
      } else {
        await tools.blockTask?.(task.id, `Agent loop failed: ${e}`, agentType, git);
      }
      complete('block', e);
      return;
    }
  }
  // Max turns
  if (feature) {
    await tools.blockFeature?.(task.id, feature.id, 'Agent loop exceeded max turns', agentType, git);
  } else {
    await tools.blockTask?.(task.id, 'Agent loop exceeded max turns', agentType, git);
  }
  complete('max_turns');
}

export async function runAgentOnTask(model: string, agentType: string, task: Task, tools: TaskUtils, git: GitManager, completion: CompletionClient) {
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
    complete: () => {}
  });
}

export async function runAgentOnFeature(model: string, agentType: string, task: Task, feature: Feature, tools: TaskUtils, git: GitManager, completion: CompletionClient) {
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
    complete: () => {}
  });
}

export async function runOrchestrator(opts: {
  model: string;
  agentType: 'developer' | 'tester' | 'planner' | 'contexter' | 'speccer';
  taskId?: string | null;
  projectDir?: string | null;
  completion: CompletionClient;
}) {
  const tools : TaskUtils = new TaskUtils()
  const git : GitManager = new GitManager()
  
  const { model, agentType, taskId, projectDir, completion } = opts;

  if (projectDir) tools.setProjectRoot(projectDir);

  let currentTask: Task | null;
  if (taskId) currentTask = await Promise.resolve(tools.getTask(taskId));
  else currentTask = await Promise.resolve(tools.findNextPendingTask());

  if (!currentTask) {
    console.log('No available tasks to work on in the repository.');
    return;
  }

  const branch = `features/${currentTask.id}`;
  try { await Promise.resolve(git.checkoutBranch(branch, true)); } catch { await Promise.resolve(git.checkoutBranch(branch, false)); }
  try { await Promise.resolve(git.pull(branch)); } catch {}

  const processed = new Set<string>();

  if (agentType === 'speccer') {
    currentTask = await Promise.resolve(tools.getTask(currentTask.id));
    await runAgentOnTask(model, agentType, currentTask, tools, git, completion);
    return;
  }

  while (true) {
    currentTask = await Promise.resolve(tools.getTask(currentTask.id));
    const next = tools.findNextAvailableFeature(currentTask, processed, agentType !== 'developer');
    if (!next) {
      console.log(`\nNo more available features for task ${currentTask.id}.`);
      break;
    }
    await runAgentOnFeature(model, agentType, currentTask, next, tools, git, completion);
    processed.add(next.id);
  }
}
