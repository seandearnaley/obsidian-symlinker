import { _electron as electron } from "playwright";
import { expect as playwrightExpect } from "@playwright/test"; // Use Playwright's expect directly
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect as vitestExpect,
  it,
} from "vitest"; // Keep vitest expect for non-Playwright things if needed
import path from "node:path";
import * as url from "node:url"; // Import the whole module

// Keep vitestExpect for non-Playwright assertions
const vitest_expect = vitestExpect;
const __filename = url.fileURLToPath(import.meta.url); // Use url.fileURLToPath
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..", "..");

// Path to the main entry point for Electron
const mainFile = path.join(projectRoot, "src", "main.js");

let electronApp;
let page;

// Store keys for temporary properties on main process dialog module
const originalOpenDialogKey = "__vitest_originalShowOpenDialog";
const originalMessageBoxKey = "__vitest_originalShowMessageBox";

beforeAll(async () => {
  // Launch the Electron app
  electronApp = await electron.launch({ args: [mainFile] });
  page = await electronApp.firstWindow();

  // Store original dialog methods ON the dialog object in the main process
  await electronApp.evaluate(
    ({ dialog }, { openKey, msgBoxKey }) => {
      if (typeof dialog.showOpenDialog === 'function') {
        dialog[openKey] = dialog.showOpenDialog;
         console.log('[Main Process] Stored original showOpenDialog');
      } else {
         console.error('[Main Process] Failed to store original showOpenDialog');
      }
      if (typeof dialog.showMessageBox === 'function') {
        dialog[msgBoxKey] = dialog.showMessageBox;
         console.log('[Main Process] Stored original showMessageBox');
      } else {
          console.error('[Main Process] Failed to store original showMessageBox');
      }
    },
    { openKey: originalOpenDialogKey, msgBoxKey: originalMessageBoxKey }
  );

  page.on("console", (msg) => console.log("RENDERER:", msg.text()));
  page.on("pageerror", (error) => console.error("RENDERER ERROR:", error));
  await page.waitForSelector("body");
}, 30000);

afterEach(async () => {
  // Restore original dialog methods after each test from stored properties
  await electronApp.evaluate(
    ({ dialog }, { openKey, msgBoxKey }) => {
      if (typeof dialog[openKey] === 'function') {
        dialog.showOpenDialog = dialog[openKey];
        console.log("[Main Process] Restored original showOpenDialog in afterEach.");
      }
       if (typeof dialog[msgBoxKey] === 'function') {
        dialog.showMessageBox = dialog[msgBoxKey];
         console.log("[Main Process] Restored original showMessageBox in afterEach.");
      }
      // No need to delete the keys, they'll be overwritten in beforeAll if needed again,
      // or potentially cleaned up in afterAll if desired.
    },
    { openKey: originalOpenDialogKey, msgBoxKey: originalMessageBoxKey }
  );
   // Also remove IPC mocks if they were set
   await electronApp.evaluate(async ({ ipcMain }) => {
        ipcMain.removeHandler('create-symlink');
   });
});

afterAll(async () => {
  // Clean up temporary properties on dialog and close app
  if (electronApp) {
     await electronApp.evaluate(
        ({ dialog }, { openKey, msgBoxKey }) => {
            // Optional: Clean up properties if desired
            if (dialog[openKey]) dialog[openKey] = undefined;
            if (dialog[msgBoxKey]) dialog[msgBoxKey] = undefined;
        },
        { openKey: originalOpenDialogKey, msgBoxKey: originalMessageBoxKey }
     );
    await electronApp.close();
  }
});

