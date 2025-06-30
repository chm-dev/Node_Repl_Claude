// Test the regex patterns
const testLines = [
    "    return a + b;  // This return will be logged!",
    "const sum = add(5, 3);",
    "Math.max(10, 20, 5);  // Built-in functions"
];

testLines.forEach((line, i) => {
    console.log(`Testing line ${i + 1}: "${line}"`);
    
    // Test return pattern
    const returnMatch = line.match(/^(\s*)return\s+([^;\/]+);?\s*(\/\/.*)?$/);
    if (returnMatch) {
        console.log(`  Return match: indent="${returnMatch[1]}", expr="${returnMatch[2].trim()}", comment="${returnMatch[3] || 'none'}"`);
    }
    
    // Test assignment pattern
    const assignMatch = line.match(/^(\s*)(const|let|var)\s+(\w+)\s*=\s*([^;\/]+);?\s*(\/\/.*)?$/);
    if (assignMatch) {
        console.log(`  Assignment match: varType="${assignMatch[2]}", varName="${assignMatch[3]}", expr="${assignMatch[4].trim()}", comment="${assignMatch[5] || 'none'}"`);
    }
    
    // Test expression pattern
    const exprMatch = line.match(/^(\s*)([^;\/]+);?\s*(\/\/.*)?$/);
    if (exprMatch) {
        console.log(`  Expression match: indent="${exprMatch[1]}", expr="${exprMatch[2].trim()}", comment="${exprMatch[3] || 'none'}"`);
    }
    
    console.log('');
});
