/**
 * 碁道코딩 — Plan Renderer
 *
 * Renders MCTS search results as a development roadmap.
 * Shows the optimal n-step plan with cumulative ΔHealth.
 */

import type { SearchResult, PathStep } from '../search/mcts-engine.js';
import type { MCTSNode } from '../search/mcts-node.js';

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const FG = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function moveTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    'fuseki': '🏗️', 'joseki': '📐', 'sente': '⚡',
    'gote': '🛡️', 'attack': '⚔️', 'defend': '🏰', 'review': '📖',
  };
  return icons[type] || '♟️';
}

function healthDelta(delta: number): string {
  const color = delta >= 0 ? FG.green : FG.red;
  const sign = delta >= 0 ? '+' : '';
  return `${color}${sign}${delta.toFixed(2)}${RESET}`;
}

/**
 * Render an ASCII tree visualization of the MCTS search.
 */
function renderMiniTree(root: MCTSNode, maxDepth: number = 2): string[] {
  const lines: string[] = [];

  function walk(node: MCTSNode, prefix: string, isLast: boolean, depth: number): void {
    if (depth > maxDepth) return;

    const connector = depth === 0 ? '' : isLast ? '└── ' : '├── ';
    const childPrefix = depth === 0 ? '' : isLast ? '    ' : '│   ';

    const label = node.action
      ? `${node.action.actionKind} → ${node.action.target.length > 25 ? '…' + node.action.target.slice(-24) : node.action.target}`
      : 'ROOT';
    const visits = `N=${node.visits}`;
    const q = node.visits > 0 ? (node.totalValue / node.visits).toFixed(2) : '—';

    lines.push(`${prefix}${connector}${DIM}${label}${RESET} ${FG.gray}(${visits}, Q=${q})${RESET}`);

    const children = [...node.children].sort((a, b) => b.visits - a.visits).slice(0, 3);
    for (let i = 0; i < children.length; i++) {
      walk(children[i], prefix + childPrefix, i === children.length - 1, depth + 1);
    }
  }

  walk(root, '  ', true, 0);
  return lines;
}

/**
 * Render the search plan result — the "n수 앞 개발 경로".
 */
export function renderPlan(result: SearchResult, startHealth: number): string {
  const lines: string[] = [];

  // Header
  lines.push('');
  lines.push(`${BOLD}${FG.cyan}  ┌──────────────────────────────────────────────────┐${RESET}`);
  lines.push(`${BOLD}${FG.cyan}  │     碁道코딩 — 개발 경로 탐색 (n-Step Plan)        │${RESET}`);
  lines.push(`${BOLD}${FG.cyan}  └──────────────────────────────────────────────────┘${RESET}`);
  lines.push('');

  // Config
  lines.push(`  ${DIM}Simulations: ${result.totalSimulations}  |  Depth: ${result.config.maxDepth}  |  c_puct: ${result.config.cPuct}${RESET}`);
  lines.push('');

  // Best Path
  if (result.bestPath.length === 0) {
    lines.push(`  ${FG.yellow}No development path found. The codebase may already be in optimal state.${RESET}`);
  } else {
    lines.push(`  ${BOLD}최적 개발 경로 (${result.bestPath.length}수)${RESET}`);
    lines.push(`  ${FG.gray}${'─'.repeat(60)}${RESET}`);

    let prevHealth = startHealth;

    for (const step of result.bestPath) {
      const icon = moveTypeIcon(step.action.type);
      const delta = step.evaluation.deltaHealth;

      lines.push('');
      lines.push(`  ${BOLD}${icon} [${step.depth}수] ${step.action.intent}${RESET}`);
      lines.push(`     ${FG.cyan}${step.action.type}${RESET} | ${step.action.actionKind} | Target: ${FG.gray}${step.action.target}${RESET}`);
      lines.push(`     ΔHealth: ${healthDelta(delta)}  →  Cumulative: ${healthDelta(step.cumulativeHealth - startHealth)}`);

      // Health progress bar
      const progress = Math.round(((step.cumulativeHealth + 1) / 2) * 20);
      const bar = `${'█'.repeat(Math.max(0, progress))}${'░'.repeat(Math.max(0, 20 - progress))}`;
      lines.push(`     Health:  ${prevHealth < 0 ? FG.red : FG.green}${bar}${RESET} ${step.cumulativeHealth.toFixed(2)}`);

      prevHealth = step.cumulativeHealth;
    }

    lines.push('');
    lines.push(`  ${FG.gray}${'─'.repeat(60)}${RESET}`);

    // Summary
    const totalDelta = result.bestPath[result.bestPath.length - 1].cumulativeHealth - startHealth;
    lines.push('');
    lines.push(`  ${BOLD}${FG.green}▶ 총 Health 변화: ${healthDelta(totalDelta)}${RESET}`);
    lines.push(`    ${DIM}${startHealth.toFixed(2)} → ${result.bestPath[result.bestPath.length - 1].cumulativeHealth.toFixed(2)}${RESET}`);
  }

  // MCTS Tree (compact visualization)
  lines.push('');
  lines.push(`  ${BOLD}탐색 트리 (Search Tree)${RESET}`);
  lines.push(...renderMiniTree(result.root, 2));

  // Reflections (복기)
  if (result.reflections.length > 0) {
    lines.push('');
    lines.push(`  ${BOLD}${FG.yellow}復棋 (Reflections)${RESET}`);
    for (const r of result.reflections.slice(0, 3)) {
      const truncated = r.length > 120 ? r.substring(0, 117) + '...' : r;
      lines.push(`  ${DIM}💭 ${truncated}${RESET}`);
    }
  }

  lines.push('');
  return lines.join('\n');
}
