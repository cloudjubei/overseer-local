const fs = require('fs').promises;
const path = require('path');

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
  }
};

module.exports = { standardToolSchemas, standardToolFunctions };