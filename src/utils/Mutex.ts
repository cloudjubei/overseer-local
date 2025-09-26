export default class Mutex {
  private isLocked: boolean = false
  private waiting: Array<() => void> = []
  async lock(): Promise<void> {
    return new Promise((resolve) => {
      const tryLock = () => {
        if (!this.isLocked) {
          this.isLocked = true
          resolve()
        } else {
          this.waiting.push(tryLock)
        }
      }
      tryLock()
    })
  }
  unlock(): void {
    if (!this.isLocked) {
      throw new Error('Mutex is not locked')
    }
    this.isLocked = false
    if (this.waiting.length > 0) {
      const next = this.waiting.shift()
      if (next) next()
    }
  }
}
