# Enhanced JS REPL - JavaScript Playground with Node.js Support

A powerful Electron-based JavaScript REPL (Read-Eval-Print Loop) application that provides a comprehensive JavaScript development environment. This enhanced version includes Node.js modules support, advanced code instrumentation, and precise line tracking for professional JavaScript development.

## ✨ Features

### Core Features
- **Monaco Editor Integration**: Full-featured code editor with syntax highlighting, IntelliSense, and modern editing features
- **Real-time Code Execution**: Execute JavaScript code with Ctrl+Enter or the Run button
- **Precise Line Number Tracking**: All console outputs and errors show the exact line number that generated them
- **Interactive Output**: Click on any output item to jump directly to the corresponding line in the editor
- **Multi-line Statement Support**: Properly handles function calls and statements spanning multiple lines

### Console & Debugging
- **Enhanced Console Logging**: All console.log, console.error, console.warn, and console.info outputs are captured and displayed
- **Function Return Value Display**: Automatically displays return values from functions and expressions
- **Smart Output Filtering**: Require statements don't clutter output with large module objects
- **Error Handling**: Comprehensive error reporting with stack traces and precise line numbers

### Node.js Integration
- **Node.js Modules Support**: Access to popular Node.js built-in modules
- **Cross-platform Compatibility**: Works with Node.js APIs on Windows, macOS, and Linux
- **Safe Module Access**: Sandboxed execution with controlled access to system resources
- **Mock Fallbacks**: Graceful fallback to mock implementations when needed

### Advanced Features
- **Async/Await Support**: Full support for asynchronous JavaScript code and Promises
- **Code Instrumentation**: Advanced code analysis and execution tracking
- **VM Sandboxing**: Secure code execution environment
- **Modern UI**: Clean, dark-themed interface optimized for development

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Clone or download this repository
2. Navigate to the project directory
3. Install dependencies:

```bash
npm install
```

### Running the Application

#### Development Mode
```bash
npm run dev
```

#### Production Mode
```bash
npm start
```

#### Building the Application
```bash
npm run build
```

## ⌨️ Keyboard Shortcuts

- `Ctrl+Enter` (or `Cmd+Enter` on Mac): Execute code
- `Ctrl+K` (or `Cmd+K` on Mac): Clear output
- `Ctrl+N` (or `Cmd+N` on Mac): New file
- Standard editor shortcuts: Ctrl+Z (undo), Ctrl+Y (redo), Ctrl+C (copy), etc.

## 💻 Usage

1. Write JavaScript code in the left editor panel
2. Press `Ctrl+Enter` or click the "Run" button to execute
3. View results, console outputs, and errors in the right output panel
4. **Enhanced**: Each output item shows the precise line number that generated it
5. **Interactive**: Click on any output item to jump directly to that line in the editor
6. Use the "Clear" button to clear the output panel
7. Use the "New" button to start with a fresh editor

### 🎯 Precision Line Number Tracking

One of the standout features is ultra-precise line number tracking:

- Every `console.log()`, `console.error()`, `console.warn()`, and `console.info()` call shows which line generated the output
- **Fixed**: Statements inside try-catch blocks now show correct line numbers
- **Enhanced**: Multi-line function calls are properly handled
- Runtime errors display the exact line where the error occurred
- Click on any output item with a line number to automatically jump to that line in the editor
- The clicked line will be highlighted temporarily for easy identification

### 🔧 Node.js Modules Support

Access popular Node.js built-in modules directly in your code:

#### Supported Modules:
- **`os`**: Operating system utilities (platform, arch, cpus, memory info, etc.)
- **`path`**: File and directory path utilities
- **`crypto`**: Cryptographic functionality (hashing, random bytes, UUIDs)
- **`util`**: Utility functions (formatting, inspection, type checking)
- **`fs`**: File system operations (limited to safe read operations)
- **`url`**: URL parsing and formatting
- **`querystring`**: Query string utilities

#### Process Object:
Access `process` global with version info, platform details, and environment data.

### 📝 Example Code

```javascript
// Node.js modules demo
try {
  const os = require("os");
  const path = require("path");
  const crypto = require("crypto");

  console.log("Platform:", os.platform());
  console.log("Node version:", process.version);
  console.log("Home directory:", os.homedir());
  console.log("Path join:", path.join("/users", "documents", "file.txt"));
  console.log("Random UUID:", crypto.randomUUID());
} catch (error) {
  console.log("Error:", error.message);
}

// Multi-line function calls work perfectly
console.log(
  "Sum:",
  [1, 2, 3, 4, 5].reduce(
    (acc, num) => acc + num,
    0
  )
);

// Function with return value tracking
function calculateArea(width, height) {
    console.log('Calculating area...');
    return width * height;  // Return value will be displayed
}

const area = calculateArea(10, 5);
console.log('Area:', area);

// Async/await support
async function fetchData() {
    await new Promise(resolve => setTimeout(resolve, 100));
    return "Data loaded!";
}

const result = await fetchData();
console.log(result);
```

