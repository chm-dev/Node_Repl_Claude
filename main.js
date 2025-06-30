const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const vm = require('vm');

let mainWindow;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    show: false,
    titleBarStyle: 'default'
  });

  // Load the app
  mainWindow.loadFile('index.html');

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open DevTools in development
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

// Create application menu
function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow.webContents.send('menu-new');
          }
        },
        {
          label: 'Clear Output',
          accelerator: 'CmdOrCtrl+K',
          click: () => {
            mainWindow.webContents.send('menu-clear');
          }
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectall' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Run',
      submenu: [
        {
          label: 'Run Code',
          accelerator: 'CmdOrCtrl+Enter',
          click: () => {
            mainWindow.webContents.send('menu-run');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Handle code execution
ipcMain.handle('execute-code', async (event, code) => {
  try {
    let currentLineNumber = 1;
    
    // Function to create console method with line tracking
    const createConsoleMethod = (type) => {
      return (...args) => {        
        event.sender.send('console-output', {
          type: `console-${type}`,
          args: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)),
          lineNumber: currentLineNumber
        });
      };
    };

    // Create a line tracker function
    const setCurrentLine = (lineNum) => {
      currentLineNumber = lineNum;
    };

    // Create a new context for code execution
    const sandbox = {
      console: {
        log: createConsoleMethod('log'),
        error: createConsoleMethod('error'),
        warn: createConsoleMethod('warn'),
        info: createConsoleMethod('info')
      },
      __setLine: setCurrentLine, // Internal line tracking function
      setTimeout: (callback, delay) => setTimeout(callback, Math.min(delay, 5000)), // Max 5 second timeout
      setInterval: (callback, delay) => setInterval(callback, Math.max(delay, 100)), // Min 100ms interval
      clearTimeout,
      clearInterval,
      Promise,
      Date,
      Math,
      JSON,
      parseInt,
      parseFloat,
      isNaN,
      isFinite,
      Array,
      Object,
      String,
      Number,
      Boolean,
      RegExp,
      Error,
      TypeError,
      ReferenceError,
      SyntaxError,
      // Add some utility functions
      fetch: require('node-fetch') // For async operations
    };

    // Instrument the code to add line tracking
    const instrumentCode = (code) => {
      const lines = code.split('\n');
      const instrumentedLines = [];
      
      for (let i = 0; i < lines.length; i++) {
        const lineNum = i + 1;
        const line = lines[i].trim();
        
        // Skip empty lines and comments
        if (line && !line.startsWith('//') && !line.startsWith('/*')) {
          instrumentedLines.push(`__setLine(${lineNum}); ${lines[i]}`);
        } else {
          instrumentedLines.push(lines[i]);
        }
      }
      
      return instrumentedLines.join('\n');
    };

    // Create VM context
    const context = vm.createContext(sandbox);

    // Instrument the code for line tracking
    const instrumentedCode = instrumentCode(code);

    // For async support, we need to handle promises properly
    const wrappedCode = `
(async () => {
${instrumentedCode}
})()
    `;

    // Execute the code
    const result = await vm.runInContext(wrappedCode, context, {
      timeout: 5000, // 5 second timeout
      displayErrors: true,
      filename: 'user-code.js', // This helps with stack traces
      lineOffset: 0 // Start from line 1
    });
    
    return {
      success: true,
      result: result,
      type: typeof result
    };
  } catch (error) {
    // Extract line number from error
    let lineNumber = null;
    if (error.stack) {
      const stackMatch = error.stack.match(/user-code\.js:(\d+):/);
      if (stackMatch) {
        lineNumber = Math.max(1, parseInt(stackMatch[1]) - 2); // Adjust for wrapper
      }
    }

    return {
      success: false,
      error: error.message,
      stack: error.stack,
      lineNumber: lineNumber
    };
  }
});

// App event handlers
app.whenReady().then(() => {
  createWindow();
  createMenu();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle app updates and other IPC events
ipcMain.on('app-version', (event) => {
  event.reply('app-version', app.getVersion());
});
