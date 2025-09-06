# Backend Project Bootstrapping

This guide contains the directory structure and commands to scaffold the new Node.js backend service.

## Instructions

1.  Create a new directory for the backend project, for example, at the same level as the current `agent-factory` project.
    ```sh
    mkdir ../agent-factory-backend
    cd ../agent-factory-backend
    ```
2.  Run the commands below to create the directory structure and initialize the project.

## Scaffolding Script

You can copy and paste the following script into your terminal to bootstrap the project.

```sh
#!/bin/bash

echo "🚀 Starting backend project setup..."

# --- 1. Create Directory Structure ---
echo "📂 Creating directory structure..."
mkdir -p config docs src/api/auth src/api/projects src/api/tasks src/api/runs src/core/auth src/core/git src/core/runner src/core/storage src/gateways src/jobs src/middleware src/models src/utils scripts test/api test/services

# --- 2. Create Placeholder Files ---
echo "📝 Creating placeholder files..."
touch config/default.json
touch src/app.js
touch src/server.js
touch src/api/index.js
touch src/gateways/event.gateway.js
touch .env.example
touch .gitignore
touch README.md

# --- 3. Initialize Node.js Project ---
echo "📦 Initializing npm project..."
npm init -y

# --- 4. Install Dependencies ---
echo "⚙️ Installing production dependencies..."
npm install express dotenv cors helmet morgan express-validator socket.io winston simple-git

echo "⚙️ Installing development dependencies..."
npm install -D nodemon eslint prettier eslint-config-prettier eslint-plugin-prettier jest supertest

# --- 5. Setup Initial Config Files ---
echo "✍️ Writing initial configuration files..."

# .gitignore
cat > .gitignore << EOL
# Dependencies
/node_modules
/dist

# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Environment
.env

# IDEs and editors
.idea
.vscode
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?
EOL

# .eslintrc.js
cat > .eslintrc.js << EOL
module.exports = {
  env: {
    commonjs: true,
    es2021: true,
    node: true,
    jest: true,
  },
  extends: ['eslint:recommended', 'prettier'],
  plugins: ['prettier'],
  parserOptions: {
    ecmaVersion: 12,
  },
  rules: {
    'prettier/prettier': 'error',
    'no-console': 'warn',
  },
};
EOL

# prettier.config.js
cat > prettier.config.js << EOL
module.exports = {
  semi: true,
  trailingComma: 'all',
  singleQuote: true,
  printWidth: 120,
  tabWidth: 2,
};
EOL

# jest.config.js
cat > jest.config.js << EOL
module.exports = {
  testEnvironment: 'node',
  coveragePathIgnorePatterns: ['/node_modules/'],
};
EOL

# --- 6. Add Scripts to package.json ---
# This part needs to be done manually or with a tool like jq,
# as directly editing package.json with shell script is fragile.
echo "📜 Add these scripts to your package.json:"
echo '
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "test": "jest",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix"
  },
'

echo "✅ Backend project scaffolding complete!"
echo "➡️ Next steps:"
echo "1. Manually add the scripts from the step above to your package.json."
echo "2. Review the generated configuration files."
echo "3. Write your application logic, starting with 'src/app.js' and 'src/server.js'!"

```
