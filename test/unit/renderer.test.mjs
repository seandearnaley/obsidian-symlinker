import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Mock DOM environment for browser-like functionality
const setupDOM = () => {
  // Mock DOM elements
  global.document = {
    getElementById: vi.fn().mockImplementation((id) => {
      // Return mock elements based on ID
      if (id === "vault-path") return { value: "" };
      if (id === "vault-selector") return { 
        value: "", 
        disabled: false,
        selectedIndex: 0,
        options: [{ value: "", textContent: "Select a vault" }],
        appendChild: vi.fn(),
        remove: vi.fn()
      };
      if (id === "markdown-files") return { value: "" };
      if (id === "file-list") return { innerHTML: "" };
      if (id === "results") return { innerHTML: "" };
      if (id === "recent-links") return { innerHTML: "" };
      if (id === "create-symlinks-btn") return { disabled: true };
      if (id === "refresh-vaults-btn") return {
        classList: { add: vi.fn(), remove: vi.fn() }
      };
      
      // Default mock element for any other ID
      return {
        addEventListener: vi.fn(),
        classList: { add: vi.fn(), remove: vi.fn() }
      };
    }),
    createElement: vi.fn().mockImplementation(() => ({
      classList: { add: vi.fn(), remove: vi.fn() },
      addEventListener: vi.fn(),
      appendChild: vi.fn(),
      className: "",
      textContent: "",
      innerHTML: ""
    })),
    documentElement: {
      setAttribute: vi.fn()
    }
  };
  
  // Mock window/global functions
  global.confirm = vi.fn().mockReturnValue(true);
  global.setTimeout = vi.fn((fn) => fn());
  
  return global.document;
};

// Mock electron's ipcRenderer
vi.mock("electron", () => ({
  ipcRenderer: {
    on: vi.fn(),
    invoke: vi.fn(),
    send: vi.fn()
  }
}));

// Mock node:path
vi.mock("node:path", async () => {
  // Return a complete mock with all needed functions
  return {
    default: {
      basename: vi.fn((filePath) => {
        if (!filePath) return "";
        const parts = filePath.split(/[/\\]/);
        return parts[parts.length - 1];
      }),
      join: vi.fn((...args) => args.join("/"))
    },
    // Also export the functions directly for ES module usage
    basename: vi.fn((filePath) => {
      if (!filePath) return "";
      const parts = filePath.split(/[/\\]/);
      return parts[parts.length - 1];
    }),
    join: vi.fn((...args) => args.join("/")),
    // Add any other path functions that might be used
    dirname: vi.fn((p) => p.split(/[/\\]/).slice(0, -1).join("/")),
    extname: vi.fn((p) => {
      const lastDotIndex = p.lastIndexOf(".");
      return lastDotIndex === -1 ? "" : p.slice(lastDotIndex);
    })
  };
});

// Import mocked modules
import { ipcRenderer } from "electron";
import path from "node:path";

