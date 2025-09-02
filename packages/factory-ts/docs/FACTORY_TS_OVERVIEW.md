# Factory TS Overview

This package provides an agent orchestrator mirroring the legacy Python scripts/blueprint/run_local_agent.py flow. It exposes runOrchestrator, runAgentOnTask, and runAgentOnFeature and consumes host-provided TaskUtils (project I/O, tools) and GitManager.

Response format and agent docs are provided under packages/factory-ts/docs and included verbatim in prompts, matching the Python orchestrator.

The orchestrator expects a CompletionClient that returns a JSON object with fields thoughts and tool_calls. See docs/agent_response_example.json for the required structure.
