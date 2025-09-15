import fs from 'fs/promises'
import path from 'path'
import chokidar from 'chokidar'
import IPC_HANDLER_KEYS from '../ipcHandlersKeys'

export const IGNORED_FILES = [
  /(^|[\/\\])\../, // dotfiles/folders
  '**/node_modules/**',
  '**/dist/**',
  '**/out/**',
  '**/build/**',
  '**/.git/**',
  '**/.cache/**',
  '**/coverage/**',
  '**/.next/**',
  '**/.vite/**',
  '**/tmp/**',
]

export default class FilesStorage {
  constructor(projectId, filesDir, window) {
    this.projectId = projectId
    this.filesDir = filesDir
    this.window = window
    this.watcher = null

    this.files = []
    this.changeHandlers = []
  }

  async init() {
    await this.__buildIndex()
    await this.__startWatcher()
  }

  addChangeHandler(handler) {
    this.changeHandlers.push(handler)
  }

  async __startWatcher() {
    if (this.watcher) {
      try {
        await this.watcher.close()
      } catch {}
      this.watcher = null
    }

    this.watcher = chokidar.watch(this.getAbsolutePath('**/*'), {
      IGNORED_FILES,
      persistent: true,
      ignoreInitial: true,
    })

    const toRel = (p) =>
      p ? path.relative(this.filesDir, p).replace(/\\\\/g, '/').replace(/\\\\/g, '/') : p

    this.watcher
      .on('add', (p) => {
        const rel = toRel(p)
        this.__emit('add', { projectId: this.projectId, relPath: rel })
        this.__rebuildAndNotify(`File added: ${p}`)
      })
      .on('change', (p) => {
        const rel = toRel(p)
        this.__emit('change', { projectId: this.projectId, relPath: rel })
        this.__rebuildAndNotify(`File changed: ${p}`)
      })
      .on('unlink', (p) => {
        const rel = toRel(p)
        this.__emit('unlink', { projectId: this.projectId, relPath: rel })
        this.__rebuildAndNotify(`File removed: ${p}`)
      })
      .on('addDir', (p) => this.__rebuildAndNotify(`Dir added: ${p}`))
      .on('unlinkDir', (p) => this.__rebuildAndNotify(`Dir removed: ${p}`))
  }

  stopWatching() {
    if (this.watcher) {
      try {
        this.watcher.close()
      } catch {}
      this.watcher = null
    }
  }

  __notify(logMessage) {
    if (logMessage) console.log(logMessage)
    if (this.window) {
      this.window.webContents.send(IPC_HANDLER_KEYS.FILES_SUBSCRIBE, this.files)
    }
  }

  __emit(type, payload) {
    try {
      if (type === 'add') this.changeHandlers.forEach((h) => h.onAdd?.(payload))
      else if (type === 'change') this.changeHandlers.forEach((h) => h.onChange?.(payload))
      else if (type === 'unlink') this.changeHandlers.forEach((h) => h.onUnlink?.(payload))
      else if (type === 'rename') this.changeHandlers.forEach((h) => h.onRename?.(payload))
    } catch (e) {
      console.warn('[FilesStorage] change handler error:', e?.message || e)
    }
  }

  async __rebuildAndNotify(logMessage) {
    await this.__buildIndex()
    this.__notify(logMessage)
  }

  async __buildIndex() {
    try {
      const s = await fs.stat(this.filesDir)
      if (!s.isDirectory()) throw new Error('filesDir is not a directory')
    } catch (e) {
      return
    }

    const files = []

    await this._walkAndIndex('', files)

    this.files = files.sort((a, b) => a.path.localeCompare(b.path))
  }

