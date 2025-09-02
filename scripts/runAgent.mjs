import { runOrchestrator } from '../packages/factory-ts/dist/index.js';

// Minimal CLI wrapper; host must provide tools and git implementations.
function parseArg(flag, def = null) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : def;
}

const model = parseArg('--model', 'gpt-5');
const agentType = parseArg('--agent', 'developer');
const taskId = parseArg('--task-id', null);
const projectRoot = parseArg('--project-root', process.cwd());

// Stubs for demonstration; the app should provide real implementations.
const tools = {
  setProjectRoot: (p) => {},
  getTask: async (id) => { throw new Error('getTask not implemented'); },
  findNextPendingTask: async () => null,
  findNextAvailableFeature: () => null,
  readFiles: async () => '{}',
  searchFiles: async () => [],
  listFiles: async () => []
};

const git = {
  checkoutBranch: async () => {},
  pull: async () => {}
};

const completion = async ({ model, messages }) => {
  // Echo a no-op by default; real app will wire to an LLM.
  return { message: { content: JSON.stringify({ thoughts: 'noop', tool_calls: [] }) } };
};

await runOrchestrator({ model, agentType, taskId, projectDir: projectRoot, tools, git, completion });
