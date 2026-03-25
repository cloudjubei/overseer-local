import type { BrowserWindow } from 'electron'
import IPC_HANDLER_KEYS from '../../preload/ipcHandlersKeys'
import {
  createCodeIntelTools,
  CodeIntelTools,
  CodeIntelDetectedEnvironment,
} from 'thefactory-tools'
import BaseManager from '../BaseManager'

export default class CodeIntelManager extends BaseManager {
  private tools: CodeIntelTools

  constructor(projectRoot: string, window: BrowserWindow) {
    super(projectRoot, window)

    this.tools = createCodeIntelTools(this.projectRoot)
  }

  async init(): Promise<void> {
    await this.tools.init()

    await super.init()
  }

  getHandlersAsync(): Record<string, (args: any) => Promise<any>> {
    const handlers: Record<string, (args: any) => Promise<any>> = {}

    handlers[IPC_HANDLER_KEYS.CODE_INTEL_DETECT_ENVIRONMENT] = async ({ dirPath }) =>
      this.detectCodeProjectEnvironment(dirPath)

    return handlers
  }

  getTools(): CodeIntelTools {
    return this.tools
  }

  async detectCodeProjectEnvironment(dirPath: string): Promise<CodeIntelDetectedEnvironment> {
    return await this.tools.detectCodeProjectEnvironment(dirPath)
  }
}
