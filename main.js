const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const vm = require('vm');

// Global persistent context for REPL
let globalContext = null;

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

// Initialize global persistent context
function initializeGlobalContext() {
  const Module = require('module');
  const fs = require('fs');
  
  // Function to create a simplified Node.js-like module system
  const createNodeModules = () => {
    const modules = new Map();
    
    // Add core modules
    modules.set('fs', fs);
    modules.set('path', path);
    modules.set('util', require('util'));
    modules.set('crypto', require('crypto'));
    modules.set('os', require('os'));
    
    return modules;
  };

  // Function to create a custom require function
  const createRequire = (nodeModules) => {
    return function customRequire(moduleName) {
      if (nodeModules.has(moduleName)) {
        return nodeModules.get(moduleName);
      }
      
      try {
        // Try to require the module normally for external packages
        return require(moduleName);
      } catch (error) {
        throw new Error(`Module '${moduleName}' not found`);
      }
    };
  };

  const nodeModules = createNodeModules();
  const requireFunction = createRequire(nodeModules);

  // Create the persistent sandbox
  const sandbox = {
    console: {}, // Will be filled in during execution
    __setLine: null, // Will be set during execution
    __logReturn: null, // Will be set during execution
    setTimeout: (callback, delay) => setTimeout(callback, Math.min(delay, 5000)),
    setInterval: (callback, delay) => setInterval(callback, Math.max(delay, 100)),
    clearTimeout,
    clearInterval,
    Promise,
    Date,
    Math,
    JSON,
    Object,
    Array,
    String,
    Number,
    Boolean,
    RegExp,
    Error,
    TypeError,
    ReferenceError,
    SyntaxError,
    Buffer,
    process: {
      versions: process.versions,
      platform: process.platform,
      arch: process.arch,
      env: { NODE_ENV: 'development' }
    },
    require: requireFunction,
    module: { exports: {} },
    exports: {},
    global: undefined,
    globalThis: undefined
  };

  // Set globalThis and global to reference the sandbox itself
  sandbox.global = sandbox;
  sandbox.globalThis = sandbox;

  globalContext = vm.createContext(sandbox);
  return globalContext;
}

