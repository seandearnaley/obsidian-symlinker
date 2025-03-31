// This file is a simplified version of renderer.js for instrumentation and coverage
// It exports functionality through window.rendererFunctions for testing

// Use a comprehensive approach based on the actual renderer.js file
// but wrapped to be testable and provide better coverage

// Initialize state variables
let vaultPath = "";
let selectedFiles = [];
let obsidianVaults = [];
let lastSavedVaultPath = null;

// Mock DOM Elements for testing
// In tests, these will be replaced by actual mocks
const vaultPathInput = document.getElementById("vault-path");
const vaultSelector = document.getElementById("vault-selector");
const refreshVaultsBtn = document.getElementById("refresh-vaults-btn");
const chooseVaultBtn = document.getElementById("choose-vault-btn");
const markdownFilesInput = document.getElementById("markdown-files");
const chooseMarkdownBtn = document.getElementById("choose-markdown-btn");
const createSymlinksBtn = document.getElementById("create-symlinks-btn");
const fileListEl = document.getElementById("file-list");
const resultsEl = document.getElementById("results");
const recentLinksEl = document.getElementById("recent-links");
const clearRecentBtn = document.getElementById("clear-recent-btn");

// Initialize app
async function init() {
	console.log("Initializing app");

	// In the real renderer.js, we would use ipcRenderer.invoke
	// Here we use the electronAPI exposed by the contextBridge
	lastSavedVaultPath = await window.electronAPI.loadVaultPath();

	// Load Obsidian vaults and recent links
	await loadObsidianVaults();
	loadRecentLinks();

	// We don't call registerEventListeners() here because
	// the tests will call individual functions directly
}

// Register event listeners for DOM elements
function registerEventListeners() {
	// Setup event listeners for UI elements (simplified for testing)
	refreshVaultsBtn.addEventListener("click", loadObsidianVaults);

	vaultSelector.addEventListener("change", () => {
		const selectedPath = vaultSelector.value;
		if (selectedPath) {
			selectVaultByPath(selectedPath);
		}
	});

	chooseVaultBtn.addEventListener("click", async () => {
		const selectedPath = await window.electronAPI.chooseVault();
		if (selectedPath) {
			selectVaultByPath(selectedPath);
		}
	});

	chooseMarkdownBtn.addEventListener("click", chooseMarkdownFiles);

	createSymlinksBtn.addEventListener("click", createSymlinks);

	clearRecentBtn.addEventListener("click", clearRecentLinks);
}

// Load Obsidian vaults from system
async function loadObsidianVaults() {
	try {
		obsidianVaults = await window.electronAPI.getObsidianVaults();

		// Populate the selector
		populateVaultSelector();

		// Handle auto-selection
		if (obsidianVaults.length > 0) {
			if (lastSavedVaultPath) {
				selectVaultByPath(lastSavedVaultPath);
			} else {
				const firstVault = obsidianVaults[0];
				if (firstVault?.path) {
					selectVaultByPath(firstVault.path);
				}
			}
		}

		// Flash the refresh button if no vaults found
		if (obsidianVaults.length === 0) {
			refreshVaultsBtn.classList.add("pulse-animation");
			setTimeout(() => {
				refreshVaultsBtn.classList.remove("pulse-animation");
			}, 2000);
		}
	} catch (error) {
		console.error("Error loading vaults:", error);
	}
}

// Populate vault selector dropdown
function populateVaultSelector() {
	// Clear existing options
	while (vaultSelector.options.length > 1) {
		vaultSelector.remove(1);
	}

	// Add vaults to dropdown
	if (obsidianVaults.length > 0) {
		let hasConfigVaults = false;
		let hasManualVaults = false;

		// Check if we have both types
		for (const vault of obsidianVaults) {
			if (vault.id.startsWith("manual-")) {
				hasManualVaults = true;
			} else {
				hasConfigVaults = true;
			}
		}

		// If we have both types, add group labels
		let currentGroup = "";

		for (const vault of obsidianVaults) {
			// Check if we need to add a group header
			if (hasConfigVaults && hasManualVaults) {
				const isManual = vault.id.startsWith("manual-");
				const newGroup = isManual ? "discovered" : "config";

				if (newGroup !== currentGroup) {
					currentGroup = newGroup;
					const groupOption = document.createElement("option");
					groupOption.disabled = true;
					groupOption.textContent = isManual
						? "--- Discovered Vaults ---"
						: "--- Configured Vaults ---";
					vaultSelector.appendChild(groupOption);
				}
			}

			const option = document.createElement("option");
			option.value = vault.path;
			option.textContent = vault.name;
			option.title = vault.path;
			vaultSelector.appendChild(option);
		}

		// Enable the selector
		vaultSelector.disabled = false;
	} else {
		// No vaults found, add a message
		const option = document.createElement("option");
		option.value = "";
		option.textContent = "No Obsidian vaults found";
		option.disabled = true;
		vaultSelector.appendChild(option);
		vaultSelector.disabled = true;
	}
}

