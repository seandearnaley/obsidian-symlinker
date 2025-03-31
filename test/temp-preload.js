const { contextBridge } = require("electron");
const path = require("node:path");

// Debug logging for preload script
console.log("Preload script executing...");

// Mock IPC implementation with debug logging
const mockIpc = {
	loadVaultPath: async () => {
		console.log("IPC: loadVaultPath called");
		return "/var/folders/kk/bt8fwgld2mn9hvbhnv9w83s80000gn/T/obsidian-symlinker-test-Ee4Jln/mock-vault";
	},
	getObsidianVaults: async () => {
		console.log("IPC: getObsidianVaults called");
		return [
			{
				id: "test",
				name: "Test Vault",
				path: "/var/folders/kk/bt8fwgld2mn9hvbhnv9w83s80000gn/T/obsidian-symlinker-test-Ee4Jln/mock-vault",
			},
		];
	},
	chooseMarkdown: async () => {
		console.log("IPC: chooseMarkdown called");
		const files = [
			"/var/folders/kk/bt8fwgld2mn9hvbhnv9w83s80000gn/T/obsidian-symlinker-test-Ee4Jln/mock-source/test-file-1.md",
			"/var/folders/kk/bt8fwgld2mn9hvbhnv9w83s80000gn/T/obsidian-symlinker-test-Ee4Jln/mock-source/test-file-2.md",
		];
		console.log("Returning files:", files);
		return files;
	},
	createSymlink: async ({ targetFiles, vaultPath }) => {
		console.log("IPC: createSymlink called with:", { targetFiles, vaultPath });
		const results = targetFiles.map((file) => ({
			success: true,
			file: file.customName || path.basename(file.filePath),
			targetPath: file.filePath,
			symlinkPath: path.join(vaultPath, file.customName || path.basename(file.filePath)),
		}));
		console.log("Returning results:", results);
		return results;
	},
	saveVaultPath: async (path) => {
		console.log("IPC: saveVaultPath called with:", path);
	},
	getRecentLinks: async () => {
		console.log("IPC: getRecentLinks called");
		return [];
	},
	saveRecentLink: async (link) => {
		console.log("IPC: saveRecentLink called with:", link);
		return [];
	},
	clearRecentLinks: async () => {
		console.log("IPC: clearRecentLinks called");
	},
	onThemeChange: (callback) => {
		console.log("IPC: onThemeChange handler registered");
		callback(false); // Initial theme state
	},
	onVaultPathChange: (callback) => {
		console.log("IPC: onVaultPathChange handler registered");
	},
	onFilePathChange: (callback) => {
		console.log("IPC: onFilePathChange handler registered");
	},
};

// Expose the mock IPC to renderer
console.log("Exposing electronAPI via contextBridge...");
contextBridge.exposeInMainWorld("electronAPI", mockIpc);
console.log("electronAPI exposed successfully");

// Initialize renderer after DOM is ready
document.addEventListener("DOMContentLoaded", () => {
	console.log("DOM Content Loaded");

	// Get the renderer script
	const rendererScript = document.createElement("script");
	rendererScript.src = "/src/renderer.js";
	rendererScript.type = "module";
	document.head.appendChild(rendererScript);

	console.log("Renderer script added to page");
});
