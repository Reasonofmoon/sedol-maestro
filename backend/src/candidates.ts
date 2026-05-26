// ============================================================
// Heuristic Candidate Generator
// 실제 코드 분석 결과를 바탕으로 묘수/후보수를 생성
// LLM 없이도 의미있는 제안을 만드는 휴리스틱 엔진
// ============================================================

import type { AnalysisResult, ModuleInfo } from './analyzer';

export interface Candidate {
  rank: number;
  actionId: string;
  intent: string;
  type: string;
  badge: '★묘수' | '○선수' | '○정석' | '△후수' | '✗실착';
  probability: number;
  qValue: number;
  visits: number;
  deltaHealth: number;
  deltaWinRate: number;
  targetFile: string;
  myoReasons: string[];
  boardX?: number;
  boardY?: number;
}

export interface MCTSTreeNode {
  id: string;
  intent: string;
  type: string;
  badge: string;
  q: number;
  prior: number;
  visits: number;
  depth: number;
  isMyo: boolean;
  children: MCTSTreeNode[];
}

// ── Heuristic patterns ────────────────────────────────────────

function detectGodObject(mod: ModuleInfo): boolean {
  return mod.lines > 300 && mod.complexity > 15 && mod.importedBy.length > 3;
}

function detectNoTests(mod: ModuleInfo, result: AnalysisResult): boolean {
  return !mod.hasTests && mod.health < 0.3 && mod.pageRank > 0.3;
}

function detectCyclicDep(mod: ModuleInfo, result: AnalysisResult): boolean {
  return result.cycles.some(cycle => cycle.includes(mod.path));
}

function detectHighDebt(mod: ModuleInfo): boolean {
  return mod.debtRatio > 0.05 && mod.pageRank > 0.2;
}

function shortName(filePath: string): string {
  return filePath.split('/').pop()?.replace(/\.(ts|tsx|js|jsx)$/, '') ?? filePath;
}

function projectedWinRate(currentWinRate: number, deltaHealth: number): number {
  return Math.round(Math.min(100, Math.max(0, currentWinRate + deltaHealth * 45)));
}

// ── Main candidate generator ──────────────────────────────────

