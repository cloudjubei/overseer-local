import React, { useEffect, useState } from 'react'
import { factoryAgentRunService } from '../services/factoryAgentRunService'
import { ToolDefinition } from 'thefactory-tools'

// Define a type for the grouped tools
type GroupedTools = {
  [source: string]: ToolDefinition[]
}

const ToolsScreen: React.FC = () => {
  const [groupedTools, setGroupedTools] = useState<GroupedTools>({})
  const [filteredGroupedTools, setFilteredGroupedTools] = useState<GroupedTools>({})
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // State for tool execution
  const [selectedTool, setSelectedTool] = useState<ToolDefinition | null>(null)
  const [args, setArgs] = useState<{ [key: string]: any }>({})
  const [isExecuting, setIsExecuting] = useState<boolean>(false)
  const [executionResult, setExecutionResult] = useState<any | null>(null)
  const [executionError, setExecutionError] = useState<string | null>(null)

  useEffect(() => {
    const fetchTools = async () => {
      try {
        setLoading(true)
        const tools = await factoryAgentRunService.listTools()

        const groups: GroupedTools = tools.reduce((acc, tool) => {
          const source = tool.source || 'Unknown Source'
          if (!acc[source]) {
            acc[source] = []
          }
          acc[source].push(tool)
          return acc
        }, {} as GroupedTools)

        setGroupedTools(groups)
        setError(null)
      } catch (err) {
        console.error('Failed to fetch tools:', err)
        setError('Failed to load tools. Please try again later.')
      } finally {
        setLoading(false)
      }
    }

    fetchTools()
  }, [])

  useEffect(() => {
    const lowercasedQuery = searchQuery.toLowerCase()
    if (!lowercasedQuery) {
      setFilteredGroupedTools(groupedTools)
      return
    }

    const filtered: GroupedTools = {}
    for (const source in groupedTools) {
      const tools = groupedTools[source].filter(
        (tool) =>
          tool.name.toLowerCase().includes(lowercasedQuery) ||
          (tool.description && tool.description.toLowerCase().includes(lowercasedQuery)),
      )
      if (tools.length > 0) {
        filtered[source] = tools
      }
    }
    setFilteredGroupedTools(filtered)
  }, [searchQuery, groupedTools])

  const handleSelectTool = (tool: ToolDefinition) => {
    setSelectedTool(tool)
    setArgs({}) // Reset args when a new tool is selected
    setExecutionResult(null)
    setExecutionError(null)
    // Pre-fill args with default values from Zod schema if they exist
    if (tool.arguments && tool.arguments.shape) {
      const initialArgs: { [key: string]: any } = {}
      for (const key in tool.arguments.shape) {
        const schema = tool.arguments.shape[key]
        if (schema._def.defaultValue) {
          initialArgs[key] = schema._def.defaultValue()
        } else {
          initialArgs[key] = '' // Default to empty string for inputs
        }
      }
      setArgs(initialArgs)
    }
  }

  const handleArgChange = (paramName: string, value: any) => {
    setArgs((prev) => ({ ...prev, [paramName]: value }))
  }

  const handleExecute = async () => {
    if (!selectedTool) return

    setIsExecuting(true)
    setExecutionResult(null)
    setExecutionError(null)

    try {
      const result = await factoryAgentRunService.executeTool(selectedTool.name, args)
      setExecutionResult(result)
    } catch (err: any) {
      console.error('Failed to execute tool:', err)
      setExecutionError(err.message || 'An unexpected error occurred.')
    } finally {
      setIsExecuting(false)
    }
  }

  const renderArgInput = (key: string, schema: z.ZodTypeAny) => {
    const description = schema.description || key
    const typeName = schema._def.typeName

    if (typeName === 'ZodBoolean') {
      return (
        <div key={key} className="flex items-center">
          <input
            id={key}
            type="checkbox"
            checked={!!args[key]}
            onChange={(e) => handleArgChange(key, e.target.checked)}
            className="mr-2"
          />
          <label htmlFor={key} className="text-sm text-gray-300">
            {description}
          </label>
        </div>
      )
    }

    // For string, number, etc.
    return (
      <div key={key}>
        <label htmlFor={key} className="block text-sm font-medium text-gray-300 mb-1">
          {description}
        </label>
        <input
          id={key}
          type={typeName === 'ZodNumber' ? 'number' : 'text'}
          value={args[key] || ''}
          onChange={(e) => handleArgChange(key, e.target.value)}
          className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
        />
      </div>
    )
  }

  return (
    <div className="p-4 h-full flex flex-col">
      <h1 className="text-2xl font-bold mb-4">Available Tools</h1>
      <input
        type="text"
        placeholder="Search tools by name or description..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full p-2 mb-4 bg-gray-700 border border-gray-600 rounded-lg text-white"
      />
      <div className="flex-grow flex overflow-hidden gap-4">
        <div className="w-1/3 overflow-y-auto pr-2">
          {loading && <p>Loading tools...</p>}
          {error && <p className="text-red-500">{error}</p>}
          {!loading && !error && Object.keys(filteredGroupedTools).length === 0 && (
            <p>No tools available{searchQuery ? ' matching your search.' : '.'}</p>
          )}
          {Object.entries(filteredGroupedTools).map(([source, tools]) => (
            <div key={source} className="mb-6">
              <h2 className="text-xl font-semibold border-b pb-2 mb-2">{source}</h2>
              <div className="grid grid-cols-1 gap-2">
                {tools.map((tool) => (
                  <div
                    key={tool.name}
                    className={`bg-gray-800 p-3 rounded-lg shadow cursor-pointer ${selectedTool?.name === tool.name ? 'ring-2 ring-blue-500' : 'hover:bg-gray-700'}`}
                    onClick={() => handleSelectTool(tool)}
                  >
                    <h3 className="font-bold text-md">{tool.name}</h3>
                    <p className="text-gray-400 text-sm mt-1">{tool.description}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="w-2/3 overflow-y-auto pl-2 flex flex-col">
          {selectedTool ? (
            <div className="bg-gray-800 p-4 rounded-lg flex flex-col flex-grow">
              <h2 className="text-xl font-bold mb-2">{selectedTool.name}</h2>
              <p className="text-gray-400 mb-4">{selectedTool.description}</p>

              <div className="space-y-4 mb-4">
                {selectedTool.arguments && Object.keys(selectedTool.arguments.shape).length > 0 ? (
                  Object.entries(selectedTool.arguments.shape).map(([key, schema]) =>
                    renderArgInput(key, schema),
                  )
                ) : (
                  <p className="text-gray-500">This tool has no arguments.</p>
                )}
              </div>

              <button
                onClick={handleExecute}
                disabled={isExecuting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-500"
              >
                {isExecuting ? 'Executing...' : 'Execute'}
              </button>

              <div className="mt-4 flex-grow flex flex-col">
                <h3 className="text-lg font-semibold">Result</h3>
                <div className="bg-gray-900 p-4 rounded-lg mt-2 flex-grow overflow-y-auto">
                  {isExecuting && <p>Running...</p>}
                  {executionError && (
                    <pre className="text-red-500 whitespace-pre-wrap">{executionError}</pre>
                  )}
                  {executionResult !== null && (
                    <pre className="text-white whitespace-pre-wrap">
                      {JSON.stringify(executionResult, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <p>Select a tool to view its details and execute it.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ToolsScreen
