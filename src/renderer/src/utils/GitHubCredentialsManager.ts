import { v4 as uuidv4 } from 'uuid'

export type GitHubCredentials = {
  id?: string
  name: string
  username: string
  email: string
  token: string
}

export const GITHUB_CREDS_CHANGED_EVENT = 'github-creds-changed'

export class GitHubCredentialsManager {
  private storageKey = 'githubCredentials'

  private notify() {
    try {
      window.dispatchEvent(new CustomEvent(GITHUB_CREDS_CHANGED_EVENT))
    } catch {}
  }

  getAll(): GitHubCredentials[] {
    try {
      const raw = localStorage.getItem(this.storageKey)
      const parsed = raw ? JSON.parse(raw) : []
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  saveAll(items: GitHubCredentials[]) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(items))
    } catch {}
    this.notify()
  }

  add(item: Omit<GitHubCredentials, 'id'>): GitHubCredentials {
    const next: GitHubCredentials = { ...item, id: uuidv4() }
    const all = this.getAll()
    all.push(next)
    this.saveAll(all)
    return next
  }

  update(id: string, updates: Partial<GitHubCredentials>) {
    const all = this.getAll()
    const idx = all.findIndex((x) => x.id === id)
    if (idx !== -1) {
      all[idx] = { ...all[idx], ...updates }
      this.saveAll(all)
    } else {
      this.notify()
    }
  }

  remove(id: string) {
    const all = this.getAll().filter((x) => x.id !== id)
    this.saveAll(all)
  }
}
