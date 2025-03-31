import { vi } from "vitest";

// Create a reusable mock for the Electron modules
export function createElectronMock() {
  // Mock the dialog module
  const dialog = {
    showOpenDialog: vi.fn(),
    showMessageBox: vi.fn(),
  };
  
  // Mock the ipcMain module
  const ipcMain = {
    handle: vi.fn(),
    on: vi.fn(),
    removeHandler: vi.fn(),
    removeAllListeners: vi.fn(),
  };
  
  // Mock the app module
  const app = {
    whenReady: vi.fn().mockResolvedValue(),
    on: vi.fn(),
    quit: vi.fn(),
    getAppPath: vi.fn().mockReturnValue("/mock/app/path"),
  };
  
  // Mock BrowserWindow
  const BrowserWindowMock = vi.fn().mockImplementation(() => ({
    loadFile: vi.fn(),
    on: vi.fn(),
    webContents: {
      on: vi.fn(),
      send: vi.fn(),
    },
  }));
  
  // Mock nativeTheme
  const nativeTheme = {
    on: vi.fn(),
    shouldUseDarkColors: false,
  };
  
  return {
    dialog,
    ipcMain,
    app,
    BrowserWindow: BrowserWindowMock,
    nativeTheme,
  };
}

// Create a reusable mock for the ipcRenderer module (used in renderer process)
export function createIpcRendererMock() {
  return {
    invoke: vi.fn(),
    on: vi.fn(),
    send: vi.fn(),
    removeListener: vi.fn(),
    removeAllListeners: vi.fn(),
  };
}

// Setup mock for electron-store
export function createElectronStoreMock() {
  const storeMock = {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    clear: vi.fn(),
    has: vi.fn(),
    path: "/mock/store/path",
  };
  
  // Default implementation for get
  storeMock.get.mockImplementation((key, defaultValue) => {
    if (key === "vaultPath") return "/mock/vault/path";
    if (key === "recentLinks") return [];
    return defaultValue;
  });
  
  // Constructor function
  const StoreMock = vi.fn().mockImplementation(() => storeMock);
  
  return StoreMock;
}

// Helper function to setup all common Electron mocks
export function setupElectronMocks() {
  const electronMock = createElectronMock();
  const electronStoreMock = createElectronStoreMock();
  
  vi.mock("electron", () => electronMock);
  vi.mock("electron-store", () => ({ default: electronStoreMock }));
  
  return {
    electron: electronMock,
    electronStore: electronStoreMock,
  };
}