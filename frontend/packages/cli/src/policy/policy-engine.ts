/**
 * 碁道코딩 — Policy Engine
 *
 * AlphaGo의 정책 네트워크(Policy Network) 대응.
 * 현재 코드베이스 상태(BoardState)를 입력받아  
 * 후보 개발 행동(DevAction[])을 확률 분포로 생성한다.
 *
 * AlphaGo Zero처럼 단일 네트워크(LLM)가 정책과 가치를 동시에 출력:
 * - 정책(π): 각 행동의 사전확률
 * - 가치(v): 행동 후 예상 건강도 변화(ΔHealth)
 *
 * API 키가 없으면 순수 휴리스틱 모드로 작동.
 */

import type { BoardState, DevAction, MoveType, OwnershipEntry } from '../encoder/types.js';
import { callLLM, detectLLMConfig, type LLMConfig } from './llm-provider.js';

interface PolicyOutput {
  actions: DevAction[];
  model: string;
  mode: 'llm' | 'heuristic';
  usage?: { inputTokens: number; outputTokens: number };
}

/**
 * System prompt — instructs the LLM to act as a Go-inspired code strategist.
 */
const SYSTEM_PROMPT = `You are 碁道코딩 (Gido Coding) — an AI strategist that reads codebases like a Go master reads the board.

You analyze code health metrics and propose development actions using Go/Baduk strategic concepts:
- **fuseki (포석)**: Foundational architectural changes
- **joseki (정석)**: Applying proven design patterns  
- **sente (선수)**: Proactive moves that create initiative (tech debt prevention)
- **gote (후수)**: Reactive/defensive fixes
- **attack (공격)**: Expanding features/capabilities
- **defend (방어)**: Strengthening tests, error handling, security

For each proposed action, assign:
1. A unique id (e.g., "move-1")
2. A moveType from: fuseki, joseki, sente, gote, attack, defend
3. An actionKind from: refactor, add-test, fix-bug, extract-module, reduce-complexity, remove-dead-code, add-error-handling, update-dependency
4. The target file/module path
5. A human-readable intent (what and why)
6. A prior probability (0-1, how confident you are this is a good move)
7. An estimated deltaHealth (-1 to +1, expected health improvement)
8. A detailed rationale explaining the strategic reasoning

RESPOND ONLY with a valid JSON array of actions. No markdown, no explanation outside JSON.`;

/**
 * Build the user prompt from the BoardState.
 */
function buildPrompt(state: BoardState): string {
  const { summary, graph } = state;

  // Ownership map as a table
  const ownershipTable = [...state.ownershipMap.values()]
    .sort((a, b) => a.health - b.health)
    .map(e => `  ${e.filePath}: health=${e.health}, complexity=${e.dimensions.complexity}, debt=${e.dimensions.debtRatio}, importance=${e.dimensions.importance}`)
    .join('\n');

  // Cycles
  const cycleInfo = graph.cycles.length > 0
    ? `\nCircular Dependencies (패, Ko):\n${graph.cycles.map(c => `  ${c.join(' → ')}`).join('\n')}`
    : '\nNo circular dependencies detected.';

  return `Analyze this codebase and propose 5-8 development actions.

## Project Summary
- Files: ${summary.totalFiles}
- Lines: ${summary.totalLines}
- Avg Complexity: ${summary.avgComplexity}
- Overall Health: ${summary.overallHealth} (scale: -1 bad to +1 good)
- Cycle Count: ${summary.cycleCount}

## Ownership Map (所有權 맵)
${ownershipTable}
${cycleInfo}

## Top Modules by PageRank (大馬)
${summary.topModules.map(m => `  ${m.filePath} (PR: ${m.pageRank})`).join('\n')}

## Risk Modules (死石)
${summary.riskModules.length > 0
  ? summary.riskModules.map(m => `  ${m.filePath} (health: ${m.health})`).join('\n')
  : '  None — all modules are healthy'}

Propose actions ranked by strategic priority. Focus on:
1. Modules with negative health (死石 — dying stones that need rescue)
2. High-importance modules with mediocre health (大馬 at risk)
3. Proactive sente moves that improve long-term architecture
4. Quick wins that increase overall health significantly`;
}

/**
 * Parse LLM output into DevAction array.
 */
function parseLLMActions(raw: string): DevAction[] {
  // Try to extract JSON from the response
  let jsonStr = raw.trim();

  // Handle markdown code blocks
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  // Handle cases where response starts with text before JSON
  const arrayStart = jsonStr.indexOf('[');
  const arrayEnd = jsonStr.lastIndexOf(']');
  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    jsonStr = jsonStr.substring(arrayStart, arrayEnd + 1);
  }

  try {
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) return [];

    return parsed.map((item: any, i: number) => ({
      id: item.id || `move-${i + 1}`,
      type: validateMoveType(item.moveType || item.type),
      actionKind: item.actionKind || 'refactor',
      target: item.target || 'unknown',
      intent: item.intent || '',
      prior: Math.max(0, Math.min(1, Number(item.prior) || 0.5)),
      deltaHealth: Math.max(-1, Math.min(1, Number(item.deltaHealth) || 0)),
      rationale: item.rationale || '',
    }));
  } catch {
    return [];
  }
}

function validateMoveType(type: string): MoveType {
  const valid: MoveType[] = ['fuseki', 'joseki', 'sente', 'gote', 'attack', 'defend', 'review'];
  return valid.includes(type as MoveType) ? (type as MoveType) : 'sente';
}

/**
 * Heuristic Policy Engine — generates actions without LLM.
 * 
 * Uses the same strategic reasoning as the LLM prompt, but purely rule-based.
 * Think of this as AlphaGo's "fast rollout policy (π)" — quick but less accurate.
 */
