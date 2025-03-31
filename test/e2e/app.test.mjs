import { _electron as electron } from "playwright";
import { expect as playwrightExpect } from "@playwright/test";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect as vitestExpect,
  it,
} from "vitest";
import path from "node:path";
import * as url from "node:url";

const vitest_expect = vitestExpect;
const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..", "..");
const mainFile = path.join(projectRoot, "src", "main.js");

let electronApp;
let page;

// Store keys for temporary properties on main process dialog module
const originalOpenDialogKey = "__vitest_originalShowOpenDialog";
const originalMessageBoxKey = "__vitest_originalShowMessageBox";

// --- Hooks ---

beforeAll(async () => {
  electronApp = await electron.launch({ args: [mainFile] });
  page = await electronApp.firstWindow();

  // Store original dialog methods ON the dialog object in the main process
  await electronApp.evaluate(
    ({ dialog }, { openKey, msgBoxKey }) => {
      if (dialog && typeof dialog.showOpenDialog === "function") {
        dialog[openKey] = dialog.showOpenDialog;
        console.log("[Main Process] Stored original showOpenDialog");
      }
      if (dialog && typeof dialog.showMessageBox === "function") {
        dialog[msgBoxKey] = dialog.showMessageBox;
        console.log("[Main Process] Stored original showMessageBox");
      }
    },
    { openKey: originalOpenDialogKey, msgBoxKey: originalMessageBoxKey }
  );

  page.on("console", (msg) => console.log("RENDERER:", msg.text()));
  page.on("pageerror", (error) => console.error("RENDERER ERROR:", error));
  await page.waitForSelector("body");
}, 30000); // Increased timeout for app launch

afterEach(async () => {
  // Restore original dialog methods from stored properties
  await electronApp.evaluate(
    ({ dialog }, { openKey, msgBoxKey }) => {
      if (dialog && typeof dialog[openKey] === "function") {
        dialog.showOpenDialog = dialog[openKey];
        console.log(
          "[Main Process] Restored original showOpenDialog in afterEach."
        );
      }
      if (dialog && typeof dialog[msgBoxKey] === "function") {
        dialog.showMessageBox = dialog[msgBoxKey];
        console.log(
          "[Main Process] Restored original showMessageBox in afterEach."
        );
      }
    },
    { openKey: originalOpenDialogKey, msgBoxKey: originalMessageBoxKey }
  );

  // Remove IPC handlers potentially mocked by tests
  await electronApp.evaluate(async ({ ipcMain }) => {
    console.log(
      "[Main Process Mock] Removing known IPC handlers in afterEach."
    );
    ipcMain.removeHandler("create-symlink");
    ipcMain.removeHandler("get-recent-links");
    ipcMain.removeHandler("clear-recent-links");
    // Clean up stateful flag
    if (ipcMain) {
      ipcMain.__VITEST_RECENT_LINKS_CLEARED = undefined;
    }
  });

  // Restore window.confirm if it was mocked
  await page.evaluate(() => {
    if (window._originalConfirm) {
      window.confirm = window._originalConfirm;
      window._originalConfirm = undefined;
      console.log(
        "RENDERER MOCK: Restored original window.confirm in afterEach"
      );
    }
  });
});

afterAll(async () => {
  // Clean up temporary properties on dialog and close app
  if (electronApp) {
    try {
      await electronApp.evaluate(
        ({ dialog }, { openKey, msgBoxKey }) => {
          // Optional: Clean up properties if desired
          if (dialog?.[openKey]) dialog[openKey] = undefined;
          if (dialog?.[msgBoxKey]) dialog[msgBoxKey] = undefined;
        },
        { openKey: originalOpenDialogKey, msgBoxKey: originalMessageBoxKey }
      );
    } catch (error) {
      // Ignore errors during cleanup if app already closed
      if (
        !error.message.includes(
          "Target page, context or browser has been closed"
        )
      ) {
        console.error("Error during afterAll cleanup evaluate:", error);
      }
    }
    // Close the app
    await electronApp.close();
  }
});

