# Obsidian Symlinker

A lightweight desktop application that creates symlinks in your Obsidian vault to external markdown files on your computer.

## Features

- Select your Obsidian vault folder
- Choose markdown files to symlink into your vault
- Create symlinks with a single click
- View recent symlinks
- Native look and feel with dark mode support

## Installation

### Prerequisites

- [Node.js](https://nodejs.org/en/) (v14 or higher)
- npm (comes with Node.js)

### Setup

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```

### Development

To run the application in development mode:

```bash
npm start
```

### Build

To build the application for your current platform:

```bash
npm run build
```

Platform-specific builds:

- macOS: `npm run package-mac`
- Windows: `npm run package-win`
- Linux: `npm run package-linux`

## Usage

1. Launch the application
2. Select your Obsidian vault folder
3. Choose the markdown files you want to symlink into your vault
4. Click "Create Symlinks"
5. The selected files will be symlinked into your Obsidian vault

## Notes

- On Windows, the app creates junction points instead of symbolic links to avoid requiring administrator privileges
- The app remembers your previously selected Obsidian vault
- Recent symlinks are saved for quick reference

## License

MIT

## Code Quality with Biome

This project uses [Biome](https://biomejs.dev/) for linting and formatting. Biome is a fast formatter and linter that helps maintain consistent code style across the project.

### Available Scripts

- `npm run lint` - Run Biome linting to check for code style issues
- `npm run format` - Format code with Biome
- `npm run check` - Run all Biome checks and fix automatically when possible

### Pre-commit Hooks

We use Husky and lint-staged to ensure code quality checks run before each commit. This helps maintain consistent code quality and prevents committing code with linting errors.

### Configuration

Biome configuration is located in the `biome.json` file at the project root. The configuration follows Biome's recommended defaults with minimal customizations
