import { v4 as uuidv4 } from 'uuid';
import type { TasksIndexSnapshot } from '../src/types/external';
import type { ProjectSpec, Task, Feature } from '../src/types/tasks';

/**
 * Migrate numeric Task/Feature IDs to UUIDs and update all dependency references.
 * - Tasks and Features receive new UUID ids
 * - All dependencies ("{taskId}" or "{taskId}.{featureId}") are rewritten to new UUID refs
 * - Display indices are captured:
 *   - ProjectSpec.taskIdToDisplayIndex = 1-based position of each task in displayed order
 *   - Task.featureIdToDisplayIndex = 1-based position of each feature within its task
 * - Snapshot.orderedIds is remapped to new UUIDs preserving original ordering.
 */
export async function migrateToUUIDs(
  currentSnapshot: TasksIndexSnapshot,
  currentProject: ProjectSpec
): Promise<{ newSnapshot: TasksIndexSnapshot; newProject: ProjectSpec }> {
  // Determine original task order (prefer explicit orderedIds; fallback to numeric sort of ids)
  const oldOrder: string[] = (currentSnapshot.orderedIds && currentSnapshot.orderedIds.length)
    ? [...currentSnapshot.orderedIds]
    : Object.keys(currentSnapshot.tasksById).sort((a, b) => Number(a) - Number(b));

  // Maps from old refs to new
  const taskOldToNew = new Map<string, string>(); // oldTaskId -> newTaskId
  const featureOldToNew = new Map<string, string>(); // "oldTaskId.oldFeatureId" -> "newTaskId.newFeatureId"

  const newTasksById: Record<string, Task> = {};
  const newTaskIdToDisplayIndex: Record<string, number> = {};
  const newOrderedIds: string[] = [];
  const newTasksListOrdered: Task[] = [];

  // First pass: assign new IDs, build features and provisional deps (will re-map in pass 2)
  oldOrder.forEach((oldTaskId, tIndex) => {
    const task = currentSnapshot.tasksById[oldTaskId];
    if (!task) return;

    const newTaskId = uuidv4();
    taskOldToNew.set(oldTaskId, newTaskId);
    newTaskIdToDisplayIndex[newTaskId] = tIndex + 1; // 1-based display index
    newOrderedIds.push(newTaskId);

    const newFeatures: Feature[] = [];
    const newFeatureIdToDisplayIndex: Record<string, number> = {};

    (task.features || []).forEach((feat, fIndex) => {
      const oldFeatId = feat.id;
      const newFeatId = uuidv4();
      featureOldToNew.set(`${oldTaskId}.${oldFeatId}`, `${newTaskId}.${newFeatId}`);
      newFeatureIdToDisplayIndex[newFeatId] = fIndex + 1; // 1-based display index

      // Provisional dependency mapping (finalized in second pass after all features mapped)
      const provisionalDeps = (feat.dependencies || []).map((dep) =>
        taskOldToNew.get(dep) || featureOldToNew.get(dep) || dep
      );

      const newFeat: Feature = {
        ...feat,
        id: newFeatId,
        dependencies: provisionalDeps,
      } as Feature;
      newFeatures.push(newFeat);
    });

    // Provisional task dependency mapping (finalized in second pass)
    const provisionalTaskDeps = (task.dependencies || []).map((dep) =>
      taskOldToNew.get(dep) || featureOldToNew.get(dep) || dep
    );

    const newTask: Task = {
      ...task,
      id: newTaskId,
      features: newFeatures,
      featureIdToDisplayIndex: newFeatureIdToDisplayIndex,
      dependencies: provisionalTaskDeps,
    } as Task;

    newTasksById[newTaskId] = newTask;
    newTasksListOrdered.push(newTask);
  });

  // Second pass: finalize dependency mappings now that all features have new IDs
  for (const newTask of Object.values(newTasksById)) {
    newTask.dependencies = (newTask.dependencies || []).map((dep) =>
      taskOldToNew.get(dep) || featureOldToNew.get(dep) || dep
    );
    newTask.features = newTask.features.map((feat) => ({
      ...feat,
      dependencies: (feat.dependencies || []).map((dep) =>
        taskOldToNew.get(dep) || featureOldToNew.get(dep) || dep
      ),
    }));
  }

  const newSnapshot: TasksIndexSnapshot = {
    ...currentSnapshot,
    tasksById: newTasksById,
    orderedIds: newOrderedIds,
  } as TasksIndexSnapshot;

  const newProject: ProjectSpec = {
    ...currentProject,
    tasks: newTasksListOrdered,
    taskIdToDisplayIndex: newTaskIdToDisplayIndex,
  } as ProjectSpec;

  return { newSnapshot, newProject };
}

// ============================
// CLI entry point
// ============================

if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  runCli();
}