function generateHeuristicActions(state: BoardState): DevAction[] {
  const actions: DevAction[] = [];
  const entries = [...state.ownershipMap.values()].sort((a, b) => a.health - b.health);
  let moveNum = 1;

  // 1. 사활(Life & Death): Rescue dying modules (health < 0)
  for (const entry of entries.filter(e => e.health < 0)) {
    if (entry.dimensions.complexity > 0.7) {
      actions.push({
        id: `move-${moveNum++}`,
        type: 'defend',
        actionKind: 'reduce-complexity',
        target: entry.filePath,
        intent: `${entry.filePath}의 복잡도가 위험 수준입니다. 함수 분리로 복잡도를 낮추세요.`,
        prior: 0.85,
        deltaHealth: 0.15,
        rationale: `복잡도 점수 ${entry.dimensions.complexity}로 프로젝트 내 최고 위험 수준. 기능을 작은 함수로 분리하면 유지보수성이 크게 향상됩니다. 바둑에서 대마(大馬)를 살리는 것과 같습니다.`,
      });
    }
    if (entry.dimensions.debtRatio > 0.5) {
      actions.push({
        id: `move-${moveNum++}`,
        type: 'sente',
        actionKind: 'refactor',
        target: entry.filePath,
        intent: `기술 부채 마커(TODO/FIXME)를 해결하여 선수를 잡으세요.`,
        prior: 0.70,
        deltaHealth: 0.10,
        rationale: `부채 비율 ${entry.dimensions.debtRatio}. TODO/FIXME를 해결하지 않으면 후수(後手)로 밀리게 됩니다.`,
      });
    }
  }

  // 2. 두터움(Thickness): Add tests for important but untested modules
  for (const entry of entries.filter(e => e.health >= 0 && e.health < 0.5 && e.dimensions.importance > 0.3)) {
    actions.push({
      id: `move-${moveNum++}`,
      type: 'joseki',
      actionKind: 'add-test',
      target: entry.filePath,
      intent: `PageRank 중요도가 높은 ${entry.filePath}에 테스트를 추가하여 두터움(厚み)을 확보하세요.`,
      prior: 0.75,
      deltaHealth: 0.12,
      rationale: `중요도 ${entry.dimensions.importance}인 핵심 모듈이지만 건강도가 ${entry.health}로 불안정합니다. 테스트 추가는 정석(定石) — 검증된 패턴으로 형세를 안정시킵니다.`,
    });
  }

  // 3. 패(Ko): Break circular dependencies
  for (const cycle of state.graph.cycles.slice(0, 2)) {
    actions.push({
      id: `move-${moveNum++}`,
      type: 'fuseki',
      actionKind: 'extract-module',
      target: cycle[0],
      intent: `순환 의존성(${cycle.join(' ↔ ')})을 분리하여 구조를 개선하세요.`,
      prior: 0.80,
      deltaHealth: 0.20,
      rationale: `순환 의존성은 바둑의 패(劫)와 같습니다 — 해결하지 않으면 전체 형세가 불안정해집니다. 공통 인터페이스를 추출하여 의존 방향을 단방향으로 정리하세요.`,
    });
  }

  // 4. 포석(Fuseki): Proactive architecture improvements
  if (state.summary.avgComplexity > 15) {
    actions.push({
      id: `move-${moveNum++}`,
      type: 'fuseki',
      actionKind: 'refactor',
      target: '(project-wide)',
      intent: `전체 평균 복잡도 ${state.summary.avgComplexity}가 높습니다. 대규모 리팩토링으로 포석을 다시 짜세요.`,
      prior: 0.60,
      deltaHealth: 0.25,
      rationale: `평균 복잡도가 권장 수준(10)을 크게 초과합니다. 포석(布石) 단계에서 구조를 바로잡지 않으면 중반전에서 돌이킬 수 없는 형세 불리로 이어집니다.`,
    });
  }

  // Normalize priors to sum to 1
  const totalPrior = actions.reduce((sum, a) => sum + a.prior, 0);
  if (totalPrior > 0) {
    for (const a of actions) {
      a.prior = Math.round((a.prior / totalPrior) * 100) / 100;
    }
  }

  return actions.slice(0, 8); // Max 8 actions
}

/**
 * Run the Policy Engine to generate candidate actions.
 * 
 * This is the core "수 읽기(reading moves)" function.
 */
export async function generateActions(
  state: BoardState,
  configOverride?: Partial<LLMConfig>
): Promise<PolicyOutput> {
  const config = { ...detectLLMConfig(), ...configOverride };

  // Heuristic fallback mode
  if (config.provider === 'heuristic') {
    const actions = generateHeuristicActions(state);
    return { actions, model: 'heuristic (빠른 착수 정책)', mode: 'heuristic' };
  }

  // LLM mode
  try {
    const response = await callLLM(config, [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildPrompt(state) },
    ]);

    const actions = parseLLMActions(response.content);

    if (actions.length === 0) {
      // LLM returned unparseable output — fall back to heuristic
      const heuristic = generateHeuristicActions(state);
      return { actions: heuristic, model: `${response.model} (fallback→heuristic)`, mode: 'heuristic' };
    }

    return {
      actions,
      model: response.model,
      mode: 'llm',
      usage: response.usage,
    };
  } catch (err) {
    // API error — fall back to heuristic
    const actions = generateHeuristicActions(state);
    return {
      actions,
      model: `heuristic (API error: ${err instanceof Error ? err.message : String(err)})`,
      mode: 'heuristic',
    };
  }
}
