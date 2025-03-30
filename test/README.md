# Obsidian Symlinker Testing

This directory contains tests for the Obsidian Symlinker application. The testing infrastructure is designed to provide comprehensive coverage and verification of the application's functionality.

## Test Structure

The test structure is organized as follows:

- **Unit Tests** (`/test/unit/`): Tests individual components and functions in isolation
  - `app-utils.test.mjs`: Tests for utility functions adapted from main and renderer
  - `basic.test.mjs`: Simple tests to verify the testing environment
  - `coverage-harness.test.mjs`: Special tests targeting code coverage
  - `main-coverage.test.mjs`: Coverage-specific tests for main.js
  - `main.test.mjs`: Core tests for main process functionality
  - `renderer-coverage.test.mjs`: Coverage-specific tests for renderer.js
  - `renderer-include.test.mjs`: Helper file for renderer coverage
  - `renderer-instrumented.js`: Instrumented version of renderer code
  - `renderer.test.mjs`: Core tests for renderer process functionality
  - `utils.test.mjs`: Tests for the utils.js module

- **Integration Tests** (`/test/integration/`): Tests interactions between components
  - `electron.test.mjs`: Tests Electron-specific functionality

## Current Test Coverage

The current test coverage is as follows:

- **main.js**: 68.77% line coverage
- **renderer.js**: 0% line coverage (difficult to test due to Electron/DOM dependencies)
- **utils.js**: 100% line coverage

The coverage for main.js and renderer.js is limited by their dependencies on Electron APIs, which are challenging to fully mock in a test environment.

## Running Tests

To run the tests, use the following command:

```bash
npm test
```

To run tests with coverage reporting:

```bash
npm test -- --coverage
```

## Testing Approach

The testing strategy employs several approaches:

1. **Mocking**: Extensive use of mocks for Electron APIs, file system operations, and DOM interactions
2. **Isolation**: Testing components in isolation to minimize dependencies
3. **Coverage Harnesses**: Special test files designed specifically to maximize code coverage
4. **Platform-Specific Testing**: Tests for Windows, macOS, and Linux-specific code paths

## Test Utilities

The tests use the following tools and utilities:

- **Vitest**: Modern test runner and assertion library
- **Mock Objects**: Custom mock implementations of Electron, DOM, and Node.js APIs
- **Coverage Instrumentation**: V8 coverage reporting through Vitest

## Future Improvements

To further improve the test coverage, the following approaches could be considered:

1. **Real Electron Environment**: Using a real Electron environment for testing
2. **End-to-End Testing**: Implementing E2E tests with tools like Playwright
3. **More Sophisticated Mocking**: Developing more comprehensive mocks for Electron APIs

## Challenges

Testing an Electron application presents several challenges:

1. **Inter-Process Communication**: Mocking IPC between main and renderer processes
2. **DOM Interactions**: Simulating DOM interactions in a Node.js environment
3. **Platform-Specific Code**: Testing code that behaves differently across platforms
4. **File System Operations**: Safely testing operations like symlink creation

## Continuous Integration

These tests can be integrated into a CI/CD pipeline to ensure code quality before deployment.

## Test Documentation

Each test file contains detailed documentation about the tests being performed and the approach used.