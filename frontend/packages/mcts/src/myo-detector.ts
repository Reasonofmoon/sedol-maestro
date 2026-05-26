// ============================================================
// 묘수(妙手) Detector
// A brilliant move in Go: appears suboptimal at first,
// but considers the whole board and creates sente chains.
//
// Myo Conditions:
//   1. Q > Prior × 1.5  — non-obvious, MCTS reveals true value
//   2. Sente chain ≥ 3  — all following moves are also sente
//   3. Multi-risk solved — resolves ≥ 2 at-risk modules
// ============================================================

import type { MCTSNode } from './mcts-node';
import type { DevAction } from '@baduck/encoder';

export interface MyoResult {
  isMyo: boolean;
  myoScore: number;       // higher = more brilliant
  reasons: string[];
  qToPriorRatio: number;
  sentteChainLength: number;
  risksResolved: number;
  badgeLabel: '★묘수' | '○선수' | '○정석' | '△후수' | '✗실착';
}

export interface MyoContext {
  atariModules: string[];  // modules currently in atari (health < -0.5)
  cycles: string[][];      // circular dependency chains (Ko)
}

export function detectMyo(
  action: DevAction,
  node: MCTSNode,
  topChildren: MCTSNode[],
  ctx: MyoContext,
): MyoResult {
  const reasons: string[] = [];
  let myoScore = 0;

  // ── Condition 1: Q >> Prior (non-obvious brilliance) ────
  const qToPriorRatio = node.prior > 0
    ? node.getQ() / node.prior
    : node.getQ() > 0 ? 2 : 0;

  const condition1 = qToPriorRatio > 1.5 && node.visits >= 3;
  if (condition1) {
    myoScore += qToPriorRatio * 10;
    reasons.push(`Q/Prior = ${qToPriorRatio.toFixed(2)} (MCTS가 진가를 발견함)`);
  }

  // ── Condition 2: Creates sente chain ────────────────────
  const sentteChainLength = countSenteChain(topChildren, 3);
  const condition2 = sentteChainLength >= 2;
  if (condition2) {
    myoScore += sentteChainLength * 8;
    reasons.push(`연쇄 선수 ${sentteChainLength}수 생성`);
  }

  // ── Condition 3: Resolves multiple risks ─────────────────
  const risksResolved = countResolvedRisks(action, ctx.atariModules);
  const condition3 = risksResolved >= 2;
  if (condition3) {
    myoScore += risksResolved * 12;
    reasons.push(`단수 ${risksResolved}개 동시 해소`);
  }

  // ── Badge classification ──────────────────────────────────
  const isMyo = condition1 && (condition2 || condition3) && action.deltaHealth >= 0.12;
  const badgeLabel = classifyBadge(action, node, isMyo);

  if (isMyo) {
    reasons.push(`전체 판 고려한 수 — 묘수`);
  }

  return {
    isMyo,
    myoScore: Math.round(myoScore),
    reasons,
    qToPriorRatio: Math.round(qToPriorRatio * 100) / 100,
    sentteChainLength,
    risksResolved,
    badgeLabel,
  };
}

// ── Helpers ───────────────────────────────────────────────

function countSenteChain(topChildren: MCTSNode[], maxDepth: number): number {
  let count = 0;
  for (const child of topChildren.slice(0, maxDepth)) {
    if (child.getQ() > 0.05) count++;
    else break;
  }
  return count;
}

function countResolvedRisks(action: DevAction, atariModules: string[]): number {
  return atariModules.filter(m =>
    action.target === m ||
    action.intent.toLowerCase().includes(m.split('/').pop()?.toLowerCase() ?? '')
  ).length;
}

function classifyBadge(
  action: DevAction,
  node: MCTSNode,
  isMyo: boolean,
): MyoResult['badgeLabel'] {
  if (isMyo) return '★묘수';
  if (action.deltaHealth < -0.10) return '✗실착';
  if (action.deltaHealth < 0) return '△후수';
  if (action.type === 'joseki') return '○정석';
  if (action.type === 'sente' || action.prior >= 0.55) return '○선수';
  return '△후수';
}
