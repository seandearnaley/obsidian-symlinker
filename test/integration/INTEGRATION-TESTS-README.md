# Integration Tests Guide

This document explains the current state of the integration tests and provides guidance for future improvements.

## Current State

The integration tests for Obsidian Symlinker are currently in the following state:

1. **Working Tests**:
   - `basic-integration.test.mjs`: Simple integration tests that verify file access and basic inter-module dependencies

2. **Skipped Tests** (need fixing):
   - `electron.test.mjs`: UI integration tests using Playwright
   - `main-process.test.mjs`: Tests for the main Electron process
   - `renderer-mock.test.mjs`: Tests for the renderer process using JSDOM

## Known Issues

### Electron Application Tests

The Electron application tests using Playwright are skipped due to these issues:

- Cannot access `window.electron.ipcRenderer` in the page context
- Difficulty mocking IPC communication between the main and renderer processes
- Need to properly configure the Playwright/Electron test environment

### Main Process Tests

The Main Process tests are skipped due to:

- Issues with `vi.mock()` for `node:fs` and other modules
- Difficulty importing and mocking the main.js module
- Challenges in testing the Electron IPC handlers

### Renderer Process Tests

The Renderer Process tests using JSDOM are skipped due to:

- Difficulty loading the renderer.js code that depends on Node.js modules
- Challenges in mocking the DOM environment and required globals
- Complex DOM manipulation that's hard to test in isolation

## How to Fix

### General Approach

1. **Module Structure**: Consider restructuring the application code to be more testable
   - Separate business logic from UI code
   - Use dependency injection for easier mocking
   - Create testable pure functions where possible

2. **Testing Infrastructure**:
   - Use proper test fixtures for setting up and tearing down the test environment
   - Create specialized test helpers for common operations
   - Consider using Spectron or similar tools for Electron testing

### Specific Fixes

#### Electron Application Tests
- Use Playwright's `addInitScript()` to inject mocked Electron IPC before the page loads
- Modify the application to allow for dependency injection in test mode
- Use a test-specific Electron configuration

#### Main Process Tests
- Fix the async mocking with proper `importOriginal` handling
- Properly mock Electron dependencies
- Extract the handler functions to standalone, importable functions

#### Renderer Process Tests
- Use a bundler (like esbuild or Webpack) to create a testable version of renderer.js
- Create a proper DOM fixture with all required elements
- Inject mocked modules before executing the code

## Running Tests

```bash
# Run all integration tests (including skipped ones)
npm run test:integration

# Run only the working integration tests
npx vitest run test/integration/basic-integration.test.mjs
```

## Adding New Tests

When adding new integration tests:

1. Start with simple tests that don't require complex mocking
2. Add tests incrementally, starting with module dependencies
3. Document any assumptions or special setup requirements
4. Use proper assertions with meaningful error messages

## Future Work

The following improvements are planned:

1. Refactor renderer.js to be more testable (separate UI from logic)
2. Create proper test fixtures for Electron environment
3. Add end-to-end tests using Playwright
4. Implement proper mocking for IPC communication