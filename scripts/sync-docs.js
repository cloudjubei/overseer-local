'use strict'

// One-off document sync script for development/testing
// Usage:
//   THEFACTORY_DB_URL=postgres://user:pass@host:5432/db node scripts/sync-docs.js
//   node scripts/sync-docs.js --db "postgres://..." --project my-project-id
//   node scripts/sync-docs.js --root /abs/path/to/repo

const path = require('path')
const fs = require('fs/promises')
const { pathToFileURL } = require('url')

async function loadESM(modulePath) {
  const spec = pathToFileURL(modulePath).href
  return await import(spec)
}

async function pathExists(p) {
  try {
    await fs.stat(p)
    return true
  } catch (_) {
    return false
  }
}

function parseArgs(argv) {
  const args = { _: [] }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--project' || a === '-p') args.project = argv[++i]
    else if (a === '--db') args.db = argv[++i]
    else if (a === '--root') args.root = argv[++i]
    else if (a === '--help' || a === '-h') args.help = true
    else args._.push(a)
  }
  return args
}

function printHelp() {
  console.log(
    `Sync project files into thefactory-db documents table\n\nOptions:\n  --db <connectionString>   Database connection string (overrides THEFACTORY_DB_URL)\n  --project <id>            Only sync the specified project id\n  --root <path>             Override repo root (defaults to process.cwd())\n`,
  )
}

class SimpleProjectsManager {
  constructor(rootDir) {
    this.projectRoot = path.resolve(rootDir)
    this.projectsDir = path.join(this.projectRoot, 'projects')
    this._projects = []
  }
  async init() {
    this._projects = await this._loadAll()
  }
  async _loadAll() {
    const dir = this.projectsDir
    const out = []
    if (!(await pathExists(dir))) return out
    let entries = []
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch (_) {
      return out
    }
    for (const e of entries) {
      if (!e.isFile() || !e.name.toLowerCase().endsWith('.json')) continue
      const abs = path.join(dir, e.name)
      try {
        const raw = await fs.readFile(abs, 'utf8')
        const json = JSON.parse(raw)
        if (json && json.id) out.push(json)
      } catch (_) {
        // ignore invalid project files
      }
    }
    return out
  }
  listProjects() {
    return this._projects
  }
  getProject(id) {
    return this._projects.find((p) => p.id === id)
  }
}

async function main() {
  const args = parseArgs(process.argv)
  if (args.help) return printHelp()

  const root = args.root ? path.resolve(args.root) : process.cwd()
  const connectionString = args.db || process.env.THEFACTORY_DB_URL
  if (!connectionString) {
    console.error('Missing DB connection string. Provide THEFACTORY_DB_URL env or --db argument.')
    process.exitCode = 2
    return
  }

  const db = await import('thefactory-db')
  const client = await db.openDatabase({ connectionString })

  const { default: DocumentIngestionService } = await loadESM(
    path.resolve(__dirname, '../src/db/DocumentIngestionService.js'),
  )

  const projectsManager = new SimpleProjectsManager(root)
  await projectsManager.init()

  const ingestion = new DocumentIngestionService({ projectsManager, logger: console })

  let result
  if (args.project) {
    const project = projectsManager.getProject(args.project)
    if (!project) {
      console.error(`Project not found: ${args.project}`)
      await client.close?.()
      process.exitCode = 1
      return
    }
    console.log(`[sync-docs] Syncing project: ${project.id}`)
    result = await ingestion.syncProject(project.id)
    console.log(`[sync-docs] Result:`, JSON.stringify(result, null, 2))
  } else {
    const projects = projectsManager.listProjects()
    if (!projects.length) {
      console.warn(`[sync-docs] No projects found under ${projectsManager.projectsDir}`)
    }
    console.log(`[sync-docs] Syncing ${projects.length} project(s)`)
    result = await ingestion.syncAllProjects()
    console.log(`[sync-docs] Results:`, JSON.stringify(result, null, 2))
  }

  await client.close?.()
}

main().catch(async (err) => {
  console.error('[sync-docs] Failed:', err?.message || err)
  try {
    const db = await import('thefactory-db')
    await db.close?.()
  } catch (_) {}
  process.exitCode = 1
})