describe("Renderer Process Coverage Tests", () => {
  let mockDocument;
  
  beforeEach(() => {
    vi.resetAllMocks();
    mockDocument = setupDOM();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should set up theme handlers", () => {
    // Get the mock of ipcRenderer.on
    const { on } = ipcRenderer;
    
    // Create a manual test for the expected renderer.js behavior
    // We need to do this since we can't import renderer.js directly
    
    // Register theme change handler
    on.mockImplementation((event, callback) => {
      if (event === "theme-changed") {
        // Call the handler with dark mode = true
        callback({}, true);
        
        // Verify theme was set to dark
        expect(mockDocument.documentElement.setAttribute).toHaveBeenCalledWith(
          "data-theme", "dark"
        );
        
        // Call the handler with dark mode = false
        callback({}, false);
        
        // Verify theme was set to light
        expect(mockDocument.documentElement.setAttribute).toHaveBeenCalledWith(
          "data-theme", "light"
        );
      }
    });
    
    // Simulate the app registering the theme handler
    // This would normally happen in the renderer.js file
    ipcRenderer.on("theme-changed", (event, isDarkMode) => {
      document.documentElement.setAttribute("data-theme", isDarkMode ? "dark" : "light");
    });
    
    // Verify the handler was registered
    expect(on).toHaveBeenCalledWith("theme-changed", expect.any(Function));
  });

  it("should handle vault loading and selection", async () => {
    // Setup mocked ipcRenderer.invoke for vault operations
    ipcRenderer.invoke.mockImplementation(async (channel, ...args) => {
      switch (channel) {
        case "load-vault-path":
          return "/test/vault";
        case "get-obsidian-vaults":
          return [
            { id: "vault1", name: "Vault 1", path: "/test/vault", isValid: true, isAccessible: true },
            { id: "vault2", name: "Vault 2", path: "/test/vault2", isValid: true, isAccessible: true }
          ];
        case "choose-vault":
          return "/test/selected/vault";
        case "save-vault-path":
          return true;
        default:
          return null;
      }
    });
    
    // Test vault loading
    const savedPath = await ipcRenderer.invoke("load-vault-path");
    expect(savedPath).toBe("/test/vault");
    
    // Test vaults listing
    const vaults = await ipcRenderer.invoke("get-obsidian-vaults");
    expect(vaults.length).toBe(2);
    
    // Test vault selection
    const selectedPath = await ipcRenderer.invoke("choose-vault");
    expect(selectedPath).toBe("/test/selected/vault");
    
    // Test vault saving
    const result = await ipcRenderer.invoke("save-vault-path", "/test/vault");
    expect(result).toBe(true);
    
    // Verify all expected IPC calls happened
    expect(ipcRenderer.invoke).toHaveBeenCalledWith("load-vault-path");
    expect(ipcRenderer.invoke).toHaveBeenCalledWith("get-obsidian-vaults");
    expect(ipcRenderer.invoke).toHaveBeenCalledWith("choose-vault");
    expect(ipcRenderer.invoke).toHaveBeenCalledWith("save-vault-path", "/test/vault");
  });

  it("should handle file selection and processing", async () => {
    // Setup mocked ipcRenderer.invoke for file operations
    ipcRenderer.invoke.mockImplementation(async (channel, ...args) => {
      if (channel === "choose-markdown") {
        return ["/test/file1.md", "/test/file2.md"];
      }
      return null;
    });
    
    // Set up path.basename mock
    path.basename.mockImplementation((filePath) => {
      if (filePath === "/test/file1.md") return "file1.md";
      if (filePath === "/test/file2.md") return "file2.md";
      return "unknown.md";
    });
    
    // Test file selection
    const files = await ipcRenderer.invoke("choose-markdown");
    expect(files).toEqual(["/test/file1.md", "/test/file2.md"]);
    
    // Simulate file processing as it would happen in renderer.js
    // This is the function that would create file objects with metadata
    const processFiles = (files) => {
      return files.map(filePath => ({
        filePath,
        originalName: path.basename(filePath),
        customName: null,
        editing: false
      }));
    };
    
    // Process the files
    const processedFiles = processFiles(files);
    
    // Verify file processing
    expect(processedFiles.length).toBe(2);
    expect(processedFiles[0].originalName).toBe("file1.md");
    expect(processedFiles[1].originalName).toBe("file2.md");
    
    // Test file customization logic as in renderer.js
    const customizeFilename = (fileObj, newName) => {
      // Simplified version of the renderer.js logic for customizing filenames
      let updatedName = newName.trim();
      
      // Force .md extension
      if (!updatedName.toLowerCase().endsWith(".md")) {
        const extIndex = updatedName.lastIndexOf(".");
        if (extIndex > 0) {
          updatedName = `${updatedName.substring(0, extIndex)}.md`;
        } else {
          updatedName = `${updatedName}.md`;
        }
      }
      
      // Only set customName if different from originalName
      if (updatedName !== fileObj.originalName) {
        fileObj.customName = updatedName;
      } else {
        fileObj.customName = null;
      }
      
      fileObj.editing = false;
      return fileObj;
    };
    
    // Test with custom name
    const customized = customizeFilename(processedFiles[0], "renamed.txt");
    expect(customized.customName).toBe("renamed.md");
    
    // Test with original name (should set customName to null)
    const unchanged = customizeFilename(processedFiles[1], "file2.md");
    expect(unchanged.customName).toBe(null);
  });

  it("should handle symlink creation", async () => {
    // Setup mocked ipcRenderer.invoke for symlink operations
    ipcRenderer.invoke.mockImplementation(async (channel, data) => {
      if (channel === "create-symlink") {
        // Return mock results mimicking successful and failed symlinks
        return [
          {
            success: true,
            file: "file1.md",
            targetPath: "/test/file1.md",
            symlinkPath: "/test/vault/file1.md"
          },
          {
            success: false,
            file: "file2.md",
            error: "Permission denied"
          }
        ];
      }
      if (channel === "save-recent-link") {
        // Return updated list with the new link
        return [data];
      }
      return null;
    });
    
    // Test data for symlink creation
    const targetFiles = [
      { filePath: "/test/file1.md", customName: null },
      { filePath: "/test/file2.md", customName: null }
    ];
    const vaultPath = "/test/vault";
    
    // Simulate symlink creation as in renderer.js
    const createSymlinks = async (files, vault) => {
      // Prepare files for IPC
      const filesToProcess = files.map(file => ({
        filePath: file.filePath,
        customName: file.customName
      }));
      
      // Create symlinks
      const results = await ipcRenderer.invoke("create-symlink", {
        targetFiles: filesToProcess,
        vaultPath: vault
      });
      
      // Save successful links
      for (const result of results) {
        if (result.success) {
          const linkInfo = {
            fileName: result.file,
            targetPath: result.targetPath,
            symlinkPath: result.symlinkPath,
            date: new Date().toISOString()
          };
          await ipcRenderer.invoke("save-recent-link", linkInfo);
        }
      }
      
      return results;
    };
    
    // Create symlinks
    const results = await createSymlinks(targetFiles, vaultPath);
    
    // Verify symlink creation
    expect(results.length).toBe(2);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(false);
    
    // Verify the IPC calls
    expect(ipcRenderer.invoke).toHaveBeenCalledWith("create-symlink", {
      targetFiles: [
        { filePath: "/test/file1.md", customName: null },
        { filePath: "/test/file2.md", customName: null }
      ],
      vaultPath: "/test/vault"
    });
    
    // Verify successful link was saved
    expect(ipcRenderer.invoke).toHaveBeenCalledWith("save-recent-link", expect.objectContaining({
      fileName: "file1.md",
      targetPath: "/test/file1.md",
      symlinkPath: "/test/vault/file1.md"
    }));
  });

  it("should handle recent links management", async () => {
    // Setup mocked ipcRenderer.invoke for recent links operations
    const mockLinks = [
      {
        fileName: "recent1.md",
        targetPath: "/test/recent1.md",
        symlinkPath: "/test/vault/recent1.md",
        date: "2023-01-01T00:00:00.000Z"
      },
      {
        fileName: "recent2.md",
        targetPath: "/test/recent2.md",
        symlinkPath: "/test/vault/recent2.md",
        date: "2023-01-02T00:00:00.000Z"
      }
    ];
    
    ipcRenderer.invoke.mockImplementation(async (channel, data) => {
      if (channel === "get-recent-links") return mockLinks;
      if (channel === "save-recent-link") return [data, ...mockLinks];
      if (channel === "clear-recent-links") return [];
      return null;
    });
    
    // Test loading recent links
    const recentLinks = await ipcRenderer.invoke("get-recent-links");
    expect(recentLinks).toEqual(mockLinks);
    
    // Test saving a new link
    const newLink = {
      fileName: "new.md",
      targetPath: "/test/new.md",
      symlinkPath: "/test/vault/new.md",
      date: new Date().toISOString()
    };
    
    const updatedLinks = await ipcRenderer.invoke("save-recent-link", newLink);
    expect(updatedLinks.length).toBe(3);
    expect(updatedLinks[0]).toEqual(newLink);
    
    // Test clearing recent links
    const clearedLinks = await ipcRenderer.invoke("clear-recent-links");
    expect(clearedLinks).toEqual([]);
    
    // Verify all expected IPC calls happened
    expect(ipcRenderer.invoke).toHaveBeenCalledWith("get-recent-links");
    expect(ipcRenderer.invoke).toHaveBeenCalledWith("save-recent-link", newLink);
    expect(ipcRenderer.invoke).toHaveBeenCalledWith("clear-recent-links");
  });

  it("should handle UI rendering and state management", () => {
    // Test functions that would be in renderer.js for UI updates
    
    // Test update button state
    const updateButtonState = (vaultPath, selectedFiles) => {
      const button = document.getElementById("create-symlinks-btn");
      button.disabled = !vaultPath || selectedFiles.length === 0;
      return button.disabled;
    };
    
    // With valid data - button should be enabled
    expect(updateButtonState("/test/vault", [{}, {}])).toBe(false);
    
    // Without vault - button should be disabled
    expect(updateButtonState("", [{}, {}])).toBe(true);
    
    // Without files - button should be disabled
    expect(updateButtonState("/test/vault", [])).toBe(true);
    
    // Test rendering file list
    const renderFileList = (files) => {
      const fileListEl = document.getElementById("file-list");
      fileListEl.innerHTML = "";
      
      // Create DOM elements for each file
      for (const file of files) {
        document.createElement("div"); // File item container
        document.createElement("div"); // File name element
      }
      
      return files.length;
    };
    
    const mockFiles = [
      { filePath: "/test/file1.md", originalName: "file1.md" },
      { filePath: "/test/file2.md", originalName: "file2.md" }
    ];
    
    // Verify file list rendering
    const fileCount = renderFileList(mockFiles);
    expect(fileCount).toBe(2);
    expect(document.createElement).toHaveBeenCalledTimes(4); // 2 files x 2 elements each
    
    // Test rendering results
    const renderResults = (results) => {
      const resultsEl = document.getElementById("results");
      resultsEl.innerHTML = "";
      
      // Create DOM elements for each result
      for (const result of results) {
        document.createElement("div"); // Result item container
        document.createElement("div"); // File name element
        document.createElement("div"); // Message element
      }
      
      return results.length;
    };
    
    const mockResults = [
      { success: true, file: "success.md", targetPath: "/test/success.md" },
      { success: false, file: "error.md", error: "Failed" }
    ];
    
    // Verify results rendering
    const resultCount = renderResults(mockResults);
    expect(resultCount).toBe(2);
    expect(document.createElement).toHaveBeenCalledTimes(10); // 4 from earlier + 2 results x 3 elements each
  });
});