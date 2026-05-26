/**
 * 碁道코딩 — Dependency Graph Builder
 *
 * Builds a directed dependency graph from import/export relationships.
 * Applies PageRank to identify the most critical modules (Aider RepoMap approach).
 *
 * 바둑판의 "이음(connection)" = 모듈 간 의존성
 * PageRank가 높은 모듈 = 대마(大馬, critical group)
 */

import { readdirSync, statSync } from 'fs';
import { join, relative, resolve, extname } from 'path';
import { parseFile, isSupportedFile } from './ast-parser.js';
import type { DependencyGraph, DependencyEdge, GraphNode, FileSymbols } from './types.js';

/**
 * Recursively discover all supported source files.
 */
function discoverFiles(dir: string, rootDir: string, ignore: string[] = ['node_modules', '.git', 'dist', 'build', '.next', '__pycache__']): string[] {
  const files: string[] = [];
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (ignore.includes(entry.name)) continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...discoverFiles(fullPath, rootDir, ignore));
      } else if (isSupportedFile(entry.name)) {
        files.push(relative(rootDir, fullPath).replace(/\\/g, '/'));
      }
    }
  } catch { /* permission errors etc */ }
  return files;
}

/**
 * Resolve an import specifier to a relative file path.
 * e.g., './components/Board' → 'src/components/Board.tsx'
 */
function resolveImport(importFrom: string, sourceFile: string, allFiles: string[]): string | null {
  if (!importFrom.startsWith('.') && !importFrom.startsWith('/')) {
    return null; // external package — skip
  }

  const sourceDir = sourceFile.substring(0, sourceFile.lastIndexOf('/'));
  const resolved = importFrom.startsWith('.')
    ? join(sourceDir, importFrom).replace(/\\/g, '/')
    : importFrom.replace(/\\/g, '/');

  // Try exact match, then with extensions
  const candidates = [
    resolved,
    `${resolved}.ts`, `${resolved}.tsx`, `${resolved}.js`, `${resolved}.jsx`,
    `${resolved}/index.ts`, `${resolved}/index.tsx`, `${resolved}/index.js`,
  ];

  for (const candidate of candidates) {
    if (allFiles.includes(candidate)) return candidate;
  }
  return null;
}

/**
 * Simple PageRank implementation.
 * Iteratively distributes "importance" through the graph edges.
 */
function computePageRank(
  nodes: string[],
  edges: DependencyEdge[],
  damping = 0.85,
  iterations = 30
): Map<string, number> {
  const n = nodes.length;
  if (n === 0) return new Map();

  const rank = new Map<string, number>();
  const outLinks = new Map<string, string[]>();

  // Initialize
  for (const node of nodes) {
    rank.set(node, 1 / n);
    outLinks.set(node, []);
  }

  for (const edge of edges) {
    outLinks.get(edge.from)?.push(edge.to);
  }

  // Iterate
  for (let i = 0; i < iterations; i++) {
    const newRank = new Map<string, number>();
    for (const node of nodes) {
      newRank.set(node, (1 - damping) / n);
    }

    for (const node of nodes) {
      const links = outLinks.get(node) || [];
      if (links.length === 0) {
        // Dangling node: distribute to all nodes
        const share = (rank.get(node) || 0) * damping / n;
        for (const target of nodes) {
          newRank.set(target, (newRank.get(target) || 0) + share);
        }
      } else {
        const share = (rank.get(node) || 0) * damping / links.length;
        for (const target of links) {
          if (newRank.has(target)) {
            newRank.set(target, (newRank.get(target) || 0) + share);
          }
        }
      }
    }

    // Update ranks
    for (const [k, v] of newRank) {
      rank.set(k, v);
    }
  }

  return rank;
}

/**
 * Detect cycles using DFS (Tarjan-like approach).
 */
function detectCycles(nodes: string[], edges: DependencyEdge[]): string[][] {
  const adj = new Map<string, string[]>();
  for (const n of nodes) adj.set(n, []);
  for (const e of edges) adj.get(e.from)?.push(e.to);

  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const cycles: string[][] = [];

  function dfs(node: string, path: string[]): void {
    visited.add(node);
    recursionStack.add(node);
    path.push(node);

    for (const neighbor of (adj.get(node) || [])) {
      if (recursionStack.has(neighbor)) {
        // Found a cycle
        const cycleStart = path.indexOf(neighbor);
        if (cycleStart >= 0) {
          cycles.push(path.slice(cycleStart));
        }
      } else if (!visited.has(neighbor)) {
        dfs(neighbor, [...path]);
      }
    }

    recursionStack.delete(node);
  }

  for (const node of nodes) {
    if (!visited.has(node)) dfs(node, []);
  }

  return cycles;
}

/**
 * Build the full dependency graph for a project directory.
 * 
 * This is the "반상 읽기" (board reading) — understanding the shape of the codebase.
 */
export function buildDependencyGraph(rootDir: string): { graph: DependencyGraph; fileSymbols: FileSymbols[] } {
  const absRoot = resolve(rootDir);
  const files = discoverFiles(absRoot, absRoot);
  const fileSymbolsList: FileSymbols[] = [];
  const edges: DependencyEdge[] = [];

  // Parse all files
  for (const file of files) {
    const absPath = join(absRoot, file);
    const symbols = parseFile(absPath);
    if (symbols) {
      // Normalize path to relative
      symbols.filePath = file;
      fileSymbolsList.push(symbols);
    }
  }

  // Build edges from imports
  for (const fileSyms of fileSymbolsList) {
    for (const imp of fileSyms.imports) {
      const resolved = resolveImport(imp.from, fileSyms.filePath, files);
      if (resolved) {
        edges.push({ from: fileSyms.filePath, to: resolved, type: 'import' });
      }
    }
  }

  // Compute PageRank
  const pageRanks = computePageRank(files, edges);

  // Detect cycles
  const cycles = detectCycles(files, edges);
  const cyclicFiles = new Set(cycles.flat());

  // Build graph nodes
  const nodeMap = new Map<string, GraphNode>();
  for (const file of files) {
    const inDeg = edges.filter(e => e.to === file).length;
    const outDeg = edges.filter(e => e.from === file).length;
    nodeMap.set(file, {
      filePath: file,
      inDegree: inDeg,
      outDegree: outDeg,
      pageRank: pageRanks.get(file) || 0,
      isCyclic: cyclicFiles.has(file),
    });
  }

  return {
    graph: { nodes: nodeMap, edges, cycles },
    fileSymbols: fileSymbolsList,
  };
}
