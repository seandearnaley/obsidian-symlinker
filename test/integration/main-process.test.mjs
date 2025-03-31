import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { setupElectronMocks } from "../mocks/electron-mock.mjs";
import * as fs from "node:fs";

// Mock fs to control file system behavior during tests
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    readdirSync: vi.fn(),
    statSync: vi.fn(),
    symlinkSync: vi.fn(),
    unlinkSync: vi.fn(),
  };
});

// FIXME: Main process tests - skipped until we can properly handle the import/mocking issues
// TODO: Fix issues with the node:fs mocking in the async vi.mock function
// TODO: Look into ways to mock the mainModule.getObsidianConfigPath function
describe.skip("Main Process Unit Tests", () => {
  // Mock dependencies and objects
  let electron;
  let electronStore;
  let mainModule;
  
  // Setup test environment before each test
  beforeEach(async () => {
    // Reset all mocks
    vi.resetAllMocks();
    
    // Setup Electron mocks
    const mocks = setupElectronMocks();
    electron = mocks.electron;
    electronStore = mocks.electronStore;
    
    // Mock return values for fs functions
    fs.existsSync.mockImplementation(path => {
      if (path.includes(".obsidian") || path.endsWith("obsidian.json")) {
        return true;
      }
      return path.includes("exists");
    });
    
    fs.readFileSync.mockImplementation((path) => {
      if (path.includes("obsidian.json")) {
        return JSON.stringify({
          vaults: {
            "vault1": {
              path: "/path/to/vault1",
              name: "Vault 1"
            },
            "vault2": {
              path: "file:///path/to/vault2",
              name: "Vault 2"
            }
          }
        });
      }
      return "";
    });
    
    fs.statSync.mockImplementation((path) => ({
      isDirectory: () => !path.includes(".md"),
    }));
    
    fs.readdirSync.mockReturnValue(["file1.md", "file2.md"]);
    
    // Import main.js after mocking
    mainModule = await import("../../src/main.js");
  });
  
  afterEach(() => {
    vi.resetModules();
  });
  
  describe("Obsidian Vault Detection", () => {
    it("should find Obsidian config path based on platform", () => {
      // Test each platform
      const platforms = ["darwin", "win32", "linux"];
      const homeDir = os.homedir();
      
      for (const platform of platforms) {
        // Override process.platform
        Object.defineProperty(process, "platform", { value: platform });
        
        // Get expected path based on platform
        let expectedPath;
        if (platform === "darwin") {
          expectedPath = path.join(homeDir, "Library", "Application Support", "obsidian", "obsidian.json");
        } else if (platform === "win32") {
          expectedPath = path.join(process.env.APPDATA || "", "obsidian", "obsidian.json");
        } else if (platform === "linux") {
          expectedPath = path.join(homeDir, ".config", "obsidian", "obsidian.json");
        }
        
        // Make sure fs.existsSync returns true for this path
        fs.existsSync.mockImplementation(path => path === expectedPath);
        
        // Call the function
        const configPath = mainModule.getObsidianConfigPath();
        
        // Verify the result
        expect(configPath).toBe(expectedPath);
      }
    });
    
    it("should handle missing Obsidian config gracefully", () => {
      // Make fs.existsSync always return false
      fs.existsSync.mockReturnValue(false);
      
      // Call the function
      const result = mainModule.findObsidianVaults();
      
      // Verify the result
      expect(result).toBeInstanceOf(Array);
      expect(fs.existsSync).toHaveBeenCalled();
    });
    
    it("should normalize file:// paths in vault configs", () => {
      // Mock the fs.readFileSync to return config with file:// paths
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValueOnce(JSON.stringify({
        vaults: {
          "vault1": {
            path: "/normal/path",
            name: "Normal Path"
          },
          "vault2": {
            path: "file:///encoded/path",
            name: "Encoded Path"
          },
          "vault3": {
            path: "file:///path%20with%20spaces",
            name: "Path With Spaces"
          }
        }
      }));
      
      // Call the function
      const vaults = mainModule.findObsidianVaults();
      
      // Verify normalization
      expect(vaults.length).toBe(3);
      expect(vaults[0].path).toBe("/normal/path");
      expect(vaults[1].path).toBe("/encoded/path");
      expect(vaults[2].path).toBe("/path with spaces");
    });
  });
  
  describe("IPC Handlers", () => {
    it("should register all required IPC handlers", () => {
      // Check if all handlers are registered
      const expectedHandlers = [
        "get-obsidian-vaults",
        "choose-vault",
        "load-vault-path",
        "save-vault-path",
        "choose-markdown",
        "create-symlink",
        "get-recent-links",
        "save-recent-link",
        "clear-recent-links"
      ];
      
      for (const handler of expectedHandlers) {
        expect(electron.ipcMain.handle).toHaveBeenCalledWith(handler, expect.any(Function));
      }
    });
    
    it("should handle vault selection dialog correctly", async () => {
      // Find the handler function for choose-vault
      const handleFn = mockIpcHandler(electron.ipcMain, "choose-vault");
      
      // Setup dialog mock
      electron.dialog.showOpenDialog.mockResolvedValueOnce({
        canceled: false,
        filePaths: ["/selected/path"]
      });
      
      // Mock fs.existsSync for .obsidian check
      fs.existsSync.mockImplementation(path => {
        return path.includes(".obsidian");
      });
      
      // Call the handler
      const result = await handleFn({}, {});
      
      // Verify
      expect(result).toBe("/selected/path");
      expect(electron.dialog.showOpenDialog).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          properties: ["openDirectory"]
        })
      );
    });
    
    it("should handle symlink creation correctly", async () => {
      // Find the handler function for create-symlink
      const handleFn = mockIpcHandler(electron.ipcMain, "create-symlink");
      
      // Setup test request data
      const request = {
        targetFiles: [
          { filePath: "/path/to/file1.md", customName: "custom.md" },
          { filePath: "/path/to/file2.md" }
        ],
        vaultPath: "/vault/path"
      };
      
      // Call the handler
      const results = await handleFn({}, request);
      
      // Verify
      expect(results.length).toBe(2);
      expect(results[0].success).toBe(true);
      expect(results[0].file).toBe("custom.md");
      expect(results[1].file).toBe("file2.md");
      
      // Verify fs operations
      expect(fs.symlinkSync).toHaveBeenCalledTimes(2);
    });
    
    it("should handle symlink errors gracefully", async () => {
      // Find the handler function for create-symlink
      const handleFn = mockIpcHandler(electron.ipcMain, "create-symlink");
      
      // Make symlink throw an error
      fs.symlinkSync.mockImplementation(() => {
        throw new Error("Permission denied");
      });
      
      // Setup test request data
      const request = {
        targetFiles: [
          { filePath: "/path/to/file.md" }
        ],
        vaultPath: "/vault/path"
      };
      
      // Call the handler
      const results = await handleFn({}, request);
      
      // Verify
      expect(results.length).toBe(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toBe("Permission denied");
    });
  });
});

// Helper function to find mock handler by channel
function mockIpcHandler(ipcMain, channel) {
  // Find the handler call for this channel
  const calls = ipcMain.handle.mock.calls;
  for (const call of calls) {
    if (call[0] === channel) {
      return call[1];
    }
  }
  return null;
}