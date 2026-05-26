/**
 * 碁道코딩 — Board State Integrator
 *
 * Orchestrates all encoder modules to produce a unified BoardState.
 * 
 * This is the "형세 판단(positional judgment)" —
 * reading the full board state before making any move decisions.
 */

import { resolve } from 'path';
import { buildDependencyGraph } from './dependency-graph.js';
import { collectMetrics } from './metrics-collector.js';
import { buildOwnershipMap, calculateOverallHealth } from './ownership-map.js';
import type { BoardState, ProjectSummary } from './types.js';

/**
 * Scan a project directory and produce a complete BoardState.
 *
 * This is the entry point for `gido scan`.
 * Combines:
 *  1. AST parsing (symbol extraction)
 *  2. Dependency graph construction (PageRank)
 *  3. Code metrics collection (complexity, debt)
 *  4. Ownership map generation (health heatmap)
 *  5. Project summary aggregation
 */
export function scanProject(rootDir: string): BoardState {
  const absRoot = resolve(rootDir);

  // Step 1 & 2: Parse files and build dependency graph
  const { graph, fileSymbols } = buildDependencyGraph(absRoot);

  // Step 3: Collect code metrics
  const metrics = collectMetrics(absRoot, fileSymbols);

  // Step 4: Build ownership map
  const ownershipMap = buildOwnershipMap(graph, metrics);

  // Step 5: Compute project summary
  const totalFiles = metrics.length;
  const totalLines = metrics.reduce((sum, m) => sum + m.lineCount, 0);
  const avgComplexity = totalFiles > 0
    ? Math.round(metrics.reduce((sum, m) => sum + m.cyclomaticComplexity, 0) / totalFiles * 10) / 10
    : 0;

  // Top modules by PageRank
  const topModules = [...graph.nodes.values()]
    .sort((a, b) => b.pageRank - a.pageRank)
    .slice(0, 5)
    .map(n => ({ filePath: n.filePath, pageRank: Math.round(n.pageRank * 10000) / 10000 }));

  // Risk modules (health < 0)
  const riskModules = [...ownershipMap.values()]
    .filter(e => e.health < 0)
    .sort((a, b) => a.health - b.health)
    .slice(0, 5)
    .map(e => ({ filePath: e.filePath, health: e.health }));

  const overallHealth = calculateOverallHealth(ownershipMap, graph);
  const avgHealth = totalFiles > 0
    ? Math.round([...ownershipMap.values()].reduce((sum, e) => sum + e.health, 0) / totalFiles * 100) / 100
    : 0;

  const summary: ProjectSummary = {
    totalFiles,
    totalLines,
    avgComplexity,
    avgHealth,
    cycleCount: graph.cycles.length,
    topModules,
    riskModules,
    overallHealth,
  };

  return {
    scannedAt: new Date().toISOString(),
    rootDir: absRoot,
    graph,
    metrics,
    ownershipMap,
    summary,
  };
}
