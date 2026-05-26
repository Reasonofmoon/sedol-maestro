// ============================================================
// Move Ranker — Ranks candidates by PUCT + Myo detection
// Produces the final probability display panel
//
// Panel format (KataGo-inspired):
// ★ 1. [묘수] Extract AuthService   83%  N=34  Q=0.78  ΔH+0.19
// ○ 2. [선수] Add Tests              54%  N=8   Q=0.52  ΔH+0.12
// ============================================================

import type { MCTSNode } from '@baduck/mcts';
import type { DevAction } from '@baduck/encoder';
import { detectMyo } from '@baduck/mcts';
import type { MyoContext, MyoResult } from '@baduck/mcts';
import { projectedWinRate } from './win-rate';
import type { BoardState } from '@baduck/encoder';

export interface RankedMove {
  rank: number;
  action: DevAction;
  node: MCTSNode;
  probability: number;      // 0-100 (visit count distribution)
  projectedWinRate: number; // win-rate after this move
  deltaWinRate: number;     // change from current
  myo: MyoResult;
  puctScore: number;
  displayBar: string;       // ████████░░░ probability bar
}

export function rankMoves(
  root: MCTSNode,
  board: BoardState,
  currentWinRate: number,
  ctx: MyoContext,
): RankedMove[] {
  const children = root.children
    .filter(c => c.visits > 0 || c.action !== undefined)
    .sort((a, b) => b.visits - a.visits);

  if (children.length === 0) return [];

  const totalVisits = children.reduce((s, c) => s + c.visits, 0) || 1;

  return children.map((node, i) => {
    const action = node.action!;
    const probability = Math.round((node.visits / totalVisits) * 100);
    const topChildren = node.children.sort((a, b) => b.getQ() - a.getQ()).slice(0, 3);
    const myo = detectMyo(action, node, topChildren, ctx);
    const projected = projectedWinRate(board, action.deltaHealth, currentWinRate);
    const deltaWinRate = projected - currentWinRate;

    return {
      rank: i + 1,
      action,
      node,
      probability,
      projectedWinRate: projected,
      deltaWinRate,
      myo,
      puctScore: node.puctScore(root.visits),
      displayBar: buildBar(probability),
    };
  });
}

/** ASCII probability bar (30 chars) */
function buildBar(pct: number): string {
  const filled = Math.round(pct / 3.33);
  return '█'.repeat(filled) + '░'.repeat(30 - filled);
}

/** Format the full candidates panel for CLI output */
export function formatCandidatesPanel(moves: RankedMove[], totalSims: number, elapsedMs: number): string {
  const lines: string[] = [];
  lines.push(`┌──────────────────────────────────────────────────────────────────┐`);
  lines.push(`│  NEXT MOVE CANDIDATES         MCTS: ${totalSims} sims / ${(elapsedMs/1000).toFixed(1)}s  │`);
  lines.push(`├──────────────────────────────────────────────────────────────────┤`);

  for (const m of moves) {
    const { myo, action, probability, node, deltaWinRate } = m;
    const dHStr = action.deltaHealth >= 0 ? `+${action.deltaHealth.toFixed(2)}` : action.deltaHealth.toFixed(2);
    const dWStr = deltaWinRate >= 0 ? `+${deltaWinRate}%` : `${deltaWinRate}%`;
    lines.push(`│`);
    lines.push(`│  ${myo.badgeLabel.padEnd(5)} ${m.rank}. [${action.type.padEnd(6)}] ${action.intent.slice(0,35).padEnd(35)} ΔH${dHStr} ΔW${dWStr}`);
    lines.push(`│     ${m.displayBar}  ${probability}%  N=${node.visits}  Q=${node.getQ().toFixed(2)}`);
    if (myo.reasons.length > 0) {
      lines.push(`│     → ${myo.reasons[0]}`);
    }
  }

  lines.push(`│`);
  lines.push(`└──────────────────────────────────────────────────────────────────┘`);
  return lines.join('\n');
}
