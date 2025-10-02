export type FactoryToolsService = {
  executeTool: (projectId: string, toolName: string, args: any) => Promise<any>
}

export const factoryToolsService: FactoryToolsService = { ...window.factoryToolsService }
