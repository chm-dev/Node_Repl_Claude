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

    // Create Node.js module mocks for browser-like environment
    const createNodeModules = () => {
      const nodeModules = {};
      
      // Mock OS module
      nodeModules.os = {
        platform: () => process.platform,
        arch: () => process.arch,
        cpus: () => require('os').cpus(),
        totalmem: () => require('os').totalmem(),
        freemem: () => require('os').freemem(),
        homedir: () => require('os').homedir(),
        hostname: () => require('os').hostname(),
        type: () => require('os').type(),
        release: () => require('os').release(),
        uptime: () => require('os').uptime(),
        loadavg: () => require('os').loadavg(),
        networkInterfaces: () => require('os').networkInterfaces(),
        userInfo: () => require('os').userInfo(),
        tmpdir: () => require('os').tmpdir(),
        endianness: () => require('os').endianness(),
        EOL: require('os').EOL
      };
      
      // Mock PATH module
      nodeModules.path = {
        join: (...args) => require('path').join(...args),
        resolve: (...args) => require('path').resolve(...args),
        relative: (from, to) => require('path').relative(from, to),
        dirname: (p) => require('path').dirname(p),
        basename: (p, ext) => require('path').basename(p, ext),
        extname: (p) => require('path').extname(p),
        parse: (p) => require('path').parse(p),
        format: (obj) => require('path').format(obj),
        normalize: (p) => require('path').normalize(p),
        isAbsolute: (p) => require('path').isAbsolute(p),
        sep: require('path').sep,
        delimiter: require('path').delimiter,
        posix: require('path').posix,
        win32: require('path').win32
      };
      
      // Mock CRYPTO module
      nodeModules.crypto = {
        randomBytes: (size) => require('crypto').randomBytes(size),
        randomUUID: () => require('crypto').randomUUID(),
        createHash: (algorithm) => require('crypto').createHash(algorithm),
        createHmac: (algorithm, key) => require('crypto').createHmac(algorithm, key),
        pbkdf2Sync: (password, salt, iterations, keylen, digest) => 
          require('crypto').pbkdf2Sync(password, salt, iterations, keylen, digest),
        scryptSync: (password, salt, keylen, options) => 
          require('crypto').scryptSync(password, salt, keylen, options),
        timingSafeEqual: (a, b) => require('crypto').timingSafeEqual(a, b)
      };
      
      // Mock FS module (limited safe operations)
      nodeModules.fs = {
        existsSync: (path) => {
          try {
            return require('fs').existsSync(path);
          } catch (error) {
            return false;
          }
        },
        statSync: (path) => {
          try {
            return require('fs').statSync(path);
          } catch (error) {
            throw new Error('File not found or access denied');
          }
        },
        constants: require('fs').constants
      };
      
      // Mock UTIL module
      nodeModules.util = {
        format: (...args) => require('util').format(...args),
        inspect: (obj, options) => require('util').inspect(obj, options),
        isArray: Array.isArray,
        isDate: (obj) => obj instanceof Date,
        isError: (obj) => obj instanceof Error,
        isFunction: (obj) => typeof obj === 'function',
        isNull: (obj) => obj === null,
        isUndefined: (obj) => obj === undefined,
        types: require('util').types
      };
      
      return nodeModules;
    };

    // Create require function for Node modules
    const createRequire = (nodeModules) => {
      return (moduleName) => {
        // Try to get real Node.js module first
        try {
          switch (moduleName) {
            case 'os':
              return require('os');
            case 'path':
              return require('path');
            case 'crypto':
              return require('crypto');
            case 'util':
              return require('util');
            case 'fs':
              return require('fs');
            case 'url':
              return require('url');
            case 'querystring':
              return require('querystring');
            default:
              // For unknown modules, throw an error like Node.js would
              throw new Error(`Cannot find module '${moduleName}'`);
          }
        } catch (error) {
          // If real module fails, try mock version
          if (nodeModules[moduleName]) {
            return nodeModules[moduleName];
          }
          // If no mock available, re-throw the error
          throw error;
        }
      };
    };

    // Create Node modules and require function
    const nodeModules = createNodeModules();
    const requireFunction = createRequire(nodeModules);

    // Create a new context for code execution
    const sandbox = {
      console: {
        log: createConsoleMethod('log'),
        error: createConsoleMethod('error'),
        warn: createConsoleMethod('warn'),
        info: createConsoleMethod('info')
      },
      __setLine: setCurrentLine, // Internal line tracking function
      __logReturn: logFunctionReturn, // Internal function return logging
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
      // Add Node.js globals
      process: {
        version: process.version,
        versions: process.versions,
        platform: process.platform,
        arch: process.arch,
        env: { NODE_ENV: 'development' }, // Limited env access
        argv: process.argv,
        pid: process.pid,
        uptime: () => process.uptime(),
        hrtime: process.hrtime,
        nextTick: process.nextTick
      },
      Buffer: Buffer,
      global: {},
      require: requireFunction,
      // Add some utility functions
      fetch: require('node-fetch') // For async operations
    };

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
      
      // Handle return statements
      if (trimmedStatement.startsWith('return ') && trimmedStatement !== 'return;') {
        const match = statement.match(/^(\s*)return\s+([^;\/]+);?\s*(\/\/.*)?$/s);
        if (match) {
          const indent = match[1];
          const expr = match[2].trim();
          const comment = match[3] || '';
          
          if (expr.includes('await ')) {
            processedStatement = `${indent}return await (async () => { const __rv = (${expr}); __logReturn('return', __rv, ${lineNum}); return __rv; })(); ${comment}`;
          } else {
            processedStatement = `${indent}return (() => { const __rv = (${expr}); __logReturn('return', __rv, ${lineNum}); return __rv; })(); ${comment}`;
          }
        }
      }
      // Handle variable assignments
      else if (trimmedStatement.match(/^(const|let|var)\s+\w+\s*=\s*/) || trimmedStatement.match(/^\w+\s*=\s*/)) {
        const match = statement.match(/^(\s*)(?:(const|let|var)\s+)?(\w+)\s*=\s*([^;\/]+);?\s*(\/\/.*)?$/s);
        if (match) {
          const indent = match[1];
          const varType = match[2] || '';
          const varName = match[3];
          const expr = match[4].trim();
          const comment = match[5] || '';
          
          const isRequireStatement = expr.match(/^require\s*\(/);
          
          if (isRequireStatement) {
            processedStatement = statement;
          } else {
            if (expr.includes('await ')) {
              if (varType) {
                processedStatement = `${indent}const ${varName} = await (async () => { const __r = (${expr}); __logReturn('${varName}', __r, ${lineNum}); return __r; })(); ${comment}`;
              } else {
                processedStatement = `${indent}${varName} = await (async () => { const __r = (${expr}); __logReturn('${varName}', __r, ${lineNum}); return __r; })(); ${comment}`;
              }
            } else {
              if (varType) {
                processedStatement = `${indent}${varType} ${varName} = (() => { const __r = (${expr}); __logReturn('${varName}', __r, ${lineNum}); return __r; })(); ${comment}`;
              } else {
                processedStatement = `${indent}${varName} = (() => { const __r = (${expr}); __logReturn('${varName}', __r, ${lineNum}); return __r; })(); ${comment}`;
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
        const match = statement.match(/^(\s*)([^;\/]+);?\s*(\/\/.*)?$/s);
        if (match) {
          const indent = match[1];
          const expr = match[2].trim();
          const comment = match[3] || '';
          
          const isRequireStatement = expr.match(/^require\s*\(/);
          
          if (isRequireStatement) {
            processedStatement = statement;
          } else {
            if (expr.includes('await ')) {
              processedStatement = `${indent}await (async () => { const __r = (${expr}); __logReturn('expression', __r, ${lineNum}); return __r; })(); ${comment}`;
            } else {
              processedStatement = `${indent}(() => { const __r = (${expr}); __logReturn('expression', __r, ${lineNum}); return __r; })(); ${comment}`;
            }
          }
        }
      }
      
      return processedStatement;
    }

    // Create VM context
    const context = vm.createContext(sandbox);

    // Instrument the code for line tracking
    const instrumentedCode = instrumentCode(code);
    
    // Debug: log the instrumented code
    console.log('Instrumented code:', instrumentedCode);

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
