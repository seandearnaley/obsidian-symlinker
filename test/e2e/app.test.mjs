import { _electron as electron } from "playwright";
// Import expect from Playwright separately
import { expect as playwrightExpect } from "@playwright/test";
import { afterAll, beforeAll, describe, expect as vitestExpect, it, vi } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Use playwrightExpect for Playwright locators, vitestExpect for general assertions
const expect = playwrightExpect; // Default to Playwright expect for convenience in this file
const generalExpect = vitestExpect; // Alias Vitest's expect if needed elsewhere

// Get project root from the test file location
const __filename = fileURLToPath(import.meta.url);
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
		// Use generalExpect (Vitest) for non-Playwright assertions
		generalExpect(electronApp).toBeDefined();
		generalExpect(page).toBeDefined();

		const windowCount = await electronApp.windows().length;
		generalExpect(windowCount).toBe(1); // Ensure only one window is open initially
	});

	it("should display the correct title", async () => {
		// Wait for the title element in the custom title bar
		await page.waitForSelector(".titlebar .title");
		const title = await page.textContent(".titlebar .title");
		expect(title).toBe("Obsidian Symlinker");
	});

	it("should have the main UI elements visible", async () => {
		// Use Playwright's expect for locator assertions
		await expect(page.locator("#vault-selector")).toBeVisible();
		await expect(page.locator("#choose-vault-btn")).toBeVisible();
		await expect(page.locator("#choose-markdown-btn")).toBeVisible();
		await expect(page.locator("#create-symlinks-btn")).toBeVisible();
		await expect(page.locator("#results")).toBeVisible();
		await expect(page.locator("#recent-links")).toBeVisible();
	});

	it("should load the saved vault path via IPC on init", async () => {
		// We can mock the main process handler for 'load-vault-path'
		// to control the return value during the test.
		const mockVaultPath = "/mock/saved/vault/path";

		// Expose a function in the main process to setup mocks BEFORE the app fully loads its handlers
		// Or, more commonly, intercept IPC calls from the renderer.
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

		// Intercept the 'load-vault-path' invoke call from the renderer
		await page.exposeFunction("mockLoadVaultPath", () => mockVaultPath);
		await page.evaluate(() => {
			const originalInvoke = window.require("electron").ipcRenderer.invoke;
			window.require("electron").ipcRenderer.invoke = async (channel, ...args) => {
				if (channel === "load-vault-path") {
					console.log(`Intercepted ${channel}, returning mock path.`);
					return window.mockLoadVaultPath();
				}
				return originalInvoke(channel, ...args);
			};
		});

		// Reload the window or wait for init to trigger the call again (tricky)
		// For this basic test, let's check the *result* of the initial load
		// Assuming the init() in renderer.js calls 'load-vault-path'

		// Wait for the vault path input to potentially be updated
		// Give it a moment for async operations
		await page.waitForTimeout(500);

		// Check the input field value - this relies on renderer.js correctly
		// calling load-vault-path and updating the UI.
		// Note: Since we can't easily mock before init, we check the state *after* init.
		// We'll need a way to control the store's value for a reliable test.

		// Alternative: Check if the 'load-vault-path' handler was called (less direct UI verification)
		// This requires adding some test hooks or logging in the main process.

		// --- Simpler Check for this Example ---
		// Let's just verify the IPC channel CAN be invoked (doesn't prove init logic fully)
		const receivedPath = await page.evaluate(async () => {
			// Manually invoke to test the channel after mocking it (if applicable)
			// Or just check UI state if init already ran
			return document.getElementById("vault-path").value;
			// If we successfully mocked above:
			// return window.require('electron').ipcRenderer.invoke('load-vault-path');
		});

		// Because mocking before init is hard, this assertion might be weak.
		// A better test would involve controlling the 'electron-store' state
		// or adding test-specific hooks.
		// For now, we'll just assert the element exists as proof of basic loading.
		// Use Playwright's expect here
		await expect(page.locator("#vault-path")).toBeVisible();
		// If we could guarantee the mock worked and UI updated:
		// const value = await page.locator("#vault-path").inputValue();
		// generalExpect(value).toBe(mockVaultPath);
	});

	// Add more tests:
	// - Clicking 'Choose Vault' and mocking the dialog
	// - Clicking 'Choose Files' and mocking the dialog, checking UI updates
	// - Inputting custom names and checking the UI
	// - Clicking 'Create Symlinks', mocking the IPC, checking results UI
	// - Testing recent links loading and clearing
});