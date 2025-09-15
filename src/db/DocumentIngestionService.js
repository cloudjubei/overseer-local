import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

// Lazy import to avoid hard dependency at module load time; caller should ensure thefactory-db is installed
let addDocumentFn = null
async function getAddDocument() {
  if (addDocumentFn) return addDocumentFn
  try {
    const mod = await import('thefactory-db')
    // Expecting addDocument exported from thefactory-db
    addDocumentFn = mod.addDocument || mod.default?.addDocument || null
    if (!addDocumentFn) throw new Error('addDocument not found in thefactory-db')
    return addDocumentFn
  } catch (e) {
    console.error('[DocumentIngestionService] Failed to import thefactory-db:', e?.message || e)
    throw e
  }
}

function stableId(projectId, relPath) {
  return `${projectId}::${relPath.replace(/\\/g, '/')}`
}

function hashContent(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex')
}

const DEFAULT_CODE_EXTS = [
  // scripts and code
  'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'json',
  // markup and docs
  'md', 'mdx', 'txt', 'html', 'htm',
  // styles
  'css', 'scss', 'sass', 'less',
  // config-like
  'yml', 'yaml', 'toml', 'ini', 'env',
]

// Files/dirs to ignore (kept in sync with FilesStorage)
const DEFAULT_IGNORES = [
  /^\./, // dot files
  'node_modules', 'dist', 'out', 'build', '.git', '.cache', 'coverage', '.next', '.vite', 'tmp', '.DS_STORE',
]

function isIgnoredDirName(name) {
  return DEFAULT_IGNORES.some((p) => typeof p === 'string' ? p === name : p.test(name))
}

function isCodeFileByExt(ext) {
  if (!ext) return false
  const e = ext.toLowerCase().replace(/^\./, '')
  return DEFAULT_CODE_EXTS.includes(e)
}

export default class DocumentIngestionService {
  constructor({ projectsManager, filesRootResolver, logger } = {}) {
    // projectsManager: src/projects/ProjectsManager.js instance
    // filesRootResolver: function(project) -> absolute path to project root (defaults to projectsManager.projectsDir + project.path)
    this.projectsManager = projectsManager
    this.filesRootResolver = filesRootResolver
    this.logger = logger || console

    // Cache of known documents metadata per docId to avoid redundant upserts during a single run
    this.docCache = new Map()
  }

  resolveProjectRoot(project) {
    if (this.filesRootResolver) return this.filesRootResolver(project)
    // default: projects are relative to projectsDir
    return path.resolve(this.projectsManager.projectsDir, project.path)
  }

  getDocumentType(ext) {
    if (isCodeFileByExt(ext)) return 'project_code'
    return 'project_file' // external_file reserved for future
  }

  async readFileEntry(absPath) {
    const buf = await fs.readFile(absPath)
    return buf
  }

  async statSafe(p) {
    try {
      return await fs.stat(p)
    } catch (e) {
      return null
    }
  }

  async walkProjectFiles(projectRootAbs) {
    const files = []
    async function walk(relDir = '') {
      const dirAbs = path.join(projectRootAbs, relDir)
      let entries
      try {
        entries = await fs.readdir(dirAbs, { withFileTypes: true })
      } catch (e) {
        return
      }
      for (const entry of entries) {
        const name = entry.name
        if (entry.isDirectory()) {
          if (isIgnoredDirName(name)) continue
          await walk(relDir ? path.join(relDir, name) : name)
        } else if (entry.isFile()) {
          if (/^\.DS_STORE$/i.test(name)) continue
          const rel = relDir ? path.join(relDir, name) : name
          const abs = path.join(projectRootAbs, rel)
          const st = await fs.stat(abs)
          const i = name.lastIndexOf('.')
          const ext = i >= 0 ? name.slice(i + 1).toLowerCase() : undefined
          files.push({ rel: rel.replace(/\\/g, '/'), abs, size: st.size, mtime: st.mtimeMs, ext })
        }
      }
    }
    await walk('')
    return files
  }

  buildMetadata({ projectId, rel, ext, size, mtime, type }) {
    return {
      projectId,
      path: rel,
      ext,
      size,
      mtime,
      type,
    }
  }