export function generateCandidates(result: AnalysisResult): Candidate[] {
  const candidates: Candidate[] = [];
  const currentWinRate = result.winRate;

  const nonTests = result.modules.filter(m => !/\.(test|spec)\./.test(m.path));
  const sorted = [...nonTests].sort((a, b) => b.pageRank - a.pageRank);

  // ── Pattern 1: God Object extraction (묘수 후보) ───────────
  for (const mod of sorted.slice(0, 20)) {
    if (detectGodObject(mod)) {
      const myoReasons: string[] = [];
      const dh = 0.15 + mod.pageRank * 0.1;
      const qOverPrior = 1.7 + Math.random() * 0.3;
      const prior = 0.4 + Math.random() * 0.15;
      const q = prior * qOverPrior;
      const isMyo = q > prior * 1.5 && dh >= 0.12;

      if (isMyo) {
        myoReasons.push(`Q/Prior=${qOverPrior.toFixed(2)} — MCTS가 진가를 발견`);
        if (mod.importedBy.length > 3) myoReasons.push(`${mod.importedBy.length}개 모듈이 의존 — 분리 시 연쇄 개선`);
        myoReasons.push(`${mod.lines}줄 God Object → 단일 책임 원칙 적용`);
      }

      candidates.push({
        rank: candidates.length + 1,
        actionId: `act:extract-${shortName(mod.path)}`,
        intent: `${shortName(mod.path)} 분리 (${mod.lines}줄 God Object)`,
        type: 'sente',
        badge: isMyo ? '★묘수' : '○선수',
        probability: Math.round(prior * 100),
        qValue: Math.round(q * 100) / 100,
        visits: Math.round(20 + prior * 30),
        deltaHealth: Math.round(dh * 100) / 100,
        deltaWinRate: projectedWinRate(currentWinRate, dh) - currentWinRate,
        targetFile: mod.path,
        myoReasons,
        boardX: mod.boardX,
        boardY: mod.boardY,
      });
      if (candidates.length >= 2) break;
    }
  }

  // ── Pattern 2: Add tests for critical untested modules (선수) ─
  for (const mod of sorted.slice(0, 15)) {
    if (detectNoTests(mod, result) && mod.inAtari) {
      const dh = 0.10 + mod.pageRank * 0.08;
      const prior = 0.55 + Math.random() * 0.15;
      candidates.push({
        rank: candidates.length + 1,
        actionId: `act:test-${shortName(mod.path)}`,
        intent: `${shortName(mod.path)} 테스트 추가 (테스트 없는 핵심 모듈)`,
        type: 'sente',
        badge: '○선수',
        probability: Math.round(prior * 100),
        qValue: Math.round(prior * 0.85 * 100) / 100,
        visits: Math.round(12 + prior * 20),
        deltaHealth: Math.round(dh * 100) / 100,
        deltaWinRate: projectedWinRate(currentWinRate, dh) - currentWinRate,
        targetFile: mod.path,
        myoReasons: [`단수 모듈 — 테스트로 안전망 확보`],
        boardX: mod.boardX,
        boardY: mod.boardY,
      });
      if (candidates.filter(c => c.badge === '○선수').length >= 2) break;
    }
  }

  // ── Pattern 3: Break circular dependencies (정석) ────────────
  if (result.cycles.length > 0) {
    const cycle = result.cycles[0];
    const target = cycle[0];
    const mod = result.modules.find(m => m.path === target);
    if (mod) {
      const dh = 0.08;
      candidates.push({
        rank: candidates.length + 1,
        actionId: `act:break-cycle-${shortName(target)}`,
        intent: `순환 의존성 해소 (패 감지: ${cycle.map(shortName).slice(0,3).join('→')})`,
        type: 'joseki',
        badge: '○정석',
        probability: 25,
        qValue: 0.42,
        visits: 5,
        deltaHealth: dh,
        deltaWinRate: projectedWinRate(currentWinRate, dh) - currentWinRate,
        targetFile: target,
        myoReasons: [],
        boardX: mod.boardX,
        boardY: mod.boardY,
      });
    }
  }

  // ── Pattern 4: Reduce complexity in top risk module (후수) ───
  const highComplexity = sorted
    .filter(m => m.complexity > 10 && m.inAtari)
    .sort((a, b) => b.complexity - a.complexity)[0];

  if (highComplexity) {
    const dh = 0.05;
    candidates.push({
      rank: candidates.length + 1,
      actionId: `act:reduce-complexity-${shortName(highComplexity.path)}`,
      intent: `${shortName(highComplexity.path)} 복잡도 감소 (CC=${highComplexity.complexity})`,
      type: 'gote',
      badge: '△후수',
      probability: 14,
      qValue: 0.22,
      visits: 2,
      deltaHealth: dh,
      deltaWinRate: projectedWinRate(currentWinRate, dh) - currentWinRate,
      targetFile: highComplexity.path,
      myoReasons: [],
      boardX: highComplexity.boardX,
      boardY: highComplexity.boardY,
    });
  }

  // ── Pattern 5: Dangerous "add feature without tests" (실착) ──
  if (result.testCoverage < 0.3) {
    candidates.push({
      rank: candidates.length + 1,
      actionId: 'act:add-feature-no-tests',
      intent: '새 기능 추가 (테스트 커버리지 30% 미만 상태)',
      type: 'attack',
      badge: '✗실착',
      probability: 5,
      qValue: -0.28,
      visits: 0,
      deltaHealth: -0.08,
      deltaWinRate: -4,
      targetFile: '',
      myoReasons: [],
    });
  }

  // Sort by probability and reassign ranks
  const sorted2 = candidates.sort((a, b) => b.probability - a.probability);
  sorted2.forEach((c, i) => c.rank = i + 1);

  return sorted2;
}

// ── MCTS Tree builder ─────────────────────────────────────────

export function buildMctsTree(candidates: Candidate[]): MCTSTreeNode {
  const totalVisits = candidates.reduce((s, c) => s + c.visits, 0);

  const children: MCTSTreeNode[] = candidates.map((c, i) => {
    const childNodes: MCTSTreeNode[] = [];

    // Add 1-2 follow-up moves for top candidates
    if (i < 2 && c.deltaWinRate > 2) {
      childNodes.push({
        id: `${c.actionId}-f1`,
        intent: '연쇄 선수 1 — 테스트 추가',
        type: 'sente',
        badge: '○선수',
        q: c.qValue * 0.85,
        prior: 0.6,
        visits: Math.round(c.visits * 0.5),
        depth: 2,
        isMyo: false,
        children: [],
      });
      if (c.badge === '★묘수') {
        childNodes.push({
          id: `${c.actionId}-f2`,
          intent: '연쇄 선수 2 — 리팩토링',
          type: 'sente',
          badge: '○선수',
          q: c.qValue * 0.75,
          prior: 0.5,
          visits: Math.round(c.visits * 0.35),
          depth: 2,
          isMyo: false,
          children: [],
        });
      }
    }

    return {
      id: c.actionId,
      intent: c.intent,
      type: c.type,
      badge: c.badge,
      q: c.qValue,
      prior: c.probability / 100,
      visits: c.visits,
      depth: 1,
      isMyo: c.badge === '★묘수',
      children: childNodes,
    };
  });

  return {
    id: 'root',
    intent: '현재 상태',
    type: 'root',
    badge: '●',
    q: 0,
    prior: 1,
    visits: totalVisits,
    depth: 0,
    isMyo: false,
    children,
  };
}
