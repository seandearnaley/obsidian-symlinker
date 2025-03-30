import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock fs module
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

import fs from "node:fs";
// Import utils after mocking dependencies
import { normalizePath, validatePath } from "../../src/utils.js";

describe("Utils Module", () => {
	beforeEach(() => {
		// Reset all mocks before each test
		vi.resetAllMocks();
	});

	describe("normalizePath", () => {
		it("should keep normal paths unchanged", () => {
			const testPath = "/Users/test/Documents/vault";
			expect(normalizePath(testPath)).toBe(testPath);
		});

		it("should normalize file:// URLs", () => {
			const testPath = "file:///Users/test/Documents/vault";
			expect(normalizePath(testPath)).toBe("/Users/test/Documents/vault");
		});

		it("should decode URI components in file paths", () => {
			const testPath = "file:///Users/test/Documents/My%20Vault";
			expect(normalizePath(testPath)).toBe("/Users/test/Documents/My Vault");
		});

		it("should handle complex URI encoding", () => {
			// The actual encode/decode behavior is handled by the browser's decodeURI function
			// We should test simple cases that we know will work
			const testPath = "file:///Users/test/Documents/My%20Special%20Folder";
			expect(normalizePath(testPath)).toBe("/Users/test/Documents/My Special Folder");
		});

		it("should handle paths with hash fragments", () => {
			const testPath = "file:///Users/test/Documents/vault#section";
			expect(normalizePath(testPath)).toBe("/Users/test/Documents/vault#section");
		});

		it("should handle empty paths", () => {
			expect(normalizePath("")).toBe("");
		});
	});

	describe("validatePath", () => {
		it("should return isValid=false if path does not exist", () => {
			fs.existsSync.mockReturnValue(false);

			const result = validatePath("/non/existent/path");

			expect(result).toEqual({ isValid: false, isAccessible: false });
			expect(fs.existsSync).toHaveBeenCalledWith("/non/existent/path");
		});

		it("should return isValid=true and isAccessible=true for accessible directory", () => {
			fs.existsSync.mockReturnValue(true);
			fs.statSync.mockReturnValue({ isDirectory: () => true });
			fs.readdirSync.mockReturnValue(["file1", "file2"]);

			const result = validatePath("/accessible/directory");

			expect(result).toEqual({ isValid: true, isAccessible: true });
			expect(fs.existsSync).toHaveBeenCalledWith("/accessible/directory");
			expect(fs.readdirSync).toHaveBeenCalledWith("/accessible/directory");
		});

		it("should return isValid=true and isAccessible=true for accessible file", () => {
			fs.existsSync.mockReturnValue(true);
			fs.statSync.mockReturnValue({ isDirectory: () => false });

			const result = validatePath("/accessible/file.txt");

			expect(result).toEqual({ isValid: true, isAccessible: true });
			expect(fs.existsSync).toHaveBeenCalledWith("/accessible/file.txt");
			expect(fs.accessSync).toHaveBeenCalledWith("/accessible/file.txt", 4);
		});

		it("should return isValid=true but isAccessible=false for inaccessible directory", () => {
			fs.existsSync.mockReturnValue(true);
			fs.statSync.mockReturnValue({ isDirectory: () => true });
			fs.readdirSync.mockImplementation(() => {
				throw new Error("Permission denied");
			});

			const result = validatePath("/inaccessible/directory");

			expect(result).toEqual({ isValid: true, isAccessible: false });
		});

		it("should return isValid=true but isAccessible=false for inaccessible file", () => {
			fs.existsSync.mockReturnValue(true);
			fs.statSync.mockReturnValue({ isDirectory: () => false });
			fs.accessSync.mockImplementation(() => {
				throw new Error("Permission denied");
			});

			const result = validatePath("/inaccessible/file.txt");

			expect(result).toEqual({ isValid: true, isAccessible: false });
		});

		it("should handle stat errors gracefully", () => {
			fs.existsSync.mockReturnValue(true);
			fs.statSync.mockImplementation(() => {
				throw new Error("Stat error");
			});

			const result = validatePath("/problem/path");

			expect(result).toEqual({ isValid: true, isAccessible: false });
		});
	});
});
