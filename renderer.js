// Global variables
let editor;
let outputContainer;
let executionCounter = 0;

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    initializeMonacoEditor();
    setupEventListeners();
    setupIPCListeners();
});

// Initialize Monaco Editor
function initializeMonacoEditor() {
    require.config({ paths: { vs: 'node_modules/monaco-editor/min/vs' } });
    
    require(['vs/editor/editor.main'], function () {
        // Hide loading screen
        const loadingScreen = document.getElementById('loadingScreen');
        loadingScreen.style.display = 'none';
        
        // Create editor
        editor = monaco.editor.create(document.getElementById('editor'), {
            value: `// Enhanced JS REPL - Now logs function returns!
// Press Ctrl+Enter to run code

console.log('Testing console log');

// Function declaration with return
function add(a, b) {
    console.log('Adding numbers...');
    return a + b;  // This return will be logged!
}

// Call the function and assign result
const result = add(5, 3);

// Simple expression that returns a value
Math.max(10, 20, 15);

// String manipulation
"Hello World".toUpperCase();`,
            language: 'javascript',
            theme: 'vs-dark',
            fontSize: 14,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            wordWrap: 'on',
            lineNumbers: 'on',
            renderLineHighlight: 'line',
            selectOnLineNumbers: true,
            mouseWheelZoom: true,
            contextmenu: true,
            folding: true,
            showFoldingControls: 'always',
            foldingHighlight: true,
            bracketPairColorization: { enabled: true },
            guides: {
                bracketPairs: true,
                indentation: true
            }
        });

        // Update line info on cursor position change
        editor.onDidChangeCursorPosition((e) => {
            updateLineInfo(e.position);
        });

        // Handle Ctrl+Enter for code execution
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
            executeCode();
        });

        // Handle Ctrl+K for clearing output
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => {
            clearOutput();
        });

        // Handle Ctrl+N for new file
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyN, () => {
            newFile();
        });
    });
}

// Setup event listeners
function setupEventListeners() {
    outputContainer = document.getElementById('output');
    
    // Button event listeners
    document.getElementById('runBtn').addEventListener('click', executeCode);
    document.getElementById('clearBtn').addEventListener('click', clearOutput);
    document.getElementById('newBtn').addEventListener('click', newFile);
    document.getElementById('clearOutputBtn').addEventListener('click', clearOutput);
}

// Setup IPC listeners for menu events
function setupIPCListeners() {
    // Console output listener
    window.electronAPI.onConsoleOutput((event, data) => {
        if (data.type === 'function-return') {
            addOutputItem(data.type, data.args.join(' '), 'console', null, data.lineNumber, data.functionName);
        } else {
            addOutputItem(data.type, data.args.join(' '), 'console', null, data.lineNumber);
        }
    });

    // Menu event listeners
    window.electronAPI.onMenuNew(() => newFile());
    window.electronAPI.onMenuClear(() => clearOutput());
    window.electronAPI.onMenuRun(() => executeCode());

    // Get app version
    window.electronAPI.getAppVersion().then(version => {
        document.getElementById('appVersion').textContent = `v${version}`;
    });
}

// Execute code
async function executeCode() {
    if (!editor) return;

    const code = editor.getValue().trim();
    if (!code) return;

    executionCounter++;
    updateExecutionStatus('Executing...');

    try {
        const result = await window.electronAPI.executeCode(code);
        
        if (result.success) {
            // Display the return value if it's not undefined
            if (result.result !== undefined) {
                addOutputItem('result', formatValue(result.result, result.type), 'execution');
            }
        } else {
            // Display error
            addOutputItem('error', result.error, 'execution', result.stack, result.lineNumber);
        }
    } catch (error) {
        addOutputItem('error', `Failed to execute code: ${error.message}`, 'execution');
    }

    updateExecutionStatus('Ready');
}

