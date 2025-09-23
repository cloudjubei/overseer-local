import type { BrowserWindow } from 'electron'
import IPC_HANDLER_KEYS from '../ipcHandlersKeys'
import {
  // ToolDefinition,
  Tools,
  createTools,
} from 'thefactory-tools'
import BaseManager from '../BaseManager'

export default class FactoryToolsManager extends BaseManager {
  private tools?: Tools

  constructor(projectRoot: string, window: BrowserWindow) {
    super(projectRoot, window)

    this.tools = undefined
  }

  async init(): Promise<void> {
    // this.tools = createTools(this.projectRoot)

    await super.init()
  }

  getHandlersAsync(): Record<string, (args: any) => Promise<any>> {
    const handlers: Record<string, (args: any) => Promise<any>> = {}

    handlers[IPC_HANDLER_KEYS.FACTORY_TOOLS_LIST] = () => this.listTools()
    handlers[IPC_HANDLER_KEYS.FACTORY_TOOLS_EXECUTE] = ({ toolName, args }) =>
      this.executeTool(toolName, args)

    return handlers
  }

  async listTools(): Promise<ToolDefinition[]> {
    return this.agentRunTools?.listTools() || []
  }

  async executeTool(toolName: string, args: any): Promise<any> {
    if (!this.agentRunTools) {
      throw new Error('AgentRunTools not initialized')
    }

    const tool = (await this.agentRunTools.listTools()).find((t) => t.name === toolName)

    if (!tool) {
      throw new Error(`Tool "${toolName}" not found`)
    }

    try {
      // NOTE: `executeTool` is not a method on agentRunTools, we need to call the tool's execute method directly
      // This is a placeholder for the actual execution logic, which might need to be adjusted
      // based on the actual structure of `thefactory-tools`
      if (typeof tool.execute !== 'function') {
        throw new Error(`Tool "${toolName}" is not executable.`)
      }
      const result = await tool.execute(args)
      return result
    } catch (error: any) {
      console.error(`Error executing tool "${toolName}":`, error)
      throw new Error(`Failed to execute tool "${toolName}": ${error.message}`)
    }
  }
}
