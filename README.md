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