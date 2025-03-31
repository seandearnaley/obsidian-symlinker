# Integration & E2E Tests Guide

This document explains the testing strategy for integration and end-to-end (E2E) scenarios.

## Current State & Strategy

Integration and E2E testing for Obsidian Symlinker is approached as follows:

1.  **Module Integration Tests (`test/integration/`)**:
    * These tests focus on verifying the interaction between different *internal* modules of the application (e.g., ensuring `main.js` correctly imports and uses functions from `utils.js`).
    * They typically do *not* involve launching the full Electron application and may use mocks for Electron APIs or external dependencies.
    * `basic-integration.test.mjs`: Verifies file access and basic inter-module dependencies.

2.  **Electron E2E / Integration Tests (`test/e2e/`)**:
    * These tests use **Playwright** to launch the *actual* Electron application.
    * They test the complete workflow, including UI interactions, main-renderer process communication (IPC), and integration with Electron APIs.
    * These provide the highest level of confidence that the application works as expected for the user.
    * See `test/e2e/app.test.mjs`.

**Note:** Previous mentions of skipped tests (`electron.test.mjs`, `main-process.test.mjs`, `renderer-mock.test.mjs`) referred to prior testing attempts. The current strategy relies on Playwright for full Electron application testing.

## Running Tests

```bash
# Run module integration tests
npm run test:integration

# Run E2E / Electron tests using Playwright
npm run test:e2e
```

## Adding New Tests

When adding new tests:

1.  **Unit Tests (`test/unit/`)**: Test individual functions/modules in isolation, using mocks heavily.
2.  **Module Integration Tests (`test/integration/`)**: Test interactions *between* your own modules, mocking Electron/external parts if needed.
3.  **E2E / Electron Tests (`test/e2e/`)**: Use Playwright to test user flows in the real app. Focus on user actions and visible outcomes. Mock external services or filesystem interactions where necessary for reliability using Playwright's features (`page.route`, `electronApp.evaluate`, IPC interception).

## Future Work

1.  Expand E2E test coverage in `test/e2e/app.test.mjs` to cover core features like file selection, renaming, symlink creation, and recent links.
2.  Refactor `renderer.js` and `main.js` if needed to improve testability (e.g., separating logic from Electron-specific calls).
3.  Implement more sophisticated mocking within Playwright tests (e.g., mocking `electron-store` or filesystem operations) for more complex scenarios.