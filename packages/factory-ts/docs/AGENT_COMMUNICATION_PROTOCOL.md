# Agent Communication Protocol

This document defines the JSON contract between the Agent (LLM) and the Orchestrator. It enables multi-step conversations and tool invocations in a deterministic, parseable format.

## Overview
- The Agent must always respond with a single JSON object containing:
  - thoughts: A short, high-level, human-readable plan of intended actions or any other relevant insight.
  - tool_calls: An ordered list of tool invocations. Each item specifies the tool name and its arguments.
- The orchestrator executes tool_calls in order and returns execution results to the Agent on the next turn.
- The Agent then returns another JSON object following the same schema for subsequent steps until completion.

## JSON Response Schema
The required structure is:

- thoughts (string): High-level summary for this step..
- tool_calls (array): A sequence of tool invocations.
  - tool_name (string): The exact tool identifier exposed by the orchestrator.
  - arguments (object): A JSON object containing the tool's parameters. The key must be exactly "arguments".

Example shape:
```json
{
  "thoughts": "Create files, run tests, and finish the feature.",
  "tool_calls": [
    {
      "tool_name": "write_file",
      "arguments": { "path": "docs/EXAMPLE.md", "content": "..." }
    },
    {
      "tool_name": "rename_file",
      "arguments": { "path": "docs/EXAMPLE.md", "new_path": "somewhere/else/NEW_EXAMPLE.md" }
    },
    {
      "tool_name": "delete_file",
      "arguments": { "path": "docs/EXAMPLE.md" }
    },
    {
      "tool_name": "run_tests",
      "arguments": {}
    },
    {
      "tool_name": "finish_feature",
      "arguments": { "task_id": 1, "feature_id": 5, "title": "Agent communication porotocol" }
    }
  ]
}
```

## Multi-Turn Conversation
- The orchestrator provides tool execution results back to the Agent after each turn.
- The Agent must continue returning the same JSON structure until the workflow is complete.
- To conclude a feature, the Agent calls finish_feature. To conclude the task (all features complete), the Agent calls submit_for_review followed by finish.

## Validation Rules
- The JSON must be a single object with required keys: thoughts (string) and tool_calls (array).
- Each item in tool_calls must be an object containing tool_name (string) and arguments (object).
- The key for tool parameters must be named exactly "arguments" to ensure deterministic parsing.

## Notes
- The set of available tools and their argument shapes are defined by the orchestrator and may include: write_file, rename_file, delete_file, retrieve_context_files, rename_files, run_tests, finish_feature, submit_for_review, ask_question, finish.
- The Agent should follow repository-specific guidance in docs/TOOL_ARCHITECTURE.md for the authoritative list and semantics of tools.
