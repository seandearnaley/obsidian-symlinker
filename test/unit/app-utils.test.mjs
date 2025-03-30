import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizePath, validatePath } from "../../src/utils.js";

// Setup mocks
vi.mock("node:fs", () => {
	return {
		default: {
			existsSync: vi.fn(),
			statSync: vi.fn(),
			readdirSync: vi.fn(),
			accessSync: vi.fn(),
			constants: { R_OK: 4 },
		},
		existsSync: vi.fn(),
		statSync: vi.fn(),
		readdirSync: vi.fn(),
		accessSync: vi.fn(),
		constants: { R_OK: 4 },
	};
});

// Import fs after mocking it
import fs from "node:fs";

// Reset mocks before each test
beforeEach(() => {
	vi.resetAllMocks();
});

describe("App Utils", () => {
	describe("normalizePath", () => {
		it("should keep normal paths unchanged", () => {
			const path = "/test/path";
			expect(normalizePath(path)).toBe(path);
		});

		it("should normalize file:// URLs", () => {
			const result = normalizePath("file:///test/path");
			expect(result).toBe("/test/path");
		});

		it("should decode URI components in file path", () => {
			const result = normalizePath("file:///test/path%20with%20spaces");
			expect(result).toBe("/test/path with spaces");
		});
	});

	describe("validatePath", () => {
		it("should return isValid=false if path does not exist", () => {
			fs.existsSync.mockReturnValue(false);

			const result = validatePath("/non/existent/path");
			expect(result.isValid).toBe(false);
			expect(result.isAccessible).toBe(false);
		});

		it("should return isValid=true and isAccessible=true for accessible directory", () => {
			fs.existsSync.mockReturnValue(true);
			fs.statSync.mockReturnValue({ isDirectory: () => true });
			fs.readdirSync.mockReturnValue(["file1", "file2"]);

			const result = validatePath("/accessible/directory");
			expect(result.isValid).toBe(true);
			expect(result.isAccessible).toBe(true);
		});

		it("should return isValid=true and isAccessible=true for accessible file", () => {
			fs.existsSync.mockReturnValue(true);
			fs.statSync.mockReturnValue({ isDirectory: () => false });

			const result = validatePath("/accessible/file.txt");
			expect(result.isValid).toBe(true);
			expect(result.isAccessible).toBe(true);
		});

		it("should return isValid=true but isAccessible=false for inaccessible directory", () => {
			fs.existsSync.mockReturnValue(true);
			fs.statSync.mockReturnValue({ isDirectory: () => true });
			fs.readdirSync.mockImplementation(() => {
				throw new Error("Permission denied");
			});

			const result = validatePath("/inaccessible/directory");
			expect(result.isValid).toBe(true);
			expect(result.isAccessible).toBe(false);
		});
	});
});