  async upsertDocument({ projectId, rel, abs, ext, size, mtime }) {
    const id = stableId(projectId, rel)
    const addDocument = await getAddDocument()

    // Read content for hashing and text ingestion. Assume text files; for binaries, we still hash but store empty or attempt utf8.
    let buf
    try {
      buf = await this.readFileEntry(abs)
    } catch (e) {
      this.logger.warn('[DocumentIngestionService] Failed reading file for upsert:', abs, e?.message || e)
      return { ok: false, skipped: true }
    }
    const hash = hashContent(buf)

    const type = this.getDocumentType(ext)
    const metadata = this.buildMetadata({ projectId, rel, ext, size, mtime, type })

    // Convert to text safely; if binary, produce empty string to avoid noise
    let content
    try {
      content = buf.toString('utf8')
    } catch {
      content = ''
    }

    const cached = this.docCache.get(id)
    if (cached && cached.hash === hash && cached.mtime === mtime) {
      return { ok: true, unchanged: true }
    }

    try {
      await addDocument({
        id,
        projectId,
        path: rel,
        content,
        metadata: { ...metadata, hash },
        type,
        // Upsert behavior expected by thefactory-db; assuming addDocument handles upsert if same id
        upsert: true,
      })
      this.docCache.set(id, { hash, mtime })
      return { ok: true }
    } catch (e) {
      this.logger.error('[DocumentIngestionService] addDocument failed:', id, e?.message || e)
      return { ok: false, error: String(e?.message || e) }
    }
  }

  async deleteDocument({ projectId, rel }) {
    const id = stableId(projectId, rel)
    try {
      const addDocument = await getAddDocument()
      // If thefactory-db supports an archive flag via addDocument, we mark archived; otherwise we can add a tombstone.
      await addDocument({
        id,
        projectId,
        path: rel,
        content: '',
        metadata: { archived: true, deletedAt: Date.now() },
        type: 'project_file',
        upsert: true,
      })
      this.docCache.delete(id)
      return { ok: true }
    } catch (e) {
      this.logger.warn('[DocumentIngestionService] delete (archive) failed:', id, e?.message || e)
      return { ok: false, error: String(e?.message || e) }
    }
  }

  async syncProject(projectId) {
    const project = await this.projectsManager.getProject(projectId)
    if (!project) {
      this.logger.warn('[DocumentIngestionService] syncProject: missing project', projectId)
      return { ok: false, error: 'Project not found' }
    }
    const root = this.resolveProjectRoot(project)
    const files = await this.walkProjectFiles(root)
    let ok = 0, fail = 0
    for (const f of files) {
      const res = await this.upsertDocument({ projectId, rel: f.rel, abs: f.abs, ext: f.ext, size: f.size, mtime: f.mtime })
      if (res?.ok) ok++
      else fail++
    }
    return { ok: true, counts: { upserted: ok, failed: fail, total: files.length } }
  }

  async syncAllProjects() {
    const projects = await this.projectsManager.listProjects()
    const results = {}
    for (const p of projects) {
      results[p.id] = await this.syncProject(p.id)
    }
    return results
  }

  async handleFileAdded({ projectId, relPath }) {
    return this._handleAddOrChange(projectId, relPath)
  }

  async handleFileChanged({ projectId, relPath }) {
    return this._handleAddOrChange(projectId, relPath)
  }

  async _handleAddOrChange(projectId, relPath) {
    const project = await this.projectsManager.getProject(projectId)
    if (!project) return { ok: false, error: 'Project not found' }
    const root = this.resolveProjectRoot(project)
    const abs = path.join(root, relPath)
    const st = await this.statSafe(abs)
    if (!st || !st.isFile?.()) return { ok: false, skipped: true }
    const name = path.basename(relPath)
    const i = name.lastIndexOf('.')
    const ext = i >= 0 ? name.slice(i + 1).toLowerCase() : undefined
    return await this.upsertDocument({ projectId, rel: relPath.replace(/\\/g, '/'), abs, ext, size: st.size, mtime: st.mtimeMs })
  }

  async handleFileDeleted({ projectId, relPath }) {
    return await this.deleteDocument({ projectId, rel: relPath.replace(/\\/g, '/') })
  }
}
