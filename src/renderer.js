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

// App State
let vaultPath = "";
let selectedFiles = [];
let obsidianVaults = [];

// Dark mode support
ipcRenderer.on("theme-changed", (event, isDarkMode) => {
  document.documentElement.setAttribute(
    "data-theme",
    isDarkMode ? "dark" : "light"
  );
});

// Initialize app
async function init() {
  // Load Obsidian vaults
  await loadObsidianVaults();

  // Load saved vault path
  const savedVaultPath = await ipcRenderer.invoke("load-vault-path");
  if (savedVaultPath) {
    selectVaultByPath(savedVaultPath);
  }

  // Load recent symlinks
  loadRecentLinks();
}

// Load Obsidian vaults from system
async function loadObsidianVaults() {
  try {
    obsidianVaults = await ipcRenderer.invoke("get-obsidian-vaults");
    populateVaultSelector();

    if (obsidianVaults.length === 0) {
      // Flash the refresh button to indicate to the user that no vaults were found
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
  // First check if it's in our list of Obsidian vaults
  let found = false;

  for (let i = 0; i < vaultSelector.options.length; i++) {
    const option = vaultSelector.options[i];
    if (option.value === targetPath) {
      vaultSelector.selectedIndex = i;
      found = true;
      break;
    }
  }

  // If not found, it could be a custom vault
  if (!found && targetPath) {
    vaultPath = targetPath;
    vaultPathInput.value = targetPath;
  }

  updateCreateButtonState();
}

// Refresh Obsidian vaults list
refreshVaultsBtn.addEventListener("click", loadObsidianVaults);

// Handle vault selection change
vaultSelector.addEventListener("change", () => {
  const selectedPath = vaultSelector.value;
  if (selectedPath) {
    setVaultPath(selectedPath);
  }
});

// Set vault path and update UI
function setVaultPath(selectedPath) {
  vaultPath = selectedPath;
  vaultPathInput.value = selectedPath;
  // Save this as the last used vault
  ipcRenderer.invoke("load-vault-path", selectedPath);
  updateCreateButtonState();
}

// Choose custom vault folder
chooseVaultBtn.addEventListener("click", async () => {
  const selectedPath = await ipcRenderer.invoke("choose-vault");
  if (selectedPath) {
    // Check if the selected folder is a valid Obsidian vault
    // (should have a .obsidian folder)
    setVaultPath(selectedPath);
    // Reset the selector to "Select a vault" since we're using a custom path
    vaultSelector.selectedIndex = 0;
  }
});

// Choose markdown files
chooseMarkdownBtn.addEventListener("click", async () => {
  const files = await ipcRenderer.invoke("choose-markdown");
  if (files && files.length > 0) {
    selectedFiles = files;
    markdownFilesInput.value = `${files.length} file(s) selected`;
    renderFileList();
    updateCreateButtonState();
  }
});

// Render selected files list
function renderFileList() {
  fileListEl.innerHTML = "";

  for (const filePath of selectedFiles) {
    const fileItem = document.createElement("div");
    fileItem.className = "file-item";

    const fileName = document.createElement("div");
    fileName.textContent = path.basename(filePath);

    const removeBtn = document.createElement("button");
    removeBtn.textContent = "✕";
    removeBtn.addEventListener("click", () => {
      selectedFiles = selectedFiles.filter((f) => f !== filePath);
      renderFileList();
      markdownFilesInput.value = selectedFiles.length
        ? `${selectedFiles.length} file(s) selected`
        : "";
      updateCreateButtonState();
    });

    fileItem.appendChild(fileName);
    fileItem.appendChild(removeBtn);
    fileListEl.appendChild(fileItem);
  }
}

// Create symlinks
createSymlinksBtn.addEventListener("click", async () => {
  if (!vaultPath || selectedFiles.length === 0) return;

  resultsEl.innerHTML = "";

  const results = await ipcRenderer.invoke("create-symlink", {
    targetFiles: selectedFiles,
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
});

// Render results
function renderResults(results) {
  for (const result of results) {
    const resultItem = document.createElement("div");
    resultItem.className = `result-item ${
      result.success ? "success" : "error"
    }`;

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

// Initialize the app
init();
