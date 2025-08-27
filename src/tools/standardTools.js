const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');

const standardToolSchemas = [
  {
    name: 'write_file',
    description: 'Create or overwrite a file.',
    parameters: {
      type: 'object',
      properties: {
        filename: { type: 'string' },
        content: { type: 'string' }
      },
      required: ['filename', 'content']
    }
  },
  {
    name: 'finish_feature',
    description: 'Mark the feature as complete.',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'block_feature',
    description: 'Block the feature with a reason.',
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string' }
      },
      required: ['reason']
    }
  },
  {
    name: 'get_context',
    description: 'Get content of files.',
    parameters: {
      type: 'object',
      properties: {
        files: { type: 'array', items: { type: 'string' } }
      },
      required: ['files']
    }
  },
  {
    name: 'run_test',
    description: 'Run tests and get result.',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'web_search_duckduckgo',
    description: 'Search the web using DuckDuckGo.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' }
      },
      required: ['query']
    }
  },
  {
    name: 'web_search_serpapi',
    description: 'Search the web using Google via SerpAPI. Requires SERPAPI_KEY in environment.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' }
      },
      required: ['query']
    }
  }
];

const standardToolFunctions = {
  async write_file({ filename, content }) {
    const fullPath = path.join(process.cwd(), filename);
    await fs.writeFile(fullPath, content, 'utf8');
    return 'File written.';
  },
  finish_feature() {
    return 'Feature completed.';
  },
  block_feature({ reason }) {
    return `Blocked: ${reason}`;
  },
  async get_context({ files }) {
    const contents = [];
    for (const file of files) {
      try {
        const content = await fs.readFile(path.join(process.cwd(), file), 'utf8');
        contents.push(content);
      } catch (e) {
        contents.push(`Error: ${e.message}`);
      }
    }
    return contents;
  },
  run_test() {
    return 'Test results.';
  },
  async web_search_duckduckgo({ query }) {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`;
    const response = await fetch(url);
    const data = await response.json();
    let results = data.Abstract ? [data.Abstract] : [];
    if (data.RelatedTopics) {
      results = results.concat(data.RelatedTopics.map(t => t.Text));
    }
    return results.join('\n') || 'No results found.';
  },
  async web_search_serpapi({ query }) {
    const apiKey = process.env.SERPAPI_KEY;
    if (!apiKey) return 'SerpAPI key not set.';
    const url = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();
    const results = data.organic_results ? data.organic_results.map(r => `${r.title}: ${r.snippet}`) : [];
    return results.join('\n') || 'No results found.';
  }
};

module.exports = { standardToolSchemas, standardToolFunctions };