// Select vault by path
function selectVaultByPath(targetPath) {
	if (!targetPath) return;

	// First check if it's in our list
	let found = false;

	for (let i = 0; i < vaultSelector.options.length; i++) {
		const option = vaultSelector.options[i];
		if (option.value === targetPath) {
			vaultSelector.selectedIndex = i;
			found = true;
			break;
		}
	}

	// Always set the vault path
	vaultPath = targetPath;

	// Update input field
	vaultPathInput.value = targetPath;

	// Save the path
	lastSavedVaultPath = targetPath;
	window.electronAPI.saveVaultPath(targetPath);

	// Update button state
	updateCreateButtonState();

	// Reset selector if not found
	if (!found && targetPath) {
		vaultSelector.selectedIndex = 0;
	}
}

// Choose markdown files
async function chooseMarkdownFiles() {
	const files = await window.electronAPI.chooseMarkdown();
	if (files && files.length > 0) {
		// We use a mock path.basename for testing
		const basename = (filepath) => {
			if (!filepath) return "";
			const parts = filepath.split(/[\/\\]/);
			return parts[parts.length - 1];
		};

		// Convert to file objects
		selectedFiles = files.map((filePath) => ({
			filePath,
			originalName: basename(filePath),
			customName: null,
			editing: false,
		}));

		markdownFilesInput.value = `${files.length} file(s) selected`;
		renderFileList();
		updateCreateButtonState();
	}
}

// Render selected files list
function renderFileList() {
	fileListEl.innerHTML = "";

	for (const fileObj of selectedFiles) {
		const fileItem = document.createElement("div");
		fileItem.className = "file-item";

		const fileItemInfo = document.createElement("div");
		fileItemInfo.className = "file-item-info";

		const fileName = document.createElement("div");

		// Display appropriate filename based on custom name
		if (fileObj.customName) {
			fileName.innerHTML = `<span class="target-filename">${fileObj.originalName}</span> <span class="filename-preview">→</span> <span class="custom-filename">${fileObj.customName}</span>`;
		} else {
			fileName.textContent = fileObj.originalName;
		}

		fileItemInfo.appendChild(fileName);
		fileItem.appendChild(fileItemInfo);

		// Actions container
		const fileActions = document.createElement("div");
		fileActions.className = "file-actions";

		// Edit button
		const editBtn = document.createElement("button");
		editBtn.className = "edit-name-btn";
		editBtn.textContent = "✎";
		editBtn.title = "Customize filename in vault";
		editBtn.onclick = () => {
			// Turn off editing for all files
			for (const file of selectedFiles) {
				file.editing = false;
			}

			// Toggle editing for this file
			fileObj.editing = true;
			renderFileList();
		};

		// Remove button
		const removeBtn = document.createElement("button");
		removeBtn.textContent = "✕";
		removeBtn.title = "Remove file";
		removeBtn.onclick = () => {
			selectedFiles = selectedFiles.filter((f) => f !== fileObj);
			renderFileList();
			markdownFilesInput.value = selectedFiles.length
				? `${selectedFiles.length} file(s) selected`
				: "";
			updateCreateButtonState();
		};

		fileActions.appendChild(editBtn);
		fileActions.appendChild(removeBtn);
		fileItem.appendChild(fileActions);

		// Add editing controls if in edit mode
		if (fileObj.editing) {
			const editContainer = document.createElement("div");
			editContainer.className = "file-edit-container";

			const nameInput = document.createElement("input");
			nameInput.type = "text";
			nameInput.placeholder = "Enter custom filename (with .md extension)";
			nameInput.value = fileObj.customName || fileObj.originalName;

			// Auto-focus the input field
			setTimeout(() => nameInput.focus(), 0);

			// Save button
			const saveBtn = document.createElement("button");
			saveBtn.textContent = "Save";
			saveBtn.onclick = () => {
				let newName = nameInput.value.trim();

				// Force .md extension if missing
				if (!newName.toLowerCase().endsWith(".md")) {
					// Remove any existing extension
					const extIndex = newName.lastIndexOf(".");
					if (extIndex > 0) {
						newName = `${newName.substring(0, extIndex)}.md`;
					} else {
						newName = `${newName}.md`;
					}
					// Notify the user that extension was added
					nameInput.value = newName;
				}

				// Only set customName if it's different from the original
				if (newName && newName !== fileObj.originalName) {
					fileObj.customName = newName;
				} else {
					fileObj.customName = null;
				}

				fileObj.editing = false;
				renderFileList();
			};

			// Cancel button
			const cancelBtn = document.createElement("button");
			cancelBtn.textContent = "Cancel";
			cancelBtn.onclick = () => {
				fileObj.editing = false;
				renderFileList();
			};

			editContainer.appendChild(nameInput);
			editContainer.appendChild(saveBtn);
			editContainer.appendChild(cancelBtn);

			fileItem.appendChild(editContainer);
		}

		fileListEl.appendChild(fileItem);
	}
}

