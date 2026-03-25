export type ProcessMemoryInfo = {
  /** Resident set size in KB (from Electron process.getProcessMemoryInfo). */
  residentSet: number
  /** Private bytes in KB (from Electron process.getProcessMemoryInfo). */
  private: number
  /** Shared bytes in KB (from Electron process.getProcessMemoryInfo). */
  shared: number
}

export type CpuUsage = {
  /** Percent CPU usage for the process since last sample (0-100 * logical cores). */
  percentCPUUsage: number
  /** Idle wakeups per second, when available. */
  idleWakeupsPerSecond?: number
}

export type DiagnosticsSnapshot = {
  timestamp: number
  appMetrics?: {
    pid: number
    type?: string
    cpu?: CpuUsage
    memory?: {
      workingSetSize?: number
      peakWorkingSetSize?: number
      privateBytes?: number
    }
  }
  processMemoryInfo?: ProcessMemoryInfo
  jsHeap?: {
    usedJSHeapSize?: number
    totalJSHeapSize?: number
    jsHeapSizeLimit?: number
  }
  eventLoopLagMs?: {
    avg: number
    p95: number
    max: number
  }
}
