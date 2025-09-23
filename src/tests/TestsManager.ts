import type { BrowserWindow } from 'electron'
import IPC_HANDLER_KEYS from '../ipcHandlersKeys'
import BaseManager from '../BaseManager'
import path from 'node:path'
import { createTestTools } from 'thefactory-tools/dist/tools/testTools'

export default class TestsManager extends BaseManager {
  constructor(projectRoot: string, window: BrowserWindow) {
    super(projectRoot, window)
  }

  getHandlersAsync(): Record<string, (args: any) => Promise<any>> {
    const handlers: Record<string, (args: any) => Promise<any>> = {}

    handlers[IPC_HANDLER_KEYS.TESTS_RUN] = async ({ relPath }: { relPath?: string }) => {
      try {
        const tools = createTestTools(this.projectRoot)
        // If relPath is not provided, run all tests by passing '.' (vitest will pick up all)
        const target = relPath && relPath.trim().length > 0 ? relPath : '.'
        const output = await tools.runTest(target)
        return { ok: true, raw: output }
      } catch (e: any) {
        return { ok: false, raw: e?.message || String(e) }
      }
    }

    return handlers
  }
}
