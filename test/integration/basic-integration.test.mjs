import { describe, expect, it } from "vitest";
import path from "node:path";
import * as fs from "node:fs";
import { fileURLToPath } from "node:url";

// Get the project root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..", "..");

describe("Basic Integration Tests", () => {
  it("should be able to access project files", () => {
    // Check if package.json exists
    const packageJsonPath = path.join(projectRoot, "package.json");
    expect(fs.existsSync(packageJsonPath)).toBe(true);
    
    // Read and parse package.json
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
    expect(packageJson.name).toBe("obsidian-symlinker");
  });
  
  it("should verify main source files exist", () => {
    const mainJsPath = path.join(projectRoot, "src", "main.js");
    const rendererJsPath = path.join(projectRoot, "src", "renderer.js");
    const utilsJsPath = path.join(projectRoot, "src", "utils.js");
    
    expect(fs.existsSync(mainJsPath)).toBe(true);
    expect(fs.existsSync(rendererJsPath)).toBe(true);
    expect(fs.existsSync(utilsJsPath)).toBe(true);
  });
  
  it("should verify integration between utils and main modules", () => {
    // This is a basic integration test that doesn't require executing the code
    // Just check that the import statements correctly reference each other
    
    const mainJsContent = fs.readFileSync(path.join(projectRoot, "src", "main.js"), "utf-8");
    const utilsImportRegex = /import\s+\{\s*(?:.*?normalizeP.*?|.*?validateP.*?)\s*\}\s+from\s+(['"])\.\/utils\.js\1/;
    
    expect(utilsImportRegex.test(mainJsContent)).toBe(true);
  });
});