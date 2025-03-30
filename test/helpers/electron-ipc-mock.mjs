/**
 * Helper module to mock Electron IPC communications for testing
 */
import { vi } from "vitest";

/**
 * Create a mock of the Electron IPC renderer
 * @returns {Object} Mock of ipcRenderer
 */
export function createMockIpcRenderer() {
	const listeners = new Map();

	const mockIpcRenderer = {
		// For registering event listeners
		on: vi.fn((channel, listener) => {
			if (!listeners.has(channel)) {
				listeners.set(channel, []);
			}
			listeners.get(channel).push(listener);
		}),

		// For handling invocations
		invoke: vi.fn(),

		// For removing listeners
		removeListener: vi.fn((channel, listener) => {
			if (listeners.has(channel)) {
				const channelListeners = listeners.get(channel);
				const index = channelListeners.indexOf(listener);
				if (index > -1) {
					channelListeners.splice(index, 1);
				}
			}
		}),

		// For removing all listeners
		removeAllListeners: vi.fn((channel) => {
			if (channel) {
				listeners.delete(channel);
			} else {
				listeners.clear();
			}
		}),

		// Helper to trigger events for testing
		_emit: (channel, ...args) => {
			if (listeners.has(channel)) {
				for (const listener of listeners.get(channel)) {
					listener({}, ...args);
				}
			}
		},
	};

	return mockIpcRenderer;
}

/**
 * Create a mock of the Electron IPC main process
 * @returns {Object} Mock of ipcMain
 */
export function createMockIpcMain() {
	const handlers = new Map();
	const listeners = new Map();

	const mockIpcMain = {
		// For registering handlers
		handle: vi.fn((channel, handler) => {
			handlers.set(channel, handler);
		}),

		// For registering event listeners
		on: vi.fn((channel, listener) => {
			if (!listeners.has(channel)) {
				listeners.set(channel, []);
			}
			listeners.get(channel).push(listener);
		}),

		// For removing handlers
		removeHandler: vi.fn((channel) => {
			handlers.delete(channel);
		}),

		// For removing listeners
		removeListener: vi.fn((channel, listener) => {
			if (listeners.has(channel)) {
				const channelListeners = listeners.get(channel);
				const index = channelListeners.indexOf(listener);
				if (index > -1) {
					channelListeners.splice(index, 1);
				}
			}
		}),

		// For removing all listeners
		removeAllListeners: vi.fn((channel) => {
			if (channel) {
				listeners.delete(channel);
			} else {
				listeners.clear();
			}
		}),

		// Helper to invoke handlers for testing
		_invoke: async (channel, event = {}, ...args) => {
			if (handlers.has(channel)) {
				const handler = handlers.get(channel);
				return await handler(event, ...args);
			}
			throw new Error(`No handler registered for channel: ${channel}`);
		},

		// Helper to trigger events for testing
		_emit: (channel, ...args) => {
			if (listeners.has(channel)) {
				for (const listener of listeners.get(channel)) {
					listener({}, ...args);
				}
			}
		},
	};

	return mockIpcMain;
}

/**
 * Create a mock of the Electron dialog module
 * @returns {Object} Mock of dialog
 */
export function createMockDialog() {
	return {
		showOpenDialog: vi.fn(),
		showSaveDialog: vi.fn(),
		showMessageBox: vi.fn(),
	};
}

/**
 * Create a mock of the Electron BrowserWindow class
 * @returns {Function} Mock constructor for BrowserWindow
 */
export function createMockBrowserWindow() {
	const mockWindow = {
		loadFile: vi.fn(),
		loadURL: vi.fn(),
		webContents: {
			send: vi.fn(),
			on: vi.fn(),
		},
		on: vi.fn(),
		show: vi.fn(),
		close: vi.fn(),
		destroy: vi.fn(),
	};

	const mockConstructor = vi.fn(() => mockWindow);

	// Add static methods
	mockConstructor.getAllWindows = vi.fn(() => []);
	mockConstructor.getFocusedWindow = vi.fn(() => null);
	mockConstructor.fromId = vi.fn(() => null);

	return mockConstructor;
}

/**
 * Create a complete mock of the main Electron modules used in the app
 * @returns {Object} Mock Electron object
 */
export function createMockElectron() {
	return {
		app: {
			whenReady: vi.fn(() => Promise.resolve()),
			on: vi.fn(),
			quit: vi.fn(),
			exit: vi.fn(),
			getPath: vi.fn((name) => {
				const paths = {
					home: "/mock/home",
					appData: "/mock/appData",
					userData: "/mock/userData",
					temp: "/mock/temp",
					desktop: "/mock/desktop",
					documents: "/mock/documents",
				};
				return paths[name] || "/mock/unknown";
			}),
			getAppPath: vi.fn(() => "/mock/app"),
			getName: vi.fn(() => "Obsidian Symlinker"),
		},
		BrowserWindow: createMockBrowserWindow(),
		dialog: createMockDialog(),
		ipcMain: createMockIpcMain(),
		ipcRenderer: createMockIpcRenderer(),
		nativeTheme: {
			shouldUseDarkColors: false,
			on: vi.fn(),
		},
	};
}
