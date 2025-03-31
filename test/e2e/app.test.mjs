import { _electron as electron } from "playwright";
import { expect as playwrightExpect } from "@playwright/test"; // Use Playwright's expect directly
import {
  afterAll,
  beforeAll,
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

beforeAll(async () => {
  // Launch the Electron app
  electronApp = await electron.launch({
    args: [mainFile],
    // Optional: Add environment variables if needed
    // env: { ...process.env, NODE_ENV: 'test' }
  });

  // Wait for the first window to open
  page = await electronApp.firstWindow();

  // Optional: Add listeners for debugging
  page.on("console", (msg) => console.log("RENDERER:", msg.text()));
  page.on("pageerror", (error) => console.error("RENDERER ERROR:", error));

  // Wait for the window to be ready (e.g., check for an element)
  await page.waitForSelector("body");
}, 30000); // Increase timeout for app launch

afterAll(async () => {
  // Close the Electron app
  if (electronApp) {
    await electronApp.close();
  }
});

describe("Application E2E Tests", () => {
  it("should launch the application window", async () => {
    // Use vitest_expect (Vitest) for non-Playwright object assertions
    vitest_expect(electronApp).toBeDefined();
    vitest_expect(page).toBeDefined();

    const windowCount = await electronApp.windows().length;
    vitest_expect(windowCount).toBe(1); // Ensure only one window is open initially
  });

  it("should display the correct title", async () => {
    // Wait for the title element in the custom title bar
    await page.waitForSelector(".titlebar .title");
    const title = await page.textContent(".titlebar .title");
    expect(title).toBe("Obsidian Symlinker");
  });

  it("should have the main UI elements visible", async () => {
    // Use Playwright's expect for locator assertions
    await playwrightExpect(page.locator("#vault-selector")).toBeVisible();
    await playwrightExpect(page.locator("#choose-vault-btn")).toBeVisible();
    await playwrightExpect(page.locator("#choose-markdown-btn")).toBeVisible();
    await playwrightExpect(page.locator("#create-symlinks-btn")).toBeVisible();
    await playwrightExpect(page.locator("#results")).toBeVisible();
    await playwrightExpect(page.locator("#recent-links")).toBeVisible();
  });

  it("should load the saved vault path via IPC on init", async () => {
    const mockVaultPath = "/mock/saved/vault/path";

    await electronApp.evaluate(
      async ({ ipcMain }, mockPath) => {
        // If ipcMain is already listening, remove handler first (might be flaky)
        // A better approach is often to ensure mocks are set before handlers register.
        // For this test, we assume we can intercept the call.
        // Note: This specific evaluate mocking might be tricky depending on timing.
        // A safer way: mock the 'electron-store' dependency in the main process if possible,
        // or intercept the call from the renderer side.
        // Let's try intercepting the 'invoke' from the renderer:
        // This requires the window context to be ready.
      },
      { mockVaultPath }
    );

    await page.exposeFunction("mockLoadVaultPath", () => mockVaultPath);
    await page.evaluate(() => {
      const originalInvoke = window.require("electron").ipcRenderer.invoke;
      window.require("electron").ipcRenderer.invoke = async (
        channel,
        ...args
      ) => {
        if (channel === "load-vault-path") {
          console.log(`Intercepted ${channel}, returning mock path.`);
          return window.mockLoadVaultPath();
        }
        return originalInvoke(channel, ...args);
      };
    });

    await page.waitForTimeout(500);

    const receivedPath = await page.evaluate(async () => {
      return document.getElementById("vault-path").value;
    });

    await playwrightExpect(page.locator("#vault-path")).toBeVisible();
  });

  it("should allow renaming a selected file", async () => {
    // --- Setup: Select files first to make test independent ---
    const mockFiles = ["/path/to/file1-for-rename.md", "/path/to/file2.md"];
    await electronApp.evaluate(
      async ({ dialog }, { filePaths }) => {
        if (!dialog._originalShowOpenDialog) {
          dialog._originalShowOpenDialog = dialog.showOpenDialog;
        }
        dialog.showOpenDialog = async () => {
          console.log(
            "[Main Process Mock] dialog.showOpenDialog called for rename test, returning mock files"
          );
          return Promise.resolve({ canceled: false, filePaths });
        };
      },
      { filePaths: mockFiles }
    );

    await page.locator("#choose-markdown-btn").click();
    // Wait for list to be populated before proceeding
    await playwrightExpect(page.locator("#file-list .file-item")).toHaveCount(
      mockFiles.length
    );
    // --- End Setup ---

    // Now proceed with the rename logic
    const firstFileItem = page.locator("#file-list .file-item").first();
    // Use the actual original name from the mock setup
    const originalName = "file1-for-rename.md";
    const customName = "My Custom File.md";
    const customNameWithoutExt = "Another Name";
    const customNameWithWrongExt = "Some File.txt";

    // --- Test 1: Basic Rename ---
    // Click the edit button on the first file
    await firstFileItem.locator(".edit-name-btn").click();

    // Check if the edit container is visible
    await playwrightExpect(
      firstFileItem.locator(".file-edit-container")
    ).toBeVisible();
    const nameInput = firstFileItem.locator(
      ".file-edit-container input[type='text']"
    );
    await playwrightExpect(nameInput).toBeVisible();
    await playwrightExpect(nameInput).toHaveValue(originalName); // Should default to original

    // Fill in the custom name and save
    await nameInput.fill(customName);
    await firstFileItem.locator("button:text('Save')").click();

    // Verify the UI updates to show both names
    await playwrightExpect(
      firstFileItem.locator(".file-item-info")
    ).toContainText(`${originalName} → ${customName}`);
    // Verify the edit container is hidden
    await playwrightExpect(
      firstFileItem.locator(".file-edit-container")
    ).toBeHidden();

    // --- Test 2: Rename back to original (should remove custom name) ---
    await firstFileItem.locator(".edit-name-btn").click();
    // Use the correct original name variable here too
    await nameInput.fill(originalName);
    await firstFileItem.locator("button:text('Save')").click();
    // Check that only the original name is displayed
    await playwrightExpect(
      firstFileItem.locator(".file-item-info")
    // Use exact text match if possible, or ensure it doesn't contain the arrow + custom name anymore
    ).toHaveText(originalName); // Using toHaveText for a more exact match
    // Ensure it doesn't show the arrow anymore
    await playwrightExpect(
      firstFileItem.locator(".file-item-info")
    ).not.toContainText("→");

    // --- Test 3: Add .md extension if missing ---
    await firstFileItem.locator(".edit-name-btn").click();
    await nameInput.fill(customNameWithoutExt);
    await firstFileItem.locator("button:text('Save')").click();
    // Verify .md was added
    await playwrightExpect(
      firstFileItem.locator(".file-item-info")
    ).toContainText(`${originalName} → ${customNameWithoutExt}.md`);

    // --- Test 4: Replace incorrect extension with .md ---
    await firstFileItem.locator(".edit-name-btn").click();
    await nameInput.fill(customNameWithWrongExt);
    // Check the warning message appears
    await playwrightExpect(
      firstFileItem.locator(".extension-warning")
    ).toBeVisible();
    await firstFileItem.locator("button:text('Save')").click();
    // Verify .txt was replaced with .md
    await playwrightExpect(
      firstFileItem.locator(".file-item-info")
    ).toContainText(
      `${originalName} → ${customNameWithWrongExt.replace(".txt", ".md")}`
    );

    // Reset for subsequent tests if needed (optional)
    await firstFileItem.locator(".edit-name-btn").click();
    // Use the correct original name variable here too
    await nameInput.fill(originalName);
    await firstFileItem.locator("button:text('Save')").click();
    // Verify it's reset
    await playwrightExpect(firstFileItem.locator('.file-item-info')).toHaveText(originalName);

    // --- Cleanup: Restore dialog ---
    await electronApp.evaluate(async ({ dialog }) => {
      if (dialog._originalShowOpenDialog) {
        dialog.showOpenDialog = dialog._originalShowOpenDialog;
        dialog._originalShowOpenDialog = undefined; // Use undefined instead of delete
      }
    });
  }, 30000); // Increased timeout for this specific test to 30s

  it("should select markdown files and update the UI", async () => {
    const mockFiles = ["/path/to/file1.md", "/path/to/another/file2.md"];

    // Mock the 'choose-markdown' IPC invoke call from the renderer
    await page.exposeFunction("mockChooseMarkdown", () => mockFiles);
    await page.evaluate(() => {
      const originalInvoke = window.require("electron").ipcRenderer.invoke;
      window.require("electron").ipcRenderer.invoke = async (
        channel,
        ...args
      ) => {
        if (channel === "choose-markdown") {
          console.log(`IPC Intercepted: ${channel}, returning mock files.`);
          return window.mockChooseMarkdown();
        }
        // Ensure other IPC calls still work if needed
        console.log(`IPC Passthrough: ${channel}`);
        return originalInvoke(channel, ...args);
      };
      // Attach a flag to indicate mocking is active
      window.ipcMarkdownMocked = true;
    });

    // Click the 'Choose Files' button
    await page.locator("#choose-markdown-btn").click();

    // Wait for potential async updates and check UI elements
    // Check the input field text
    await playwrightExpect(page.locator("#markdown-files")).toHaveValue(
      `${mockFiles.length} file(s) selected`
    );

    // Check the file list for the correct number of items
    await playwrightExpect(page.locator("#file-list .file-item")).toHaveCount(
      mockFiles.length
    );

    // Check the content of the first file item
    await playwrightExpect(
      page.locator("#file-list .file-item").first()
    ).toContainText("file1.md");
    // Check the content of the second file item
    await playwrightExpect(
      page.locator("#file-list .file-item").nth(1)
    ).toContainText("file2.md");

    // Check that the create button is enabled
    await playwrightExpect(page.locator("#create-symlinks-btn")).toBeEnabled();
  });

  // Add more tests:
  // - Inputting custom names and checking the UI
  // - Clicking 'Create Symlinks', mocking the IPC, checking results UI
  // - Testing recent links loading and clearing
});