// ============================================================
// Win-Rate Calculator
// The single truth signal for project vitality.
// Like KataGo's win-rate display — visible at all times.
//
// Win-Rate = Σ (component × weight) × 100
// ============================================================

import type { BoardState } from '@baduck/encoder';

export interface WinRateComponents {
  healthScore:    number;  // [-1,+1] normalized to [0,1]
  testCoverage:   number;  // [0,1]
  complexityInv:  number;  // 1 - normalized_complexity [0,1]
  velocity:       number;  // recent move quality average [0,1]
  debtRatioInv:   number;  // 1 - debt_ratio [0,1]
}

export const WIN_RATE_WEIGHTS: Record<keyof WinRateComponents, number> = {
  healthScore:    0.35,
  testCoverage:   0.25,
  complexityInv:  0.20,
  velocity:       0.10,
  debtRatioInv:   0.10,
};

export interface WinRateResult {
  value: number;             // 0-100 integer
  components: WinRateComponents;
  trend: 'rising' | 'stable' | 'falling';
  deltaFromPrev: number;
  label: string;             // 승률 표시 텍스트
}

/** Calculate current Win-Rate from board state */
export function calcWinRate(
  board: BoardState,
  prevWinRate?: number,
  velocityHistory: number[] = [],
): WinRateResult {
  const h = board.summary.overallHealth;
  const avgComplexity = board.summary.avgComplexity;

  // Normalize complexity: assume max complexity ~20 for typical project
  const complexityInv = Math.max(0, 1 - Math.min(1, avgComplexity / 20));

  // Debt ratio from metrics
  let avgDebtRatio = 0;
  let count = 0;
  for (const m of board.metrics.values()) {
    avgDebtRatio += m.debtMarkerRatio;
    count++;
  }
  avgDebtRatio = count > 0 ? avgDebtRatio / count : 0;
  const debtRatioInv = Math.max(0, 1 - avgDebtRatio * 10); // scale: 10% debt = 0

  // Velocity: average of recent health improvements
  const velocity = velocityHistory.length > 0
    ? Math.max(0, Math.min(1, (velocityHistory.reduce((a, b) => a + b, 0) / velocityHistory.length + 1) / 2))
    : 0.5;

  const components: WinRateComponents = {
    healthScore: (h + 1) / 2,   // [-1,1] → [0,1]
    testCoverage: 0.3,           // default; override when coverage data available
    complexityInv,
    velocity,
    debtRatioInv,
  };

  const raw = (Object.keys(WIN_RATE_WEIGHTS) as Array<keyof WinRateComponents>)
    .reduce((sum, k) => sum + components[k] * WIN_RATE_WEIGHTS[k], 0);

  const value = Math.round(Math.max(0, Math.min(100, raw * 100)));
  const deltaFromPrev = prevWinRate !== undefined ? value - prevWinRate : 0;
  const trend: WinRateResult['trend'] =
    deltaFromPrev > 2 ? 'rising' : deltaFromPrev < -2 ? 'falling' : 'stable';

  return {
    value,
    components,
    trend,
    deltaFromPrev,
    label: buildLabel(value, trend, deltaFromPrev),
  };
}

/** Project win-rate after applying a hypothetical action */
export function projectedWinRate(
  board: BoardState,
  deltaHealth: number,
  prevWinRate: number,
): number {
  const simulatedHealth = Math.max(-1, Math.min(1, board.summary.overallHealth + deltaHealth));
  const simComponents: WinRateComponents = {
    healthScore: (simulatedHealth + 1) / 2,
    testCoverage: 0.3,
    complexityInv: Math.max(0, 1 - board.summary.avgComplexity / 20),
    velocity: 0.6,  // assume positive momentum
    debtRatioInv: 0.7,
  };
  const raw = (Object.keys(WIN_RATE_WEIGHTS) as Array<keyof WinRateComponents>)
    .reduce((sum, k) => sum + simComponents[k] * WIN_RATE_WEIGHTS[k], 0);
  return Math.round(Math.max(0, Math.min(100, raw * 100)));
}

function buildLabel(value: number, trend: WinRateResult['trend'], delta: number): string {
  const trendArrow = trend === 'rising' ? `▲ +${delta}%` : trend === 'falling' ? `▼ ${delta}%` : '→ 변동없음';
  const bar = '█'.repeat(Math.round(value / 5)) + '░'.repeat(20 - Math.round(value / 5));
  return `${bar}  ${value}%  ${trendArrow}`;
}
