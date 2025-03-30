// Utility functions for the Obsidian Symlinker application

import fs from "node:fs";

/**
 * Determines if a path is valid and accessible
 * @param {string} filePath - The path to check
 * @returns {{isValid: boolean, isAccessible: boolean}} - Object with validation info
 */
export function validatePath(filePath) {
	let isValid = false;
	let isAccessible = false;

	try {
		isValid = fs.existsSync(filePath);
		if (isValid) {
			// Try to read directory to verify access permissions
			if (fs.statSync(filePath).isDirectory()) {
				fs.readdirSync(filePath);
			} else {
				// Try to read file
				fs.accessSync(filePath, fs.constants.R_OK);
			}
			isAccessible = true;
		}
	} catch (err) {
		console.log(`Path ${filePath} exists but may require elevated privileges:`, err.message);
		isAccessible = false;
	}

	return { isValid, isAccessible };
}

/**
 * Normalizes file paths, especially those from Obsidian config
 * @param {string} path - The path to normalize
 * @returns {string} - Normalized path
 */
export function normalizePath(path) {
	if (path.startsWith("file://")) {
		return decodeURI(path.replace(/^file:\/\//, ""));
	}
	return path;
}
