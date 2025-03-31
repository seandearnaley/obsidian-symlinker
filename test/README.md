# Obsidian Symlinker Tests

This directory contains tests for the Obsidian Symlinker application, organized by test type.

## Test Structure

- **Unit Tests**: Basic tests for individual functions
- **Integration Tests**: Cross-module tests verifying larger system behavior
- **End-to-End Tests**: Testing the full application with Electron

## Running Tests

The following npm scripts are available:

```bash
# Run all tests
npm test

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Run end-to-end tests (may be skipped in CI)
npm run test:e2e

# Run tests with coverage report
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

- `basic-integration.test.mjs`: Basic integration tests that don't require complex setup
- `electron.test.mjs`: Integration tests for Electron components with Playwright (currently skipped)
- `main-process.test.mjs`: Tests for the main process functionality (currently skipped) 
- `renderer-mock.test.mjs`: Tests for the renderer process with a mocked DOM environment (currently skipped)

Note: Some integration tests are currently skipped due to setup complexity. These tests require additional configuration to properly mock the Electron environment and will be enabled as the test infrastructure evolves.

### End-to-End Tests

End-to-end tests use Playwright to launch the full Electron application and interact with it.
These tests are marked with `.skipIf(process.env.CI === "true")` to avoid issues in CI environments.

## Mocks

Common mocks are located in `test/mocks/` to be shared across different test files.

- `electron-mock.mjs`: Reusable mocks for Electron modules and related dependencies

## Testing Philosophy

1. **Maintainable**: Tests are designed to be maintainable and not break with minor UI changes
2. **Fast**: Tests use mocks where appropriate to ensure fast test execution
3. **Comprehensive**: Tests cover various aspects of the application, including edge cases
4. **Isolated**: Tests are isolated from each other and can run in any order

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