  async _walkAndIndex(relDir, filesAcc) {
    const absDir = this.getAbsolutePath(relDir)
    let entries
    try {
      entries = await fs.readdir(absDir, { withFileTypes: true })
    } catch (e) {
      if (e && e.code === 'ENOENT') return
      return
    }

    for (const entry of entries) {
      const entryRel = relDir ? path.join(relDir, entry.name) : entry.name
      const entryAbs = this.getAbsolutePath(entryRel)

      // Skip ignored folders similar to watcher
      if (entry.isDirectory()) {
        if (
          /^(node_modules|dist|out|build|\.git|\.cache|coverage|\.next|\.vite|tmp|\.DS_STORE)$/i.test(
            entry.name,
          )
        ) {
          continue
        }
        await this._walkAndIndex(entryRel, filesAcc)
      } else if (entry.isFile()) {
        if (/^(\.DS_STORE)$/i.test(entry.name)) {
          continue
        }
        let stats
        try {
          stats = await fs.stat(entryAbs)
        } catch (e) {
          continue
        }
        const name = path.basename(entryRel)
        const i = name.lastIndexOf('.')
        const ext = i >= 0 ? name.slice(i + 1).toLowerCase() : undefined
        filesAcc.push({
          path: entryRel.replace(/\\/g, '/'),
          name,
          ext,
          size: stats.size,
          mtime: stats.mtimeMs,
        })
      }
    }
  }

  getAbsolutePath(relPath) {
    return path.join(this.filesDir, relPath)
  }

  async listFiles() {
    return this.files
  }

  async readFile(relPath, encoding) {
    const data = await this.readFileBinary(relPath)
    return data.toString(encoding)
  }

  async readFileBinary(relPath) {
    const abs = this.getAbsolutePath(relPath)
    return await fs.readFile(abs)
  }

  async readDirectory(relPath) {
    const abs = this.getAbsolutePath(relPath)
    return await fs.readdir(abs, { withFileTypes: true })
  }

  async writeFile(relPath, content, encoding) {
    const abs = this.getAbsolutePath(relPath)
    const dir = path.dirname(abs)
    await fs.mkdir(dir, { recursive: true })
    if (content instanceof Uint8Array || Buffer.isBuffer(content)) {
      await fs.writeFile(abs, content)
    } else {
      await fs.writeFile(abs, content, { encoding })
    }
    // Emit change for ingestion
    this.__emit('change', { projectId: this.projectId, relPath })
    await this.__rebuildAndNotify('File written: ' + relPath)
  }

  async deleteFile(relPath) {
    const abs = this.getAbsolutePath(relPath)
    const st = await fs.lstat(abs)
    if (st.isDirectory()) {
      await fs.rm(abs, { recursive: true, force: true })
    } else {
      await fs.unlink(abs)
    }
    // Emit unlink for ingestion
    this.__emit('unlink', { projectId: this.projectId, relPath })
    await this.__rebuildAndNotify('File deleted: ' + relPath)
  }

  async renameFile(relPathSource, relPathTarget) {
    const absSource = this.getAbsolutePath(relPathSource)
    const absTarget = this.getAbsolutePath(relPathTarget)
    const targetDir = path.dirname(absTarget)
    await fs.mkdir(targetDir, { recursive: true })
    await fs.rename(absSource, absTarget)
    // Emit as two-step for ingestion (delete old + add new)
    this.__emit('unlink', { projectId: this.projectId, relPath: relPathSource })
    this.__emit('add', { projectId: this.projectId, relPath: relPathTarget })
    // Also emit a rename hint if listener supports it
    this.__emit('rename', {
      projectId: this.projectId,
      relPathSource,
      relPathTarget,
    })
    await this.__rebuildAndNotify('File renamed from: ' + relPathSource + ' to: ' + relPathTarget)
  }

  async uploadFile(name, content) {
    const uploadsDir = this.getAbsolutePath('uploads')
    await fs.mkdir(uploadsDir, { recursive: true })
    const filePath = path.join(uploadsDir, name)
    if (content instanceof Uint8Array || Buffer.isBuffer(content)) {
      await fs.writeFile(filePath, content)
    } else {
      await fs.writeFile(filePath, content, { encoding: 'utf8' })
    }
    const rel = path.join('uploads', name).replace(/\\/g, '/')
    // Emit add for ingestion
    this.__emit('add', { projectId: this.projectId, relPath: rel })
    await this.__rebuildAndNotify('File uploaded: ' + name)
    return rel
  }
}