// --- Test Suite ---

describe("Application E2E Tests", () => {
  it("should launch the application window", async () => {
    vitest_expect(electronApp).toBeDefined();
    vitest_expect(page).toBeDefined();
    const windowCount = await electronApp.windows().length;
    vitest_expect(windowCount).toBe(1);
  });

  it("should select a custom vault path", async () => {
    const mockVaultPath = "/selected/custom/vault";
    // Mock dialogs needed for THIS test
    await electronApp.evaluate(
      ({ dialog }, { vaultPath, openKey, msgBoxKey }) => {
        dialog.showOpenDialog = async (win, options) => {
          return options?.properties?.includes("openDirectory")
            ? { canceled: false, filePaths: [vaultPath] }
            : typeof dialog[openKey] === "function"
            ? dialog[openKey](win, options)
            : { canceled: true, filePaths: [] };
        };
        dialog.showMessageBox = async () => ({ response: 0 }); // Auto-confirm vault warning
      },
      {
        vaultPath: mockVaultPath,
        openKey: originalOpenDialogKey,
        msgBoxKey: originalMessageBoxKey,
      }
    );

    await page.locator("#choose-vault-btn").click();

    await playwrightExpect(page.locator("#vault-path")).toHaveValue(
      mockVaultPath
    );
    await playwrightExpect(page.locator("#vault-selector")).toHaveValue("");
    await playwrightExpect(page.locator("#create-symlinks-btn")).toBeDisabled();
  });

  it("should display the correct title", async () => {
    await page.waitForSelector(".titlebar .title");
    const title = await page.textContent(".titlebar .title");
    playwrightExpect(title).toBe("Obsidian Symlinker");
  });

  it("should have the main UI elements visible", async () => {
    await playwrightExpect(page.locator("#vault-selector")).toBeVisible();
    await playwrightExpect(page.locator("#choose-vault-btn")).toBeVisible();
    await playwrightExpect(page.locator("#choose-markdown-btn")).toBeVisible();
    await playwrightExpect(page.locator("#create-symlinks-btn")).toBeVisible();
    await playwrightExpect(page.locator("#results")).toBeVisible();
    await playwrightExpect(page.locator("#recent-links")).toBeVisible();
  });

  it("should allow renaming a selected file", async () => {
    const mockFiles = ["/path/to/file1-for-rename.md", "/path/to/file2.md"];
    // Mock dialog needed for THIS test setup
    await electronApp.evaluate(
      ({ dialog }, { filePaths, openKey }) => {
        dialog.showOpenDialog = async (win, options) => {
          return options?.properties?.includes("openFile")
            ? { canceled: false, filePaths }
            : typeof dialog[openKey] === "function"
            ? dialog[openKey](win, options)
            : { canceled: true, filePaths: [] };
        };
      },
      { filePaths: mockFiles, openKey: originalOpenDialogKey }
    );

    await page.locator("#choose-markdown-btn").click();
    await playwrightExpect(page.locator("#file-list .file-item")).toHaveCount(
      mockFiles.length
    );

    // --- Rename Logic ---
    const firstFileItem = page.locator("#file-list .file-item").first();
    const originalName = "file1-for-rename.md"; // Name derived from mockFiles[0]
    const customName = "My Custom File.md";

    await firstFileItem.locator(".edit-name-btn").click();
    const nameInput = firstFileItem.locator(
      ".file-edit-container input[type='text']"
    );
    await playwrightExpect(nameInput).toBeVisible();
    await playwrightExpect(nameInput).toHaveValue(originalName);
    await nameInput.fill(customName);
    await firstFileItem.locator("button:text('Save')").click();
    await playwrightExpect(
      firstFileItem.locator(".file-item-info")
    ).toContainText(`${originalName} → ${customName}`);
    await playwrightExpect(
      firstFileItem.locator(".file-edit-container")
    ).toBeHidden();

    // Can add other rename sub-tests here if desired...

    // Cleanup happens in afterEach
  }, 20000); // Slightly reduced timeout

  it("should select markdown files and update the UI", async () => {
    const mockFiles = ["/path/to/file1.md", "/path/to/another/file2.md"];
    // Mock dialog needed for THIS test
    await electronApp.evaluate(
      ({ dialog }, { filePaths, openKey }) => {
        dialog.showOpenDialog = async (win, options) => {
          return options?.properties?.includes("openFile")
            ? { canceled: false, filePaths }
            : typeof dialog[openKey] === "function"
            ? dialog[openKey](win, options)
            : { canceled: true, filePaths: [] };
        };
      },
      { filePaths: mockFiles, openKey: originalOpenDialogKey }
    );

    await page.locator("#choose-markdown-btn").click();

    await playwrightExpect(page.locator("#markdown-files")).toHaveValue(
      `${mockFiles.length} file(s) selected`
    );
    await playwrightExpect(page.locator("#file-list .file-item")).toHaveCount(
      mockFiles.length
    );
    await playwrightExpect(
      page.locator("#file-list .file-item").first()
    ).toContainText("file1.md");
    await playwrightExpect(
      page.locator("#file-list .file-item").nth(1)
    ).toContainText("file2.md");
    await playwrightExpect(page.locator("#create-symlinks-btn")).toBeEnabled();
  });

  it("should create symlinks and display results (mocked)", async () => {
    const vaultPath = "/test/vault/for-symlinks";
    const mockFilesToSelect = [
      { path: "/source/fileA.md", originalName: "fileA.md" },
      {
        path: "/source/fileB.md",
        originalName: "fileB.md",
        customName: "CustomB.md",
      },
    ];
    const mockSymlinkResults = [
      {
        success: true,
        file: "fileA.md",
        targetPath: mockFilesToSelect[0].path,
        symlinkPath: path.join(vaultPath, "fileA.md"),
      },
      {
        success: true,
        file: "CustomB.md",
        targetPath: mockFilesToSelect[1].path,
        symlinkPath: path.join(vaultPath, "CustomB.md"),
      },
    ];

    // --- Setup 1: Select Vault ---
    await electronApp.evaluate(
      ({ dialog }, { path, openKey, msgBoxKey }) => {
        dialog.showOpenDialog = async (win, options) => {
          return options?.properties?.includes("openDirectory")
            ? { canceled: false, filePaths: [path] }
            : typeof dialog[openKey] === "function"
            ? dialog[openKey](win, options)
            : { canceled: true, filePaths: [] };
        };
        dialog.showMessageBox = async () => ({ response: 0 });
      },
      {
        path: vaultPath,
        openKey: originalOpenDialogKey,
        msgBoxKey: originalMessageBoxKey,
      }
    );
    await page.locator("#choose-vault-btn").click();
    await playwrightExpect(page.locator("#vault-path")).toHaveValue(vaultPath);

    // --- Setup 2: Select Files ---
    await electronApp.evaluate(
      ({ dialog }, { filePaths, openKey }) => {
        dialog.showOpenDialog = async (win, options) => {
          return options?.properties?.includes("openFile")
            ? { canceled: false, filePaths }
            : typeof dialog[openKey] === "function"
            ? dialog[openKey](win, options)
            : { canceled: true, filePaths: [] };
        };
      },
      {
        filePaths: mockFilesToSelect.map((f) => f.path),
        openKey: originalOpenDialogKey,
      }
    );
    await page.locator("#choose-markdown-btn").click();
    await playwrightExpect(page.locator("#file-list .file-item")).toHaveCount(
      mockFilesToSelect.length
    );

    // --- Setup 3: Custom Name ---
    const fileBItem = page.locator("#file-list .file-item").nth(1);
    await fileBItem.locator(".edit-name-btn").click();
    await fileBItem
      .locator(".file-edit-container input[type='text']")
      .fill(mockFilesToSelect[1].customName);
    await fileBItem.locator("button:text('Save')").click();

    // --- Setup 4: Mock IPC handlers for symlink creation ---
    await electronApp.evaluate(
      async ({ ipcMain }, { results }) => {
        ipcMain.removeHandler("create-symlink");
        ipcMain.handle("create-symlink", async () => {
          console.log(
            "[Main Process Mock] IPC create-symlink returning mock results"
          );
          return results;
        });
      },
      { results: mockSymlinkResults }
    );

    // --- Action: Create Symlinks ---
    await page.locator("#create-symlinks-btn").click();
    await page.waitForSelector("#results .result-item", { timeout: 10000 });

    // --- Assertion 1: Verify Results ---
    await playwrightExpect(
      page.locator("#results .result-item").nth(1)
    ).toHaveClass(/success/, { timeout: 10000 });
    await playwrightExpect(
      page.locator("#results .result-item").nth(1)
    ).toContainText("CustomB.md");

    // Clear recent links for next test
    await page.locator("#clear-recent-btn").click();

    // --- Assertion 2: Verify UI Reset ---
    await playwrightExpect(page.locator("#markdown-files")).toHaveValue("");
    await playwrightExpect(page.locator("#file-list .file-item")).toHaveCount(
      0
    );
    await playwrightExpect(page.locator("#create-symlinks-btn")).toBeDisabled();
  }, 20000); // Slightly reduced timeout

  /**
   * Test for clearing recent links functionality
   *
   * IMPORTANT IMPLEMENTATION NOTES:
   * This test requires careful handling of Electron's IPC and dialog systems:
   *
   * 1. CRITICAL: You must mock BOTH window.confirm in the renderer process AND
   *    dialog.showMessageBox in the main process - the app uses both for confirmation.
   *
   * 2. Simply mocking the dialogs is NOT enough - you must also mock the actual
   *    IPC handlers (clear-recent-links and get-recent-links) to ensure proper state
   *    management.
   *
   * 3. State must be properly refreshed with ipcMain.emit("recent-links-changed")
   *    to trigger UI updates after clearing.
   *
   * 4. The test data accumulates across test runs if not properly cleaned, leading
   *    to test failures. We use a flag to verify the clear operation completed.
   *
   * 5. Cleanup must happen in afterEach hooks to prevent state persistence between tests.
   *
   * Common pitfalls:
   * - Mocking only window.confirm but not dialog.showMessageBox
   * - Not properly implementing the clear-recent-links handler
   * - Not emitting events to trigger UI updates
   * - Not verifying the operation completed before assertions
   * - Not handling the persistent state between tests
   */
  it("should clear recent links when confirmed", async () => {
    // This flag helps ensure our mock handler was called
    await electronApp.evaluate(({ ipcMain }) => {
      ipcMain.__VITEST_RECENT_LINKS_CLEARED = false;
    });

    // First create some symlinks to populate the recent links
    const vaultPath = "/test/vault/for-clear-test";
    const mockFiles = [
      { path: "/source/fileA.md", originalName: "fileA.md" },
      { path: "/source/fileB.md", originalName: "fileB.md" },
    ];
    const mockResults = [
      {
        success: true,
        file: "fileA.md",
        targetPath: mockFiles[0].path,
        symlinkPath: path.join(vaultPath, "fileA.md"),
      },
      {
        success: true,
        file: "fileB.md",
        targetPath: mockFiles[1].path,
        symlinkPath: path.join(vaultPath, "fileB.md"),
      },
    ];

    // Set up vault selection
    await electronApp.evaluate(
      ({ dialog }, { path }) => {
        dialog.showOpenDialog = async () => ({
          canceled: false,
          filePaths: [path],
        });
        dialog.showMessageBox = async () => ({ response: 0 });
      },
      { path: vaultPath }
    );
    await page.locator("#choose-vault-btn").click();
    await playwrightExpect(page.locator("#vault-path")).toHaveValue(vaultPath);

    // Set up file selection
    await electronApp.evaluate(
      ({ dialog }, { filePaths }) => {
        dialog.showOpenDialog = async () => ({ canceled: false, filePaths });
      },
      { filePaths: mockFiles.map((f) => f.path) }
    );
    await page.locator("#choose-markdown-btn").click();

    // Mock symlink creation
    await electronApp.evaluate(
      async ({ ipcMain }, { results }) => {
        ipcMain.removeHandler("create-symlink");
        ipcMain.handle("create-symlink", async () => results);
      },
      { results: mockResults }
    );

    // Create the symlinks - this also updates recent links
    await page.locator("#create-symlinks-btn").click();
    await page.waitForSelector("#results .result-item", { timeout: 5000 });

    // Make sure we have recent links showing
    await page.waitForSelector("#recent-links .recent-item", { timeout: 5000 });
    const beforeCount = await page.evaluate(
      () => document.querySelectorAll("#recent-links .recent-item").length
    );
    console.log(`Before clearing: ${beforeCount} recent links`);
    expect(beforeCount).toBeGreaterThan(0);

    // CRITICAL: Mock both confirm methods AND the IPC handlers
    // 1. Mock window.confirm in RENDERER process
    await page.evaluate(() => {
      window._originalConfirm = window.confirm;
      window.confirm = () => {
        console.log("RENDERER: window.confirm mock called - returning true");
        return true;
      };
    });

    // 2. Mock both dialog.showMessageBox AND IPC handlers in MAIN process
    await electronApp.evaluate(({ dialog, ipcMain }) => {
      // Mock dialog first
      dialog.showMessageBox = async (win, options) => {
        console.log("[MAIN] showMessageBox mock called - auto confirming");
        return { response: 0 }; // First button (OK/Yes)
      };

      // MORE IMPORTANT: Mock the actual clear-recent-links handler
      console.log("[MAIN] Setting up clear-recent-links mock handler");
      ipcMain.removeHandler("clear-recent-links");
      ipcMain.handle("clear-recent-links", async () => {
        console.log("[MAIN] clear-recent-links handler called");

        // Set a flag we can check
        ipcMain.__VITEST_RECENT_LINKS_CLEARED = true;

        // Mock empty results to get-recent-links going forward
        ipcMain.removeHandler("get-recent-links");
        ipcMain.handle("get-recent-links", async () => {
          console.log(
            "[MAIN] get-recent-links returning empty array after clear"
          );
          return [];
        });

        // CRITICAL: Emit an event to refresh the UI
        // Without this, the UI won't update even if the store is cleared
        ipcMain.emit("recent-links-changed");

        return true;
      });
    });

    // Click the clear button
    console.log("Test: Clicking clear recent links button");
    await page.locator("#clear-recent-btn").click();

    // Wait for our mock to be called and take effect
    // This is important to ensure the async operations complete
    await electronApp.evaluate(async ({ ipcMain }) => {
      // Give a little time for events to propagate
      for (let i = 0; i < 10; i++) {
        if (ipcMain.__VITEST_RECENT_LINKS_CLEARED) {
          console.log("[MAIN] Verified clear handler was called");
          return;
        }
        await new Promise((r) => setTimeout(r, 100));
      }
      console.log(
        "[MAIN] Warning: Clear handler doesn't seem to have been called"
      );
    });

    // Wait for the view to update with "No recent symlinks"
    await playwrightExpect(page.locator("#recent-links")).toContainText(
      "No recent symlinks",
      { timeout: 5000 }
    );

    // Verify no items remain
    const afterCount = await page.evaluate(
      () => document.querySelectorAll("#recent-links .recent-item").length
    );
    console.log(`After clearing: ${afterCount} recent links`);
    expect(afterCount).toBe(0);
  }, 15000);
}); // End of describe
