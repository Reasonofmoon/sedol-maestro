// ============================================================
// UKDL Bridge — BoardState → UKDL Document
// Converts code analysis results into an executable .ukdl file
// that captures quantum states, entities, relations, and context
// ============================================================

import type { BoardState, OwnershipEntry, DevAction } from '@baduck/encoder';

// ── Types ──────────────────────────────────────────────────

export interface UKDLDocument {
  meta: UKDLMeta;
  nodes: string;  // full UKDL text
}

interface UKDLMeta {
  sessionId: string;
  rootDir: string;
  scannedAt: string;
  winRate: number;
}

// ── Board → UKDL ───────────────────────────────────────────

export function boardToUKDL(
  board: BoardState,
  sessionId: string,
  winRate: number,
  moves: DevAction[] = [],
): string {
  const lines: string[] = [];

  // meta node
  lines.push(`:: meta id=session-${sessionId}`);
  lines.push(`  title: Baduck Session ${new Date().toISOString().slice(0,10)}`);
  lines.push(`  version: 1.0.0`);
  lines.push(`  date: ${new Date().toISOString().slice(0,10)}`);
  lines.push(`  level: L5`);
  lines.push(`  root-dir: ${board.rootDir}`);
  lines.push(`  scanned-at: ${board.scannedAt}`);
  lines.push(`  win-rate: ${winRate}`);
  lines.push(`  total-files: ${board.summary.totalFiles}`);
  lines.push(`  overall-health: ${board.summary.overallHealth.toFixed(3)}`);
  lines.push(``);

  // entity node per top module (top 20 by importance)
  const topModules = [...board.summary.topModules].slice(0, 20);
  for (const filePath of topModules) {
    const ownership = board.ownershipMap.get(filePath);
    const metrics = board.metrics.get(filePath);
    const graphNode = board.graph.nodes.get(filePath);
    if (!ownership || !metrics || !graphNode) continue;

    const id = filePathToId(filePath);
    const inAtari = ownership.health < -0.5;
    const [bx, by] = healthToBoard(ownership.health, graphNode.pageRank, topModules.indexOf(filePath));

    lines.push(`:: entity id=ent:${id} type=System`);
    lines.push(`  name: ${filePath.split('/').pop()}`);
    lines.push(`  path: ${filePath}`);
    lines.push(`  health: ${ownership.health.toFixed(3)}`);
    lines.push(`  complexity: ${metrics.cyclomaticComplexity}`);
    lines.push(`  test-coverage: 0`);
    lines.push(`  page-rank: ${graphNode.pageRank.toFixed(4)}`);
    lines.push(`  in-degree: ${graphNode.inDegree}`);
    lines.push(`  out-degree: ${graphNode.outDegree}`);
    lines.push(`  in-atari: ${inAtari}`);
    lines.push(`  is-cyclic: ${graphNode.isCyclic}`);
    lines.push(`  board-pos: [${bx}, ${by}]`);
    lines.push(``);
  }

  // rel nodes for edges (top 30 by importance)
  let relCount = 0;
  for (const edge of board.graph.edges) {
    if (relCount >= 30) break;
    const fromId = filePathToId(edge.from);
    const toId = filePathToId(edge.to);
    lines.push(`:: rel id=rel:${fromId}-to-${toId}`);
    lines.push(`  from: @ent:${fromId}`);
    lines.push(`  to: @ent:${toId}`);
    lines.push(`  type: ${edge.type}`);
    lines.push(``);
    relCount++;
  }

  // quantum nodes for project state
  lines.push(...buildQuantumNodes(board));

  // action nodes for committed moves
  for (const move of moves) {
    lines.push(...buildActionNode(move));
  }

  // context node — compressed board state for LLM
  lines.push(`:: context id=ctx:board-state priority=critical depth=standard`);
  lines.push(`  summary: ${buildContextSummary(board, winRate)}`);
  lines.push(`  tokens: ${estimateTokens(board)}`);
  lines.push(`  phase: priority`);
  lines.push(``);

  return lines.join('\n');
}

