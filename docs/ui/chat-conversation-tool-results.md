# ChatConversation tool results display: root cause and fix

Problem

- Tool results for a running agent were intermittently not shown in the ChatConversation UI, while they appeared correctly once the agent had finished.

Findings

- In `buildFeatureTurns`, we attached toolResults to the latest assistant turn by assigning `latestTurn.toolResults = a.toolResults` for any non-assistant message.
- During a running session, additional non-assistant messages (without tool results) can arrive after the tool-results message (e.g., intermediary messages in the same feature/run). The previous logic overwrote `latestTurn.toolResults` with `undefined` as soon as such a message arrived.
- Separately, the UI double-stringified tool results:
  - The tool execution pipeline often returns a JSON string for `toolResults[i].result`.
  - We passed `JSON.stringify(result)` to the `ToolCallRow`, and then attempted `JSON.parse` inside the row, leading to quoted/escaped strings or parse errors.

Fixes

- Only set `latestTurn.toolResults` when the current message actually contains tool results (length > 0); never overwrite with undefined.
- Pass a single, raw string to `ToolCallRow` when the tool result is already a string; only `JSON.stringify` when it is a non-string value.
- In `ToolCallRow`, parse the incoming `resultText` with a safe try/catch and pretty-print valid JSON; otherwise render the raw string.

Why this works

- Tool results now persist for the current turn even as more messages arrive during a live run.
- The display logic gracefully handles both JSON strings and non-JSON strings without double-encoding.

Notes

- The message sequence for tool usage is: assistant response (with toolCalls) → user message containing `toolResults` → possible further messages. The turn builder must attach the first available `toolResults` to the current assistant turn and ignore later non-result messages for that attachment.
