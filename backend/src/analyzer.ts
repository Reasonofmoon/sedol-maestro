// ============================================================
// Core Analysis Engine
// 실제 코드베이스를 분석해서 BoardState 생성
// GitHub clone 또는 업로드된 파일 모두 처리
// ============================================================

import * as fs from 'fs';
import * as path from 'path';

export interface FileEntry {
  path: string;
  content: string;
  lines: number;
}

export interface ModuleInfo {
  path: string;
  lines: number;
  complexity: number;
  debtRatio: number;
  imports: string[];
  importedBy: string[];
  hasTests: boolean;
  pageRank: number;
  health: number;
  inAtari: boolean;
  boardX: number;
  boardY: number;
}

export interface AnalysisResult {
  totalFiles: number;
  totalLines: number;
  avgComplexity: number;
  avgHealth: number;
  overallHealth: number;
  winRate: number;
  cycles: string[][];
  riskModules: string[];
  modules: ModuleInfo[];
  testCoverage: number;
}

// ── File collection ───────────────────────────────────────────

const CODE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.vue', '.py', '.go', '.java', '.cs', '.rb']);
const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', 'vendor', '.venv']);

export function collectFiles(rootDir: string): FileEntry[] {
  const files: FileEntry[] = [];
  const MAX_FILES = 200;
  const MAX_FILE_SIZE = 200_000; // 200KB

  function walk(dir: string) {
    if (files.length >= MAX_FILES) return;
    let entries: string[];
    try { entries = fs.readdirSync(dir); } catch { return; }

    for (const entry of entries) {
      if (files.length >= MAX_FILES) break;
      if (IGNORE_DIRS.has(entry)) continue;

      const fullPath = path.join(dir, entry);
      let stat: fs.Stats;
      try { stat = fs.statSync(fullPath); } catch { continue; }

      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (CODE_EXTS.has(path.extname(entry).toLowerCase())) {
        if (stat.size > MAX_FILE_SIZE) continue;
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const relPath = path.relative(rootDir, fullPath).replace(/\\/g, '/');
          files.push({ path: relPath, content, lines: content.split('\n').length });
        } catch { continue; }
      }
    }
  }

  walk(rootDir);
  return files;
}

// ── Import extraction ─────────────────────────────────────────

function extractImports(filePath: string, content: string, allPaths: string[]): string[] {
  const imports: string[] = [];
  const dir = path.dirname(filePath);

  // ES imports: import X from './y'
  const esImport = /import\s+.*?from\s+['"]([^'"]+)['"]/g;
  // require: require('./y')
  const cjsImport = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  // Python: from .module import X  or  import module
  const pyImport = /^(?:from\s+(\.[\w.]+)\s+import|import\s+([\w.]+))/gm;

  const patterns = [esImport, cjsImport, pyImport];
  for (const pattern of patterns) {
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(content)) !== null) {
      const raw = m[1] || m[2];
      if (!raw) continue;

      // Only resolve relative imports
      if (!raw.startsWith('.')) continue;

      const resolved = path.join(dir, raw).replace(/\\/g, '/');

      // Find matching file (with various extensions)
      for (const ext of ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.js']) {
        const candidate = resolved + ext;
        if (allPaths.includes(candidate)) {
          imports.push(candidate);
          break;
        }
      }
    }
  }

  return [...new Set(imports)];
}

// ── Cyclomatic complexity (simplified) ───────────────────────

function calcComplexity(content: string): number {
  const branches = [
    /\bif\b/g, /\belse\s+if\b/g, /\bfor\b/g, /\bwhile\b/g,
    /\bcase\b/g, /\bcatch\b/g, /\?\?/g, /&&/g, /\|\|/g,
    /\?\s/g,  // ternary
  ];
  let count = 1;
  for (const re of branches) {
    count += (content.match(re) || []).length;
  }
  return Math.min(count, 50);
}

// ── Debt markers ──────────────────────────────────────────────

function calcDebtRatio(content: string): number {
  const markers = (content.match(/\b(TODO|FIXME|HACK|XXX|NOSONAR|@deprecated)\b/gi) || []).length;
  const lines = content.split('\n').length;
  return Math.min(1, markers / Math.max(lines / 10, 1));
}

// ── PageRank ─────────────────────────────────────────────────

function computePageRank(modules: Map<string, ModuleInfo>): void {
  const damping = 0.85;
  const iters = 20;
  const paths = [...modules.keys()];
  const n = paths.length;
  if (n === 0) return;

  const pr: Record<string, number> = {};
  paths.forEach(p => pr[p] = 1 / n);

  for (let iter = 0; iter < iters; iter++) {
    const next: Record<string, number> = {};
    paths.forEach(p => next[p] = (1 - damping) / n);

    for (const [p, mod] of modules) {
      const outLinks = mod.imports.length;
      if (outLinks === 0) continue;
      const share = damping * pr[p] / outLinks;
      for (const imp of mod.imports) {
        if (next[imp] !== undefined) next[imp] += share;
      }
    }
    paths.forEach(p => pr[p] = next[p]);
  }

  // Normalize 0-1
  const max = Math.max(...Object.values(pr)) || 1;
  for (const [p, mod] of modules) {
    mod.pageRank = pr[p] / max;
  }
}

// ── Health score ──────────────────────────────────────────────

function calcHealth(mod: ModuleInfo): number {
  const normComplexity = Math.min(1, mod.complexity / 20);
  const isCyclic = false; // simplified
  const h = 1
    - 0.35 * normComplexity
    - 0.25 * mod.debtRatio
    - 0.20 * (isCyclic ? 1 : 0)
    - 0.20 * Math.min(1, mod.lines / 500);
  return Math.max(-1, Math.min(1, h));
}

