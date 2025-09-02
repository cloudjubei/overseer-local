import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import fssync from 'node:fs';
import os from 'node:os';
import { listProjects, loadProject, listTasks, loadTask } from './projectLoader';

async function mkFixtureRoot(): Promise<string> {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'factory-ts-')); // e.g., /tmp/factory-ts-xxx
  const projectsDir = path.join(tmp, 'projects');
  const childDir = path.join(tmp, 'child');
  const acmeChild = path.join(childDir, 'acme');
  await fs.mkdir(projectsDir, { recursive: true });
  await fs.mkdir(acmeChild, { recursive: true });
  // tasks
  const tasksDir = path.join(acmeChild, 'tasks');
  await fs.mkdir(path.join(tasksDir, '1'), { recursive: true });
  await fs.mkdir(path.join(tasksDir, '2'), { recursive: true });
  await fs.writeFile(
    path.join(tasksDir, '1', 'task.json'),
    JSON.stringify({ id: 1, title: 'One', description: 'first task' }, null, 2)
  );
  await fs.writeFile(
    path.join(tasksDir, '2', 'task.json'),
    JSON.stringify({ id: '2', title: 'Two' }, null, 2)
  );
  // project config
  const acmeConfig = {
    id: 'acme',
    name: 'Acme Project',
    path: 'child/acme',
    tasks: [1, '2'],
  };
  await fs.writeFile(path.join(projectsDir, 'acme.json'), JSON.stringify(acmeConfig, null, 2));
  return tmp;
}

let prevEnv: string | undefined;
let FIX_ROOT = '';

beforeAll(async () => {
  prevEnv = process.env.FACTORY_ROOT;
  FIX_ROOT = await mkFixtureRoot();
  process.env.FACTORY_ROOT = FIX_ROOT;
});

afterAll(async () => {
  process.env.FACTORY_ROOT = prevEnv;
  // best effort cleanup
  try {
    if (FIX_ROOT && FIX_ROOT.startsWith(os.tmpdir())) {
      // recursive delete
      await fs.rm(FIX_ROOT, { recursive: true, force: true });
    }
  } catch {}
});

describe('ProjectLoader', () => {
  it('lists projects from projects/*.json', async () => {
    const projects = await listProjects();
    expect(projects).toContain('acme');
  });

  it('loads a project and resolves paths', async () => {
    const loaded = await loadProject('acme');
    expect(loaded.config.id).toBe('acme');
    expect(loaded.projectRoot).toBe(path.join(FIX_ROOT, 'child', 'acme'));
    expect(loaded.tasksDir).toBe(path.join(FIX_ROOT, 'child', 'acme', 'tasks'));
    expect(loaded.projectConfigPath).toBe(path.join(FIX_ROOT, 'projects', 'acme.json'));
  });

  it('lists tasks by folder presence with task.json', async () => {
    const tasks = await listTasks('acme');
    expect(tasks).toEqual(['1', '2']);
  });

  it('loads an individual task with validation', async () => {
    const t1 = await loadTask('acme', 1);
    expect(t1.task.id).toBe('1');
    expect(t1.task.title).toBe('One');
    const t2 = await loadTask('acme', '2');
    expect(t2.task.id).toBe('2');
  });

  it('provides helpful errors for missing project', async () => {
    await expect(loadProject('nope')).rejects.toThrow(/Project config for 'nope'.*Expected at/);
  });

  it('provides helpful errors for missing task', async () => {
    await expect(loadTask('acme', '999')).rejects.toThrow(/Task directory not found/);
  });

  it('validates invalid project schema', async () => {
    // write invalid project file
    const bad = { name: 'bad' } as any
    await fs.writeFile(path.join(FIX_ROOT, 'projects', 'bad.json'), JSON.stringify(bad))
    await expect(loadProject('bad')).rejects.toThrow(/Invalid project config/)
  })

  it('validates invalid task schema', async () => {
    // overwrite task 2 with invalid payload (missing id)
    await fs.writeFile(path.join(FIX_ROOT, 'child', 'acme', 'tasks', '2', 'task.json'), JSON.stringify({ title: 'no id' }))
    await expect(loadTask('acme', '2')).rejects.toThrow(/Invalid task definition/)
  })
});
