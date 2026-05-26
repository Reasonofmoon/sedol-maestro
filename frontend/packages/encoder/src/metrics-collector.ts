/**
 * 碁道코딩 — Metrics Collector
 *
 * Collects code quality metrics for each module.
 * 바둑의 "두터움(厚み)" = 테스트 커버리지 + 낮은 복잡도 + 적은 부채
 */

import { readFileSync } from 'fs';
import { resolve, join } from 'path';
import type { ModuleMetrics, FileSymbols } from './types.js';

/** Debt marker patterns (TODO, FIXME, HACK, XXX, TEMP, WORKAROUND) */
const DEBT_MARKERS = /\b(TODO|FIXME|HACK|XXX|TEMP|WORKAROUND)\b/gi;

/**
 * Estimate cyclomatic complexity from source code via control-flow keyword counting.
 * Each decision point adds +1 to base complexity of 1.
 * 
 * This is a heuristic approximation; accurate measurement requires full AST.
 */
function estimateCyclomaticComplexity(content: string): number {
  const controlFlowKeywords = [
    /\bif\s*\(/g,
    /\belse\s+if\s*\(/g,
    /\bfor\s*\(/g,
    /\bwhile\s*\(/g,
    /\bcase\s+/g,
    /\bcatch\s*\(/g,
    /\b\?\?/g,         // nullish coalescing
    /\?\./g,           // optional chaining (decision point)
    /&&/g,             // logical AND
    /\|\|/g,           // logical OR
    /\?\s*[^:]/g,      // ternary
  ];

  let complexity = 1; // base complexity
  for (const pattern of controlFlowKeywords) {
    const matches = content.match(pattern);
    if (matches) complexity += matches.length;
  }

  return complexity;
}

/**
 * Count debt markers (TODO, FIXME, HACK, etc.) in source code.
 */
function countDebtMarkers(content: string): number {
  const matches = content.match(DEBT_MARKERS);
  return matches ? matches.length : 0;
}

/**
 * Collect metrics for all parsed files.
 * 
 * 두터움(厚み) 지표:
 *  - 순환 복잡도가 낮을수록 두텁다
 *  - 부채 마커가 적을수록 두텁다
 *  - 함수 수 대비 라인 수가 적절할수록 두텁다
 */
export function collectMetrics(rootDir: string, fileSymbolsList: FileSymbols[]): ModuleMetrics[] {
  const absRoot = resolve(rootDir);
  const results: ModuleMetrics[] = [];

  for (const fileSym of fileSymbolsList) {
    try {
      const absPath = join(absRoot, fileSym.filePath);
      const content = readFileSync(absPath, 'utf-8');
      const lines = content.split('\n');

      const complexity = estimateCyclomaticComplexity(content);
      const debtMarkerCount = countDebtMarkers(content);
      const functionCount = fileSym.definitions.filter(
        d => d.kind === 'function' || d.kind === 'method'
      ).length;

      results.push({
        filePath: fileSym.filePath,
        lineCount: lines.length,
        cyclomaticComplexity: complexity,
        violations: 0, // Populated separately by dependency-cruiser integration
        functionCount,
        debtMarkerRatio: lines.length > 0 ? debtMarkerCount / lines.length : 0,
      });
    } catch {
      // File read error
    }
  }

  return results;
}
