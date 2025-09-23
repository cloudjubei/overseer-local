import type { BrowserWindow } from 'electron'
import IPC_HANDLER_KEYS from '../ipcHandlersKeys'
import BaseManager from '../BaseManager'
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

    handlers[IPC_HANDLER_KEYS.TESTS_RUN_COVERAGE] = async ({ relPath }: { relPath?: string }) => {
      try {
        const tools = createTestTools(this.projectRoot)
        if (!relPath || relPath.trim().length === 0) {
          return { ok: false, raw: 'Coverage requires a specific test file path (e.g., tests/foo.spec.ts)'}
        }
        const output = await tools.runTestCoverage(relPath)
        return { ok: true, raw: output }
      } catch (e: any) {
        return { ok: false, raw: e?.message || String(e) }
      }
    }

    return handlers
  }
}
