import path from 'node:path';
import fsp from 'node:fs/promises';
import { fileTools } from './fileTools.js';
import { taskUtils } from './taskUtils.js';

export type ChatTool = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: any;
  };
};

export function buildChatTools(opts: { repoRoot: string; projectId: string }) {
  const repoRoot = path.resolve(opts.repoRoot || process.cwd());
  const projectId = String(opts.projectId);

  async function getProjectConfig() {
    const p = path.join(repoRoot, 'projects', `${projectId}.json`);
    const raw = await fsp.readFile(p, 'utf8');
    return JSON.parse(raw);
  }
  async function getProjectRoot() {
    const cfg = await getProjectConfig();
    const projectRoot = path.resolve(repoRoot, 'projects', cfg.path);
    return projectRoot;
  }

  const tools: ChatTool[] = [
    {
      type: 'function',
      function: {
        name: 'list_tasks',
        description: 'List all tasks in the current project',
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_task_reference',
        description: 'Get a task or feature by its reference in the current project',
        parameters: {
          type: 'object',
          properties: {
            reference: { type: 'string', description: 'Task or feature reference (e.g., #1 or #1.2)' },
          },
          required: ['reference'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_files',
        description: 'List all files in the current project',
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'read_file',
        description: 'Read the content of a file by its project-relative path',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Project-relative path to the file' },
          },
          required: ['path'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'write_file',
        description: 'Writes a new file with the given name and content (relative to project root)',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Project-relative path (include extension, e.g. notes/todo.md)' },
            content: { type: 'string', description: 'Content of the file' },
          },
          required: ['name', 'content'],
        },
      },
    },
  ];

  async function listTasks() {
    // Read tasks under the project's root
    const projectRoot = await getProjectRoot();
    const tasksDir = path.join(projectRoot, 'tasks');
    let entries: any[] = [];
    try {
      const dirents = await fsp.readdir(tasksDir, { withFileTypes: true });
      for (const d of dirents) {
        if (!d.isDirectory()) continue;
        const p = path.join(tasksDir, d.name, 'task.json');
        try { const raw = await fsp.readFile(p, 'utf8'); entries.push(JSON.parse(raw)); } catch {}
      }
    } catch {}
    return entries;
  }

  async function getTaskReference(reference: string) {
    const ref = String(reference || '').trim().replace(/^#/, '');
    if (!ref) throw new Error('Invalid reference');
    const parts = ref.split('.');
    const project = await getProjectConfig();
    const taskIndex = parts[0];
    let taskId: string | undefined;
    for (const id of Object.keys(project.taskIdToDisplayIndex || {})) {
      if (String(project.taskIdToDisplayIndex[id]) === String(taskIndex)) { taskId = id; break; }
    }
    if (!taskId) throw new Error('task not found');

    const projectRoot = await getProjectRoot();
    const taskPath = path.join(projectRoot, 'tasks', taskId, 'task.json');
    const taskRaw = await fsp.readFile(taskPath, 'utf8');
    const task = JSON.parse(taskRaw);
    if (parts.length <= 1) return task;

    const featureIndex = parts[1];
    let featureId: string | undefined;
    for (const id of Object.keys(task.featureIdToDisplayIndex || {})) {
      if (String(task.featureIdToDisplayIndex[id]) === String(featureIndex)) { featureId = id; break; }
    }
    return (task.features || []).find((f: any) => f.id === featureId);
  }

  async function listFiles() {
    const projectRoot = await getProjectRoot();
    const ignore = new Set(['.git', 'node_modules', 'dist', 'out', 'build', '.cache', 'coverage', '.next', '.vite', 'tmp']);
    const res: string[] = [];
    async function walk(dir: string, rel: string = '.') {
      let ents: any[] = [];
      try { ents = await fsp.readdir(dir, { withFileTypes: true }); } catch { return; }
      for (const e of ents) {
        const abs = path.join(dir, e.name);
        const r = rel === '.' ? e.name : path.join(rel, e.name);
        if (e.isDirectory()) {
          if (ignore.has(e.name)) continue;
          await walk(abs, r);
        } else if (e.isFile()) {
          res.push(r.replace(/\\/g, '/'));
        }
      }
    }
    await walk(projectRoot);
    return res;
  }

  async function readFile(args: { path: string }) {
    const projectRoot = await getProjectRoot();
    fileTools.setProjectRoot(projectRoot);
    const out = await fileTools.readFiles([args.path]);
    try { const map = JSON.parse(out); return map[args.path]; } catch { return out; }
  }

  async function writeFileTool(args: { name: string; content: string }) {
    const projectRoot = await getProjectRoot();
    fileTools.setProjectRoot(projectRoot);
    return await fileTools.writeFile(args.name, args.content);
  }

  async function callTool(name: string, args: any) {
    switch (name) {
      case 'list_tasks': return await listTasks();
      case 'get_task_reference': return await getTaskReference(args?.reference);
      case 'list_files': return await listFiles();
      case 'read_file': return await readFile({ path: args?.path });
      case 'write_file': return await writeFileTool({ name: args?.name, content: args?.content });
      default: throw new Error(`Unknown tool: ${name}`);
    }
  }

  return { tools, callTool };
}

export type BuildChatTools = typeof buildChatTools;
