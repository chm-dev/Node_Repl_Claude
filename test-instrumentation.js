// Test script to verify instrumentation
const code = `console.log('Testing console log');

function add(a, b) {
    console.log('Adding numbers...');
    return a + b;
}

const result = add(5, 3);

Math.max(10, 20, 15);

"Hello World".toUpperCase();`;

console.log('Original code:');
console.log(code);
console.log('\n' + '='.repeat(50) + '\n');

// Simulate the instrumentation function
const instrumentCode = (code) => {
  const lines = code.split('\n');
  const instrumentedLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i];
    const trimmedLine = line.trim();
    
    // Skip empty lines and comments
    if (!trimmedLine || trimmedLine.startsWith('//') || trimmedLine.startsWith('/*')) {
      instrumentedLines.push(line);
      continue;
    }
    
    let processedLine = line;
    
    // Handle return statements
    if (trimmedLine.startsWith('return ') && trimmedLine !== 'return;') {
      const match = line.match(/^(\s*)return\s+(.+?);?\s*$/);
      if (match) {
        const indent = match[1];
        const expr = match[2].replace(/;$/, '');
        processedLine = `${indent}return (() => { const __rv = (${expr}); __logReturn('return', __rv, ${lineNum}); return __rv; })();`;
      }
    }
    // Handle variable assignments with function calls: const x = func();
    else if (trimmedLine.match(/^(const|let|var)\s+\w+\s*=\s*\w+.*\(/)) {
      const match = line.match(/^(\s*)(const|let|var)\s+(\w+)\s*=\s*(.+?);?\s*$/);
      if (match) {
        const indent = match[1];
        const varType = match[2];
        const varName = match[3];
        const expr = match[4].replace(/;$/, '');
        processedLine = `${indent}${varType} ${varName} = (() => { const __r = (${expr}); __logReturn('${varName}', __r, ${lineNum}); return __r; })();`;
      }
    }
    // Handle standalone function calls (like Math.max, "str".method(), etc.)
    else if (trimmedLine.match(/^[A-Za-z0-9"'][^=]*\([^)]*\);?\s*$/) && 
             !trimmedLine.startsWith('console.') &&
             !trimmedLine.startsWith('function ') &&
             !trimmedLine.includes('__logReturn')) {
      const match = line.match(/^(\s*)(.+?);?\s*$/);
      if (match) {
        const indent = match[1];
        const expr = match[2].replace(/;$/, '');
        processedLine = `${indent}(() => { const __r = (${expr}); __logReturn('expression', __r, ${lineNum}); return __r; })();`;
      }
    }
    
    instrumentedLines.push(`__setLine(${lineNum}); ${processedLine}`);
  }
  
  return instrumentedLines.join('\n');
};

const instrumentedCode = instrumentCode(code);
console.log('Instrumented code:');
console.log(instrumentedCode);