// ── Quantum State Builder ──────────────────────────────────

function buildQuantumNodes(board: BoardState): string[] {
  const lines: string[] = [];
  const h = board.summary.overallHealth;

  // Project risk quantum state — derived from health
  const critical = Math.max(0, (-h - 0.3) / 0.7);
  const high = Math.max(0, Math.min(1, (0.3 - h) / 0.6));
  const medium = Math.max(0, Math.min(1, (h + 0.5) / 0.8));
  const low = Math.max(0, h);
  const total = critical + high + medium + low || 1;

  lines.push(`:: quantum id=qst:project-risk`);
  lines.push(`  states:`);
  lines.push(`    critical: ${(critical / total).toFixed(3)}`);
  lines.push(`    high: ${(high / total).toFixed(3)}`);
  lines.push(`    medium: ${(medium / total).toFixed(3)}`);
  lines.push(`    low: ${(low / total).toFixed(3)}`);
  lines.push(`  observe-on: [move-completed, test-added, refactor-done]`);
  lines.push(`  entangle: @qst:project-velocity`);
  lines.push(``);

  // Cycle count affects architecture clarity
  const cycles = board.graph.cycles.length;
  const clear = Math.max(0, 1 - cycles * 0.15);
  const evolving = Math.min(0.6, cycles * 0.12);
  const muddy = 1 - clear - evolving;

  lines.push(`:: quantum id=qst:architecture-clarity`);
  lines.push(`  states:`);
  lines.push(`    clear: ${clear.toFixed(3)}`);
  lines.push(`    evolving: ${evolving.toFixed(3)}`);
  lines.push(`    muddy: ${Math.max(0, muddy).toFixed(3)}`);
  lines.push(`  observe-on: [refactor-done, pattern-applied]`);
  lines.push(``);

  return lines;
}

// ── Action Node Builder ────────────────────────────────────

function buildActionNode(action: DevAction): string[] {
  const lines: string[] = [];
  lines.push(`:: action id=${action.id} type=${action.type}`);
  lines.push(`  kind: ${action.actionKind}`);
  lines.push(`  target: @ent:${filePathToId(action.target)}`);
  lines.push(`  intent: ${action.intent}`);
  lines.push(`  prior: ${action.prior.toFixed(3)}`);
  lines.push(`  delta-health: ${action.deltaHealth.toFixed(3)}`);
  lines.push(`  rationale: ${action.rationale}`);
  lines.push(``);
  return lines;
}

// ── Helpers ───────────────────────────────────────────────

function filePathToId(filePath: string): string {
  return filePath
    .replace(/^\.\//, '')
    .replace(/\//g, '-')
    .replace(/\.(ts|tsx|js|jsx)$/, '')
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .toLowerCase()
    .slice(0, 40);
}

function healthToBoard(health: number, pageRank: number, index: number): [number, number] {
  // Map health [-1,1] and pageRank [0,1] to board coordinates [0,18]
  const x = Math.round(Math.min(18, Math.max(0, (health + 1) / 2 * 18)));
  const y = Math.round(Math.min(18, Math.max(0, pageRank * 18 * 3)));
  return [x, y];
}

function estimateTokens(board: BoardState): number {
  return board.summary.totalFiles * 12 + board.graph.edges.length * 5;
}

function buildContextSummary(board: BoardState, winRate: number): string {
  const risks = board.summary.riskModules.slice(0, 3).map(r => r.split('/').pop()).join(', ');
  const cycles = board.graph.cycles.length;
  return `Win-Rate ${winRate}% | 전체 ${board.summary.totalFiles}개 파일 | 위험: ${risks || '없음'} | 패(순환) ${cycles}개 | 건강도 ${board.summary.overallHealth.toFixed(2)}`;
}
