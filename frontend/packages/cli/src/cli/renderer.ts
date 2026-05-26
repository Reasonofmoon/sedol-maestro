/**
 * 碁道코딩 — Terminal Renderer
 *
 * Renders BoardState data in a premium terminal UI.
 * Uses chalk for color-coded heatmaps and structured output.
 *
 * Inspired by KataGo's ownership visualization:
 * - 녹색(Green) = 건강 (+1.0)
 * - 노란색(Yellow) = 주의 (0.0)
 * - 빨간색(Red) = 위험 (-1.0)
 */

import type { BoardState, OwnershipEntry } from '../encoder/types.js';

// ── ANSI color helpers (no dependency on chalk for portability) ──
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const FG = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};
const BG = {
  red: '\x1b[41m',
  green: '\x1b[42m',
  yellow: '\x1b[43m',
};

function healthToColor(health: number): string {
  if (health >= 0.5) return FG.green;
  if (health >= 0.0) return FG.yellow;
  if (health >= -0.5) return FG.red;
  return `${BOLD}${FG.red}`;
}

function healthToBar(health: number, width: number = 20): string {
  const normalized = (health + 1) / 2; // map [-1,1] to [0,1]
  const filled = Math.round(normalized * width);
  const empty = width - filled;
  const color = healthToColor(health);
  return `${color}${'█'.repeat(filled)}${DIM}${'░'.repeat(empty)}${RESET}`;
}

function healthToEmoji(health: number): string {
  if (health >= 0.7) return '🟢';
  if (health >= 0.3) return '🟡';
  if (health >= 0.0) return '🟠';
  return '🔴';
}

/**
 * Render the full board scan result — the "形勢圖 (positional map)".
 */
export function renderBoardState(state: BoardState): string {
  const lines: string[] = [];
  const { summary } = state;

  // ── Header ──
  lines.push('');
  lines.push(`${BOLD}${FG.cyan}  ┌──────────────────────────────────────────────────┐${RESET}`);
  lines.push(`${BOLD}${FG.cyan}  │          碁道코딩 — 形勢圖 (Board Scan)           │${RESET}`);
  lines.push(`${BOLD}${FG.cyan}  └──────────────────────────────────────────────────┘${RESET}`);
  lines.push('');

  // ── Project Summary ──
  const overallEmoji = healthToEmoji(summary.overallHealth);
  lines.push(`  ${BOLD}프로젝트 형세 판단${RESET}`);
  lines.push(`  ${overallEmoji} Overall Health: ${healthToColor(summary.overallHealth)}${summary.overallHealth.toFixed(2)}${RESET}  ${healthToBar(summary.overallHealth, 25)}`);
  lines.push(`  ${FG.gray}   Files: ${summary.totalFiles}  |  Lines: ${summary.totalLines.toLocaleString()}  |  Avg Complexity: ${summary.avgComplexity}  |  Cycles: ${summary.cycleCount}${RESET}`);
  lines.push('');

  // ── Sente Meter ──
  const senteScore = Math.max(0, Math.min(100, Math.round((summary.overallHealth + 1) * 50)));
  lines.push(`  ${BOLD}選手 (Sente) Initiative${RESET}`);
  lines.push(`  ${FG.gray}Gote (後手)${RESET} ${healthToBar(summary.overallHealth, 30)} ${FG.gray}Sente (先手)${RESET}`);
  lines.push(`  ${DIM}${senteScore}% — ${senteScore >= 60 ? '선수를 잡고 있습니다' : senteScore >= 40 ? '균형 상태입니다' : '기술 부채에 끌려가고 있습니다'}${RESET}`);
  lines.push('');

  // ── Top Modules (大馬, Critical Groups) ──
  if (summary.topModules.length > 0) {
    lines.push(`  ${BOLD}大馬 (Critical Modules) — PageRank Top 5${RESET}`);
    for (const mod of summary.topModules) {
      const entry = state.ownershipMap.get(mod.filePath);
      const health = entry?.health ?? 0;
      lines.push(`  ${healthToEmoji(health)} ${FG.cyan}${mod.filePath.padEnd(45)}${RESET} PR: ${mod.pageRank.toFixed(4)}  Health: ${healthToColor(health)}${health.toFixed(2)}${RESET}`);
    }
    lines.push('');
  }

  // ── Risk Modules (死石, Dead Stones) ──
  if (summary.riskModules.length > 0) {
    lines.push(`  ${BOLD}${FG.red}死石 (Risk Modules) — Health < 0${RESET}`);
    for (const mod of summary.riskModules) {
      lines.push(`  🔴 ${FG.red}${mod.filePath.padEnd(45)}${RESET} Health: ${BOLD}${FG.red}${mod.health.toFixed(2)}${RESET}`);
    }
    lines.push('');
  }

  // ── Ownership Heatmap (소유권 맵) ──
  lines.push(`  ${BOLD}所有權 맵 (Ownership Heatmap)${RESET}`);
  lines.push(`  ${FG.gray}${'─'.repeat(70)}${RESET}`);

  const entries = [...state.ownershipMap.values()]
    .sort((a, b) => a.health - b.health);

  for (const entry of entries) {
    const bar = healthToBar(entry.health, 15);
    const name = entry.filePath.length > 42 
      ? '…' + entry.filePath.slice(-41)
      : entry.filePath.padEnd(42);
    lines.push(`  ${healthToEmoji(entry.health)} ${name} ${bar} ${healthToColor(entry.health)}${entry.health.toFixed(2).padStart(6)}${RESET}`);
  }

  lines.push(`  ${FG.gray}${'─'.repeat(70)}${RESET}`);

  // ── Cycles (패, Ko) ──
  if (state.graph.cycles.length > 0) {
    lines.push('');
    lines.push(`  ${BOLD}${FG.yellow}패 (Ko) — Circular Dependencies${RESET}`);
    for (const cycle of state.graph.cycles.slice(0, 3)) {
      lines.push(`  ${FG.yellow}⟳ ${cycle.join(' → ')}${RESET}`);
    }
  }

  lines.push('');
  lines.push(`  ${DIM}Scanned at ${state.scannedAt}${RESET}`);
  lines.push('');

  return lines.join('\n');
}
