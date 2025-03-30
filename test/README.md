# Obsidian Symlinker Testing

This directory contains tests for the Obsidian Symlinker application using Vitest.

## Testing Approach

We use ES Modules (ESM) for both our application code and tests, which simplifies testing and keeps our codebase consistent with modern JavaScript practices.

## Running Tests

You can run tests using the following npm scripts:

```bash
# Run all tests
npm test

# Run tests in watch mode (automatically re-run on file changes)
npm run test:watch

# Run tests with UI
npm run test:ui

# Run tests with coverage report
npm run test:coverage
```

## Test Structure

- `unit/`: Unit tests for individual functions and components
- `integration/`: Tests for how components work together

## Writing Tests

To create a new test, create a file with the `.test.mjs` extension in the appropriate directory:

```javascript
// basic-test.mjs
import { describe, it, expect } from "vitest";

describe("Feature name", () => {
  it("should do something specific", () => {
    // Arrange
    const input = "test";

    // Act
    const result = input.toUpperCase();

    // Assert
    expect(result).toBe("TEST");
  });
});
```

### Mocking Dependencies

When testing code that has external dependencies, use Vitest's mocking capabilities:

```javascript
import { describe, it, expect, vi } from "vitest";
import { myFunction } from "../../src/my-module.js";

// Mock dependencies
vi.mock("node:fs", () => {
  return {
    readFile: vi.fn(),
    writeFile: vi.fn(),
  };
});

// Import mocked module after mocking
import fs from "node:fs";

describe("MyFunction", () => {
  it("should handle file operations correctly", () => {
    // Setup mock behavior
    fs.readFile.mockImplementation((path, options, callback) => {
      callback(null, "file content");
    });

    // Test the function
    const result = myFunction();

    // Verify results
    expect(fs.readFile).toHaveBeenCalled();
    expect(result).toBe("expected value");
  });
});
```

## Best Practices

1. **Test Organization**: Keep tests organized by feature or module
2. **Test Isolation**: Each test should be independent and not rely on other tests
3. **Use Mocks**: Mock external dependencies to ensure tests run consistently
4. **Test Coverage**: Aim for comprehensive test coverage, but focus on critical paths
5. **CI Integration**: Tests should run automatically in CI to catch regressions

## Troubleshooting

- If Electron tests fail to launch, check that you have the correct Electron version installed
- For issues with Playwright, try running `npx playwright install` to ensure dependencies are set up
