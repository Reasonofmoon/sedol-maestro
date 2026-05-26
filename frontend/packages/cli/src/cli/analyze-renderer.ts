/**
 * 碁道코딩 — Analyze Renderer
 *
 * Renders the AnalysisResult as a premium terminal UI.
 * Shows candidate moves with ΔHealth, Go categorization, and strategic rationale.
 */

import type { AnalysisResult } from '../value/move-evaluator.js';
import type { FitnessEvaluation } from '../value/fitness-function.js';

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

function categoryEmoji(cat: FitnessEvaluation['category']): string {
  switch (cat) {
    case 'brilliant': return '🌟';
    case 'good': return '✅';
    case 'inaccurate': return '🟡';
    case 'mistake': return '🟠';
    case 'blunder': return '🔴';
  }
}

function moveTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    'fuseki': '布石 포석',
    'joseki': '定石 정석',
    'sente': '先手 선수',
    'gote': '後手 후수',
    'attack': '攻擊 공격',
    'defend': '防禦 방어',
    'review': '復棋 복기',
  };
  return labels[type] || type;
}

function actionKindLabel(kind: string): string {
  const labels: Record<string, string> = {
    'refactor': '🔧 리팩토링',
    'add-test': '🧪 테스트 추가',
    'fix-bug': '🐛 버그 수정',
    'extract-module': '📦 모듈 분리',
    'reduce-complexity': '🧹 복잡도 감소',
    'remove-dead-code': '🗑️ 데드코드 제거',
    'add-error-handling': '🛡️ 에러 처리 추가',
    'update-dependency': '📌 의존성 업데이트',
  };
  return labels[kind] || kind;
}

function deltaBar(delta: number): string {
  const absDelta = Math.abs(delta);
  const width = Math.min(15, Math.round(absDelta * 50));
  const color = delta >= 0 ? FG.green : FG.red;
  const sign = delta >= 0 ? '+' : '';
  return `${color}${sign}${delta.toFixed(2)} ${'█'.repeat(width)}${RESET}`;
}

/**
 * Render the analysis result — the "수 읽기 결과(Move Analysis)".
 */
export function renderAnalysis(result: AnalysisResult): string {
  const lines: string[] = [];
  const { evaluations, policyModel, policyMode, boardState } = result;

  // ── Header ──
  lines.push('');
  lines.push(`${BOLD}${FG.cyan}  ┌──────────────────────────────────────────────────┐${RESET}`);
  lines.push(`${BOLD}${FG.cyan}  │       碁道코딩 — 수 읽기 (Move Analysis)           │${RESET}`);
  lines.push(`${BOLD}${FG.cyan}  └──────────────────────────────────────────────────┘${RESET}`);
  lines.push('');

  // ── Board Summary ──
  const s = boardState.summary;
  lines.push(`  ${BOLD}현재 형세${RESET}: Overall Health ${s.overallHealth >= 0 ? FG.green : FG.red}${s.overallHealth.toFixed(2)}${RESET}  |  ${s.totalFiles} files  |  ${s.totalLines.toLocaleString()} lines`);
  lines.push(`  ${DIM}Policy: ${policyMode === 'llm' ? '🤖 ' : '⚡ '}${policyModel}${RESET}`);
  if (result.usage) {
    lines.push(`  ${DIM}Tokens: ${result.usage.inputTokens} in → ${result.usage.outputTokens} out${RESET}`);
  }
  lines.push('');

  // ── Candidate Moves ──
  lines.push(`  ${BOLD}후보수 (Candidate Moves) — ${evaluations.length}개${RESET}`);
  lines.push(`  ${FG.gray}${'─'.repeat(68)}${RESET}`);

  for (let i = 0; i < evaluations.length; i++) {
    const ev = evaluations[i];
    const rank = i + 1;
    const emoji = categoryEmoji(ev.category);

    lines.push('');
    lines.push(`  ${BOLD}${rank}. ${emoji} ${ev.action.intent}${RESET}`);
    lines.push(`     ${FG.cyan}${moveTypeLabel(ev.action.type)}${RESET}  |  ${actionKindLabel(ev.action.actionKind)}  |  ${FG.gray}Target: ${ev.action.target}${RESET}`);
    lines.push(`     ΔHealth: ${deltaBar(ev.deltaHealth)}  ${DIM}Prior: ${(ev.action.prior * 100).toFixed(0)}%${RESET}`);
    lines.push(`     ${DIM}${ev.badukTerm}${RESET}`);

    // Breakdown
    const b = ev.breakdown;
    lines.push(`     ${FG.gray}├─ Complexity: ${b.complexityDelta >= 0 ? '+' : ''}${b.complexityDelta.toFixed(2)}  Debt: ${b.debtDelta >= 0 ? '+' : ''}${b.debtDelta.toFixed(2)}${RESET}`);
    lines.push(`     ${FG.gray}└─ Structure: ${b.structuralDelta >= 0 ? '+' : ''}${b.structuralDelta.toFixed(2)}   Feature: ${b.featureDelta >= 0 ? '+' : ''}${b.featureDelta.toFixed(2)}${RESET}`);

    // Rationale (truncated)
    if (ev.action.rationale) {
      const rationale = ev.action.rationale.length > 120
        ? ev.action.rationale.substring(0, 117) + '...'
        : ev.action.rationale;
      lines.push(`     ${DIM}💭 ${rationale}${RESET}`);
    }
  }

  lines.push('');
  lines.push(`  ${FG.gray}${'─'.repeat(68)}${RESET}`);

  // ── Summary recommendation ──
  if (evaluations.length > 0) {
    const best = evaluations[0];
    lines.push('');
    lines.push(`  ${BOLD}${FG.green}▶ 최선의 수: ${best.action.intent}${RESET}`);
    lines.push(`    ${FG.green}ΔHealth ${best.deltaHealth >= 0 ? '+' : ''}${best.deltaHealth.toFixed(2)} — "${best.badukTerm}"${RESET}`);

    if (policyMode === 'heuristic') {
      lines.push('');
      lines.push(`  ${FG.yellow}💡 TIP: ANTHROPIC_API_KEY 또는 OPENAI_API_KEY를 설정하면${RESET}`);
      lines.push(`  ${FG.yellow}   LLM 기반 더 정밀한 수 읽기가 가능합니다.${RESET}`);
    }
  }

  lines.push('');
  lines.push(`  ${DIM}Analyzed at ${result.analyzedAt}${RESET}`);
  lines.push('');

  return lines.join('\n');
}
