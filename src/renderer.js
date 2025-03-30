const { ipcRenderer } = require('electron');
const path = require('path');

// DOM Elements
const vaultPathInput = document.getElementById('vault-path');
const chooseVaultBtn = document.getElementById('choose-vault-btn');
const markdownFilesInput = document.getElementById('markdown-files');
const chooseMarkdownBtn = document.getElementById('choose-markdown-btn');
const createSymlinksBtn = document.getElementById('create-symlinks-btn');
const fileListEl = document.getElementById('file-list');
const resultsEl = document.getElementById('results');
const recentLinksEl = document.getElementById('recent-links');

// App State
let vaultPath = '';
let selectedFiles = [];

// Dark mode support
ipcRenderer.on('theme-changed', (event, isDarkMode) => {
  document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
});

// Initialize app
async function init() {
  // Load saved vault path
  const savedVaultPath = await ipcRenderer.invoke('load-vault-path');
  if (savedVaultPath) {
    vaultPath = savedVaultPath;
    vaultPathInput.value = savedVaultPath;
    updateCreateButtonState();
  }
  
  // Load recent symlinks
  loadRecentLinks();
}

// Choose vault folder
chooseVaultBtn.addEventListener('click', async () => {
  const selectedPath = await ipcRenderer.invoke('choose-vault');
  if (selectedPath) {
    vaultPath = selectedPath;
    vaultPathInput.value = selectedPath;
    updateCreateButtonState();
  }
});

// Choose markdown files
chooseMarkdownBtn.addEventListener('click', async () => {
  const files = await ipcRenderer.invoke('choose-markdown');
  if (files && files.length > 0) {
    selectedFiles = files;
    markdownFilesInput.value = `${files.length} file(s) selected`;
    renderFileList();
    updateCreateButtonState();
  }
});

// Render selected files list
function renderFileList() {
  fileListEl.innerHTML = '';
  
  selectedFiles.forEach(filePath => {
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    
    const fileName = document.createElement('div');
    fileName.textContent = path.basename(filePath);
    
    const removeBtn = document.createElement('button');
    removeBtn.textContent = '✕';
    removeBtn.addEventListener('click', () => {
      selectedFiles = selectedFiles.filter(f => f !== filePath);
      renderFileList();
      markdownFilesInput.value = selectedFiles.length ? `${selectedFiles.length} file(s) selected` : '';
      updateCreateButtonState();
    });
    
    fileItem.appendChild(fileName);
    fileItem.appendChild(removeBtn);
    fileListEl.appendChild(fileItem);
  });
}

// Create symlinks
createSymlinksBtn.addEventListener('click', async () => {
  if (!vaultPath || selectedFiles.length === 0) return;
  
  resultsEl.innerHTML = '';
  
  const results = await ipcRenderer.invoke('create-symlink', {
    targetFiles: selectedFiles,
    vaultPath: vaultPath
  });
  
  renderResults(results);
  
  // Save successful links to recent links
  results.forEach(result => {
    if (result.success) {
      saveRecentLink({
        fileName: result.file,
        targetPath: result.targetPath,
        symlinkPath: result.symlinkPath,
        date: new Date().toISOString()
      });
    }
  });
  
  // Reset file selection
  selectedFiles = [];
  markdownFilesInput.value = '';
  fileListEl.innerHTML = '';
  updateCreateButtonState();
});

// Render results
function renderResults(results) {
  results.forEach(result => {
    const resultItem = document.createElement('div');
    resultItem.className = `result-item ${result.success ? 'success' : 'error'}`;
    
    const fileName = document.createElement('div');
    fileName.textContent = result.file;
    
    const message = document.createElement('div');
    message.className = 'path';
    message.textContent = result.success 
      ? `Successfully linked to ${result.targetPath}`
      : `Error: ${result.error}`;
    
    resultItem.appendChild(fileName);
    resultItem.appendChild(message);
    resultsEl.appendChild(resultItem);
  });
}

// Load recent symlinks
async function loadRecentLinks() {
  const recentLinks = await ipcRenderer.invoke('get-recent-links');
  renderRecentLinks(recentLinks);
}

// Save recent symlink
async function saveRecentLink(linkInfo) {
  const recentLinks = await ipcRenderer.invoke('save-recent-link', linkInfo);
  renderRecentLinks(recentLinks);
}

// Render recent links
function renderRecentLinks(recentLinks) {
  recentLinksEl.innerHTML = '';
  
  if (!recentLinks || recentLinks.length === 0) {
    const noLinks = document.createElement('div');
    noLinks.textContent = 'No recent symlinks';
    recentLinksEl.appendChild(noLinks);
    return;
  }
  
  recentLinks.forEach(link => {
    const recentItem = document.createElement('div');
    recentItem.className = 'recent-item';
    
    const fileName = document.createElement('div');
    fileName.textContent = link.fileName;
    
    const targetPath = document.createElement('div');
    targetPath.className = 'path';
    targetPath.textContent = `Target: ${link.targetPath}`;
    
    const symlinkPath = document.createElement('div');
    symlinkPath.className = 'path';
    symlinkPath.textContent = `Symlink: ${link.symlinkPath}`;
    
    const date = document.createElement('div');
    date.className = 'path';
    date.textContent = `Created: ${new Date(link.date).toLocaleString()}`;
    
    recentItem.appendChild(fileName);
    recentItem.appendChild(targetPath);
    recentItem.appendChild(symlinkPath);
    recentItem.appendChild(date);
    recentLinksEl.appendChild(recentItem);
  });
}

// Update create button state
function updateCreateButtonState() {
  createSymlinksBtn.disabled = !vaultPath || selectedFiles.length === 0;
}

// Initialize the app
init();