import { describe, it, expect, vi, beforeEach } from "vitest";
import path from "node:path";

// Create mock functions that we'll use directly
const mockExistsSync = vi.fn();
const mockStatSync = vi.fn();
const mockReaddirSync = vi.fn();
const mockAccessSync = vi.fn();
const mockConstants = { R_OK: 4 };

// Create a utils module for tests
const utils = {
  validatePath(filePath) {
    let isValid = false;
    let isAccessible = false;

    try {
      isValid = mockExistsSync(filePath);
      if (isValid) {
        // Try to read directory to verify access permissions
        if (mockStatSync(filePath).isDirectory()) {
          mockReaddirSync(filePath);
        } else {
          // Try to read file
          mockAccessSync(filePath, mockConstants.R_OK);
        }
        isAccessible = true;
      }
    } catch (err) {
      console.log(
        `Path ${filePath} exists but may require elevated privileges:`,
        err.message
      );
      isAccessible = false;
    }

    return { isValid, isAccessible };
  },

  normalizePath(path) {
    if (path.startsWith("file://")) {
      return decodeURI(path.replace(/^file:\/\//, ""));
    }
    return path;
  },
};

describe("Utils Module", () => {
  beforeEach(() => {
    // Reset all mocks before each test
    mockExistsSync.mockReset();
    mockStatSync.mockReset();
    mockReaddirSync.mockReset();
    mockAccessSync.mockReset();
  });

  describe("normalizePath", () => {
    it("should keep normal paths unchanged", () => {
      const testPath = "/Users/test/Documents/vault";
      expect(utils.normalizePath(testPath)).toBe(testPath);
    });

    it("should normalize file:// URLs", () => {
      const testPath = "file:///Users/test/Documents/vault";
      expect(utils.normalizePath(testPath)).toBe("/Users/test/Documents/vault");
    });

    it("should decode URI components in file paths", () => {
      const testPath = "file:///Users/test/Documents/My%20Vault";
      expect(utils.normalizePath(testPath)).toBe(
        "/Users/test/Documents/My Vault"
      );
    });
  });

  describe("validatePath", () => {
    it("should return isValid=false if path does not exist", () => {
      mockExistsSync.mockReturnValue(false);

      const result = utils.validatePath("/non/existent/path");

      expect(result).toEqual({ isValid: false, isAccessible: false });
      expect(mockExistsSync).toHaveBeenCalledWith("/non/existent/path");
    });

    it("should return isValid=true and isAccessible=true for accessible directory", () => {
      mockExistsSync.mockReturnValue(true);
      mockStatSync.mockReturnValue({ isDirectory: () => true });
      mockReaddirSync.mockReturnValue(["file1", "file2"]);

      const result = utils.validatePath("/accessible/directory");

      expect(result).toEqual({ isValid: true, isAccessible: true });
      expect(mockExistsSync).toHaveBeenCalledWith("/accessible/directory");
      expect(mockReaddirSync).toHaveBeenCalledWith("/accessible/directory");
    });

    it("should return isValid=true and isAccessible=true for accessible file", () => {
      mockExistsSync.mockReturnValue(true);
      mockStatSync.mockReturnValue({ isDirectory: () => false });

      const result = utils.validatePath("/accessible/file.txt");

      expect(result).toEqual({ isValid: true, isAccessible: true });
      expect(mockExistsSync).toHaveBeenCalledWith("/accessible/file.txt");
      expect(mockAccessSync).toHaveBeenCalledWith("/accessible/file.txt", 4);
    });

    it("should return isValid=true but isAccessible=false for inaccessible directory", () => {
      mockExistsSync.mockReturnValue(true);
      mockStatSync.mockReturnValue({ isDirectory: () => true });
      mockReaddirSync.mockImplementation(() => {
        throw new Error("Permission denied");
      });

      const result = utils.validatePath("/inaccessible/directory");

      expect(result).toEqual({ isValid: true, isAccessible: false });
    });
  });
});
