# JS REPL - JavaScript Playground

A powerful Electron-based JavaScript REPL (Read-Eval-Print Loop) application that mimics the functionality of RunJS. This app provides a modern code editor with real-time JavaScript execution, console logging, and comprehensive output display.

## Features

- **Monaco Editor Integration**: Full-featured code editor with syntax highlighting, IntelliSense, and modern editing features
- **Real-time Code Execution**: Execute JavaScript code with Ctrl+Enter or the Run button
- **Line Number Tracking**: All console outputs and errors show the exact line number that generated them
- **Interactive Output**: Click on any output item to jump directly to the corresponding line in the editor
- **Console Logging**: All console.log, console.error, console.warn, and console.info outputs are captured and displayed
- **Return Value Display**: Function return values are automatically displayed in the output panel
- **Async/Await Support**: Full support for asynchronous JavaScript code
- **Modern UI**: Clean, dark-themed interface similar to modern code editors
- **Error Handling**: Comprehensive error reporting with stack traces and line numbers
- **Keyboard Shortcuts**: Convenient shortcuts for common operations
- **Safe Execution**: Code runs in a sandboxed VM environment

## Getting Started

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

## Keyboard Shortcuts

- `Ctrl+Enter` (or `Cmd+Enter` on Mac): Execute code
- `Ctrl+K` (or `Cmd+K` on Mac): Clear output
- `Ctrl+N` (or `Cmd+N` on Mac): New file
- Standard editor shortcuts: Ctrl+Z (undo), Ctrl+Y (redo), Ctrl+C (copy), etc.

## Usage

1. Write JavaScript code in the left editor panel
2. Press `Ctrl+Enter` or click the "Run" button to execute
3. View results, console outputs, and errors in the right output panel
4. **NEW**: Each output item shows the line number that generated it
5. **NEW**: Click on any output item to jump directly to that line in the editor
6. Use the "Clear" button to clear the output panel
7. Use the "New" button to start with a fresh editor

### Line Number Tracking

One of the key features of this REPL is precise line number tracking:

- Every `console.log()`, `console.error()`, `console.warn()`, and `console.info()` call shows which line generated the output
- Runtime errors display the exact line where the error occurred
- Click on any output item with a line number to automatically jump to that line in the editor
- The clicked line will be highlighted temporarily for easy identification

### Example Code

```javascript
// Line tracking demo
console.log('This will show it came from line 2');

function testFunction() {
    console.log('This shows it came from inside the function');
    return 'Function completed';
}

const result = testFunction();
console.log('Result:', result);

// Try an error to see line tracking for errors
// uncomment the next line:
// nonExistentFunction();
```

## Architecture

### Main Process (`main.js`)
- Creates the main application window
- Handles menu creation and IPC communication
- Manages code execution in a secure VM environment

### Renderer Process (`renderer.js`)
- Initializes Monaco Editor
- Handles user interactions and UI updates
- Communicates with main process for code execution

### Preload Script (`preload.js`)
- Provides secure bridge between renderer and main processes
- Exposes limited APIs for code execution and event handling

### VM Execution
- Uses `vm2` library for secure code execution
- Provides sandboxed environment with limited access
- Captures console outputs and return values

## Security

This application uses several security measures:

- **Context Isolation**: Renderer process runs in isolated context
- **No Node Integration**: Renderer cannot directly access Node.js APIs
- **Sandboxed Execution**: Code runs in VM2 sandbox with limited capabilities
- **Preload Bridge**: Secure communication bridge between processes

## Dependencies

### Main Dependencies
- `monaco-editor`: Advanced code editor
- `vm2`: Secure JavaScript VM for code execution

### Development Dependencies
- `electron`: Desktop application framework
- `electron-builder`: Application packaging and distribution

## Customization

### Adding New Console Methods
Edit the `sandbox.console` object in `main.js` to add new console methods.

### Modifying Editor Theme
Change the `theme` parameter in the Monaco Editor configuration in `renderer.js`.

### Adding Keyboard Shortcuts
Use `editor.addCommand()` in `renderer.js` to add new keyboard shortcuts.

## Building for Distribution

### Windows
```bash
npm run build-win
```

### All Platforms
```bash
npm run build
```

Built applications will be available in the `dist` folder.

## Troubleshooting

### Monaco Editor Not Loading
- Ensure all dependencies are installed: `npm install`
- Check that the Monaco Editor files are properly copied to `node_modules`

### Code Execution Errors
- Check the output panel for detailed error messages
- Ensure your code doesn't use restricted modules or APIs

### Performance Issues
- Large outputs may slow down the interface
- Use the "Clear" button regularly to maintain performance

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License - see the package.json file for details.

## Acknowledgments

- Inspired by RunJS application
- Built with Electron and Monaco Editor
- Uses VM2 for secure code execution
