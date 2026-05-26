/**
 * 碁道코딩 Board Encoder — Types
 * 
 * Core type definitions mapping Go board concepts to codebase analysis.
 * 바둑판의 교차점 = 코드 모듈, 돌 = 커밋된 코드, 집 = 작동하는 기능 영역
 */

// ── Symbol extracted from AST ──
export interface SymbolNode {
  name: string;
  kind: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'export' | 'import' | 'method';
  filePath: string;
  startLine: number;
  endLine: number;
}

export interface FileSymbols {
  filePath: string;
  definitions: SymbolNode[];
  imports: { name: string; from: string }[];
  exports: string[];
  lineCount: number;
}

// ── Dependency Graph ──
export interface DependencyEdge {
  from: string; // source file
  to: string;   // target file
  type: 'import' | 'dynamic-import' | 'require' | 're-export';
}

export interface GraphNode {
  filePath: string;
  inDegree: number;
  outDegree: number;
  pageRank: number;
  isCyclic: boolean;
}

export interface DependencyGraph {
  nodes: Map<string, GraphNode>;
  edges: DependencyEdge[];
  cycles: string[][];
}

// ── Code Metrics ──
export interface ModuleMetrics {
  filePath: string;
  lineCount: number;
  cyclomaticComplexity: number;
  /** Number of dependency-cruiser rule violations */
  violations: number;
  /** Number of functions/methods */
  functionCount: number;
  /** Ratio of TODO/FIXME/HACK comments to total lines */
  debtMarkerRatio: number;
}

// ── Ownership Map (KataGo Ownership Map 대응) ──
export interface OwnershipEntry {
  filePath: string;
  /** Health score: -1.0 (critical risk) to +1.0 (excellent health) */
  health: number;
  /** Individual dimension scores */
  dimensions: {
    complexity: number;   // 0-1, lower is better
    debtRatio: number;    // 0-1, lower is better
    violations: number;   // count
    importance: number;   // PageRank score
  };
}

// ── Board State (피트니스 벡터 인코딩) ──
export interface ProjectSummary {
  totalFiles: number;
  totalLines: number;
  avgComplexity: number;
  avgHealth: number;
  cycleCount: number;
  topModules: { filePath: string; pageRank: number }[];
  riskModules: { filePath: string; health: number }[];
  /** Overall project health: -1.0 to +1.0 */
  overallHealth: number;
}

export interface BoardState {
  /** Timestamp of when this scan was taken */
  scannedAt: string;
  /** Root directory of the project */
  rootDir: string;
  /** Dependency graph with PageRank */
  graph: DependencyGraph;
  /** Per-file code metrics */
  metrics: ModuleMetrics[];
  /** KataGo-style ownership/health map */
  ownershipMap: Map<string, OwnershipEntry>;
  /** Aggregate project summary */
  summary: ProjectSummary;
}

// ── Dev Actions (바둑의 착수(手) 대응) ──
export type MoveType = 'fuseki' | 'joseki' | 'sente' | 'gote' | 'attack' | 'defend' | 'review';

export interface DevAction {
  id: string;
  type: MoveType;
  actionKind: 'refactor' | 'add-test' | 'fix-bug' | 'extract-module' | 'reduce-complexity' | 'remove-dead-code' | 'add-error-handling' | 'update-dependency';
  target: string;   // file or module path
  intent: string;   // human-readable justification
  prior: number;    // 사전확률 (0-1)
  deltaHealth: number; // projected ΔHealth
  rationale: string;   // detailed reasoning
}
