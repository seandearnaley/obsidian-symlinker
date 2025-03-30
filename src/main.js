const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const Store = require("electron-store");
const os = require("node:os");

const store = new Store();

let mainWindow;

// Get Obsidian config file path based on platform
function getObsidianConfigPath() {
  const possiblePaths = [];

  switch (process.platform) {
    case "win32": {
      // Standard installation path
      possiblePaths.push(
        path.join(process.env.APPDATA, "obsidian", "obsidian.json")
      );

      // Portable installation - check Data directory for portable apps
      if (process.env.PORTABLE_EXECUTABLE_DIR) {
        possiblePaths.push(
          path.join(
            process.env.PORTABLE_EXECUTABLE_DIR,
            "Data",
            "obsidian",
            "obsidian.json"
          )
        );
      }

      // Add current directory + Data folder for portable installations
      possiblePaths.push(
        path.join(app.getAppPath(), "..", "Data", "obsidian", "obsidian.json")
      );
      possiblePaths.push(
        path.join(process.cwd(), "Data", "obsidian", "obsidian.json")
      );
      break;
    }
    case "darwin": {
      // Standard Mac installation paths
      possiblePaths.push(
        path.join(
          os.homedir(),
          "Library",
          "Application Support",
          "obsidian",
          "obsidian.json"
        )
      );

      // Add current directory + Data folder for portable installations
      possiblePaths.push(
        path.join(app.getAppPath(), "..", "Data", "obsidian", "obsidian.json")
      );
      possiblePaths.push(
        path.join(process.cwd(), "Data", "obsidian", "obsidian.json")
      );
      break;
    }
    case "linux": {
      // Standard Linux installation paths
      possiblePaths.push(
        path.join(os.homedir(), ".config", "obsidian", "obsidian.json")
      );

      // Flatpak installation
      possiblePaths.push(
        path.join(
          os.homedir(),
          ".var",
          "app",
          "md.obsidian.Obsidian",
          "config",
          "obsidian",
          "obsidian.json"
        )
      );

      // Snap installation
      possiblePaths.push(
        path.join(
          os.homedir(),
          "snap",
          "obsidian",
          "current",
          ".config",
          "obsidian",
          "obsidian.json"
        )
      );

      // AppImage or portable installation
      possiblePaths.push(
        path.join(app.getAppPath(), "..", "Data", "obsidian", "obsidian.json")
      );
      possiblePaths.push(
        path.join(process.cwd(), "Data", "obsidian", "obsidian.json")
      );
      break;
    }
    default:
      return null;
  }

  // Check each path and return the first one that exists
  for (const configPath of possiblePaths) {
    try {
      if (fs.existsSync(configPath)) {
        console.log("Found Obsidian config at:", configPath);
        return configPath;
      }
    } catch (error) {
      // Ignore permission errors or other issues
      console.log(`Error checking path ${configPath}: ${error.message}`);
    }
  }

  // If no config file is found, return the default path for the platform
  console.log("No Obsidian config found, using default path");
  return possiblePaths[0];
}

