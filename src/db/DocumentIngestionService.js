import crypto from 'crypto'
import path from 'path'
import fs from 'fs/promises'

// We expect thefactory-db to expose a client/SDK with addDocument and query/update helpers.
// To keep this integration thin, we only use addDocument for upserts, and mark archived on deletions.
// The thefactory-tools package is expected to read the same connection info, so we export a getter here if needed.

// Helper to compute SHA256 over string or buffer
function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex')
}

// Default code file extensions we treat as 'project_code'
const DEFAULT_CODE_EXTS = new Set([
  'js', 'ts', 'tsx', 'jsx', 'mjs', 'cjs',
  'json', 'md', 'mdx', 'yml', 'yaml', 'toml', 'ini',
  'css', 'scss', 'sass', 'less', 'pcss',
  'html', 'htm', 'xml', 'svg',
  'sh', 'bash', 'zsh', 'fish',
  'py', 'rb', 'go', 'rs', 'java', 'kt', 'c', 'cc', 'cpp', 'h', 'hpp',
  'sql',
])

// Ignore patterns aligned with FilesStorage
const IGNORED_DIR_RE = /^(node_modules|dist|out|build|\.git|\.cache|coverage|\.next|\.vite|tmp|\.DS_STORE)$/i

export default class DocumentIngestionService {
  /**
   * @param {object} opts
   * @param {import('../projects/ProjectsManager').ProjectsManager} opts.projectsManager
   * @param {import('../files/FilesManager').FilesManager} opts.filesManager Optional; if not provided, will walk FS directly.
   * @param {object} opts.db A thefactory-db client exposing addDocument(doc)
   * @param {object} [opts.logger] Optional logger with .info/.warn/.error
   * @param {Set<string>} [opts.codeExts]
   * @param {import('./DatabaseManager').DatabaseManager} [opts.dbManager]
   */
  constructor({ projectsManager, filesManager, db, logger, codeExts, dbManager } = {}) {
    this.projectsManager = projectsManager
    this.filesManager = filesManager
    this.db = db
    this.logger = logger || console
    this.codeExts = codeExts || DEFAULT_CODE_EXTS
    this.dbManager = dbManager
  }

  // Determine document type based on extension
  _inferTypeFromExt(ext) {
    if (!ext) return 'project_file'
    const clean = String(ext).replace(/^\./, '').toLowerCase()
    if (this.codeExts.has(clean)) return 'project_code'
    return 'project_file'
  }

  // Compose stable document id per file
  _docId(projectId, relPath) {
    return `${projectId}:${relPath}`
  }

  // Build document payload for addDocument
  async _buildDocument({ projectId, projectRoot, relPath }) {
    const abs = path.join(projectRoot, relPath)
    let buf
    try {
      buf = await fs.readFile(abs)
    } catch (e) {
      // File may have been removed; return null to skip
      this.logger?.warn?.(`_buildDocument: could not read ${abs}: ${e?.message || e}`)
      return null
    }
    const content = buf.toString('utf8')
    let stats
    try {
      stats = await fs.stat(abs)
    } catch (e) {
      this.logger?.warn?.(`_buildDocument: could not stat ${abs}: ${e?.message || e}`)
      return null
    }
    const id = this._docId(projectId, relPath)
    const name = path.basename(relPath)
    const i = name.lastIndexOf('.')
    const ext = i >= 0 ? name.slice(i + 1).toLowerCase() : undefined
    const type = this._inferTypeFromExt(ext)
    const contentHash = sha256(content)

    const metadata = {
      projectId,
      relPath,
      name,
      ext,
      size: stats.size,
      mtime: stats.mtimeMs,
      type,
    }

    return {
      id,
      projectId,
      content,
      contentHash,
      metadata,
      archived: false,
    }
  }