describe("Application E2E Tests", () => {
  it("should launch the application window", async () => {
    vitest_expect(electronApp).toBeDefined();
    vitest_expect(page).toBeDefined();
    const windowCount = await electronApp.windows().length;
    vitest_expect(windowCount).toBe(1);
  });

  it("should select a custom vault path", async () => {
    const mockVaultPath = "/selected/custom/vault";

    // Mock dialog methods just for this test
    await electronApp.evaluate(
      ({ dialog }, { vaultPath, openKey, msgBoxKey }) => {
        // Mock showOpenDialog to return a directory
        dialog.showOpenDialog = async (win, options) => {
          if (options?.properties?.includes("openDirectory")) {
            console.log("[Main Process Mock] Vault Select: showOpenDialog mocked.");
            return { canceled: false, filePaths: [vaultPath] };
          }
          // Fallback to original if stored and needed for other calls
          return typeof dialog[openKey] === 'function' ? dialog[openKey](win, options) : { canceled: true, filePaths: [] };
        };
        // Mock showMessageBox to simulate clicking "Use Anyway"
        dialog.showMessageBox = async () => {
          console.log("[Main Process Mock] Vault Select: showMessageBox mocked.");
          return { response: 0 };
        };
      },
      { vaultPath: mockVaultPath, openKey: originalOpenDialogKey, msgBoxKey: originalMessageBoxKey }
    );

    await page.locator("#choose-vault-btn").click();

    // Assertions
    await playwrightExpect(page.locator("#vault-path")).toHaveValue(mockVaultPath);
    await playwrightExpect(page.locator("#vault-selector")).toHaveValue("");
    await playwrightExpect(page.locator("#create-symlinks-btn")).toBeDisabled();
    // Cleanup happens in afterEach
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

    // --- Setup: Select files first ---
     await electronApp.evaluate(
        ({ dialog }, { filePaths, openKey }) => {
            dialog.showOpenDialog = async (win, options) => {
                if (options?.properties?.includes("openFile")) {
                    console.log("[Main Process Mock] Rename Test: showOpenDialog (file) mocked.");
                    return { canceled: false, filePaths };
                }
                 // Fallback to original if stored
                 return typeof dialog[openKey] === 'function' ? dialog[openKey](win, options) : { canceled: true, filePaths: [] };
            };
        }, { filePaths: mockFiles, openKey: originalOpenDialogKey }
     );

    await page.locator("#choose-markdown-btn").click();
    await playwrightExpect(page.locator("#file-list .file-item")).toHaveCount(mockFiles.length);
    // --- End Setup ---

    // Test logic remains the same...
    const firstFileItem = page.locator("#file-list .file-item").first();
    const originalName = "file1-for-rename.md";
    const customName = "My Custom File.md";
    const customNameWithoutExt = "Another Name";
    const customNameWithWrongExt = "Some File.txt";

    // Test 1: Basic Rename
    await firstFileItem.locator(".edit-name-btn").click();
    const nameInput = firstFileItem.locator(".file-edit-container input[type='text']");
    await playwrightExpect(nameInput).toBeVisible();
    await playwrightExpect(nameInput).toHaveValue(originalName);
    await nameInput.fill(customName);
    await firstFileItem.locator("button:text('Save')").click();
    await playwrightExpect(firstFileItem.locator(".file-item-info")).toContainText(`${originalName} → ${customName}`);
    await playwrightExpect(firstFileItem.locator(".file-edit-container")).toBeHidden();

    // Test 2: Rename back to original
    await firstFileItem.locator(".edit-name-btn").click();
    await nameInput.fill(originalName);
    await firstFileItem.locator("button:text('Save')").click();
    await playwrightExpect(firstFileItem.locator(".file-item-info")).toHaveText(originalName);
    await playwrightExpect(firstFileItem.locator(".file-item-info")).not.toContainText("→");

    // Test 3: Add .md extension
    await firstFileItem.locator(".edit-name-btn").click();
    await nameInput.fill(customNameWithoutExt);
    await firstFileItem.locator("button:text('Save')").click();
    await playwrightExpect(firstFileItem.locator(".file-item-info")).toContainText(`${originalName} → ${customNameWithoutExt}.md`);

    // Test 4: Replace incorrect extension
    await firstFileItem.locator(".edit-name-btn").click();
    await nameInput.fill(customNameWithWrongExt);
    await playwrightExpect(firstFileItem.locator(".extension-warning")).toBeVisible();
    await firstFileItem.locator("button:text('Save')").click();
    await playwrightExpect(firstFileItem.locator(".file-item-info")).toContainText(`${originalName} → ${customNameWithWrongExt.replace(".txt", ".md")}`);

    // Reset (optional)
    await firstFileItem.locator(".edit-name-btn").click();
    await nameInput.fill(originalName);
    await firstFileItem.locator("button:text('Save')").click();
    await playwrightExpect(firstFileItem.locator('.file-item-info')).toHaveText(originalName);

    // Cleanup happens in afterEach
  }, 30000); // Increased timeout

  it("should select markdown files and update the UI", async () => {
    const mockFiles = ["/path/to/file1.md", "/path/to/another/file2.md"];

     // Mock dialog
     await electronApp.evaluate(
        ({ dialog }, { filePaths, openKey }) => {
            dialog.showOpenDialog = async (win, options) => {
                if (options?.properties?.includes("openFile")) {
                     console.log("[Main Process Mock] Select Files Test: showOpenDialog mocked.");
                    return { canceled: false, filePaths };
                }
                 // Fallback to original if stored
                 return typeof dialog[openKey] === 'function' ? dialog[openKey](win, options) : { canceled: true, filePaths: [] };
            };
        }, { filePaths: mockFiles, openKey: originalOpenDialogKey }
     );

    await page.locator("#choose-markdown-btn").click();

    // Assertions
    await playwrightExpect(page.locator("#markdown-files")).toHaveValue(`${mockFiles.length} file(s) selected`);
    await playwrightExpect(page.locator("#file-list .file-item")).toHaveCount(mockFiles.length);
    await playwrightExpect(page.locator("#file-list .file-item").first()).toContainText("file1.md");
    await playwrightExpect(page.locator("#file-list .file-item").nth(1)).toContainText("file2.md");
    await playwrightExpect(page.locator("#create-symlinks-btn")).toBeEnabled();
    // Cleanup happens in afterEach
  });

  it("should create symlinks and display results (mocked)", async () => {
    const vaultPath = "/test/vault/for-symlinks";
    const mockFilesToSelect = [
        { path: "/source/fileA.md", originalName: "fileA.md" },
        { path: "/source/fileB.md", originalName: "fileB.md", customName: "CustomB.md" },
        { path: "/source/fileC.md", originalName: "fileC.md" },
    ];
    const mockSymlinkResults = [
        { success: true, file: "fileA.md", targetPath: mockFilesToSelect[0].path, symlinkPath: path.join(vaultPath, "fileA.md")},
        { success: true, file: "CustomB.md", targetPath: mockFilesToSelect[1].path, symlinkPath: path.join(vaultPath, "CustomB.md")},
        { success: false, file: "fileC.md", error: "Permission denied"},
    ];

    // --- Setup 1: Select a vault path (Mocking Dialogs) ---
    await electronApp.evaluate(
      ({ dialog }, { path, openKey, msgBoxKey }) => {
        // Mock both needed dialogs
        dialog.showOpenDialog = async (win, options) => {
          if (options?.properties?.includes("openDirectory")) {
            console.log("[Main Process Mock] Create Test: showOpenDialog (vault) mocked.");
            return { canceled: false, filePaths: [path] };
          }
          // Fallback to original if stored
          return typeof dialog[openKey] === 'function' ? dialog[openKey](win, options) : { canceled: true, filePaths: [] };
        };
         dialog.showMessageBox = async () => {
             console.log("[Main Process Mock] Create Test: showMessageBox mocked.");
             return { response: 0 };
         };
      }, { path: vaultPath, openKey: originalOpenDialogKey, msgBoxKey: originalMessageBoxKey });

    await page.locator("#choose-vault-btn").click();
    await playwrightExpect(page.locator("#vault-path")).toHaveValue(vaultPath);

    // --- Setup 2: Select files (Mocking Dialog) ---
     await electronApp.evaluate(
      ({ dialog }, { filePaths, openKey }) => {
        // Overwrite showOpenDialog again, specific for file selection
        dialog.showOpenDialog = async (win, options) => {
            if (options?.properties?.includes("openFile")) {
                console.log("[Main Process Mock] Create Test: showOpenDialog (file) mocked.");
                return { canceled: false, filePaths };
            }
             // Fallback to original if stored
            return typeof dialog[openKey] === 'function' ? dialog[openKey](win, options) : { canceled: true, filePaths: [] };
        };
        // showMessageBox should still be mocked from previous step in this test scope if needed,
        // but restore in afterEach will reset it.
      }, { filePaths: mockFilesToSelect.map(f => f.path), openKey: originalOpenDialogKey });

    await page.locator("#choose-markdown-btn").click();
    await playwrightExpect(page.locator("#file-list .file-item")).toHaveCount(mockFilesToSelect.length);

    // --- Setup 3: Set custom name for fileB via UI ---
    const fileBItem = page.locator("#file-list .file-item").nth(1);
    await fileBItem.locator(".edit-name-btn").click();
    await fileBItem.locator(".file-edit-container input[type='text']").fill(mockFilesToSelect[1].customName);
    await fileBItem.locator("button:text('Save')").click();
    await playwrightExpect(fileBItem.locator(".file-item-info")).toContainText(`fileB.md → ${mockFilesToSelect[1].customName}`);

    await playwrightExpect(page.locator("#create-symlinks-btn")).toBeEnabled();

    // --- Mock the core create-symlink IPC handler ---
     await electronApp.evaluate(
        async ({ ipcMain }, { results }) => {
             ipcMain.removeHandler('create-symlink'); // Ensure clean state
             ipcMain.handle('create-symlink', async () => {
                 console.log('[Main Process Mock] IPC create-symlink returning mock results.');
                 return results;
             });
        }, { results: mockSymlinkResults }
     );

    // --- Action: Click the Create Symlinks button ---
    await page.locator("#create-symlinks-btn").click();

    // --- Assertions ---
    await playwrightExpect(page.locator("#results .result-item")).toHaveCount(mockSymlinkResults.length);

    const firstResult = page.locator("#results .result-item").first();
    await playwrightExpect(firstResult).toHaveClass(/success/);
    await playwrightExpect(firstResult).toContainText("fileA.md");
    await playwrightExpect(firstResult).toContainText(`Successfully linked to ${mockFilesToSelect[0].path}`);

    const secondResult = page.locator("#results .result-item").nth(1);
    await playwrightExpect(secondResult).toHaveClass(/success/);
    await playwrightExpect(secondResult).toContainText("CustomB.md");
    await playwrightExpect(secondResult).toContainText(`Successfully linked to ${mockFilesToSelect[1].path}`);

    const thirdResult = page.locator("#results .result-item").nth(2);
    await playwrightExpect(thirdResult).toHaveClass(/error/);
    await playwrightExpect(thirdResult).toContainText("fileC.md");
    await playwrightExpect(thirdResult).toContainText("Error: Permission denied");

    await playwrightExpect(page.locator("#markdown-files")).toHaveValue("");
    await playwrightExpect(page.locator("#file-list .file-item")).toHaveCount(0);
    await playwrightExpect(page.locator("#create-symlinks-btn")).toBeDisabled();

    // Cleanup happens in afterEach
  }, 30000); // Increased timeout

});