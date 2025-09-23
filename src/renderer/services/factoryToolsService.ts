import { ChatTool } from 'thefactory-tools'

export type FactoryToolsService = {
  listTools: (projectId: string) => Promise<ChatTool[]>
  executeTool: (projectId: string, toolName: string, args: any) => Promise<any>
}

export const factoryToolsService: FactoryToolsService = { ...window.factoryToolsService }