// Function to reset the global context (clear all variables)
function resetGlobalContext() {
  globalContext = null;
  initializeGlobalContext();
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

    // Function to log function returns
    const logFunctionReturn = (functionName, returnValue, lineNumber) => {
      if (returnValue !== undefined) {
        event.sender.send('console-output', {
          type: 'function-return',
          args: [typeof returnValue === 'object' ? JSON.stringify(returnValue, null, 2) : String(returnValue)],
          lineNumber: lineNumber,
          functionName: functionName
        });
      }
    };

    // Initialize global context if it doesn't exist
    if (!globalContext) {
      initializeGlobalContext();
    }

    // Update the context with current execution-specific functions
    globalContext.console = {
      log: createConsoleMethod('log'),
      error: createConsoleMethod('error'),
      warn: createConsoleMethod('warn'),
      info: createConsoleMethod('info')
    };
    globalContext.__setLine = setCurrentLine;
    globalContext.__logReturn = logFunctionReturn;

    // Instrument the code to add line tracking
    const instrumentCode = (code) => {
      const lines = code.split('\n');
      const instrumentedLines = [];
      let buffer = [];
      let parenDepth = 0, braceDepth = 0, bracketDepth = 0;
      let inString = false, stringChar = '';
      let startLineNum = 1;

      function updateDepths(line) {
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          const prevChar = i > 0 ? line[i - 1] : '';
          if (!inString) {
            if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
              inString = true;
              stringChar = char;
            } else {
              if (char === '(') parenDepth++;
              else if (char === ')') parenDepth--;
              else if (char === '{') braceDepth++;
              else if (char === '}') braceDepth--;
              else if (char === '[') bracketDepth++;
              else if (char === ']') bracketDepth--;
            }
          } else {
            if (char === stringChar && prevChar !== '\\') {
              inString = false;
              stringChar = '';
            }
          }
        }
      }

      function isComplete() {
        return parenDepth === 0 && braceDepth === 0 && bracketDepth === 0 && !inString;
      }

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*')) {
          if (buffer.length === 0) instrumentedLines.push(line);
          else buffer.push(line);
          continue;
        }
        if (buffer.length === 0) startLineNum = i + 1;
        buffer.push(line);
        updateDepths(line);
        if (isComplete()) {
          const statement = buffer.join('\n');
          const trimmedStatement = statement.trim();
          let processed = statement;
          // Only instrument if not a block/control flow
          const isControlFlow = trimmedStatement.match(/^(try|catch|finally|if|else|for|while|do|switch|case|default|function|class|\}|\{)/) ||
                                trimmedStatement === '}' || trimmedStatement === '{';
          if (!isControlFlow) {
            processed = processStatement(statement, startLineNum);
            instrumentedLines.push(`__setLine(${startLineNum}); ${processed}`);
          } else {
            instrumentedLines.push(statement);
          }
          buffer = [];
          parenDepth = 0; braceDepth = 0; bracketDepth = 0; inString = false; stringChar = '';
        }
      }
      // If anything left in buffer, add as is
      if (buffer.length > 0) instrumentedLines.push(buffer.join('\n'));
      return instrumentedLines.join('\n');
    };
    
    // Helper function to check if a line starts a multi-line statement
    function isStartOfMultiLineStatement(line) {
      const trimmed = line.trim();
      // Don't treat console methods as multi-line statements that need instrumentation
      if (trimmed.startsWith('console.')) {
        return false;
      }
      // Check for function calls that might span multiple lines
      return trimmed.match(/^[a-zA-Z_$][a-zA-Z0-9_$]*\s*\(/) || // function calls
             trimmed.match(/^(const|let|var)\s+\w+\s*=.*\(/) || // variable assignments with function calls
             trimmed.match(/^\w+\s*=.*\(/); // reassignments with function calls
    }
    
    // Helper function to update bracket counts
    function updateBracketCounts(line, counts) {
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const prevChar = i > 0 ? line[i - 1] : '';
        
        if (!counts.inString) {
          if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
            counts.inString = true;
            counts.stringChar = char;
          } else {
            if (char === '(') counts.parenDepth++;
            else if (char === ')') counts.parenDepth--;
            else if (char === '{') counts.braceDepth++;
            else if (char === '}') counts.braceDepth--;
            else if (char === '[') counts.bracketDepth++;
            else if (char === ']') counts.bracketDepth--;
          }
        } else {
          if (char === counts.stringChar && prevChar !== '\\') {
            counts.inString = false;
            counts.stringChar = '';
          }
        }
      }
    }
    
    // Helper function to process a statement (single or multi-line)
    function processStatement(statement, lineNum) {
      const trimmedStatement = statement.trim();
      let processedStatement = statement;
      
      // Helper function to safely extract expression and comment
      function parseStatementParts(stmt, regex) {
        const match = stmt.match(regex);
        if (match) {
          const parts = {
            indent: match[1] || '',
            varType: match[2] || '',
            varName: match[3] || '',
            expr: '',
            comment: ''
          };
          
          // Find the last part which should be the expression + potential comment
          const lastPart = match[match.length - 1];
          
          // Check if there's a comment at the end (but not inside a string)
          let inQuote = false;
          let quoteChar = '';
          let commentIndex = -1;
          
          for (let i = 0; i < lastPart.length - 1; i++) {
            const char = lastPart[i];
            const nextChar = lastPart[i + 1];
            
            if (!inQuote && (char === '"' || char === "'" || char === '`')) {
              inQuote = true;
              quoteChar = char;
            } else if (inQuote && char === quoteChar && lastPart[i - 1] !== '\\') {
              inQuote = false;
              quoteChar = '';
            } else if (!inQuote && char === '/' && nextChar === '/') {
              commentIndex = i;
              break;
            }
          }
          
          if (commentIndex >= 0) {
            parts.expr = lastPart.substring(0, commentIndex).trim().replace(/;$/, '');
            parts.comment = lastPart.substring(commentIndex);
          } else {
            parts.expr = lastPart.trim().replace(/;$/, '');
          }
          
          return parts;
        }
        return null;
      }
      
      // Handle return statements
      if (trimmedStatement.startsWith('return ') && trimmedStatement !== 'return;') {
        const parts = parseStatementParts(statement, /^(\s*)return\s+(.+)$/s);
        if (parts) {
          if (parts.expr.includes('await ')) {
            processedStatement = `${parts.indent}return await (async () => { const __rv = (${parts.expr}); __logReturn('return', __rv, ${lineNum}); return __rv; })(); ${parts.comment}`;
          } else {
            processedStatement = `${parts.indent}return (() => { const __rv = (${parts.expr}); __logReturn('return', __rv, ${lineNum}); return __rv; })(); ${parts.comment}`;
          }
        }
      }
      // Handle variable assignments
      else if (trimmedStatement.match(/^(const|let|var)\s+\w+\s*=\s*/) || trimmedStatement.match(/^\w+\s*=\s*/)) {
        const parts = parseStatementParts(statement, /^(\s*)(?:(const|let|var)\s+)?(\w+)\s*=\s*(.+)$/s);
        if (parts) {
          const isRequireStatement = parts.expr.match(/^require\s*\(/);
          
          if (isRequireStatement) {
            processedStatement = statement;
          } else {
            if (parts.expr.includes('await ')) {
              if (parts.varType) {
                processedStatement = `${parts.indent}const ${parts.varName} = await (async () => { const __r = (${parts.expr}); __logReturn('${parts.varName}', __r, ${lineNum}); return __r; })(); ${parts.comment}`;
              } else {
                processedStatement = `${parts.indent}${parts.varName} = await (async () => { const __r = (${parts.expr}); __logReturn('${parts.varName}', __r, ${lineNum}); return __r; })(); ${parts.comment}`;
              }
            } else {
              if (parts.varType) {
                processedStatement = `${parts.indent}${parts.varType} ${parts.varName} = (() => { const __r = (${parts.expr}); __logReturn('${parts.varName}', __r, ${lineNum}); return __r; })(); ${parts.comment}`;
              } else {
                processedStatement = `${parts.indent}${parts.varName} = (() => { const __r = (${parts.expr}); __logReturn('${parts.varName}', __r, ${lineNum}); return __r; })(); ${parts.comment}`;
              }
            }
          }
        }
      }
      // Handle standalone function calls
      else if (trimmedStatement.match(/^[A-Za-z0-9"'][^=]*\(/s) && 
               !trimmedStatement.startsWith('console.') &&
               !trimmedStatement.startsWith('function ') &&
               !trimmedStatement.includes('__logReturn')) {
        const parts = parseStatementParts(statement, /^(\s*)(.+)$/s);
        if (parts) {
          const isRequireStatement = parts.expr.match(/^require\s*\(/);
          
          if (isRequireStatement) {
            processedStatement = statement;
          } else {
            // Execute directly in global context without wrapping in IIFE
            if (parts.expr.includes('await ')) {
              processedStatement = `${parts.indent}{ const __r = await (${parts.expr}); __logReturn('expression', __r, ${lineNum}); } ${parts.comment}`;
            } else {
              processedStatement = `${parts.indent}{ const __r = (${parts.expr}); __logReturn('expression', __r, ${lineNum}); } ${parts.comment}`;
            }
          }
        }
      }
      
      return processedStatement;
    }

    // Use the persistent global context

    // Instrument the code for line tracking
    const instrumentedCode = instrumentCode(code);
    
    // Debug: log the instrumented code
    console.log('Instrumented code:', instrumentedCode);

    // Check if the code contains function declarations that need to be in global scope
    const lines = code.split('\n');
    const functionDeclarations = [];
    const otherCode = [];
    
    let currentBlock = [];
    let inFunction = false;
    let braceDepth = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      // Check if this line starts a function declaration
      if (trimmed.match(/^(async\s+)?function\s+\w+/) || trimmed.match(/^(const|let|var)\s+\w+\s*=\s*(async\s+)?\s*function/)) {
        if (currentBlock.length > 0) {
          otherCode.push(...currentBlock);
          currentBlock = [];
        }
        inFunction = true;
        currentBlock.push(line);
        
        // Count braces to know when function ends
        for (const char of line) {
          if (char === '{') braceDepth++;
          else if (char === '}') braceDepth--;
        }
      } else if (inFunction) {
        currentBlock.push(line);
        
        // Count braces to know when function ends
        for (const char of line) {
          if (char === '{') braceDepth++;
          else if (char === '}') braceDepth--;
        }
        
        // If we've closed all braces, the function is complete
        if (braceDepth === 0) {
          functionDeclarations.push(...currentBlock);
          currentBlock = [];
          inFunction = false;
        }
      } else {
        currentBlock.push(line);
      }
    }
    
    // Add any remaining code
    if (currentBlock.length > 0) {
      otherCode.push(...currentBlock);
    }

    let result;
    
    // First, execute function declarations directly in global context
    if (functionDeclarations.length > 0) {
      const functionCode = functionDeclarations.join('\n');
      const instrumentedFunctionCode = instrumentCode(functionCode);
      console.log('Executing function declarations:', instrumentedFunctionCode);
      
      await vm.runInContext(instrumentedFunctionCode, globalContext, {
        timeout: 5000,
        displayErrors: true,
        filename: 'user-code.js'
      });
    }
    
    // Then execute other code (which may reference the functions)
    if (otherCode.length > 0) {
      const otherCodeStr = otherCode.join('\n').trim();
      if (otherCodeStr) {
        const instrumentedOtherCode = instrumentCode(otherCodeStr);
        console.log('Executing other code:', instrumentedOtherCode);
        
        // Execute directly in global context - no need to wrap in async IIFE
        // since the global context can handle promises and async operations
        result = await vm.runInContext(instrumentedOtherCode, globalContext, {
          timeout: 5000,
          displayErrors: true,
          filename: 'user-code.js'
        });
      }
    }
    
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

// Handle context reset
ipcMain.handle('reset-context', async () => {
  resetGlobalContext();
  return { success: true };
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
