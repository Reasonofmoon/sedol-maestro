/**
 * 碁道코딩 — Ownership Map
 *
 * KataGo의 소유권 맵(Ownership Map) 대응.
 * 19×19 바둑판의 모든 교차점에 대해 흑/백 소유 확률을 예측하듯,
 * 코드베이스의 모든 모듈에 대해 건강도(-1~+1)를 예측한다.
 *
 * +1.0 = 완전 건강 (두 개의 눈이 있는 살아있는 돌)
 * -1.0 = 심각한 위험 (눈이 없는 죽은 돌)
 */

import type { DependencyGraph, ModuleMetrics, OwnershipEntry } from './types.js';

/** Weights for health score calculation */
const WEIGHTS = {
  complexity: 0.35,    // 복잡도 (낮을수록 좋음)
  debtRatio: 0.25,     // 기술 부채 비율 (낮을수록 좋음)
  cyclicPenalty: 0.20,  // 순환 의존성 페널티
  importance: 0.20,     // PageRank 중요도 (역보정: 중요할수록 위험도 높음)
};

/**
 * Normalize a value to [0, 1] range using min-max normalization.
 */
function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

/**
 * Build the Ownership Map — the health heatmap of the codebase.
 *
 * KataGo의 핵심 휴리스틱 적용:
 * "목표 타겟이 별도 하위 이벤트들의 합으로 표현될 수 있을 때,
 *  그 하위 이벤트들을 예측하는 것이 학습을 돕는다."
 *
 * → 전체 프로젝트 건강도를 모듈별 건강도의 합으로 분해한다.
 */
export function buildOwnershipMap(
  graph: DependencyGraph,
  metrics: ModuleMetrics[]
): Map<string, OwnershipEntry> {
  const map = new Map<string, OwnershipEntry>();

  // Compute global ranges for normalization
  const complexities = metrics.map(m => m.cyclomaticComplexity);
  const maxComplexity = Math.max(...complexities, 1);
  const minComplexity = Math.min(...complexities, 1);

  const debtRatios = metrics.map(m => m.debtMarkerRatio);
  const maxDebt = Math.max(...debtRatios, 0.001);

  // All PageRank values
  const pageRanks = [...graph.nodes.values()].map(n => n.pageRank);
  const maxPR = Math.max(...pageRanks, 0.001);

  for (const metric of metrics) {
    const node = graph.nodes.get(metric.filePath);
    if (!node) continue;

    // Dimension scores (0 = good, 1 = bad)
    const complexityScore = normalize(metric.cyclomaticComplexity, minComplexity, maxComplexity);
    const debtScore = metric.debtMarkerRatio / maxDebt;
    const isCyclic = node.isCyclic ? 1.0 : 0.0;
    const importanceScore = node.pageRank / maxPR;

    // Combined health: transform from "badness" [0,1] to health [-1, +1]
    const badness =
      WEIGHTS.complexity * complexityScore +
      WEIGHTS.debtRatio * debtScore +
      WEIGHTS.cyclicPenalty * isCyclic +
      WEIGHTS.importance * importanceScore * complexityScore; // importance amplifies complexity risk

    // Map: 0 badness → +1 health, 1 badness → -1 health
    const health = 1 - 2 * Math.min(1, badness);

    map.set(metric.filePath, {
      filePath: metric.filePath,
      health: Math.round(health * 100) / 100,
      dimensions: {
        complexity: Math.round(complexityScore * 100) / 100,
        debtRatio: Math.round(debtScore * 100) / 100,
        violations: metric.violations,
        importance: Math.round(importanceScore * 100) / 100,
      },
    });
  }

  return map;
}

/**
 * Calculate the overall project health from the ownership map.
 * Weighted average by PageRank (more important modules count more).
 */
export function calculateOverallHealth(
  ownershipMap: Map<string, OwnershipEntry>,
  graph: DependencyGraph
): number {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const [filePath, entry] of ownershipMap) {
    const node = graph.nodes.get(filePath);
    const weight = node ? node.pageRank : 0.001;
    weightedSum += entry.health * weight;
    totalWeight += weight;
  }

  return totalWeight > 0
    ? Math.round((weightedSum / totalWeight) * 100) / 100
    : 0;
}
