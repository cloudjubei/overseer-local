# Testing Guidance

## Philosophy
High-quality, well-tested code is critical to the success and reliability of this project. We aim for near-100% automated test coverage across all non-generated code. Every new feature should be accompanied by comprehensive tests, and bug fixes should include a regression test to prevent future issues.

Tests should be fast, reliable, and easy to write. They serve as living documentation for our codebase, demonstrating how different components are expected to behave in various scenarios.

### ATOMICITY
Tests should be as atomic as they can be - each test should be checking a single code path or a single return. One unit test shouldn't be testing the same function multiple times, other than to test out the difference in flow or data stored between multiple runs (if there's any need for that).

## Tooling
- Test Runner: Vitest (https://vitest.dev/)
- Mocking: Vitest's built-in vi object is used for mocking, spying, and stubbing. See vi.mock() for module-level mocking and vi.spyOn() for tracking calls to specific functions.
- Assertions: We use Vitest's built-in expect assertion library.

## Project Test Setup
- Global Setup: The tests/setup.ts file is executed before the test suite runs. It is responsible for:
  - Setting essential environment variables (NODE_ENV, tokens, secrets) to ensure a consistent test environment.
  - Creating a temporary directory for session files (SESSIONS_DIR) to isolate test runs from development data and each other.
  - Globally mocking the generated backend client (src/generated/backend) to prevent actual network requests during tests.
- Test Location: Tests for a file src/lib/module.ts should be located at tests/lib/module.test.ts.

## Logging in Tests
To prevent noisy stderr during tests, we use an environment-aware logger at src/lib/logger.ts. In NODE_ENV=test, warn and error logs are suppressed by default. If you need to see them while debugging a flaky test, set LOG_LEVEL explicitly (e.g., LOG_LEVEL=debug or LOG_LEVEL=error).

- Default behavior (NODE_ENV=test):
  - warn/error suppressed, info logged via console.log, debug suppressed
- Override:
  - LOG_LEVEL=silent | error | warn | info | debug

## Mocking Strategy
- Backend Services: The entire generated backend client is mocked in tests/setup.ts. In your tests, you can provide specific mock implementations for the service methods you expect to be called. Always reset mocks (vi.resetAllMocks()) in a beforeEach block to ensure tests are isolated.

  ```typescript
  import { ConversationsService } from '../src/generated/backend';
  import { vi } from 'vitest';

  // In your test:
  vi.mocked(ConversationsService.conversationsControllerHandle).mockResolvedValue({ ... });
  ```

- Dependencies: Use vi.mock('path/to/module') at the top of your test file to mock dependencies like sessionStore, config, or third-party libraries (node-cron). This allows you to control their behavior and isolate the unit under test.

- Internal Functions: To test a function that calls another function within the same module, direct mocking won't work. Instead, use a namespace import and vi.spyOn:

  ```typescript
  import * as myModule from '../src/myModule';

  it('should call internal function', () => {
    const internalSpy = vi.spyOn(myModule, 'internalFunction');
    myModule.publicFunction();
    expect(internalSpy).toHaveBeenCalled();
  });
  ```

## Writing Tests
- Arrange, Act, Assert: Structure your tests clearly following this pattern.
- Describe and It: Use describe blocks to group tests for a specific function or module. Use it blocks with descriptive names for individual test cases.
- Edge Cases: Test not only the happy path but also edge cases and failure modes:
  - Invalid or missing input (e.g., null, undefined, empty strings).
  - Errors thrown by mocked dependencies.
  - Unexpected responses from backend APIs (e.g., empty arrays, missing properties).
- Schema Validation: When interacting with the backend, ensure your code is robust against malformed data. While the generated client provides types, your handling logic should gracefully manage scenarios where the runtime data does not match the expected schema. Tests should validate this behavior by mocking responses with missing or incorrect data types.

## Running Tests
Execute the test suite with the following command:

```bash
npm test
```

To run tests in watch mode during development:

```bash
npm run test:watch
```

To check test coverage:

```bash
npm run test:coverage
```