## 🏗️ Architecture

### Main Process (`main.js`)
- Creates the main application window
- Handles menu creation and IPC communication
- **Enhanced**: Manages secure code execution with Node.js modules support
- **Advanced**: Code instrumentation for precise line tracking
- **Smart**: Filters out noisy require() statement outputs

### Renderer Process (`renderer.js`)
- Initializes Monaco Editor with enhanced configuration
- Handles user interactions and UI updates
- **Interactive**: Click-to-navigate functionality for output items
- Communicates with main process for secure code execution

### Preload Script (`preload.js`)
- Provides secure bridge between renderer and main processes
- Exposes limited APIs for code execution and event handling
- Maintains security while enabling powerful features

### VM Execution Environment
- **Secure**: Uses Node.js VM module for sandboxed execution
- **Enhanced**: Custom require() function for Node.js modules
- **Smart**: Mock fallbacks for unavailable modules
- **Controlled**: Limited system access for security
- **Advanced**: Multi-line statement and async/await support

## 🔒 Security

This application implements multiple layers of security:

- **Context Isolation**: Renderer process runs in completely isolated context
- **No Direct Node Integration**: Renderer cannot directly access Node.js APIs
- **Sandboxed Execution**: Code runs in VM sandbox with controlled module access
- **Secure Bridge**: All communication through secure preload script
- **Limited System Access**: File system and process access is restricted
- **Safe Module Loading**: Only approved Node.js modules are accessible

## 📦 Dependencies

### Main Dependencies
- `monaco-editor`: Advanced code editor with IntelliSense
- `node-fetch`: HTTP client for async operations

### Development Dependencies
- `electron`: Cross-platform desktop application framework
- `electron-builder`: Application packaging and distribution tool

## 🛠️ Customization

### Adding New Node.js Modules
Edit the `createNodeModules()` and `createRequire()` functions in `main.js` to add support for additional Node.js modules.

### Modifying Console Output
Customize the `createConsoleMethod()` function in `main.js` to change how console outputs are formatted and displayed.

### Editor Customization
Change Monaco Editor settings in `renderer.js`:
- Theme: Modify the `theme` parameter
- Font: Adjust `fontSize` and font family
- Features: Enable/disable minimap, word wrap, etc.

### Adding Keyboard Shortcuts
Use `editor.addCommand()` in `renderer.js` to add new keyboard shortcuts for additional functionality.

## 📦 Building for Distribution

### Windows
```bash
npm run build-win
```

### All Platforms
```bash
npm run build
```

Built applications will be available in the `dist` folder with platform-specific installers.

## 🐛 Troubleshooting

### Monaco Editor Issues
- Ensure all dependencies are installed: `npm install`
- Check that Monaco Editor files are in `node_modules/monaco-editor`
- Verify no conflicting CSS or JavaScript

### Code Execution Problems
- Check output panel for detailed error messages with line numbers
- Verify Node.js modules are being used correctly
- Ensure async code uses proper await syntax

### Performance Optimization
- Use "Clear" button regularly for large outputs
- Avoid logging large objects (require() outputs are automatically filtered)
- Close DevTools when not needed

### Line Number Issues
- Multi-line statements are now properly supported
- Try-catch blocks show correct line numbers
- Click output items to navigate to source lines

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes with proper testing
4. Ensure all existing functionality works
5. Update documentation as needed
6. Submit a pull request with clear description

## 📄 License

This project is licensed under the MIT License - see the package.json file for details.

## 🙏 Acknowledgments

- Inspired by the RunJS application
- Built with Electron framework and Monaco Editor
- Enhanced with custom VM execution and Node.js integration
- Community feedback and contributions

## 🔄 Recent Updates

- ✅ **Node.js Modules Support**: Added support for os, path, crypto, util, fs, and more
- ✅ **Enhanced Line Tracking**: Fixed line number issues in try-catch blocks
- ✅ **Multi-line Support**: Proper handling of function calls spanning multiple lines
- ✅ **Smart Output Filtering**: Require statements no longer clutter output
- ✅ **Improved Error Handling**: Better error messages with precise line numbers
- ✅ **Interactive Navigation**: Click any output to jump to source line
