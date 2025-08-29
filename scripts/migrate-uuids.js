
async function runCli() {
  const { v4: uuidv4 } = require('uuid');

  const { argv } = process;
  const args = parseArgs(argv.slice(2));

  if (!args.config) {
    printUsage('Missing required --config <path-to-project-config.json>');
    process.exit(1);
  }

  const { config: configPath } = args;

  // lazy imports to keep the module clean for library usage
  const fs = await import('fs/promises');
  const path = await import('path');

  // Load project config
  let config;
  try {
    const raw = await fs.readFile(configPath, 'utf8');
    config = JSON.parse(raw);
  } catch (err) {
    console.error(`Failed to read config at ${configPath}:`, err);
    process.exit(1);
  }

  const configDir = path.dirname(path.resolve(configPath));
  const projectInPath = path.resolve(configDir, config.path)

  const tasksFromConfig = `${projectInPath}/tasks`
  const tasksInPath = path.resolve(tasksFromConfig)

  // Ensure input files exist
  const exists = async (p) => !!(await fs.stat(p).catch(() => null));
  const projExists = await exists(projectInPath);
  const tasksExists = await exists(tasksInPath);

  if (!tasksExists || !projExists) {
    console.error('Cannot find required input files:');
    if (!tasksExists) console.error(`- tasks (expected at): ${tasksInPath}`);
    if (!projExists) console.error(`- project spec (expected at): ${projectInPath}`);
    console.error('\nTips:');
    console.error('- Provide explicit --project file path');
    console.error('- Or add path in your config file');
    process.exit(1);
  }

  const referencesMap = {}
  const tasks = []

  const taskFolders = await fs.readdir(tasksInPath)
  for (const taskFolder of taskFolders){
    const raw = await fs.readFile(`${tasksInPath}/${taskFolder}/task.json`)
    const json = JSON.parse(raw, 'utf8')

    const newTaskId = uuidv4()
    referencesMap[`${json['id']}`] = newTaskId
    json['id'] = newTaskId

    let features = json['features']
    const featureIdToDisplayIndex = {}
    let index = 1
    for(const f of features){
      const newFeatureId = uuidv4()
      referencesMap[`${f['id']}`] = newFeatureId
      featureIdToDisplayIndex[newFeatureId] = index
      f['id'] = newFeatureId
      index++
    }

    json['features'] = features
    json['featureIdToDisplayIndex'] = featureIdToDisplayIndex
    tasks.push(json)
  }
  let newTasks = []
  for(const t of tasks){
    let newT = t
    let newDependencies = []
    if (t['dependencies'] && t['dependencies'].length > 0){
      for(const d of t['dependencies']){
        newDependencies.push(referencesMap[d])
      }
      newT['dependencies'] = newDependencies
    }

    let newFeatures = []
    for(const f of t['features']){
      let newF = f
      if (f['dependencies'] && f['dependencies'].length > 0){
        let newFeatureDependencies = []
        for(const d of f['dependencies']){
          newFeatureDependencies.push(referencesMap[d])
        }
        newF['dependencies'] = newFeatureDependencies
      }
      newFeatures.push(newF)
    }
    newT['features'] = newFeatures
    newTasks.push(newT)
  }

  await fs.rmdir(tasksInPath, { recursive: true, force: true })
  await fs.mkdir(tasksInPath)

  for(const t of newTasks){
    await fs.mkdir(`${tasksInPath}/${t.id}`)
    await fs.writeFile(`${tasksInPath}/${t.id}/task.json`, JSON.stringify(t, null, 2))
  }

  let projectTasks = {}
  for(let i=0; i<newTasks.length; i++){
    projectTasks[newTasks[i].id] = i+1
  }
  config['taskIdToDisplayIndex'] = projectTasks

  await fs.writeFile(configPath, JSON.stringify(config, 2))
}

function parseArgs(argv) {
  const out = {};

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case '--config':
        out.config = next();
        break;
      default:
        // ignore unknown flags for forward-compat, but print a hint
        if (a.startsWith('-')) console.warn(`Unknown option: ${a}`);
        break;
    }
  }

  return out;
}

function printUsage(error) {
  if (error) console.error(`Error: ${error}\n`);
  console.log(`Usage: node scripts/migrate-uuids.ts --config <project-config.json`);
}


runCli();