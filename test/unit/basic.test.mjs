import { describe, it, expect } from "vitest";

// Simple test to verify our testing setup works
describe("Basic Tests", () => {
  it("should correctly add numbers", () => {
    expect(1 + 1).toBe(2);
  });

  it("should correctly compare strings", () => {
    expect("hello").toBe("hello");
  });

  it("should correctly handle arrays", () => {
    const arr = [1, 2, 3];
    expect(arr).toContain(2);
    expect(arr).toHaveLength(3);
  });
});

// Testing a function similar to one in our utils.js but without requiring the actual module
describe("Path Normalization", () => {
  // Simple path normalizer function
  function normalizePath(path) {
    if (path.startsWith("file://")) {
      return decodeURI(path.replace(/^file:\/\//, ""));
    }
    return path;
  }

  it("should keep normal paths unchanged", () => {
    const path = "/Users/test/Documents/vault";
    expect(normalizePath(path)).toBe(path);
  });

  it("should normalize file:// URLs", () => {
    const path = "file:///Users/test/Documents/vault";
    expect(normalizePath(path)).toBe("/Users/test/Documents/vault");
  });

  it("should decode URI components in file paths", () => {
    const path = "file:///Users/test/Documents/My%20Vault";
    expect(normalizePath(path)).toBe("/Users/test/Documents/My Vault");
  });
});

describe("Basic Math Tests", () => {
  it("adds numbers correctly", () => {
    expect(1 + 1).toBe(2);
  });

  it("multiplies numbers correctly", () => {
    expect(2 * 3).toBe(6);
  });

  it("subtracts numbers correctly", () => {
    expect(5 - 2).toBe(3);
  });
});

describe("String Tests", () => {
  it("concatenates strings correctly", () => {
    expect("hello " + "world").toBe("hello world");
  });

  it("handles string methods correctly", () => {
    expect("hello world".toUpperCase()).toBe("HELLO WORLD");
  });
});

describe("Array Tests", () => {
  it("works with array methods", () => {
    const arr = [1, 2, 3];
    expect(arr.length).toBe(3);
    expect(arr.includes(2)).toBe(true);
    expect(arr.map((x) => x * 2)).toEqual([2, 4, 6]);
  });
});