// Add output item
function addOutputItem(type, content, source, stack = null, lineNumber = null, functionName = null) {
    const outputItem = document.createElement('div');
    outputItem.className = `output-item ${type === 'result' ? 'result' : type === 'function-return' ? 'function-return' : type.startsWith('console') ? type : 'error'}`;

    const header = document.createElement('div');
    header.className = 'output-header';
    
    const timestamp = new Date().toLocaleTimeString();
    const executionId = source === 'execution' ? `#${executionCounter}` : '';
    const lineInfo = lineNumber ? `<span class="line-number">Line ${lineNumber}</span>` : '';
    const funcInfo = functionName ? `<span class="function-name">${functionName}()</span>` : '';
    
    header.innerHTML = `
        <span>${getOutputIcon(type)} ${getOutputLabel(type)} ${executionId} ${funcInfo} ${lineInfo}</span>
        <span class="output-type">${timestamp}</span>
    `;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'output-content';
    contentDiv.innerHTML = highlightSyntax(content);

    outputItem.appendChild(header);
    outputItem.appendChild(contentDiv);

    // Add click handler to jump to line
    if (lineNumber && editor) {
        outputItem.style.cursor = 'pointer';
        outputItem.addEventListener('click', () => {
            editor.setPosition({ lineNumber: lineNumber, column: 1 });
            editor.revealLineInCenter(lineNumber);
            editor.focus();
            
            // Highlight the line temporarily
            const decoration = editor.deltaDecorations([], [{
                range: new monaco.Range(lineNumber, 1, lineNumber, 1),
                options: {
                    isWholeLine: true,
                    className: 'line-highlight',
                    glyphMarginClassName: 'line-highlight-glyph'
                }
            }]);
            
            // Remove highlight after 2 seconds
            setTimeout(() => {
                editor.deltaDecorations(decoration, []);
            }, 2000);
        });
    }

    // Add stack trace for errors
    if (stack && type === 'error') {
        const stackDiv = document.createElement('div');
        stackDiv.className = 'output-content';
        stackDiv.style.marginTop = '8px';
        stackDiv.style.fontSize = '12px';
        stackDiv.style.color = '#8c8c8c';
        stackDiv.textContent = stack;
        outputItem.appendChild(stackDiv);
    }

    outputContainer.appendChild(outputItem);
    outputContainer.scrollTop = outputContainer.scrollHeight;
}

// Format values for display
function formatValue(value, type) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    
    switch (type) {
        case 'string':
            return `"${value}"`;
        case 'number':
        case 'boolean':
            return String(value);
        case 'function':
            return value.toString();
        case 'object':
            try {
                return JSON.stringify(value, null, 2);
            } catch (e) {
                return String(value);
            }
        default:
            return String(value);
    }
}

// Get output icon
function getOutputIcon(type) {
    const icons = {
        'result': '→',
        'error': '✗',
        'log': 'ℹ',
        'warn': '⚠',
        'info': 'ℹ',
        'console-log': 'ℹ',
        'console-warn': '⚠',
        'console-error': '✗',
        'console-info': 'ℹ',
        'function-return': '↩'
    };
    return icons[type] || 'ℹ';
}

// Get output label
function getOutputLabel(type) {
    const labels = {
        'result': 'Result',
        'error': 'Error',
        'log': 'Console',
        'warn': 'Warning',
        'info': 'Info',
        'console-log': 'Console Log',
        'console-warn': 'Console Warn',
        'console-error': 'Console Error',
        'console-info': 'Console Info',
        'function-return': 'Return'
    };
    return labels[type] || 'Output';
}

// Basic syntax highlighting for output
function highlightSyntax(text) {
    if (typeof text !== 'string') return text;
    
    return text
        .replace(/(".*?")/g, '<span class="string">$1</span>')
        .replace(/\b(\d+\.?\d*)\b/g, '<span class="number">$1</span>')
        .replace(/\b(true|false)\b/g, '<span class="boolean">$1</span>')
        .replace(/\b(null|undefined)\b/g, '<span class="null">$1</span>')
        .replace(/\b(function\s+\w+|=>\s*{)/g, '<span class="function">$1</span>');
}

// Clear output
function clearOutput() {
    if (outputContainer) {
        outputContainer.innerHTML = '';
        executionCounter = 0;
        updateExecutionStatus('Output cleared');
        
        // Reset status after a delay
        setTimeout(() => {
            updateExecutionStatus('Ready');
        }, 2000);
    }
}

// New file
function newFile() {
    if (editor) {
        editor.setValue('// New JavaScript file\n\n');
        editor.focus();
        clearOutput();
        updateExecutionStatus('New file created');
        
        // Reset status after a delay
        setTimeout(() => {
            updateExecutionStatus('Ready');
        }, 2000);
    }
}

// Update line info
function updateLineInfo(position) {
    const lineInfo = document.getElementById('lineInfo');
    if (lineInfo) {
        lineInfo.textContent = `Line ${position.lineNumber}, Column ${position.column}`;
    }
}

// Update execution status
function updateExecutionStatus(status) {
    const statusElement = document.getElementById('executionStatus');
    if (statusElement) {
        statusElement.textContent = status;
    }
}

// Handle window resize
window.addEventListener('resize', () => {
    if (editor) {
        editor.layout();
    }
});
