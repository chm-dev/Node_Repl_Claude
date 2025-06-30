// Test the URL instrumentation fix
const testCode = `const response = fetch('https://github.com/');
const body = await response.text();
console.log(body);`;

console.log('Testing code with URLs:');
console.log(testCode);
console.log('\n' + '='.repeat(50) + '\n');

// Copy the fixed instrumentCode function from main.js to test it
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
          if (parts.expr.includes('await ')) {
            processedStatement = `${parts.indent}await (async () => { const __r = (${parts.expr}); __logReturn('expression', __r, ${lineNum}); return __r; })(); ${parts.comment}`;
          } else {
            processedStatement = `${parts.indent}(() => { const __r = (${parts.expr}); __logReturn('expression', __r, ${lineNum}); return __r; })(); ${parts.comment}`;
          }
        }
      }
    }
    
    return processedStatement;
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

const result = instrumentCode(testCode);
console.log('Instrumented result:');
console.log(result);

// Check if the result contains valid syntax
try {
  new Function(result);
  console.log('\n✅ Valid JavaScript syntax!');
} catch (error) {
  console.log('\n❌ Invalid JavaScript syntax:');
  console.log(error.message);
}