// Create symlinks
async function createSymlinks() {
	if (!vaultPath || selectedFiles.length === 0) return;

	resultsEl.innerHTML = "";

	// Serialize file objects with their custom names for IPC
	const filesToProcess = selectedFiles.map((file) => ({
		filePath: file.filePath,
		customName: file.customName,
	}));

	const results = await window.electronAPI.createSymlink({
		targetFiles: filesToProcess,
		vaultPath: vaultPath,
	});

	renderResults(results);

	// Save successful links to recent links
	for (const result of results) {
		if (result.success) {
			saveRecentLink({
				fileName: result.file,
				targetPath: result.targetPath,
				symlinkPath: result.symlinkPath,
				date: new Date().toISOString(),
			});
		}
	}

	// Reset file selection
	selectedFiles = [];
	markdownFilesInput.value = "";
	fileListEl.innerHTML = "";
	updateCreateButtonState();
}

// Render results
function renderResults(results) {
	for (const result of results) {
		const resultItem = document.createElement("div");
		resultItem.className = `result-item ${result.success ? "success" : "error"}`;

		const fileName = document.createElement("div");
		fileName.textContent = result.file;

		const message = document.createElement("div");
		message.className = "path";
		message.textContent = result.success
			? `Successfully linked to ${result.targetPath}`
			: `Error: ${result.error}`;

		resultItem.appendChild(fileName);
		resultItem.appendChild(message);
		resultsEl.appendChild(resultItem);
	}
}

// Load recent symlinks
async function loadRecentLinks() {
	const recentLinks = await window.electronAPI.getRecentLinks();
	renderRecentLinks(recentLinks);
}

// Save recent symlink
async function saveRecentLink(linkInfo) {
	const recentLinks = await window.electronAPI.saveRecentLink(linkInfo);
	renderRecentLinks(recentLinks);
}

// Render recent links
function renderRecentLinks(recentLinks) {
	recentLinksEl.innerHTML = "";

	if (!recentLinks || recentLinks.length === 0) {
		const noLinks = document.createElement("div");
		noLinks.textContent = "No recent symlinks";
		recentLinksEl.appendChild(noLinks);
		return;
	}

	for (const link of recentLinks) {
		const recentItem = document.createElement("div");
		recentItem.className = "recent-item";

		const fileName = document.createElement("div");
		fileName.textContent = link.fileName;

		const targetPath = document.createElement("div");
		targetPath.className = "path";
		targetPath.textContent = `Target: ${link.targetPath}`;

		const symlinkPath = document.createElement("div");
		symlinkPath.className = "path";
		symlinkPath.textContent = `Symlink: ${link.symlinkPath || "unknown"}`;

		const date = document.createElement("div");
		date.className = "path";
		date.textContent = `Created: ${new Date(link.date).toLocaleString()}`;

		recentItem.appendChild(fileName);
		recentItem.appendChild(targetPath);
		recentItem.appendChild(symlinkPath);
		recentItem.appendChild(date);
		recentLinksEl.appendChild(recentItem);
	}
}

// Update create button state
function updateCreateButtonState() {
	createSymlinksBtn.disabled = !vaultPath || selectedFiles.length === 0;
}

// Clear recent links
async function clearRecentLinks() {
	if (window.confirm("Are you sure you want to clear all recent symlinks?")) {
		await window.electronAPI.clearRecentLinks();
		loadRecentLinks();
	}
}

// Export for testing
window.rendererFunctions = {
	init,
	loadObsidianVaults,
	populateVaultSelector,
	selectVaultByPath,
	renderFileList,
	renderResults,
	loadRecentLinks,
	saveRecentLink,
	renderRecentLinks,
	updateCreateButtonState,
	createSymlinks,
	clearRecentLinks,
	chooseMarkdownFiles,
	registerEventListeners,
};
