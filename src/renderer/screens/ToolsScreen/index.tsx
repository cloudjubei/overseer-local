import React, { useEffect, useState } from 'react';
import { factoryService } from '../../services/factoryService';
import { ToolDefinition } from 'thefactory-tools';

// Define a type for the grouped tools
type GroupedTools = {
  [source: string]: ToolDefinition[];
};

const ToolsScreen: React.FC = () => {
  const [groupedTools, setGroupedTools] = useState<GroupedTools>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTools = async () => {
      try {
        setLoading(true);
        const tools = await factoryService.listTools();
        
        const groups: GroupedTools = tools.reduce((acc, tool) => {
          const source = tool.source || 'Unknown Source'; 
          if (!acc[source]) {
            acc[source] = [];
          }
          acc[source].push(tool);
          return acc;
        }, {} as GroupedTools);

        setGroupedTools(groups);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch tools:', err);
        setError('Failed to load tools. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchTools();
  }, []);

  return (
    <div className="p-4 h-full overflow-y-auto">
      <h1 className="text-2xl font-bold mb-4">Available Tools</h1>
      {loading && <p>Loading tools...</p>}
      {error && <p className="text-red-500">{error}</p>}
      {!loading && !error && Object.keys(groupedTools).length === 0 && (
        <p>No tools available.</p>
      )}
      {Object.entries(groupedTools).map(([source, tools]) => (
        <div key={source} className="mb-6">
          <h2 className="text-xl font-semibold border-b pb-2 mb-2">{source}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tools.map((tool) => (
              <div key={tool.name} className="bg-gray-800 p-4 rounded-lg shadow">
                <h3 className="font-bold text-lg">{tool.name}</h3>
                <p className="text-gray-400 text-sm mt-1">{tool.description}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ToolsScreen;
