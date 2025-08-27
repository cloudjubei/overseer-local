# Code Execution and Compilation Checking Options

## Introduction

In our Electron app, agents modify files but cannot currently verify outcomes like compilation success or runtime behavior. This document researches tools and methods to enable compilation checks and isolated code execution, allowing agents to test their work. Options are evaluated for feasibility in a Node.js/Electron context, considering security, performance, and integration.

## Compilation Checking

Compilation checks verify if code is syntactically correct and type-safe without executing it. Tools can be exposed to agents via src/tools/standardTools.js.

### For JavaScript/TypeScript
- **TypeScript Compiler (tsc)**: Run `tsc --noEmit` via Node's child_process to check types and syntax.
  - Pros: Accurate, integrates with our TS setup.
  - Cons: Slower for large files, requires TypeScript installed.
- **ESBuild**: Use esbuild API for fast syntax and type checking.
  - Pros: Extremely fast, lightweight.
  - Cons: Less comprehensive than tsc for advanced TS features.

### For Python
- **py_compile Module**: Use Python's built-in py_compile to check syntax.
  - Pros: Simple, no external deps.
  - Cons: Only catches syntax errors, not runtime issues.
- **pylint or flake8**: For linting and static analysis.
  - Pros: Catches more issues.
  - Cons: Requires installation, opinionated.

### General Approach
- Implement a `check_compilation(filename: str)` tool that detects file type (e.g., via extension) and runs the appropriate checker using child_process.spawn.
- Handle multiple languages by configuring supported compilers in the app.

## Code Execution in Isolated Environments

For verifying runtime behavior, code must run safely without risking the host system. Isolation is key to prevent malicious code.

### Node.js VM Module
- Execute JS code in a sandboxed VM context.
  - Pros: Built-in to Node.js, easy to integrate, controllable globals.
  - Cons: Limited to JS, not full isolation (can escape if misconfigured), no native module access by default.

### Docker Containers
- Run code in ephemeral Docker containers (e.g., via dockerode library).
  - Pros: Strong isolation, supports any language (e.g., node, python images), full environment control.
  - Cons: Requires Docker installed on user machine, higher overhead, potential security prompts, not ideal for quick checks in an Electron app.

### WebContainers
- Use StackBlitz WebContainers for browser-based file systems and execution.
  - Pros: Runs in Electron's renderer (Chromium), supports Node-like env, isolated.
  - Cons: Primarily for web/JS, experimental, may not handle all Node APIs, performance overhead.

### Third-Party Sandboxes
- Libraries like 'isolated-vm' or 'sandboxr' for enhanced JS sandboxes.
  - Pros: Better isolation than built-in VM.
  - Cons: Additional dependencies, still JS-focused.
- For other languages: Use language-specific sandboxes (e.g., Pyodide for Python in browser).
  - Pros: No server needed.
  - Cons: Limited language support, wasm overhead.

## Security Considerations
- Always sanitize inputs.
- Limit execution time and resources.
- Run in non-privileged contexts.
- Inform users about potential risks (e.g., Docker requirement).

## Recommendations
- **Start Simple**: Implement compilation checks first using child_process for tsc/ESBuild (JS/TS) and py_compile (Python). Expose as agent tools.
- **For Execution**: Use Node VM for JS code initially due to ease. Evaluate Docker for multi-language support if needed, but check user adoption impact.
- **Next Steps**: Prototype in src/tools/, add tests, and decide based on performance/security trade-offs.