// ── Cycle detection (simplified DFS) ─────────────────────────

function detectCycles(modules: Map<string, ModuleInfo>): string[][] {
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const cycles: string[][] = [];

  function dfs(node: string, stack: string[]) {
    visited.add(node);
    inStack.add(node);
    stack.push(node);

    const mod = modules.get(node);
    if (mod) {
      for (const dep of mod.imports) {
        if (!visited.has(dep)) {
          dfs(dep, stack);
        } else if (inStack.has(dep)) {
          const cycleStart = stack.indexOf(dep);
          if (cycleStart >= 0) {
            cycles.push([...stack.slice(cycleStart)]);
          }
        }
      }
    }

    stack.pop();
    inStack.delete(node);
  }

  for (const p of modules.keys()) {
    if (!visited.has(p)) dfs(p, []);
    if (cycles.length >= 5) break; // cap
  }

  return cycles;
}

// ── Board position mapping ────────────────────────────────────

function toBoardPos(filePath: string, pageRank: number, index: number, total: number): [number, number] {
  // x: based on health value (set after health calc)
  // y: based on pageRank (important modules at top)
  const hash = filePath.split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) & 0xFFFF, 0);
  const x = hash % 19;
  const y = Math.round(Math.min(18, Math.max(0, (1 - pageRank) * 14 + (index % 5))));
  return [x, y];
}

// ── Win-Rate calculation ──────────────────────────────────────

export function calcWinRate(result: Pick<AnalysisResult, 'avgHealth' | 'avgComplexity' | 'testCoverage' | 'modules'>): number {
  const healthScore = (result.avgHealth + 1) / 2;         // [-1,1] → [0,1]
  const testCoverage = result.testCoverage;
  const complexityInv = Math.max(0, 1 - result.avgComplexity / 20);
  const debtRatios = result.modules.map(m => m.debtRatio);
  const avgDebt = debtRatios.length > 0 ? debtRatios.reduce((a, b) => a + b, 0) / debtRatios.length : 0;
  const debtRatioInv = Math.max(0, 1 - avgDebt * 5);

  const raw = healthScore * 0.35 + testCoverage * 0.25 + complexityInv * 0.20 + 0.5 * 0.10 + debtRatioInv * 0.10;
  return Math.round(Math.max(0, Math.min(100, raw * 100)));
}

// ── Main analysis entry point ─────────────────────────────────

export function analyzeFiles(files: FileEntry[]): AnalysisResult {
  const allPaths = files.map(f => f.path);
  const testPaths = new Set(files.filter(f => /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(f.path)).map(f => f.path));

  // Build module map
  const modules = new Map<string, ModuleInfo>();

  for (const file of files) {
    const imports = extractImports(file.path, file.content, allPaths);
    const mod: ModuleInfo = {
      path: file.path,
      lines: file.lines,
      complexity: calcComplexity(file.content),
      debtRatio: calcDebtRatio(file.content),
      imports,
      importedBy: [],
      hasTests: testPaths.has(file.path) ||
        files.some(f => f.path.replace(/\.(test|spec)/, '') === file.path.replace(/\.(ts|tsx|js|jsx)$/, '')),
      pageRank: 0,
      health: 0,
      inAtari: false,
      boardX: 0,
      boardY: 0,
    };
    modules.set(file.path, mod);
  }

  // Build importedBy
  for (const [p, mod] of modules) {
    for (const imp of mod.imports) {
      const target = modules.get(imp);
      if (target) target.importedBy.push(p);
    }
  }

  // PageRank
  computePageRank(modules);

  // Health
  for (const mod of modules.values()) {
    mod.health = calcHealth(mod);
    mod.inAtari = mod.health < -0.3;
  }

  // Cycles
  const cycles = detectCycles(modules);
  const cycleFiles = new Set(cycles.flat());

  // Board positions
  const sorted = [...modules.values()].sort((a, b) => b.pageRank - a.pageRank);
  const usedPositions = new Set<string>();

  sorted.forEach((mod, i) => {
    let [x, y] = toBoardPos(mod.path, mod.pageRank, i, sorted.length);
    // Avoid overlap
    while (usedPositions.has(`${x},${y}`)) {
      x = (x + 1) % 19;
    }
    usedPositions.add(`${x},${y}`);
    mod.boardX = x;
    mod.boardY = y;
  });

  const modList = [...modules.values()];
  const nonTestMods = modList.filter(m => !testPaths.has(m.path));

  const totalFiles = modList.length;
  const totalLines = modList.reduce((s, m) => s + m.lines, 0);
  const avgComplexity = nonTestMods.length > 0
    ? nonTestMods.reduce((s, m) => s + m.complexity, 0) / nonTestMods.length : 0;
  const avgHealth = nonTestMods.length > 0
    ? nonTestMods.reduce((s, m) => s + m.health, 0) / nonTestMods.length : 0;
  const testCoverage = totalFiles > 0 ? modList.filter(m => m.hasTests).length / totalFiles : 0;

  const riskModules = nonTestMods
    .filter(m => m.inAtari)
    .sort((a, b) => a.health - b.health)
    .slice(0, 8)
    .map(m => m.path);

  const result: AnalysisResult = {
    totalFiles,
    totalLines,
    avgComplexity,
    avgHealth,
    overallHealth: avgHealth,
    testCoverage,
    winRate: 0,
    cycles,
    riskModules,
    modules: modList,
  };
  result.winRate = calcWinRate(result);

  return result;
}
