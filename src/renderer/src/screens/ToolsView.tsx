import React, { useEffect, useMemo, useState } from 'react'
import { AgentToolSchema } from 'thefactory-tools'
import { factoryToolsService } from '../services/factoryToolsService'
import { useActiveProject } from '../contexts/ProjectContext'
import { TOOL_SCHEMAS } from 'thefactory-tools/constants'

type GroupedTools = {
  [group: string]: AgentToolSchema[]
}

function getGroupFromName(name: string): string {
  const dotIdx = name.indexOf('.')
  const underIdx = name.indexOf('_')
  let idx = -1
  if (dotIdx !== -1 && underIdx !== -1) idx = Math.min(dotIdx, underIdx)
  else idx = dotIdx !== -1 ? dotIdx : underIdx

  const raw = idx > 0 ? name.slice(0, idx) : name
  const cleaned = raw.replace(/Tools$/i, '')
  const base = cleaned || raw
  const label = base && base !== name ? base : idx === -1 ? 'Misc' : base
  return label.charAt(0).toUpperCase() + label.slice(1)
}

const ToolsScreen: React.FC = () => {
  const { projectId } = useActiveProject()

  const [groupedTools, setGroupedTools] = useState<GroupedTools>({})
  const [filteredGroupedTools, setFilteredGroupedTools] = useState<GroupedTools>({})
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const [selectedTool, setSelectedTool] = useState<AgentToolSchema | null>(null)
  const [args, setArgs] = useState<{ [key: string]: any }>({})
  const [isExecuting, setIsExecuting] = useState<boolean>(false)
  const [executionResult, setExecutionResult] = useState<any | null>(null)
  const [executionError, setExecutionError] = useState<string | null>(null)

  const allTools = useMemo(() => Object.values(groupedTools).flat(), [groupedTools])

  useEffect(() => {
    const fetchTools = async () => {
      try {
        setLoading(true)
        let groups: GroupedTools = {}
        for (const k of Object.keys(TOOL_SCHEMAS)) {
          const tool = TOOL_SCHEMAS[k]
          const group = getGroupFromName(tool.name)
          if (!groups[group]) groups[group] = []
          groups[group].push(tool)
        }

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
  }, [projectId])

  useEffect(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) {
      setFilteredGroupedTools(groupedTools)
      return
    }

    const filtered: GroupedTools = {}
    for (const group in groupedTools) {
      const tools = groupedTools[group].filter((tool) => {
        return (
          tool.name.toLowerCase().includes(q) ||
          tool.description.toLowerCase().includes(q) ||
          group.toLowerCase().includes(q)
        )
      })
      if (tools.length > 0) filtered[group] = tools
    }
    setFilteredGroupedTools(filtered)
  }, [searchQuery, groupedTools])

  const handleSelectTool = (tool: AgentToolSchema) => {
    setSelectedTool(tool)
    setArgs({}) // Reset args when a new tool is selected
    setExecutionResult(null)
    setExecutionError(null)
  }

  const coerceValue = (schema: any, raw: any) => {
    if (!schema) return raw
    const t = schema.type
    if (t === 'boolean') return Boolean(raw)
    if (t === 'integer' || t === 'number') {
      const n = raw === '' || raw === null || raw === undefined ? undefined : Number(raw)
      return isNaN(n as number) ? undefined : n
    }
    if (t === 'array') {
      if (typeof raw === 'string') {
        const parts = raw
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
        if (schema.items && (schema.items.type === 'number' || schema.items.type === 'integer')) {
          return parts.map((p) => (p === '' ? undefined : Number(p))).filter((v) => v !== undefined)
        }
        if (schema.items && schema.items.type === 'boolean') {
          return parts.map((p) => p.toLowerCase() === 'true')
        }
        return parts
      }
      return Array.isArray(raw) ? raw : []
    }
    if (t === 'object') {
      if (typeof raw === 'string') {
        try {
          return raw ? JSON.parse(raw) : {}
        } catch {
          return raw
        }
      }
      return raw
    }
    return raw
  }

  const handleArgChange = (paramName: string, value: any, schema?: any) => {
    const coerced = schema ? coerceValue(schema, value) : value
    setArgs((prev) => ({ ...prev, [paramName]: coerced }))
  }

  const handleExecute = async () => {
    if (!selectedTool) return

    setIsExecuting(true)
    setExecutionResult(null)
    setExecutionError(null)

    try {
      const result = await factoryToolsService.executeTool(projectId, selectedTool.name, args)
      setExecutionResult(result)
    } catch (err: any) {
      console.error('Failed to execute tool:', err)
      setExecutionError(err?.message || 'An unexpected error occurred.')
    } finally {
      setIsExecuting(false)
    }
  }

  const renderArgInput = (key: string, schema: any) => {
    const type = schema?.type || 'string'
    const description = schema?.description || key
    const required = (selectedTool?.parameters?.required || []).includes(key)

    if (schema && Array.isArray(schema.enum)) {
      return (
        <div key={key}>
          <label htmlFor={key} className="block text-sm font-medium text-gray-300 mb-1">
            {description} {required && <span className="text-red-400">*</span>}
          </label>
          <select
            id={key}
            value={args[key] ?? ''}
            onChange={(e) => handleArgChange(key, e.target.value, schema)}
            className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
          >
            <option value="" disabled>
              Select...
            </option>
            {schema.enum.map((opt: any) => (
              <option key={String(opt)} value={opt}>
                {String(opt)}
              </option>
            ))}
          </select>
        </div>
      )
    }

    if (type === 'boolean') {
      return (
        <div key={key} className="flex items-center">
          <input
            id={key}
            type="checkbox"
            checked={!!args[key]}
            onChange={(e) => handleArgChange(key, e.target.checked, schema)}
            className="mr-2"
          />
          <label htmlFor={key} className="text-sm text-gray-300">
            {description} {required && <span className="text-red-400">*</span>}
          </label>
        </div>
      )
    }

    if (type === 'array') {
      return (
        <div key={key}>
          <label htmlFor={key} className="block text-sm font-medium text-gray-300 mb-1">
            {description} {required && <span className="text-red-400">*</span>}
          </label>
          <input
            id={key}
            type="text"
            placeholder="Comma-separated values"
            value={Array.isArray(args[key]) ? args[key].join(', ') : args[key] || ''}
            onChange={(e) => handleArgChange(key, e.target.value, schema)}
            className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
          />
          <p className="text-xs text-gray-400 mt-1">Enter a comma-separated list.</p>
        </div>
      )
    }

    if (type === 'object') {
      return (
        <div key={key}>
          <label htmlFor={key} className="block text-sm font-medium text-gray-300 mb-1">
            {description} {required && <span className="text-red-400">*</span>}
          </label>
          <textarea
            id={key}
            placeholder="JSON object"
            value={
              typeof args[key] === 'string'
                ? args[key]
                : args[key]
                  ? JSON.stringify(args[key], null, 2)
                  : ''
            }
            onChange={(e) => handleArgChange(key, e.target.value, schema)}
            className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-white h-32"
          />
          <p className="text-xs text-gray-400 mt-1">Provide a valid JSON object.</p>
        </div>
      )
    }

    const inputType = type === 'integer' || type === 'number' ? 'number' : 'text'
    return (
      <div key={key}>
        <label htmlFor={key} className="block text-sm font-medium text-gray-300 mb-1">
          {description} {required && <span className="text-red-400">*</span>}
        </label>
        <input
          id={key}
          type={inputType}
          value={args[key] ?? ''}
          onChange={(e) => handleArgChange(key, e.target.value, schema)}
          className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
        />
      </div>
    )
  }

  const selectedToolParams = selectedTool?.parameters
  const selectedToolProps = selectedToolParams?.properties || {}

  return (
    <div className="p-4 h-full flex flex-col">
      <h1 className="text-2xl font-bold mb-4">Available Tools</h1>
      <input
        type="text"
        placeholder="Search tools by name, description, or group..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full p-2 mb-4 bg-gray-700 border border-gray-600 rounded-lg text-white"
      />
      <div className="flex-grow flex overflow-hidden gap-4">
        <div className="w-1/3 overflow-y-auto pr-2">
          {loading && <p>Loading tools...</p>}
          {error && <p className="text-red-500">{error}</p>}
          {!loading && !error && allTools.length === 0 && (
            <p>No tools available{searchQuery ? ' matching your search.' : '.'}</p>
          )}
          {Object.entries(filteredGroupedTools).map(([group, tools]) => (
            <div key={group} className="mb-6">
              <h2 className="text-xl font-semibold border-b pb-2 mb-2">{group}</h2>
              <div className="grid grid-cols-1 gap-2">
                {tools.map((tool) => (
                  <div
                    key={tool.name}
                    className={`bg-gray-800 p-3 rounded-lg shadow cursor-pointer ${
                      selectedTool?.name === tool.name
                        ? 'ring-2 ring-blue-500'
                        : 'hover:bg-gray-700'
                    }`}
                    onClick={() => handleSelectTool(tool)}
                  >
                    <h3 className="font-bold text-md">{tool.name}</h3>
                    <p className="text-gray-400 text-sm mt-1">
                      {tool.description || 'No description provided.'}
                    </p>
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
              <p className="text-gray-400 mb-4">
                {selectedTool.description || 'No description provided.'}
              </p>

              <div className="space-y-4 mb-4">
                {selectedToolProps && Object.keys(selectedToolProps).length > 0 ? (
                  Object.entries(selectedToolProps).map(([key, schema]: [string, any]) =>
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
