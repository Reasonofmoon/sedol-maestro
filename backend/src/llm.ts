// ============================================================
// LLM Engine — Claude API integration for real 묘수 generation
// Takes actual code content from risky modules and asks Claude
// to find the highest-leverage refactoring action.
// ============================================================

import Anthropic from '@anthropic-ai/sdk';
import type { AnalysisResult, ModuleInfo, FileEntry } from './analyzer';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface LLMCandidate {
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
  // LLM-generated fields
  issue?: string;
  recommendation?: string;
  codeBefore?: string;
  codeAfter?: string;
}

interface LLMResponse {
  candidates: Array<{
    intent: string;
    type: string;
    badge: string;
    targetFile: string;
    issue: string;
    recommendation: string;
    codeBefore: string;
    codeAfter: string;
    myoReasons: string[];
    deltaWinRate: number;
    probability: number;
  }>;
}

// ── Prompt builder ────────────────────────────────────────────

function buildPrompt(
  result: AnalysisResult,
  topModules: Array<{ mod: ModuleInfo; content: string }>,
): string {
  const moduleSection = topModules.map(({ mod, content }) => {
    const truncated = content.length > 3000
      ? content.slice(0, 3000) + '\n... (truncated)'
      : content;
    return `
=== 파일: ${mod.path} ===
건강도: ${mod.health.toFixed(2)} | 복잡도: ${mod.complexity} | 라인: ${mod.lines}
${mod.inAtari ? '⚠ 단수 (건강도 위험)' : ''}
${mod.imports.length > 0 ? `의존: ${mod.imports.slice(0,5).join(', ')}` : ''}
${mod.importedBy.length > 0 ? `피의존: ${mod.importedBy.slice(0,5).join(', ')}` : ''}

\`\`\`
${truncated}
\`\`\``;
  }).join('\n\n');

  return `당신은 세계 최고 수준의 소프트웨어 아키텍트입니다.
바둑의 묘수(妙手)처럼, 코드베이스 전체를 읽고 가장 높은 레버리지의 리팩토링 액션을 찾습니다.

## 프로젝트 현황
- 파일: ${result.totalFiles}개 | 줄: ${result.totalLines.toLocaleString()}
- 평균 복잡도: ${result.avgComplexity.toFixed(1)} | 테스트 커버리지: ${Math.round(result.testCoverage * 100)}%
- 순환 의존성(패): ${result.cycles.length}개 | 단수 모듈: ${result.riskModules.length}개
- Win-Rate: ${result.winRate}%

## 분석 대상 코드 파일

${moduleSection}

## 지시사항

위 코드를 분석하여 **묘수(妙手)** 를 포함한 3~5개의 개선 액션을 제안해주세요.

묘수의 조건:
1. 처음엔 비직관적이지만 MCTS 탐색 후 진가가 드러나는 수
2. 이 수 하나로 이후 3수가 모두 선수(先手)가 되는 연쇄 효과
3. 여러 문제를 동시에 해소하는 전략적 수

다음 JSON 형식으로 정확히 응답해주세요 (다른 텍스트 없이):

{
  "candidates": [
    {
      "intent": "한 줄 액션 설명 (한국어)",
      "type": "sente|joseki|gote",
      "badge": "★묘수|○선수|○정석|△후수|✗실착",
      "targetFile": "파일 경로",
      "issue": "이 파일의 핵심 문제 (2-3문장)",
      "recommendation": "구체적인 리팩토링 방법 (3-5문장, 단계별)",
      "codeBefore": "현재 문제가 있는 코드 예시 (10-20줄)",
      "codeAfter": "리팩토링 후 코드 예시 (10-20줄)",
      "myoReasons": ["이것이 묘수인 이유 1", "이유 2"],
      "deltaWinRate": 7,
      "probability": 75
    }
  ]
}

JSON 외 다른 텍스트를 포함하지 마세요.`;
}

// ── Main LLM call ─────────────────────────────────────────────

export async function generateLLMCandidates(
  result: AnalysisResult,
  files: FileEntry[],
): Promise<LLMCandidate[] | null> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('[llm] No ANTHROPIC_API_KEY — falling back to heuristics');
    return null;
  }

  // Pick top 4 modules: highest complexity + lowest health, non-test
  const nonTests = result.modules
    .filter(m => !/\.(test|spec)\./.test(m.path) && m.lines > 20)
    .sort((a, b) => (b.complexity * (1 - b.health)) - (a.complexity * (1 - a.health)))
    .slice(0, 4);

  if (nonTests.length === 0) return null;

  // Map file content
  const fileMap = new Map(files.map(f => [f.path, f.content]));
  const topModules = nonTests.map(mod => ({
    mod,
    content: fileMap.get(mod.path) ?? '(내용 없음)',
  }));

  const prompt = buildPrompt(result, topModules);

  try {
    console.log(`[llm] Calling Claude Sonnet 4.6 with ${topModules.length} modules...`);

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    // Parse JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[llm] No JSON found in response');
      return null;
    }

    const parsed: LLMResponse = JSON.parse(jsonMatch[0]);

    if (!parsed.candidates?.length) return null;

    // Map module info for board positions
    const moduleMap = new Map(result.modules.map(m => [m.path, m]));

    const candidates: LLMCandidate[] = parsed.candidates.map((c, i) => {
      const mod = moduleMap.get(c.targetFile);
      return {
        rank: i + 1,
        actionId: `act:llm-${i + 1}-${c.targetFile.replace(/[^a-z0-9]/gi, '-').slice(0, 20)}`,
        intent: c.intent,
        type: c.type || 'sente',
        badge: (c.badge as LLMCandidate['badge']) || (i === 0 ? '★묘수' : '○선수'),
        probability: Math.min(95, Math.max(5, c.probability || (80 - i * 15))),
        qValue: Math.min(0.95, Math.max(0.1, (c.probability || 70) / 100 * 0.9 + (i === 0 ? 0.1 : 0))),
        visits: Math.round((c.probability || 60) / 100 * 40 + (i === 0 ? 10 : 0)),
        deltaHealth: Math.min(0.3, Math.max(0.01, (c.deltaWinRate || 5) / 50)),
        deltaWinRate: c.deltaWinRate || (8 - i * 2),
        targetFile: c.targetFile,
        myoReasons: c.myoReasons || [],
        boardX: mod?.boardX,
        boardY: mod?.boardY,
        issue: c.issue,
        recommendation: c.recommendation,
        codeBefore: c.codeBefore,
        codeAfter: c.codeAfter,
      };
    });

    console.log(`[llm] Generated ${candidates.length} LLM candidates. Myo: ${candidates.filter(c => c.badge === '★묘수').length}`);
    return candidates;

  } catch (err: any) {
    console.error('[llm] Error:', err.message);
    return null;
  }
}
