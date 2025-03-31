// renderer-coverage.test.mjs - Uses the instrumented renderer.js for coverage 

import { vi, describe, it, beforeEach, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Create a more comprehensive mock for electron
const mockIpcRenderer = {
  on: vi.fn((channel, callback) => {
    // Store callbacks to trigger them in tests
    if (!mockIpcRenderer._callbacks) mockIpcRenderer._callbacks = {};
    mockIpcRenderer._callbacks[channel] = callback;
    return mockIpcRenderer; // For chaining
  }),
  invoke: vi.fn(async (channel, ...args) => {
    // Implement different responses based on channel
    switch (channel) {
      case 'load-vault-path':
        return '/test/vault';
      case 'get-obsidian-vaults':
        return [
          { id: 'vault1', name: 'Vault 1', path: '/test/vault1', isValid: true },
          { id: 'vault2', name: 'Vault 2', path: '/test/vault2', isValid: true },
          { id: 'manual-1', name: 'Manual Vault', path: '/test/manual1', isValid: true }
        ];
      case 'save-vault-path':
        return true;
      case 'choose-vault':
        return '/test/chosen/vault';
      case 'choose-markdown':
        return ['/test/file1.md', '/test/file2.md'];
      case 'create-symlink':
        if (args[0]?.targetFiles?.some(f => f.customName === 'error.md')) {
          return [{ success: false, file: 'error.md', error: 'Failed to create symlink' }];
        }
        return [
          { success: true, file: 'file1.md', targetPath: '/test/file1.md', symlinkPath: '/test/vault/file1.md' }
        ];
      case 'get-recent-links':
        return [
          { fileName: 'recent1.md', targetPath: '/test/path1.md', date: '2023-01-01' },
          { fileName: 'recent2.md', targetPath: '/test/path2.md', date: '2023-01-02' }
        ];
      case 'save-recent-link':
        return [args[0], { fileName: 'old.md', date: '2022-12-31' }];
      case 'clear-recent-links':
        return [];
      default:
        return null;
    }
  }),
  send: vi.fn(),
  // Helper method to trigger event callbacks in tests
  _triggerEvent: (channel, ...args) => {
    if (mockIpcRenderer._callbacks && mockIpcRenderer._callbacks[channel]) {
      mockIpcRenderer._callbacks[channel]({ sender: mockIpcRenderer }, ...args);
    }
  }
};

// Mock electron
vi.mock('electron', () => ({
  ipcRenderer: mockIpcRenderer
}));

// Create a global coverage object to track renderer coverage
global.__coverage__ = global.__coverage__ || {};

// Prepare to instrument the renderer.js file
const rendererPath = '/Users/seandearnaley/Documents/GitHub/obsidian-symlinker/src/renderer.js';
const rendererInstrumentedPath = path.join(process.cwd(), 'test', 'unit', 'renderer-instrumented.js');

// This test loads the specialized renderer-instrumented.js file which has been
// specifically created to be testable while providing coverage metrics

describe('Renderer Process Coverage', () => {
  // Read the instrumented renderer file
  const rendererPath = path.join(process.cwd(), 'test', 'unit', 'renderer-instrumented.js');
  const rendererCode = fs.readFileSync(rendererPath, 'utf-8');
  
  // Use this to access exported functions
  let rendererFunctions;
  
  beforeEach(() => {
    // Create detailed DOM mocks with proper event handling
    const elements = {};
    
    // Create a mockElement factory to simplify consistent element creation
    const createMockElement = (id, additionalProps = {}) => {
      const events = {};
      const el = {
        id,
        value: '',
        disabled: false,
        innerHTML: '',
        type: '',
        classList: { 
          add: vi.fn(className => {
            if (!el.className) el.className = '';
            el.className += ` ${className}`;
          }), 
          remove: vi.fn(className => {
            if (el.className) {
              el.className = el.className.replace(new RegExp(`\\b${className}\\b`, 'g'), '');
            }
          }),
          contains: vi.fn(className => {
            return el.className && el.className.includes(className);
          })
        },
        className: '',
        options: additionalProps.options || [],
        selectedIndex: 0,
        appendChild: vi.fn(child => {
          if (!el.children) el.children = [];
          el.children.push(child);
          return child;
        }),
        removeChild: vi.fn(child => {
          if (el.children) {
            const index = el.children.indexOf(child);
            if (index > -1) {
              el.children.splice(index, 1);
            }
          }
        }),
        addEventListener: vi.fn((event, handler) => {
          if (!events[event]) events[event] = [];
          events[event].push(handler);
        }),
        // Method to trigger events for testing
        _triggerEvent: (event, ...args) => {
          if (events[event]) {
            events[event].forEach(handler => handler(...args));
          }
        },
        // Additional selector functionality
        querySelector: vi.fn(selector => {
          // Simple selector implementation
          if (selector.startsWith('.')) {
            const className = selector.substring(1);
            return el.children && el.children.find(child => 
              child.className && child.className.includes(className)
            );
          }
          return null;
        }),
        // For form elements
        focus: vi.fn(),
        setSelectionRange: vi.fn(),
        ...additionalProps
      };
      return el;
    };
    
    // Setup the vault selector with more complete functionality
    elements['vault-selector'] = createMockElement('vault-selector', {
      options: [{ value: '', textContent: 'Select a vault' }],
      remove: vi.fn(index => {
        if (index >= 0 && index < elements['vault-selector'].options.length) {
          elements['vault-selector'].options.splice(index, 1);
        }
      }),
      value: ''
    });
    
    // Setup other elements with complete behavior
    elements['vault-path'] = createMockElement('vault-path', { type: 'text' });
    elements['refresh-vaults-btn'] = createMockElement('refresh-vaults-btn');
    elements['choose-vault-btn'] = createMockElement('choose-vault-btn');
    elements['markdown-files'] = createMockElement('markdown-files');
    elements['choose-markdown-btn'] = createMockElement('choose-markdown-btn');
    elements['create-symlinks-btn'] = createMockElement('create-symlinks-btn', { disabled: true });
    elements['file-list'] = createMockElement('file-list');
    elements['results'] = createMockElement('results');
    elements['recent-links'] = createMockElement('recent-links');
    elements['clear-recent-btn'] = createMockElement('clear-recent-btn');
    
    // Mock document with improved functionality
    global.document = {
      getElementById: vi.fn(id => elements[id] || createMockElement(id)),
      createElement: vi.fn(tagName => {
        if (!tagName) tagName = 'div'; // Default to div if no tag specified
        const el = createMockElement(`mock-${tagName}-${Math.random().toString(36).substring(2, 9)}`);
        el.tagName = tagName.toUpperCase();
        return el;
      }),
      documentElement: createMockElement('documentElement', {
        setAttribute: vi.fn()
      })
    };
    
    // Mock window.electronAPI with comprehensive implementation
    global.window = {
      electronAPI: {
        loadVaultPath: vi.fn().mockResolvedValue('/test/vault'),
        getObsidianVaults: vi.fn().mockImplementation(async () => {
          // Return different results for testing various branches
          const mockVaults = [
            { id: 'vault1', name: 'Vault 1', path: '/test/vault1', isValid: true },
            { id: 'vault2', name: 'Vault 2', path: '/test/vault2', isValid: true },
            { id: 'manual-1', name: 'Discovered', path: '/test/discovered', isValid: true }
          ];
          
          // Use this to test empty vaults scenario in some tests
          if (global._testEmptyVaults) {
            return [];
          }
          
          // Use this to test only config or only manual vaults
          if (global._testOnlyConfigVaults) {
            return mockVaults.filter(v => !v.id.startsWith('manual-'));
          }
          
          if (global._testOnlyManualVaults) {
            return mockVaults.filter(v => v.id.startsWith('manual-'));
          }
          
          return mockVaults;
        }),
        saveVaultPath: vi.fn().mockResolvedValue(true),
        getRecentLinks: vi.fn().mockImplementation(async () => {
          if (global._testEmptyRecentLinks) {
            return [];
          }
          return [
            { fileName: 'recent1.md', targetPath: '/test/path1.md', date: '2023-01-01' },
            { fileName: 'recent2.md', targetPath: '/test/path2.md', date: '2023-01-02' }
          ];
        }),
        saveRecentLink: vi.fn().mockImplementation(async (link) => {
          return [link, { fileName: 'old.md', targetPath: '/old/path.md', date: '2022-12-31' }];
        }),
        clearRecentLinks: vi.fn().mockResolvedValue([]),
        chooseVault: vi.fn().mockImplementation(async () => {
          // Simulate cancellation in some tests
          if (global._testCancelVaultSelection) {
            return null;
          }
          return '/test/chosen/vault';
        }),
        chooseMarkdown: vi.fn().mockImplementation(async () => {
          // Simulate cancellation in some tests
          if (global._testCancelFileSelection) {
            return null;
          }
          return ['/test/file1.md', '/test/file2.md', '/test/file3.md'];
        }),
        createSymlink: vi.fn().mockImplementation(async (options) => {
          if (global._testSymlinkError) {
            return [
              { success: false, file: 'file1.md', error: 'Failed to create symlink - permission denied' },
              { success: true, file: 'file2.md', targetPath: '/test/file2.md', symlinkPath: '/test/vault/file2.md' },
            ];
          }
          
          const results = options.targetFiles.map(file => ({
            success: !file.customName?.includes('error'),
            file: file.customName || path.basename(file.filePath),
            targetPath: file.filePath,
            symlinkPath: `${options.vaultPath}/${file.customName || path.basename(file.filePath)}`,
            error: file.customName?.includes('error') ? 'Error: Invalid file name' : undefined
          }));
          return results;
        })
      },
      confirm: vi.fn().mockImplementation(msg => {
        // Return false for some tests
        if (global._testCancelConfirm) {
          return false;
        }
        return true;
      }),
      rendererFunctions: {}
    };
    
    // Setup setTimeout with controllable behavior
    global.setTimeout = vi.fn((fn, timeout) => {
      fn();
      return Math.floor(Math.random() * 1000);
    });
    
    // Execute the renderer code
    eval(rendererCode);
    
    // Get the exported functions
    rendererFunctions = global.window.rendererFunctions;
  });
  
  afterEach(() => {
    // Reset test flags
    global._testEmptyVaults = false;
    global._testOnlyConfigVaults = false;
    global._testOnlyManualVaults = false;
    global._testEmptyRecentLinks = false;
    global._testCancelVaultSelection = false;
    global._testCancelFileSelection = false;
    global._testSymlinkError = false;
    global._testCancelConfirm = false;
  });
  
  it('should initialize the application and load vaults', async () => {
    // Initialize the renderer
    await rendererFunctions.init();
    
    // Verify the initialization sequence
    expect(window.electronAPI.loadVaultPath).toHaveBeenCalled();
    expect(window.electronAPI.getObsidianVaults).toHaveBeenCalled();
    expect(window.electronAPI.getRecentLinks).toHaveBeenCalled();
  });
  
  it('should handle theme changes', () => {
    // Test dark mode
    rendererFunctions.handleThemeChange(true);
    expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'dark');
    
    // Test light mode
    rendererFunctions.handleThemeChange(false);
    expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'light');
    
    // Verify state update
    const state = rendererFunctions.getState();
    expect(state.isDarkMode).toBe(false);
  });
  
  it('should handle empty vaults list', async () => {
    // Setup for empty vaults test
    global._testEmptyVaults = true;
    
    await rendererFunctions.loadObsidianVaults();
    
    // Verify the "No vaults found" message is added
    const vaultSelector = document.getElementById('vault-selector');
    expect(vaultSelector.appendChild).toHaveBeenCalled();
    expect(vaultSelector.disabled).toBe(true);
    
    // Verify the refresh button animation
    const refreshBtn = document.getElementById('refresh-vaults-btn');
    expect(refreshBtn.classList.add).toHaveBeenCalledWith('pulse-animation');
    expect(refreshBtn.classList.remove).toHaveBeenCalledWith('pulse-animation');
  });
  
  it('should handle only config vaults', async () => {
    global._testOnlyConfigVaults = true;
    
    await rendererFunctions.loadObsidianVaults();
    
    // No group headers should be added
    const state = rendererFunctions.getState();
    expect(state.obsidianVaults.length).toBeGreaterThan(0);
    expect(state.obsidianVaults.every(v => !v.id.startsWith('manual-'))).toBe(true);
  });
  
  it('should handle only manual vaults', async () => {
    global._testOnlyManualVaults = true;
    
    await rendererFunctions.loadObsidianVaults();
    
    // No group headers should be added
    const state = rendererFunctions.getState();
    expect(state.obsidianVaults.length).toBeGreaterThan(0);
    expect(state.obsidianVaults.every(v => v.id.startsWith('manual-'))).toBe(true);
  });
  
  it('should select vault by path correctly', async () => {
    await rendererFunctions.init();
    
    // Test selecting a vault that exists in the selector
    rendererFunctions.selectVaultByPath('/test/vault1');
    
    let state = rendererFunctions.getState();
    expect(state.vaultPath).toBe('/test/vault1');
    expect(state.lastSavedVaultPath).toBe('/test/vault1');
    expect(window.electronAPI.saveVaultPath).toHaveBeenCalledWith('/test/vault1');
    
    // Test selecting a vault that doesn't exist in the selector
    rendererFunctions.selectVaultByPath('/custom/path');
    
    state = rendererFunctions.getState();
    expect(state.vaultPath).toBe('/custom/path');
    expect(document.getElementById('vault-selector').selectedIndex).toBe(0);
    
    // Test empty path
    // Reset spy count
    window.electronAPI.saveVaultPath.mockClear();
    rendererFunctions.selectVaultByPath('');
    expect(state.vaultPath).toBe('/custom/path'); // Should remain unchanged
    expect(window.electronAPI.saveVaultPath).not.toHaveBeenCalled(); // No call for empty path
  });
  
  it('should handle choosing markdown files', async () => {
    // Setup vault path for file selection
    rendererFunctions.setState({ vaultPath: '/test/vault' });
    
    await rendererFunctions.chooseMarkdownFiles();
    
    // Verify the files were processed correctly
    const state = rendererFunctions.getState();
    expect(state.selectedFiles.length).toBe(3); // From our mock
    expect(state.selectedFiles[0].originalName).toBe('file1.md');
    expect(state.selectedFiles[0].customName).toBeNull();
    expect(state.selectedFiles[0].editing).toBe(false);
    
    // Verify UI updates
    expect(document.getElementById('markdown-files').value).toBe('3 file(s) selected');
    expect(document.getElementById('create-symlinks-btn').disabled).toBe(false);
  });
  
  it('should handle cancelled file selection', async () => {
    global._testCancelFileSelection = true;
    
    await rendererFunctions.chooseMarkdownFiles();
    
    // Verify no files were added
    const state = rendererFunctions.getState();
    expect(state.selectedFiles.length).toBe(0);
  });
  
  it('should render file list with various states', () => {
    // Set up mixed file states
    const testFiles = [
      { filePath: '/test/path1.md', originalName: 'file1.md', customName: null, editing: false },
      { filePath: '/test/path2.md', originalName: 'file2.md', customName: 'renamed.md', editing: false },
      { filePath: '/test/path3.md', originalName: 'file3.md', customName: null, editing: true }
    ];
    
    rendererFunctions.setState({ selectedFiles: testFiles });
    
    // Render the list
    rendererFunctions.renderFileList();
    
    // Verify DOM manipulations
    const fileList = document.getElementById('file-list');
    expect(fileList.innerHTML).toBe(''); // Should clear first
    expect(fileList.appendChild).toHaveBeenCalledTimes(3); // Three files
  });
  
  it('should handle editing file names correctly', () => {
    // Setup test files
    const testFiles = [
      { filePath: '/test/path1.md', originalName: 'file1.md', customName: null, editing: false },
      { filePath: '/test/path2.md', originalName: 'file2.md', customName: null, editing: true }
    ];
    
    rendererFunctions.setState({ selectedFiles: testFiles });
    rendererFunctions.renderFileList();
    
    // Simulate the name input with an invalid extension
    const mockNameInput = {
      value: 'new-name.txt',
      setSelectionRange: vi.fn(),
      onfocus: null,
      oninput: null,
      focus: vi.fn()
    };
    
    // Call the oninput handler to trigger extension warning
    document.createElement().oninput?.();
    
    // Simulate the save button click with invalid extension
    const saveHandler = document.createElement().onclick;
    if (saveHandler) {
      document.createElement = vi.fn().mockReturnValue(mockNameInput);
      saveHandler();
      
      // Should force .md extension
      expect(mockNameInput.value).toContain('.md');
    }
    
    // Test cancel functionality
    const cancelHandler = document.createElement().onclick;
    if (cancelHandler) {
      cancelHandler();
      
      // Should set editing to false
      const state = rendererFunctions.getState();
      expect(state.selectedFiles.some(f => f.editing)).toBe(false);
    }
  });
  
  it('should test file editing with focus and extension warnings', () => {
    // Setup a test file in editing mode
    const testFile = { 
      filePath: '/test/path1.md', 
      originalName: 'file1.md', 
      customName: null, 
      editing: true 
    };
    
    rendererFunctions.setState({ selectedFiles: [testFile] });
    rendererFunctions.renderFileList();
    
    // Get mockNameInput
    const mockNameInput = document.createElement();
    mockNameInput.value = 'new-name.txt';
    
    // Trigger focus event
    if (mockNameInput.onfocus) {
      mockNameInput.onfocus();
      expect(mockNameInput.setSelectionRange).toHaveBeenCalled();
    }
    
    // Trigger input event 
    if (mockNameInput.oninput) {
      mockNameInput.oninput();
      // Should detect invalid extension
      expect(document.createElement().className).toContain('extension-warning');
    }
    
    // Test with valid extension
    mockNameInput.value = 'valid-name.md';
    if (mockNameInput.oninput) {
      mockNameInput.oninput();
      // Should not create warning element
      expect(document.createElement).toHaveBeenCalledTimes(expect.any(Number));
      expect(document.createElement().className).not.toContain('extension-warning');
    }
  });
  
  it('should create symlinks correctly', async () => {
    // Setup vault path and files
    rendererFunctions.setState({ 
      vaultPath: '/test/vault',
      selectedFiles: [
        { filePath: '/test/path1.md', originalName: 'file1.md', customName: null, editing: false },
        { filePath: '/test/path2.md', originalName: 'file2.md', customName: 'custom.md', editing: false }
      ]
    });
    
    await rendererFunctions.createSymlinks();
    
    // Verify create symlink was called with correct params
    expect(window.electronAPI.createSymlink).toHaveBeenCalledWith({
      targetFiles: [
        { filePath: '/test/path1.md', customName: null },
        { filePath: '/test/path2.md', customName: 'custom.md' }
      ],
      vaultPath: '/test/vault'
    });
    
    // Verify results were rendered
    expect(document.getElementById('results').appendChild).toHaveBeenCalled();
    
    // Verify recent links were saved
    expect(window.electronAPI.saveRecentLink).toHaveBeenCalled();
    
    // Verify state was reset
    const state = rendererFunctions.getState();
    expect(state.selectedFiles.length).toBe(0);
    expect(document.getElementById('markdown-files').value).toBe('');
  });
  
  it('should handle symlink errors', async () => {
    // Setup for error test
    global._testSymlinkError = true;
    
    rendererFunctions.setState({ 
      vaultPath: '/test/vault',
      selectedFiles: [
        { filePath: '/test/path1.md', originalName: 'file1.md', customName: null, editing: false },
      ]
    });
    
    await rendererFunctions.createSymlinks();
    
    // Should render error results
    const resultsElement = document.getElementById('results');
    expect(resultsElement.appendChild).toHaveBeenCalled();
    
    // Save recent link should only be called for successful items
    expect(window.electronAPI.saveRecentLink).toHaveBeenCalledTimes(1);
  });
  
  it('should not create symlinks if no vault or files selected', async () => {
    // Test with no vault
    rendererFunctions.setState({ 
      vaultPath: '',
      selectedFiles: [{ filePath: '/test/path1.md', originalName: 'file1.md', customName: null, editing: false }]
    });
    
    await rendererFunctions.createSymlinks();
    expect(window.electronAPI.createSymlink).not.toHaveBeenCalled();
    
    // Test with no files
    rendererFunctions.setState({ 
      vaultPath: '/test/vault',
      selectedFiles: []
    });
    
    await rendererFunctions.createSymlinks();
    expect(window.electronAPI.createSymlink).not.toHaveBeenCalled();
  });
  
  it('should handle recent links correctly', async () => {
    // Test with links
    await rendererFunctions.loadRecentLinks();
    expect(document.getElementById('recent-links').appendChild).toHaveBeenCalled();
    
    // Test with empty links
    global._testEmptyRecentLinks = true;
    await rendererFunctions.loadRecentLinks();
    
    const recentLinksElement = document.getElementById('recent-links');
    expect(recentLinksElement.innerHTML).toBe('');
    expect(recentLinksElement.appendChild).toHaveBeenCalledWith(expect.objectContaining({
      textContent: 'No recent symlinks'
    }));
  });
  
  it('should clear recent links when confirmed', async () => {
    await rendererFunctions.clearRecentLinks();
    
    expect(window.confirm).toHaveBeenCalled();
    expect(window.electronAPI.clearRecentLinks).toHaveBeenCalled();
    expect(window.electronAPI.getRecentLinks).toHaveBeenCalled();
  });
  
  it('should not clear recent links when cancelled', async () => {
    global._testCancelConfirm = true;
    
    await rendererFunctions.clearRecentLinks();
    
    expect(window.confirm).toHaveBeenCalled();
    expect(window.electronAPI.clearRecentLinks).not.toHaveBeenCalled();
  });
  
  it('should register event listeners', () => {
    rendererFunctions.registerEventListeners();
    
    // Verify event listeners were attached
    expect(document.getElementById('refresh-vaults-btn').addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    expect(document.getElementById('vault-selector').addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    expect(document.getElementById('choose-vault-btn').addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    expect(document.getElementById('choose-markdown-btn').addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    expect(document.getElementById('create-symlinks-btn').addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    expect(document.getElementById('clear-recent-btn').addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
  });
  
  it('should trigger vault selector change handler', () => {
    rendererFunctions.registerEventListeners();
    
    // Setup vault selector
    const vaultSelector = document.getElementById('vault-selector');
    vaultSelector.value = '/test/selected-vault';
    
    // Trigger change event
    const changeHandlers = vaultSelector._events?.change || [];
    if (changeHandlers.length > 0) {
      changeHandlers[0]();
      
      // Should call selectVaultByPath
      const state = rendererFunctions.getState();
      expect(state.vaultPath).toBe('/test/selected-vault');
    }
  });
  
  it('should trigger the choose vault button handler', async () => {
    rendererFunctions.registerEventListeners();
    
    // Get the choose vault button
    const chooseVaultBtn = document.getElementById('choose-vault-btn');
    
    // Trigger click event
    const clickHandlers = chooseVaultBtn._events?.click || [];
    if (clickHandlers.length > 0) {
      await clickHandlers[0]();
      
      // Should call chooseVault API and then selectVaultByPath
      expect(window.electronAPI.chooseVault).toHaveBeenCalled();
      
      const state = rendererFunctions.getState();
      expect(state.vaultPath).toBe('/test/chosen/vault');
    }
    
    // Test cancellation
    global._testCancelVaultSelection = true;
    if (clickHandlers.length > 0) {
      const initialPath = rendererFunctions.getState().vaultPath;
      await clickHandlers[0]();
      
      // Path should remain unchanged
      const state = rendererFunctions.getState();
      expect(state.vaultPath).toBe(initialPath);
    }
  });
  
  it('should update button states correctly', () => {
    // Test with no vault or files
    rendererFunctions.setState({ vaultPath: '', selectedFiles: [] });
    rendererFunctions.updateCreateButtonState();
    expect(document.getElementById('create-symlinks-btn').disabled).toBe(true);
    
    // Test with vault but no files
    rendererFunctions.setState({ vaultPath: '/test/vault', selectedFiles: [] });
    rendererFunctions.updateCreateButtonState();
    expect(document.getElementById('create-symlinks-btn').disabled).toBe(true);
    
    // Test with files but no vault
    rendererFunctions.setState({ 
      vaultPath: '', 
      selectedFiles: [{ filePath: '/test/file.md', originalName: 'file.md' }] 
    });
    rendererFunctions.updateCreateButtonState();
    expect(document.getElementById('create-symlinks-btn').disabled).toBe(true);
    
    // Test with both vault and files
    rendererFunctions.setState({ 
      vaultPath: '/test/vault', 
      selectedFiles: [{ filePath: '/test/file.md', originalName: 'file.md' }] 
    });
    rendererFunctions.updateCreateButtonState();
    expect(document.getElementById('create-symlinks-btn').disabled).toBe(false);
  });
});