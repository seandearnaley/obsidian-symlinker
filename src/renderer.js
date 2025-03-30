const { ipcRenderer } = require("electron");
const path = require("node:path");

// DOM Elements
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

// App State
let vaultPath = "";
let selectedFiles = [];
let obsidianVaults = [];
let lastSavedVaultPath = null; // Track last saved vault path for auto-selection

// Dark mode support
ipcRenderer.on("theme-changed", (event, isDarkMode) => {
	document.documentElement.setAttribute("data-theme", isDarkMode ? "dark" : "light");
});

// Initialize app
async function init() {
	console.log("Initializing app");

	// Load saved vault path first
	lastSavedVaultPath = await ipcRenderer.invoke("load-vault-path");
	console.log("Loaded saved vault path:", lastSavedVaultPath);

	// Load Obsidian vaults (which will handle selection based on saved path)
	await loadObsidianVaults();

	// Load recent symlinks
	loadRecentLinks();
}

// Load Obsidian vaults from system
async function loadObsidianVaults() {
	try {
		console.log("Loading Obsidian vaults");
		obsidianVaults = await ipcRenderer.invoke("get-obsidian-vaults");
		console.log(`Found ${obsidianVaults.length} vaults`);

		// Now populate the selector
		populateVaultSelector();

		// After populating, handle auto-selection
		if (obsidianVaults.length > 0) {
			// If we have a saved path, use it
			if (lastSavedVaultPath) {
				console.log("Using saved vault path:", lastSavedVaultPath);
				selectVaultByPath(lastSavedVaultPath);
			}
			// Otherwise auto-select the first available vault
			else {
				const firstVault = obsidianVaults[0];
				if (firstVault?.path) {
					console.log("Auto-selecting first vault:", firstVault.path);
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
	// Clear existing options except the default one
	while (vaultSelector.options.length > 1) {
		vaultSelector.remove(1);
	}

	// Add vaults to dropdown
	if (obsidianVaults.length > 0) {
		// Add section title for automatic vaults
		let hasConfigVaults = false;
		let hasManualVaults = false;

		// First, check if we have both types
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

	console.log(`Selecting vault path: "${targetPath}"`);

	// First check if it's in our list of Obsidian vaults
	let found = false;

	for (let i = 0; i < vaultSelector.options.length; i++) {
		const option = vaultSelector.options[i];
		if (option.value === targetPath) {
			vaultSelector.selectedIndex = i;
			found = true;
			console.log(`Found matching vault in selector at index ${i}`);
			break;
		}
	}

	// Always set the vault path in our state
	vaultPath = targetPath;

	// Always update the input field with the path
	vaultPathInput.value = targetPath;

	// Save the path
	lastSavedVaultPath = targetPath;
	ipcRenderer.invoke("save-vault-path", targetPath);

	// Update button state
	updateCreateButtonState();

	// If not found in the dropdown but valid path, it's a custom vault
	if (!found && targetPath) {
		console.log(`Path ${targetPath} not found in selector, treating as custom vault`);
		// Reset the selector to default
		vaultSelector.selectedIndex = 0;
	}
}

// Refresh Obsidian vaults list
refreshVaultsBtn.addEventListener("click", loadObsidianVaults);

// Handle vault selection change from dropdown
vaultSelector.addEventListener("change", () => {
	const selectedPath = vaultSelector.value;
	if (selectedPath) {
		console.log("Vault selected from dropdown:", selectedPath);
		selectVaultByPath(selectedPath);
	}
});

// Choose custom vault folder
chooseVaultBtn.addEventListener("click", async () => {
	const selectedPath = await ipcRenderer.invoke("choose-vault");
	if (selectedPath) {
		console.log("Custom vault selected:", selectedPath);
		selectVaultByPath(selectedPath);
		// Reset the selector to "Select a vault" for custom paths
		vaultSelector.selectedIndex = 0;
	}
});

// Choose markdown files
chooseMarkdownBtn.addEventListener("click", async () => {
	const files = await ipcRenderer.invoke("choose-markdown");
	if (files && files.length > 0) {
		// Convert to file objects with additional properties
		selectedFiles = files.map((filePath) => ({
			filePath,
			originalName: path.basename(filePath),
			customName: null,
			editing: false,
		}));

		markdownFilesInput.value = `${files.length} file(s) selected`;
		renderFileList();
		updateCreateButtonState();
	}
});

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
		editBtn.addEventListener("click", () => {
			// Turn off editing for all files
			for (const file of selectedFiles) {
				file.editing = false;
			}

			// Toggle editing for this file only
			fileObj.editing = true;
			renderFileList();
		});

		// Remove button
		const removeBtn = document.createElement("button");
		removeBtn.textContent = "✕";
		removeBtn.title = "Remove file";
		removeBtn.addEventListener("click", () => {
			selectedFiles = selectedFiles.filter((f) => f !== fileObj);
			renderFileList();
			markdownFilesInput.value = selectedFiles.length
				? `${selectedFiles.length} file(s) selected`
				: "";
			updateCreateButtonState();
		});

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

			// Track if the filename has a valid extension
			let hasValidExtension = nameInput.value.toLowerCase().endsWith(".md");

			// Add extension warning if needed
			function updateExtensionWarning() {
				// Remove any existing warning
				const existingWarning = fileItem.querySelector(".extension-warning");
				if (existingWarning) {
					fileItem.removeChild(existingWarning);
				}

				// Check if extension is valid
				hasValidExtension = nameInput.value.toLowerCase().endsWith(".md");

				// Add warning if needed
				if (!hasValidExtension) {
					const warningEl = document.createElement("div");
					warningEl.className = "extension-warning";
					warningEl.innerHTML =
						'<span class="warning-icon">⚠️</span> Filename must end with .md to work in Obsidian';
					fileItem.appendChild(warningEl);
				}
			}

			// Auto-select filename without extension
			nameInput.addEventListener("focus", () => {
				const extIndex = nameInput.value.lastIndexOf(".");
				if (extIndex > 0) {
					nameInput.setSelectionRange(0, extIndex);
				}
			});

			// Handle input changes
			nameInput.addEventListener("input", () => {
				updateExtensionWarning();
			});

			// Initial extension check
			updateExtensionWarning();

			// Save button
			const saveBtn = document.createElement("button");
			saveBtn.textContent = "Save";
			saveBtn.addEventListener("click", () => {
				let newName = nameInput.value.trim();
				console.log("Save clicked. Original name:", fileObj.originalName, "Input value:", newName);

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
					console.log("Added .md extension. New name:", newName);
				}

				// Only set customName if it's different from the original
				if (newName && newName !== fileObj.originalName) {
					console.log("Setting custom name:", newName);
					fileObj.customName = newName;
				} else {
					console.log("Using original name:", fileObj.originalName);
					fileObj.customName = null;
				}

				console.log("Updated file object:", fileObj);
				fileObj.editing = false;
				renderFileList();
			});

			// Cancel button
			const cancelBtn = document.createElement("button");
			cancelBtn.textContent = "Cancel";
			cancelBtn.addEventListener("click", () => {
				fileObj.editing = false;
				renderFileList();
			});

			editContainer.appendChild(nameInput);
			editContainer.appendChild(saveBtn);
			editContainer.appendChild(cancelBtn);

			fileItem.appendChild(editContainer);
		}

		fileListEl.appendChild(fileItem);
	}
}

// Create symlinks
createSymlinksBtn.addEventListener("click", async () => {
	if (!vaultPath || selectedFiles.length === 0) return;

	resultsEl.innerHTML = "";

	console.log("Create Symlinks button clicked. Selected files:", selectedFiles);

	// Serialize file objects with their custom names for IPC
	const filesToProcess = selectedFiles.map((file) => {
		console.log(`Processing file: ${file.originalName}, Custom name: ${file.customName || "NONE"}`);
		return {
			filePath: file.filePath,
			customName: file.customName,
		};
	});

	console.log("Files to send to main process:", filesToProcess);

	const results = await ipcRenderer.invoke("create-symlink", {
		targetFiles: filesToProcess,
		vaultPath: vaultPath,
	});

	console.log("Results from main process:", results);

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
});

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
	const recentLinks = await ipcRenderer.invoke("get-recent-links");
	renderRecentLinks(recentLinks);
}

// Save recent symlink
async function saveRecentLink(linkInfo) {
	const recentLinks = await ipcRenderer.invoke("save-recent-link", linkInfo);
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
		symlinkPath.textContent = `Symlink: ${link.symlinkPath}`;

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
clearRecentBtn.addEventListener("click", async () => {
	if (confirm("Are you sure you want to clear all recent symlinks?")) {
		await ipcRenderer.invoke("clear-recent-links");
		loadRecentLinks();
	}
});

// Initialize the app
init();
