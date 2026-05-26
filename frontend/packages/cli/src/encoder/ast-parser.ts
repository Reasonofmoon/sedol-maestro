/**
 * 碁道코딩 — AST Parser
 * 
 * Extracts symbol definitions and references from source files.
 * Inspired by Aider's RepoMap: Tree-sitter AST → symbol graph.
 * 
 * For Phase 1 MVP, we use regex-based heuristic parsing
 * (fast bootstrap). Tree-sitter integration planned for Phase 2+.
 */

import { readFileSync } from 'fs';
import { FileSymbols, SymbolNode } from './types.js';

const SUPPORTED_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go'];

/** Regex patterns for TypeScript/JavaScript symbol extraction */
const TS_PATTERNS = {
  functionDecl: /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/gm,
  arrowFunction: /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(/gm,
  classDecl: /^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/gm,
  interfaceDecl: /^(?:export\s+)?interface\s+(\w+)/gm,
  typeDecl: /^(?:export\s+)?type\s+(\w+)\s*=/gm,
  importStatement: /import\s+(?:{[^}]+}|\w+)\s+from\s+['"]([^'"]+)['"]/gm,
  importNamed: /import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/gm,
  exportStatement: /export\s+(?:default\s+)?(?:function|class|const|let|var|interface|type|enum)\s+(\w+)/gm,
  methodDecl: /^\s+(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*\w+)?\s*\{/gm,
};

/**
 * Parse a single TypeScript/JavaScript source file for symbols.
 */
function parseTypeScriptFile(filePath: string, content: string): FileSymbols {
  const lines = content.split('\n');
  const definitions: SymbolNode[] = [];
  const imports: { name: string; from: string }[] = [];
  const exports: string[] = [];

  // Extract function declarations
  for (const match of content.matchAll(TS_PATTERNS.functionDecl)) {
    const line = content.substring(0, match.index!).split('\n').length;
    definitions.push({ name: match[1], kind: 'function', filePath, startLine: line, endLine: line });
  }

  // Extract arrow function assignments
  for (const match of content.matchAll(TS_PATTERNS.arrowFunction)) {
    const line = content.substring(0, match.index!).split('\n').length;
    definitions.push({ name: match[1], kind: 'function', filePath, startLine: line, endLine: line });
  }

  // Extract class declarations
  for (const match of content.matchAll(TS_PATTERNS.classDecl)) {
    const line = content.substring(0, match.index!).split('\n').length;
    definitions.push({ name: match[1], kind: 'class', filePath, startLine: line, endLine: line });
  }

  // Extract interface declarations
  for (const match of content.matchAll(TS_PATTERNS.interfaceDecl)) {
    const line = content.substring(0, match.index!).split('\n').length;
    definitions.push({ name: match[1], kind: 'interface', filePath, startLine: line, endLine: line });
  }

  // Extract type declarations
  for (const match of content.matchAll(TS_PATTERNS.typeDecl)) {
    const line = content.substring(0, match.index!).split('\n').length;
    definitions.push({ name: match[1], kind: 'type', filePath, startLine: line, endLine: line });
  }

  // Extract imports
  for (const match of content.matchAll(TS_PATTERNS.importNamed)) {
    const names = match[1].split(',').map(n => n.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean);
    for (const name of names) {
      imports.push({ name, from: match[2] });
    }
  }

  // Extract exports
  for (const match of content.matchAll(TS_PATTERNS.exportStatement)) {
    exports.push(match[1]);
  }

  return { filePath, definitions, imports, exports, lineCount: lines.length };
}

/**
 * Parse a Python source file for symbols.
 */
function parsePythonFile(filePath: string, content: string): FileSymbols {
  const lines = content.split('\n');
  const definitions: SymbolNode[] = [];
  const imports: { name: string; from: string }[] = [];
  const exports: string[] = [];

  // Function definitions
  for (const match of content.matchAll(/^(?:async\s+)?def\s+(\w+)/gm)) {
    const line = content.substring(0, match.index!).split('\n').length;
    definitions.push({ name: match[1], kind: 'function', filePath, startLine: line, endLine: line });
  }

  // Class definitions
  for (const match of content.matchAll(/^class\s+(\w+)/gm)) {
    const line = content.substring(0, match.index!).split('\n').length;
    definitions.push({ name: match[1], kind: 'class', filePath, startLine: line, endLine: line });
  }

  // from X import Y
  for (const match of content.matchAll(/from\s+(\S+)\s+import\s+(.+)/gm)) {
    const names = match[2].split(',').map(n => n.trim());
    for (const name of names) {
      imports.push({ name, from: match[1] });
    }
  }

  return { filePath, definitions, imports, exports, lineCount: lines.length };
}

/**
 * Parse a source file based on its extension.
 */
export function parseFile(filePath: string): FileSymbols | null {
  const ext = filePath.substring(filePath.lastIndexOf('.'));
  if (!SUPPORTED_EXTENSIONS.includes(ext)) return null;

  try {
    const content = readFileSync(filePath, 'utf-8');
    if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
      return parseTypeScriptFile(filePath, content);
    } else if (ext === '.py') {
      return parsePythonFile(filePath, content);
    }
  } catch {
    // File read error — skip silently
  }
  return null;
}

/**
 * Check if a file extension is supported for parsing.
 */
export function isSupportedFile(filePath: string): boolean {
  const ext = filePath.substring(filePath.lastIndexOf('.'));
  return SUPPORTED_EXTENSIONS.includes(ext);
}
