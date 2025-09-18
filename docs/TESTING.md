# Testing Guidance

## Philosophy
High-quality, well-tested code is critical for the reliability of the Compass Telegram Bot. We aim for near-100% automated test coverage across the non-generated codebase. Every new feature or bug fix must be accompanied by relevant tests.

This document provides guidance on our testing strategy, tools, and standards. For architectural and code style conventions, please refer to `docs/CODE_STANDARD.md`.

## Tooling
- **Test Runner**: [Vitest](https://vitest.dev/) - A fast and modern test runner with a Jest-compatible API.
- **Mocks & Spies**: Vitest's built-in `vi` object.
- **Assertions**: Vitest's built-in `expect`.

Tests are located in the `tests/` directory and follow the `*.test.ts` naming convention.

## How to Write Tests

### General Principles
1.  **Isolate Units**: Tests should be small and focused on a single unit of functionality (e.g., one function or method).
2.  **AAA Pattern**: Structure tests using the Arrange-Act-Assert pattern:
    -   **Arrange**: Set up all preconditions, mocks, and inputs.
    -   **Act**: Execute the function or method being tested.
    -   **Assert**: Check that the outcome (return value, side effects, mock calls) is what you expect.
3.  **Descriptive Naming**: Use `describe`, `it`, and `test` blocks to create a clear, readable hierarchy. The `it` block should describe the expected behavior, e.g., `it('should return an authenticated user session on successful login', () => { ... });`.

### Mocking Strategy
Effective mocking is key to isolating units and ensuring tests are fast and reliable. Our global test setup is in `tests/setup.ts`.

#### Mocking Backend Services
All backend services, which are generated under `src/generated/backend/`, must be mocked. Never make live API calls in unit tests.

The `tests/setup.ts` file uses `vi.mock` to replace the entire generated module with mock implementations. You can then control the behavior of each service method on a per-test basis using `mockResolvedValue` or `mockRejectedValue`.

**Example**: Mocking a `GoalsService` call:

```typescript
import { GoalsService } from '../src/generated/backend';
import { vi } from 'vitest';

// This mock is often placed in tests/setup.ts or at the top of a test file
vi.mock('../src/generated/backend');

describe('some feature that uses GoalsService', () => {
  it('should handle a list of goals correctly', async () => {
    // Arrange
    const mockGoals = [{ id: '1', title: 'Test Goal' }];
    vi.mocked(GoalsService.GoalsController_list).mockResolvedValue(mockGoals as any);

    // Act
    const result = await someFunctionThatCallsGoalService();

    // Assert
    expect(GoalsService.GoalsController_list).toHaveBeenCalledWith({ limit: 10 });
    expect(result).toEqual(mockGoals);
  });
});
```

#### Mocking AI/LLM Responses
When testing features that rely on AI-generated content (e.g., goal suggestions), it is crucial to mock the backend responses that would typically come from an LLM. This allows us to test for a wide range of scenarios in a deterministic way.

-   **Success Case**: Mock a typical, well-formed AI response.
-   **Empty/No Suggestions**: Mock an empty array or null response to ensure the bot handles it gracefully.
-   **Malformed Data**: Mock a response that deviates from the expected schema (e.g., missing required fields). The bot should handle this without crashing, ideally logging an error and presenting a user-friendly message.
-   **Backend Errors**: Use `mockRejectedValue` to simulate a 500 error from the backend.

### Schema and Data Validation
While the backend is the ultimate source of truth for data schemas, the bot must be resilient to unexpected data shapes. Tests should validate that our code correctly handles both valid and invalid data from the backend.

-   **Input Validation**: For any user input that is parsed or transformed (e.g., dates, numbers), add tests for invalid formats.
-   **Output Validation**: When the bot receives data from the backend, especially within conversation flows, ensure it can handle missing or malformed fields gracefully. For example, if a `ConversationPromptDto` is missing a `title`, the rendering logic should not crash.

## Coverage Expectations
We aim for **as close to 100% line and branch coverage as possible**. While 100% is not always practical (e.g., for unavoidable error paths in third-party libraries), all new business logic must be fully tested.

Use the coverage report to identify untested code paths:

```bash
npm run test:coverage
```

Any pull request that decreases overall test coverage will not be merged until coverage is improved.
