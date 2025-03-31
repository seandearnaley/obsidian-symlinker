# Obsidian Symlinker Tests

This directory contains tests for the Obsidian Symlinker application, organized by test type.

## Test Structure

- **Unit Tests**: Basic tests for individual functions
- **Integration Tests**: Tests verifying interactions between modules, potentially with mocks (found in `test/integration/`)
- **End-to-End (E2E) / Electron Integration Tests**: Tests using Playwright to launch and interact with the full Electron application (found in `test/e2e/`)

## Running Tests

The following npm scripts are available:

```bash
# Run all tests
npm test

# Run only unit tests
npm run test:unit

# Run only integration tests (module interactions)
npm run test:integration

# Run only E2E / Electron tests (requires app build potentially)
npm run test:e2e

# Run tests with coverage report (primarily for unit/integration tests)
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui
```

## Test Types

### Unit Tests

Located in `test/unit/`, these tests verify individual function behavior in isolation.

- `utils.test.mjs`: Tests for utility functions like `normalizePath` and `validatePath`
- `app-utils.test.mjs`: Tests for application-specific utility functions
- `basic.test.mjs`: Basic tests to ensure the testing framework is configured correctly

### Integration Tests

Located in `test/integration/`, these tests verify integration between multiple modules.

- `basic-integration.test.mjs`: Basic integration tests verifying file access and simple module imports.

### End-to-End (E2E) / Electron Integration Tests

Located in `test/e2e/`, these tests use Playwright to launch the actual Electron application and simulate user interactions. They verify the complete flow, including main-renderer process communication (IPC) and UI behavior.

- `app.test.mjs`: Core E2E tests covering application launch, UI elements, and basic IPC interactions.

## Mocks

Common mocks are located in `test/mocks/` to be shared across different test files.

- `electron-mock.mjs`: Reusable mocks for Electron modules and related dependencies

## Testing Philosophy

1.  **Unit Tests**: Focus on isolated logic using mocks (`test/unit/`). Fast execution.
2.  **Integration Tests**: Verify interactions between internal modules, potentially using mocks (`test/integration/`). Reasonably fast.
3.  **E2E / Electron Tests**: Use Playwright (`test/e2e/`) to test the real application flow, including UI and IPC. Slower but provides highest confidence. Minimize reliance on internal implementation details.
4.  **Maintainable**: Tests should be resilient to minor code refactoring and UI tweaks where possible. E2E tests target user-visible behavior.
5.  **Comprehensive**: Aim for good coverage across different test types.

## Platform Testing

The tests include platform-specific tests that simulate running on Windows, macOS, and Linux
to ensure cross-platform compatibility.

## Adding New Tests

When adding new tests, follow these guidelines:

1. Place tests in the appropriate directory based on test type
2. Use mocks when testing components that depend on external systems
3. Keep tests focused on specific functionality
4. Use descriptive test names that clearly explain what is being tested
5. Follow the existing patterns for setup and cleanup