// Find Obsidian vaults from config file
function findObsidianVaults() {
  try {
    const configPath = getObsidianConfigPath();
    if (!configPath || !fs.existsSync(configPath)) {
      console.log("Obsidian config file not found at:", configPath);
      return searchForVaultsByDirectory();
    }

    const configData = fs.readFileSync(configPath, "utf8");
    const config = JSON.parse(configData);

    // The vault list structure might differ slightly based on Obsidian version
    // but generally it's stored in either 'vaults' or 'vaultList'
    const vaults = config.vaults || config.vaultList || {};

    const vaultList = Object.entries(vaults)
      .map(([id, vault]) => {
        // Fix path if necessary (some Obsidian versions use uri-encoded paths)
        let vaultPath = vault.path;
        if (vaultPath.startsWith("file://")) {
          vaultPath = decodeURI(vaultPath.replace(/^file:\/\//, ""));
        }

        // Validate the vault path exists
        let isValid = false;
        let isAccessible = false;

        try {
          isValid = fs.existsSync(vaultPath);
          // Try to read directory to verify access permissions
          if (isValid) {
            fs.readdirSync(vaultPath);
            isAccessible = true;
          }
        } catch (err) {
          console.log(
            `Vault at ${vaultPath} exists but may require elevated privileges:`,
            err.message
          );
          isAccessible = false;
        }

        return {
          id,
          name: vault.name || path.basename(vaultPath),
          path: vaultPath,
          isValid,
          isAccessible,
        };
      })
      .filter((vault) => vault.isValid); // Only return valid vaults

    // Check for inaccessible vaults that might need elevated privileges
    const inaccessibleVaults = vaultList.filter((vault) => !vault.isAccessible);
    if (inaccessibleVaults.length > 0) {
      console.log(
        `Warning: ${inaccessibleVaults.length} vault(s) may require elevated privileges to access`
      );
    }

    console.log(`Found ${vaultList.length} Obsidian vaults from config`);

    // If no vaults found in config, try to search common locations
    if (vaultList.length === 0) {
      return searchForVaultsByDirectory();
    }

    return vaultList;
  } catch (error) {
    console.error("Error finding Obsidian vaults from config:", error);
    return searchForVaultsByDirectory();
  }
}

// Search for potential Obsidian vaults by checking common directories
function searchForVaultsByDirectory() {
  const potentialVaults = [];
  const commonDirs = [];

  // Add common locations where vaults might be stored
  commonDirs.push(path.join(os.homedir(), "Documents"));
  commonDirs.push(path.join(os.homedir(), "Dropbox"));
  commonDirs.push(path.join(os.homedir(), "Google Drive"));
  commonDirs.push(path.join(os.homedir(), "OneDrive"));
  commonDirs.push(path.join(os.homedir(), "iCloud Drive"));
  commonDirs.push(path.join(os.homedir(), "Obsidian Vaults"));

  // Check each directory for .obsidian folders (indicating an Obsidian vault)
  for (const dir of commonDirs) {
    try {
      if (!fs.existsSync(dir)) continue;

      // Check if this directory itself is a vault
      if (fs.existsSync(path.join(dir, ".obsidian"))) {
        potentialVaults.push({
          id: `manual-${potentialVaults.length}`,
          name: path.basename(dir),
          path: dir,
          isValid: true,
          isAccessible: true,
        });
        continue;
      }

      // Check subdirectories (but only one level deep to avoid too much scanning)
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const itemPath = path.join(dir, item);

        try {
          const stats = fs.statSync(itemPath);
          if (
            stats.isDirectory() &&
            fs.existsSync(path.join(itemPath, ".obsidian"))
          ) {
            potentialVaults.push({
              id: `manual-${potentialVaults.length}`,
              name: item,
              path: itemPath,
              isValid: true,
              isAccessible: true,
            });
          }
        } catch (err) {
          // Skip inaccessible directories
        }
      }
    } catch (err) {
      // Skip inaccessible directories
    }
  }

  console.log(
    `Found ${potentialVaults.length} potential Obsidian vaults by directory scanning`
  );
  return potentialVaults;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    titleBarStyle: "hiddenInset", // Native macOS look
    backgroundColor: "#f0f0f0",
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));

  // Handle macOS dark mode changes
  if (process.platform === "darwin") {
    const { nativeTheme } = require("electron");
    mainWindow.webContents.on("dom-ready", () => {
      mainWindow.webContents.send(
        "theme-changed",
        nativeTheme.shouldUseDarkColors
      );
    });

    nativeTheme.on("updated", () => {
      mainWindow.webContents.send(
        "theme-changed",
        nativeTheme.shouldUseDarkColors
      );
    });
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// Get list of Obsidian vaults
ipcMain.handle("get-obsidian-vaults", () => {
  return findObsidianVaults();
});

// Choose Obsidian vault folder
ipcMain.handle("choose-vault", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"],
    title: "Select Obsidian Vault Folder",
  });

  if (!result.canceled) {
    const vaultPath = result.filePaths[0];

    // Verify this is likely an Obsidian vault by checking for .obsidian directory
    const isObsidianVault = fs.existsSync(path.join(vaultPath, ".obsidian"));

    if (!isObsidianVault) {
      const { response } = await dialog.showMessageBox(mainWindow, {
        type: "warning",
        buttons: ["Use Anyway", "Cancel"],
        defaultId: 1,
        title: "Not an Obsidian Vault",
        message: "The selected folder does not appear to be an Obsidian vault.",
        detail:
          "No .obsidian folder was found. You can still use this folder, but symlinks may not work as expected in Obsidian.",
      });

      if (response === 1) {
        // User clicked Cancel
        return null;
      }
    }

    store.set("vaultPath", vaultPath);
    return vaultPath;
  }
  return null;
});

// Load saved vault path
ipcMain.handle("load-vault-path", (event, path) => {
  if (path) {
    store.set("vaultPath", path);
  }
  return store.get("vaultPath");
});

// Choose markdown file to symlink
ipcMain.handle("choose-markdown", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile", "multiSelections"],
    filters: [{ name: "Markdown", extensions: ["md", "markdown"] }],
    title: "Select Markdown Files to Symlink",
  });

  if (!result.canceled) {
    return result.filePaths;
  }
  return [];
});

// Create symlink
ipcMain.handle("create-symlink", async (event, { targetFiles, vaultPath }) => {
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
          error: "File already exists in vault",
        });
        continue;
      }

      // Create symlink
      if (process.platform === "win32") {
        // Windows requires admin privileges for symlinks, use junction instead
        fs.symlinkSync(filePath, symlinkPath, "junction");
      } else {
        fs.symlinkSync(filePath, symlinkPath);
      }

      results.push({
        success: true,
        file: fileName,
        targetPath: filePath,
        symlinkPath: symlinkPath,
      });
    } catch (error) {
      results.push({
        success: false,
        file: path.basename(filePath),
        error: error.message,
      });
    }
  }

  return results;
});

// Get recent symlinks
ipcMain.handle("get-recent-links", () => {
  return store.get("recentLinks") || [];
});

// Save recent symlink
ipcMain.handle("save-recent-link", (event, linkInfo) => {
  const recentLinks = store.get("recentLinks") || [];
  const updatedLinks = [linkInfo, ...recentLinks.slice(0, 9)]; // Keep only the 10 most recent
  store.set("recentLinks", updatedLinks);
  return updatedLinks;
});
