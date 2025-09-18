Testing Guide

Purpose
- Ensure the bot’s behavior is correct and resilient with near-100% coverage of the application code (excluding generated code and the process entry point).
- Validate the data entering and leaving our boundaries (Telegram inputs and backend API calls) with runtime checks where appropriate.

Test Runner and Tools
- Vitest is used for running tests and coverage.
- Tests are written in TypeScript.
- External integrations are mocked:
  - TelegramBot instances are replaced with lightweight fakes in unit tests.
  - Generated backend client (src/generated/backend) services are mocked via Vitest.

Setup
- Required environment variables are set in tests/setup.ts before modules load.
- Sessions are directed to a per-run temporary directory via SESSIONS_DIR env var to avoid clobbering real data.

Conventions
- Location: tests/**/*.test.ts
- Keep tests focused and deterministic. No real network calls.
- Prefer white-box tests for critical logic (flows, auth, session store, scheduler helpers).
- Mock all generated services; never rely on the real backend during tests.

Coverage
- Coverage reports are produced with V8 instrumentation. See coverage/ after running tests.
- We target near-100% coverage of our code under src/ (excluding src/generated/** and src/index.ts). See vitest.config.ts for exact coverage configuration.

Input/Output Validation
- Validate incoming user inputs where possible to avoid sending malformed payloads to the backend.
  - Example: Profile flow validates DOB format (YYYY-MM-DD) and accepted gender values; tests assert that malformed inputs are rejected and that prompts are re-shown.
  - Goal creation flow validates free text presence and ignores commands.
- Validate outbound data by constructing request bodies only from validated fields; tests assert that only valid shapes reach the mocked services.
- When the backend returns heterogeneous data, defensively read fields with type checks in the bot (already implemented) and assert graceful behavior in tests.

Mocking AI/LLM
- The AI suggestions endpoint is treated like an LLM response. Tests mock a range of responses:
  - No suggestions
  - Multiple suggestions
  - Partial/malformed items (missing fields) are coerced to safe defaults by the flow

Running Tests
- npm run test: Run all tests
- npm run test:coverage: Run tests with coverage report

Writing New Tests
- Add a new *.test.ts under tests/.
- Mock any backend calls from src/generated/backend.
- Use a minimal fake bot with only the methods you need (sendMessage, answerCallbackQuery, etc.).
- Ensure edge cases are covered: invalid inputs, cancellations, retries, and error branches.

Notes
- Do not import src/index.ts in tests; it starts a real bot. Test individual modules and flows instead.
- Do not modify files under src/generated/backend/ in tests; always mock them.
