/**
 * Fix TypeScript import paths for ESM compatibility
 * Adds .js extensions to relative imports
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

function fixImportsInFile(filePath) {
  const content = readFileSync(filePath, 'utf8');
  
  // Replace relative imports without file extensions
  const fixedContent = content.replace(
    /from\s+['"](\.[^'"]*?)(['"])/g,
    (match, importPath, quote) => {
      // Skip if already has extension
      if (extname(importPath) || importPath.includes('.js')) {
        return match;
      }
      
      // Add .js extension
      return `from ${quote}${importPath}.js${quote}`;
    }
  ).replace(
    /import\s*\(\s*['"](\.[^'"]*?)['"][)\]]/g,
    (match, importPath) => {
      // Skip if already has extension  
      if (extname(importPath) || importPath.includes('.js')) {
        return match;
      }
      
      // Add .js extension
      return match.replace(importPath, `${importPath}.js`);
    }
  );
  
  if (content !== fixedContent) {
    writeFileSync(filePath, fixedContent, 'utf8');
    console.log(`Fixed imports in: ${filePath}`);
  }
}

function processDirectory(dirPath) {
  const entries = readdirSync(dirPath);
  
  for (const entry of entries) {
    const fullPath = join(dirPath, entry);
    const stat = statSync(fullPath);
    
    if (stat.isDirectory() && !entry.startsWith('.') && entry !== 'node_modules') {
      processDirectory(fullPath);
    } else if (stat.isFile() && entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
      fixImportsInFile(fullPath);
    }
  }
}

// Run the script
const srcPath = './src';
console.log(`Fixing imports in: ${srcPath}`);
processDirectory(srcPath);
console.log('Import fixing complete!');

// Start processing from src directory
const srcDir = './src';
console.log('Fixing TypeScript import paths...');
processDirectory(srcDir);
console.log('Import path fixes completed!');
