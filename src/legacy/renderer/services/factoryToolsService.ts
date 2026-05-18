import { PreviewToolNotSupportedResult } from 'thefactory-tools'

export type FactoryToolsService = {
  executeTool: (projectId: string, toolName: string, args: any) => Promise<any>
  previewTool: (
    projectId: string,
    toolName: string,
    args: any,
  ) => Promise<any | PreviewToolNotSupportedResult>
}

export const factoryToolsService: FactoryToolsService = { ...window.factoryToolsService }
