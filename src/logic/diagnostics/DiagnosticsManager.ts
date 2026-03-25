import type { BrowserWindow } from 'electron'
import { app } from 'electron'
import process from 'node:process'
import BaseManager from '../BaseManager'
import IPC_HANDLER_KEYS from '../../preload/ipcHandlersKeys'
import type { DiagnosticsSnapshot } from '../../types/diagnostics'

type LagStats = { avg: number; p95: number; max: number }

// Simple event-loop lag sampler.
// We keep a rolling buffer of lag values measured by setInterval drift.
class EventLoopLagSampler {
  private intervalMs: number
  private timer: NodeJS.Timeout | null = null
  private lastTickAt: number = 0
  private lags: number[] = []
  private maxSamples: number

  constructor(intervalMs = 250, maxSamples = 120) {
    this.intervalMs = intervalMs
    this.maxSamples = maxSamples
  }

  start() {
    if (this.timer) return
    this.lastTickAt = Date.now()
    this.timer = setInterval(() => {
      const now = Date.now()
      const expected = this.lastTickAt + this.intervalMs
      const lag = Math.max(0, now - expected)
      this.lastTickAt = now

      this.lags.push(lag)
      if (this.lags.length > this.maxSamples) this.lags.shift()
    }, this.intervalMs)
    // Don't keep the process alive because of diagnostics
    this.timer.unref?.()
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.lags = []
  }

  getStats(): LagStats | undefined {
    if (!this.lags.length) return undefined
    const sorted = [...this.lags].sort((a, b) => a - b)
    const sum = this.lags.reduce((a, b) => a + b, 0)
    const avg = sum / this.lags.length
    const p95 = sorted[Math.floor(0.95 * (sorted.length - 1))]
    const max = sorted[sorted.length - 1]
    return { avg, p95, max }
  }
}

export default class DiagnosticsManager extends BaseManager {
  private lagSampler = new EventLoopLagSampler()

  constructor(projectRoot: string, window: BrowserWindow) {
    super(projectRoot, window)
  }

  async init(): Promise<void> {
    this.lagSampler.start()
    await super.init()
  }

  async cleanup(): Promise<void> {
    this.lagSampler.stop()
    await super.cleanup()
  }

  getHandlersAsync(): Record<string, (args: any) => Promise<any>> {
    const handlers: Record<string, (args: any) => Promise<any>> = {}

    handlers[IPC_HANDLER_KEYS.DIAGNOSTICS_GET_SNAPSHOT] = async () => this.getSnapshot()

    return handlers
  }

  private async getSnapshot(): Promise<DiagnosticsSnapshot> {
    const timestamp = Date.now()

    // app.getAppMetrics includes CPU and memory per process.
    const metrics = app.getAppMetrics?.() ?? []

    // best-effort: pick the renderer process for the focused window, fallback to first renderer.
    const webContentsId = this.window.webContents?.id
    const rendererMetric =
      metrics.find((m: any) => m?.type === 'Tab' && m?.webContentsId === webContentsId) ??
      metrics.find((m: any) => m?.type === 'Tab')

    const appMetrics = rendererMetric
      ? {
          pid: rendererMetric.pid,
          type: rendererMetric.type,
          cpu: rendererMetric.cpu
            ? {
                percentCPUUsage: rendererMetric.cpu.percentCPUUsage,
                idleWakeupsPerSecond: rendererMetric.cpu.idleWakeupsPerSecond,
              }
            : undefined,
          memory: rendererMetric.memory
            ? {
                workingSetSize: rendererMetric.memory.workingSetSize,
                peakWorkingSetSize: rendererMetric.memory.peakWorkingSetSize,
                privateBytes: rendererMetric.memory.privateBytes,
              }
            : undefined,
        }
      : undefined

    // process.getProcessMemoryInfo is available in the main process.
    // Use node:process (Electron augments it). Keep this best-effort to avoid breaking the overlay.
    const processMemoryInfo = process.getProcessMemoryInfo
      ? await (process.getProcessMemoryInfo() as any)
      : undefined

    return {
      timestamp,
      appMetrics,
      processMemoryInfo,
      eventLoopLagMs: this.lagSampler.getStats(),
    }
  }
}
