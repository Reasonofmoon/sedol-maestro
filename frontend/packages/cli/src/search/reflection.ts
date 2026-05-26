/**
 * 碁道코딩 — Self-Reflection (복기, 復棋)
 *
 * LATS(Language Agent Tree Search)의 핵심 혁신:
 * 실패한 경로에서 "왜 이 수가 좋지 않았는지" 자기 비평을 생성한다.
 *
 * 바둑의 "복기(復棋)" — 대국 후 기보를 되짚으며 더 나은 수를 찾는 과정.
 * 이 반영 결과는 다음 탐색의 컨텍스트에 추가되어 동일 실수를 반복하지 않게 한다.
 */

import type { BoardState } from '../encoder/types.js';
import type { MCTSNode } from './mcts-node.js';
import { callLLM, detectLLMConfig, type LLMConfig } from '../policy/llm-provider.js';

const REFLECTION_PROMPT = `You are the reflection component of 碁道코딩 (Gido Coding).

A development action was tried but received a poor evaluation. Analyze why this action was suboptimal and suggest what should be tried instead.

Be concise (2-3 sentences). Use Go/Baduk metaphors when applicable:
- A move that looked like sente (先手) but was actually gote (後手)
- A move that strengthened the wrong part of the board
- A move that created unnecessary aji (味, residual weakness)

Format: One paragraph of reflection, no bullet points.`;

/**
 * Generate a reflection on a failed MCTS path.
 *
 * In LLM mode: asks the LLM to analyze the failure.
 * In heuristic mode: generates a template-based reflection.
 */
export async function generateReflection(
  node: MCTSNode,
  boardState: BoardState,
  llmConfigOverride?: Partial<LLMConfig>
): Promise<string> {
  const config = { ...detectLLMConfig(), ...llmConfigOverride };

  if (!node.action) return '';

  if (config.provider === 'heuristic') {
    return generateHeuristicReflection(node, boardState);
  }

  try {
    const actionDescr = `Action: ${node.action.actionKind} on ${node.action.target}\nIntent: ${node.action.intent}\nΔHealth: ${node.action.deltaHealth}`;

    const response = await callLLM(config, [
      { role: 'system', content: REFLECTION_PROMPT },
      { role: 'user', content: `${actionDescr}\n\nProject health: ${boardState.summary.overallHealth}\nThis action scored poorly. Why was it a bad move?` },
    ]);

    return response.content.trim();
  } catch {
    return generateHeuristicReflection(node, boardState);
  }
}

/**
 * Heuristic reflection — template-based self-critique.
 */
function generateHeuristicReflection(node: MCTSNode, boardState: BoardState): string {
  if (!node.action) return '';

  const action = node.action;
  const entry = boardState.ownershipMap.get(action.target);

  const reflections: string[] = [];

  // Check if targeting a healthy module (wasted move)
  if (entry && entry.health > 0.5) {
    reflections.push(
      `${action.target}에 대한 ${action.actionKind}는 이미 건강한(${entry.health}) 모듈에 대한 불필요한 수였습니다. ` +
      `바둑에서 이미 살아있는 집에 수를 낭비한 것과 같습니다(先手를 잃는 後手).`
    );
  }

  // Check if structural action on low-importance module
  if (entry && entry.dimensions.importance < 0.2 && action.actionKind === 'extract-module') {
    reflections.push(
      `PageRank 중요도가 낮은(${entry.dimensions.importance}) 모듈을 분리하는 것은 ` +
      `바둑에서 변(邊)의 작은 돌에 과도한 자원을 투입하는 것과 같습니다. 大馬(핵심 모듈)에 집중하세요.`
    );
  }

  // Default reflection
  if (reflections.length === 0) {
    reflections.push(
      `이 수는 현재 형세에서 최선이 아닙니다. ` +
      `ΔHealth가 ${action.deltaHealth} < 0으로, 프로젝트 건강도를 오히려 악화시킵니다. ` +
      `다른 방향의 수를 시도해 보세요.`
    );
  }

  return reflections[0];
}
