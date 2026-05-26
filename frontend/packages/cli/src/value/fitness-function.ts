/**
 * 碁道코딩 — Fitness Function (Value Engine)
 *
 * AlphaGo의 가치 네트워크(Value Network) 대응.
 * 각 후보 행동의 예상 ΔHealth를 계산한다.
 *
 * KataGo의 유틸리티 공식:
 *   utility = winrate_utility + c_score × score_utility(score)
 *
 * 碁道코딩의 유틸리티 공식:
 *   utility = w₁·Δcoverage + w₂·Δcomplexity + w₃·Δdebt + w₄·Δfeature
 */

import type { BoardState, DevAction } from '../encoder/types.js';

/** Fitness function weights — tunable per project via .gido/config */
const FITNESS_WEIGHTS = {
  complexityReduction: 0.30,
  debtReduction: 0.25,
  structuralImprovement: 0.25,
  featureValue: 0.20,
};

export interface FitnessEvaluation {
  /** The action being evaluated */
  action: DevAction;
  /** Estimated health change: [-1.0, +1.0] */
  deltaHealth: number;
  /** Individual dimension contributions */
  breakdown: {
    complexityDelta: number;
    debtDelta: number;
    structuralDelta: number;
    featureDelta: number;
  };
  /** Overall goodness classification */
  category: 'brilliant' | 'good' | 'inaccurate' | 'mistake' | 'blunder';
  /** Korean Go term for the category */
  badukTerm: string;
}

/**
 * Classify a ΔHealth score into a Go-style move quality category.
 * 
 * Mirrors KataGo's ΔWR classification:
 * - ΔWR ≥ 0    → Best or better
 * - -5% < ΔWR   → Inaccuracy
 * - -10% < ΔWR  → Mistake
 * - ΔWR ≤ -10%  → Blunder
 */
function classifyMove(deltaHealth: number): { category: FitnessEvaluation['category']; badukTerm: string } {
  if (deltaHealth >= 0.15) return { category: 'brilliant', badukTerm: '묘수(妙手) — Brilliant Move' };
  if (deltaHealth >= 0.0)  return { category: 'good', badukTerm: '본수(本手) — Proper Move' };
  if (deltaHealth > -0.05) return { category: 'inaccurate', badukTerm: '의문수(疑問手) — Questionable' };
  if (deltaHealth > -0.10) return { category: 'mistake', badukTerm: '악수(惡手) — Bad Move' };
  return { category: 'blunder', badukTerm: '대악수(大惡手) — Blunder' };
}

/**
 * Estimate the fitness impact of a DevAction on the current BoardState.
 * 
 * This is a heuristic simulation — it estimates what would happen
 * if the action were executed, without actually modifying any files.
 * 
 * Think of it as AlphaGo Zero's value head evaluating a position
 * without performing rollouts.
 */
function estimateActionImpact(action: DevAction, state: BoardState): FitnessEvaluation['breakdown'] {
  const targetEntry = state.ownershipMap.get(action.target);
  const targetNode = state.graph.nodes.get(action.target);

  // Base estimates per action kind
  const impacts: Record<string, FitnessEvaluation['breakdown']> = {
    'reduce-complexity': {
      complexityDelta: 0.15,
      debtDelta: 0.02,
      structuralDelta: 0.05,
      featureDelta: 0.0,
    },
    'add-test': {
      complexityDelta: 0.0,
      debtDelta: 0.05,
      structuralDelta: 0.03,
      featureDelta: 0.02,
    },
    'refactor': {
      complexityDelta: 0.10,
      debtDelta: 0.10,
      structuralDelta: 0.08,
      featureDelta: -0.02,
    },
    'fix-bug': {
      complexityDelta: 0.02,
      debtDelta: 0.05,
      structuralDelta: 0.0,
      featureDelta: 0.10,
    },
    'extract-module': {
      complexityDelta: 0.12,
      debtDelta: 0.03,
      structuralDelta: 0.20,
      featureDelta: 0.0,
    },
    'remove-dead-code': {
      complexityDelta: 0.08,
      debtDelta: 0.12,
      structuralDelta: 0.05,
      featureDelta: 0.0,
    },
    'add-error-handling': {
      complexityDelta: -0.03,
      debtDelta: 0.05,
      structuralDelta: 0.02,
      featureDelta: 0.08,
    },
    'update-dependency': {
      complexityDelta: 0.0,
      debtDelta: 0.10,
      structuralDelta: 0.02,
      featureDelta: 0.05,
    },
  };

  const base = impacts[action.actionKind] || impacts['refactor'];

  // Scale by target module's current state
  const importanceMultiplier = targetNode ? Math.max(0.5, targetNode.pageRank * 20) : 1.0;
  const urgencyMultiplier = targetEntry ? Math.max(0.5, 1.0 - targetEntry.health) : 1.0;

  return {
    complexityDelta: Math.round(base.complexityDelta * urgencyMultiplier * 100) / 100,
    debtDelta: Math.round(base.debtDelta * urgencyMultiplier * 100) / 100,
    structuralDelta: Math.round(base.structuralDelta * importanceMultiplier * 100) / 100,
    featureDelta: Math.round(base.featureDelta * 100) / 100,
  };
}

/**
 * Evaluate a single DevAction's fitness.
 */
export function evaluateAction(action: DevAction, state: BoardState): FitnessEvaluation {
  const breakdown = estimateActionImpact(action, state);

  // Weighted sum → ΔHealth
  const deltaHealth = Math.round((
    FITNESS_WEIGHTS.complexityReduction * breakdown.complexityDelta +
    FITNESS_WEIGHTS.debtReduction * breakdown.debtDelta +
    FITNESS_WEIGHTS.structuralImprovement * breakdown.structuralDelta +
    FITNESS_WEIGHTS.featureValue * breakdown.featureDelta
  ) * 100) / 100;

  const { category, badukTerm } = classifyMove(deltaHealth);

  return {
    action: { ...action, deltaHealth },
    deltaHealth,
    breakdown,
    category,
    badukTerm,
  };
}

/**
 * Evaluate all candidate actions and rank them.
 * Returns actions sorted by ΔHealth (best first), like KataGo's move ordering.
 */
export function evaluateAllActions(
  actions: DevAction[],
  state: BoardState
): FitnessEvaluation[] {
  return actions
    .map(action => evaluateAction(action, state))
    .sort((a, b) => b.deltaHealth - a.deltaHealth);
}
