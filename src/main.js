const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const Store = require("electron-store");
const os = require("node:os");

const store = new Store();

let mainWindow;

// Get Obsidian config file path based on platform
function getObsidianConfigPath() {
  switch (process.platform) {
    case "win32":
      return path.join(process.env.APPDATA, "obsidian", "obsidian.json");
    case "darwin":
      return path.join(
        os.homedir(),
        "Library",
        "Application Support",
        "obsidian",
        "obsidian.json"
      );
    case "linux": {
      // Try different locations based on how Obsidian was installed
      const possibleLocations = [
        path.join(os.homedir(), ".config", "obsidian", "obsidian.json"),
        path.join(
          os.homedir(),
          ".var",
          "app",
          "md.obsidian.Obsidian",
          "config",
          "obsidian",
          "obsidian.json"
        ),
      ];

      for (const location of possibleLocations) {
        if (fs.existsSync(location)) {
          return location;
        }
      }
      return path.join(os.homedir(), ".config", "obsidian", "obsidian.json"); // Default fallback
    }
    default:
      return null;
  }
}

// Find Obsidian vaults from config file
function findObsidianVaults() {
  try {
    const configPath = getObsidianConfigPath();
    if (!configPath || !fs.existsSync(configPath)) {
      console.log("Obsidian config file not found at:", configPath);
      return [];
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

        // Check if vault path is accessible
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

    console.log(`Found ${vaultList.length} Obsidian vaults`);
    return vaultList;
  } catch (error) {
    console.error("Error finding Obsidian vaults:", error);
    return [];
  }
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

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", function () {
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
