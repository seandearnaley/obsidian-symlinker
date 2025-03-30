const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');
const os = require('os');

const store = new Store();

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    titleBarStyle: 'hiddenInset', // Native macOS look
    backgroundColor: '#f0f0f0',
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  
  // Handle macOS dark mode changes
  if (process.platform === 'darwin') {
    const { nativeTheme } = require('electron');
    mainWindow.webContents.on('dom-ready', () => {
      mainWindow.webContents.send('theme-changed', nativeTheme.shouldUseDarkColors);
    });
    
    nativeTheme.on('updated', () => {
      mainWindow.webContents.send('theme-changed', nativeTheme.shouldUseDarkColors);
    });
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Choose Obsidian vault folder
ipcMain.handle('choose-vault', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Obsidian Vault Folder'
  });
  
  if (!result.canceled) {
    const vaultPath = result.filePaths[0];
    store.set('vaultPath', vaultPath);
    return vaultPath;
  }
  return null;
});

// Load saved vault path
ipcMain.handle('load-vault-path', () => {
  return store.get('vaultPath');
});

// Choose markdown file to symlink
ipcMain.handle('choose-markdown', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
    title: 'Select Markdown Files to Symlink'
  });
  
  if (!result.canceled) {
    return result.filePaths;
  }
  return [];
});

// Create symlink
ipcMain.handle('create-symlink', async (event, { targetFiles, vaultPath }) => {
  const results = [];
  
  for (const filePath of targetFiles) {
    try {
      const fileName = path.basename(filePath);
      const symlinkPath = path.join(vaultPath, fileName);
      
      // Check if file already exists in the vault
      if (fs.existsSync(symlinkPath)) {
        results.push({
          success: false,
          file: fileName,
          error: 'File already exists in vault'
        });
        continue;
      }
      
      // Create symlink
      if (process.platform === 'win32') {
        // Windows requires admin privileges for symlinks, use junction instead
        fs.symlinkSync(filePath, symlinkPath, 'junction');
      } else {
        fs.symlinkSync(filePath, symlinkPath);
      }
      
      results.push({
        success: true,
        file: fileName,
        targetPath: filePath,
        symlinkPath: symlinkPath
      });
    } catch (error) {
      results.push({
        success: false,
        file: path.basename(filePath),
        error: error.message
      });
    }
  }
  
  return results;
});

// Get recent symlinks
ipcMain.handle('get-recent-links', () => {
  return store.get('recentLinks') || [];
});

// Save recent symlink
ipcMain.handle('save-recent-link', (event, linkInfo) => {
  const recentLinks = store.get('recentLinks') || [];
  const updatedLinks = [linkInfo, ...recentLinks.slice(0, 9)]; // Keep only the 10 most recent
  store.set('recentLinks', updatedLinks);
  return updatedLinks;
});