  // Walk project directory collecting relative file paths while respecting ignores
  async _walkProject(projectRoot) {
    const results = []
    async function walk(relDir = '') {
      const absDir = path.join(projectRoot, relDir)
      let entries
      try {
        entries = await fs.readdir(absDir, { withFileTypes: true })
      } catch (e) {
        return
      }
      for (const entry of entries) {
        const entryRel = relDir ? path.join(relDir, entry.name) : entry.name
        if (entry.isDirectory()) {
          if (IGNORED_DIR_RE.test(entry.name)) continue
          await walk(entryRel)
        } else if (entry.isFile()) {
          if (/^(\.DS_STORE)$/i.test(entry.name)) continue
          results.push(entryRel.replace(/\\/g, '/'))
        }
      }
    }
    await walk('')
    return results
  }

  // Obtain project root from ProjectsManager spec
  _resolveProjectRoot(projectSpec) {
    // ProjectsManager stores projectsDir as base and projectSpec.path is relative to it
    const projectsDir = this.projectsManager.projectsDir
    return path.resolve(projectsDir, projectSpec.path)
  }

  // Upsert a single file
  async _upsertFile(projectId, projectRoot, relPath) {
    const doc = await this._buildDocument({ projectId, projectRoot, relPath })
    if (!doc) return { skipped: true }
    try {
      await this.db.addDocument(doc)
      return { ok: true }
    } catch (e) {
      this.logger?.error?.(`addDocument failed for ${doc.id}: ${e?.message || e}`)
      return { ok: false, error: e }
    }
  }

  // Mark a document as archived (on delete)
  async _archiveDoc(projectId, relPath) {
    const id = this._docId(projectId, relPath)
    try {
      await this.db.addDocument({ id, archived: true })
      return { ok: true }
    } catch (e) {
      this.logger?.error?.(`archive addDocument failed for ${id}: ${e?.message || e}`)
      return { ok: false, error: e }
    }
  }

  // Public: Sync all projects found in ProjectsManager
  async syncAllProjects() {
    const projects = this.projectsManager.listProjects?.() || []
    for (const p of projects) {
      await this.syncProject(p.id)
    }
  }

  // Public: Sync one project by id
  async syncProject(projectId) {
    const project = this.projectsManager.getProject(projectId)
    if (!project) return { ok: false, error: `Project not found: ${projectId}` }
    const projectRoot = this._resolveProjectRoot(project)

    // Prefer FilesManager listing to stay consistent with ignores and virtual files
    let relPaths
    try {
      if (this.filesManager?.listFiles) {
        const files = await this.filesManager.listFiles(projectId)
        relPaths = (files || []).map((f) => f.path)
      } else {
        relPaths = await this._walkProject(projectRoot)
      }
    } catch (e) {
      this.logger?.warn?.(`syncProject list failed for ${projectId}, walking FS: ${e?.message || e}`)
      relPaths = await this._walkProject(projectRoot)
    }

    for (const relPath of relPaths) {
      await this._upsertFile(projectId, projectRoot, relPath)
    }

    // mark sync time on DatabaseManager for status
    try {
      this.dbManager?.markProjectSynced?.(projectId, new Date())
    } catch {}

    return { ok: true, count: relPaths.length }
  }

  // Public: react to a single file added
  async handleFileAdded(projectId, relPath) {
    const project = this.projectsManager.getProject(projectId)
    if (!project) return
    const projectRoot = this._resolveProjectRoot(project)
    await this._upsertFile(projectId, projectRoot, relPath)
    try { this.dbManager?.markProjectSynced?.(projectId, new Date()) } catch {}
  }

  // Public: react to a single file changed
  async handleFileChanged(projectId, relPath) {
    const project = this.projectsManager.getProject(projectId)
    if (!project) return
    const projectRoot = this._resolveProjectRoot(project)
    await this._upsertFile(projectId, projectRoot, relPath)
    try { this.dbManager?.markProjectSynced?.(projectId, new Date()) } catch {}
  }

  // Public: react to a single file deleted
  async handleFileDeleted(projectId, relPath) {
    await this._archiveDoc(projectId, relPath)
    try { this.dbManager?.markProjectSynced?.(projectId, new Date()) } catch {}
  }
}