async function runCli() {
  const { argv } = process;
  const args = parseArgs(argv.slice(2));

  if (!args.config) {
    printUsage('Missing required --config <path-to-project-config.json>');
    process.exit(1);
  }

  const { config: configPath, snapshot: snapshotPathArg, project: projectPathArg, outSnapshot, outProject, pretty, dryRun } = args;

  // lazy imports to keep the module clean for library usage
  const fs = await import('fs/promises');
  const path = await import('path');

  // Load project config
  let config: any;
  try {
    const raw = await fs.readFile(configPath, 'utf8');
    config = JSON.parse(raw);
  } catch (err) {
    console.error(`Failed to read config at ${configPath}:`, err);
    process.exit(1);
  }

  const configDir = path.dirname(path.resolve(configPath));

  // Resolve snapshot and project spec paths
  const snapFromConfig = config?.tasksSnapshot || config?.paths?.tasksSnapshot;
  const projFromConfig = config?.projectSpec || config?.paths?.projectSpec;

  const snapshotInPath = snapshotPathArg
    ? path.resolve(snapshotPathArg)
    : snapFromConfig
      ? path.resolve(configDir, snapFromConfig)
      : path.resolve(configDir, 'tasks-index.json');

  const projectInPath = projectPathArg
    ? path.resolve(projectPathArg)
    : projFromConfig
      ? path.resolve(configDir, projFromConfig)
      : path.resolve(configDir, 'project-spec.json');

  // Ensure input files exist
  const exists = async (p: string) => !!(await fs.stat(p).catch(() => null));
  const snapExists = await exists(snapshotInPath);
  const projExists = await exists(projectInPath);

  if (!snapExists || !projExists) {
    console.error('Cannot find required input files:');
    if (!snapExists) console.error(`- tasks snapshot (expected at): ${snapshotInPath}`);
    if (!projExists) console.error(`- project spec (expected at): ${projectInPath}`);
    console.error('\nTips:');
    console.error('- Provide explicit --snapshot and --project file paths');
    console.error('- Or add paths.tasksSnapshot and paths.projectSpec in your config file');
    process.exit(1);
  }

  // Read inputs
  let snapshotJson: TasksIndexSnapshot;
  let projectJson: ProjectSpec;

  try {
    snapshotJson = JSON.parse(await fs.readFile(snapshotInPath, 'utf8')) as TasksIndexSnapshot;
  } catch (err) {
    console.error(`Failed to parse tasks snapshot JSON at ${snapshotInPath}:`, err);
    process.exit(1);
  }

  try {
    projectJson = JSON.parse(await fs.readFile(projectInPath, 'utf8')) as ProjectSpec;
  } catch (err) {
    console.error(`Failed to parse project spec JSON at ${projectInPath}:`, err);
    process.exit(1);
  }

  // Run migration
  console.log('Running UUID migration...');
  const { newSnapshot, newProject } = await migrateToUUIDs(snapshotJson, projectJson);

  // Output
  if (dryRun) {
    console.log('Dry run complete. No files written. Summary:');
    try {
      const tasksCount = Object.keys(newSnapshot.tasksById || {}).length;
      const featuresCount = Object.values(newSnapshot.tasksById || {}).reduce((acc: number, t: any) => acc + (t.features?.length || 0), 0);
      console.log(`- Tasks: ${tasksCount}`);
      console.log(`- Features: ${featuresCount}`);
      console.log(`- Ordered Task IDs preserved: ${newSnapshot.orderedIds?.length || 0}`);
      console.log(`- taskIdToDisplayIndex entries: ${Object.keys((newProject as any).taskIdToDisplayIndex || {}).length}`);
    } catch {
      // ignore summary errors
    }
    return;
  }

  const outSnapPath = outSnapshot ? path.resolve(outSnapshot) : snapshotInPath;
  const outProjPath = outProject ? path.resolve(outProject) : projectInPath;

  const space = pretty ? 2 : 0;
  try {
    await fs.writeFile(outSnapPath, JSON.stringify(newSnapshot, null, space) + (pretty ? '\n' : ''));
    await fs.writeFile(outProjPath, JSON.stringify(newProject, null, space) + (pretty ? '\n' : ''));
  } catch (err) {
    console.error('Failed writing output files:', err);
    process.exit(1);
  }

  console.log('UUID migration complete.');
  console.log(`- Wrote snapshot: ${outSnapPath}`);
  console.log(`- Wrote project:  ${outProjPath}`);
}

function parseArgs(argv: string[]) {
  const out: {
    config?: string;
    snapshot?: string;
    project?: string;
    outSnapshot?: string;
    outProject?: string;
    pretty?: boolean;
    dryRun?: boolean;
  } = {};

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case '--config':
        out.config = next();
        break;
      case '--snapshot':
        out.snapshot = next();
        break;
      case '--project':
        out.project = next();
        break;
      case '--out-snapshot':
        out.outSnapshot = next();
        break;
      case '--out-project':
        out.outProject = next();
        break;
      case '--pretty':
        out.pretty = true;
        break;
      case '--dry-run':
        out.dryRun = true;
        break;
      case '-h':
      case '--help':
        printUsage();
        process.exit(0);
      default:
        // ignore unknown flags for forward-compat, but print a hint
        if (a.startsWith('-')) console.warn(`Unknown option: ${a}`);
        break;
    }
  }

  return out;
}

function printUsage(error?: string) {
  if (error) console.error(`Error: ${error}\n`);
  console.log(`Usage: ts-node scripts/migrate-uuids.ts --config <project-config.json> [options]\n\nOptions:\n  --snapshot <path>       Input TasksIndexSnapshot JSON path (overrides config)\n  --project <path>        Input ProjectSpec JSON path (overrides config)\n  --out-snapshot <path>   Output path for migrated snapshot (default: overwrite input)\n  --out-project <path>    Output path for migrated project (default: overwrite input)\n  --dry-run               Do not write files; print summary only\n  --pretty                Pretty-print JSON outputs (2-space indent)\n  -h, --help              Show this help\n\nConfig resolution:\n- The provided config JSON may include either top-level keys or under a 'paths' object:\n    tasksSnapshot, projectSpec\n- If not provided, defaults are resolved relative to the config file directory:\n    tasks-index.json and project-spec.json\n`);
}
