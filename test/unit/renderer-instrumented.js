// This file is a simplified version of renderer.js for instrumentation and coverage

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
let lastSavedVaultPath = null;

// Initialize app
async function init() {
	console.log("Initializing app");
	lastSavedVaultPath = await window.electronAPI.loadVaultPath();
	await loadObsidianVaults();
	loadRecentLinks();
}

// Load Obsidian vaults from system
async function loadObsidianVaults() {
	try {
		obsidianVaults = await window.electronAPI.getObsidianVaults();
		populateVaultSelector();

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
	} catch (error) {
		console.error("Error loading vaults:", error);
	}
}

// Populate vault selector dropdown
function populateVaultSelector() {
	while (vaultSelector.options.length > 1) {
		vaultSelector.remove(1);
	}

	if (obsidianVaults.length > 0) {
		let hasConfigVaults = false;
		let hasManualVaults = false;

		for (const vault of obsidianVaults) {
			if (vault.id.startsWith("manual-")) {
				hasManualVaults = true;
			} else {
				hasConfigVaults = true;
			}
		}

		let currentGroup = "";

		for (const vault of obsidianVaults) {
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

		vaultSelector.disabled = false;
	} else {
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

	let found = false;

	for (let i = 0; i < vaultSelector.options.length; i++) {
		const option = vaultSelector.options[i];
		if (option.value === targetPath) {
			vaultSelector.selectedIndex = i;
			found = true;
			break;
		}
	}

	vaultPath = targetPath;
	vaultPathInput.value = targetPath;
	lastSavedVaultPath = targetPath;
	window.electronAPI.saveVaultPath(targetPath);

	updateCreateButtonState();

	if (!found && targetPath) {
		vaultSelector.selectedIndex = 0;
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

		if (fileObj.customName) {
			fileName.innerHTML = `<span class="target-filename">${fileObj.originalName}</span> <span class="filename-preview">→</span> <span class="custom-filename">${fileObj.customName}</span>`;
		} else {
			fileName.textContent = fileObj.originalName;
		}

		fileItemInfo.appendChild(fileName);
		fileItem.appendChild(fileItemInfo);

		const fileActions = document.createElement("div");
		fileActions.className = "file-actions";

		const editBtn = document.createElement("button");
		editBtn.className = "edit-name-btn";
		editBtn.textContent = "✎";
		editBtn.title = "Customize filename in vault";
		editBtn.onclick = () => {
			for (const file of selectedFiles) {
				file.editing = false;
			}

			fileObj.editing = true;
			renderFileList();
		};

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

			// Add editing functionality here

			fileItem.appendChild(editContainer);
		}

		fileListEl.appendChild(fileItem);
	}
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

		recentItem.appendChild(fileName);
		recentLinksEl.appendChild(recentItem);
	}
}

// Update create button state
function updateCreateButtonState() {
	createSymlinksBtn.disabled = !vaultPath || selectedFiles.length === 0;
}

// Export these for testing
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
};
