// ============================================================
// Go / Baduk Notation Utilities
// Based on SGF (Smart Game Format) FF[4] standard
// https://www.red-bean.com/sgf/sgf4.html
//
// Real Go coordinates:
//   Columns: A B C D E F G H J K L M N O P Q R S T  (I is SKIPPED)
//   Rows:    19 18 17 ... 1  (top to bottom on board display)
//
// SGF internal format uses lowercase a-s (no skip):
//   Column a=0, b=1, ... s=18
//   Row    a=0(top), b=1, ... s=18(bottom)
// ============================================================

// ── Real Go column labels (I is skipped) ─────────────────────
export const GO_COLUMNS = 'ABCDEFGHJKLMNOPQRST'; // 19 chars, no I

/** Convert 0-based x → Go column letter (A-T, skipping I) */
export function colLabel(x: number): string {
  return GO_COLUMNS[Math.max(0, Math.min(18, x))];
}

/** Convert 0-based y → Go row number (19 at top, 1 at bottom) */
export function rowLabel(y: number): number {
  return 19 - y;
}

/** Full Go coordinate string, e.g. "D16", "K10", "Q3" */
export function goCoord(x: number, y: number): string {
  return `${colLabel(x)}${rowLabel(y)}`;
}

/** Parse "D16" → { x: 3, y: 3 } */
export function parseGoCoord(coord: string): { x: number; y: number } | null {
  const m = coord.match(/^([A-HJ-T])(\d+)$/i);
  if (!m) return null;
  const col = GO_COLUMNS.indexOf(m[1].toUpperCase());
  const row = 19 - parseInt(m[2]);
  if (col < 0 || row < 0 || row > 18) return null;
  return { x: col, y: row };
}

// ── SGF coordinate encoding ───────────────────────────────────
// SGF uses lowercase a-s for both axes (no skipping):
//   column: a=0 … s=18   (left to right)
//   row:    a=0 … s=18   (top to bottom, same as our y)

const SGF_CHARS = 'abcdefghijklmnopqrs';

/** Convert 0-based (x, y) → SGF coordinate string, e.g. "dp" */
export function sgfCoord(x: number, y: number): string {
  return `${SGF_CHARS[x] ?? 'a'}${SGF_CHARS[y] ?? 'a'}`;
}

// ── SGF exporter ──────────────────────────────────────────────

export interface SgfMove {
  moveNumber: number;
  x?: number;
  y?: number;
  intent: string;
  badge: string;
  winRateBefore: number;
  winRateAfter: number;
  isMyo: boolean;
}

/**
 * Export kifu moves to SGF format.
 * We use Black stones for "sente/myo" moves and White for defensive moves,
 * following the convention of black=initiative, white=reaction.
 */
export function toSGF(moves: SgfMove[], projectName = 'Project'): string {
  const date = new Date().toISOString().slice(0, 10);

  const header = [
    '(;',
    'FF[4]',           // SGF format version 4
    'GM[1]',           // Game type: Go
    'SZ[19]',          // Board size
    `GN[${projectName} — 바둑코딩 기보]`,
    `DT[${date}]`,
    'PB[Developer]',   // Black = active developer
    'PW[Codebase]',    // White = existing code
    'KM[0]',           // No komi (not a real game)
    'RU[Baduk-Coding]',// Custom ruleset
    'AP[Baduck Coding Workbench:2.0]',
    `C[바둑코딩 워크벤치 기보\\n프로젝트: ${projectName}\\n총 수: ${moves.length}\\n]`,
  ].join('\n');

  const nodes = moves.map(m => {
    const isBlack = ['sente', 'fuseki', 'attack'].includes(m.badge.includes('묘수') ? 'sente' : 'gote');
    const color = m.badge === '★묘수' || m.badge === '○선수' || m.badge === '●포석' ? 'B' : 'W';
    const coord = m.x !== undefined && m.y !== undefined ? sgfCoord(m.x, m.y) : 'tt'; // tt = pass
    const goPos = m.x !== undefined && m.y !== undefined ? goCoord(m.x, m.y) : '(pass)';

    const comment = [
      `수${m.moveNumber}: ${m.intent}`,
      `배지: ${m.badge}`,
      `착점: ${goPos}`,
      `Win-Rate: ${m.winRateBefore}% → ${m.winRateAfter}% (${m.winRateAfter >= m.winRateBefore ? '+' : ''}${m.winRateAfter - m.winRateBefore}%)`,
      m.isMyo ? '★ 묘수 (Brilliant Move)' : '',
    ].filter(Boolean).join('\\n');

    return `;${color}[${coord}]C[${comment}]`;
  });

  return `${header}\n${nodes.join('\n')}\n)`;
}

// ── Glossary (용어 사전) ───────────────────────────────────────

export interface GlossaryTerm {
  ko: string;          // Korean
  jp: string;          // Japanese / Chinese character
  en: string;          // English
  definition: string;
  codeAnalogy: string; // How it maps to code
}

export const BADUK_GLOSSARY: GlossaryTerm[] = [
  {
    ko: '묘수', jp: '妙手', en: 'Brilliant Move',
    definition: '처음엔 비직관적으로 보이지만 전체 판을 바꾸는 수. AI가 수천 번 시뮬레이션 후 발견한다.',
    codeAnalogy: 'Q값 > Prior×1.5 + 연쇄 선수 + 다중 위험 해소. 작은 리팩토링 하나가 이후 모든 개발을 선수로 만든다.',
  },
  {
    ko: '선수', jp: '先手', en: 'Sente',
    definition: '상대가 반드시 응수해야 하는 수. 주도권을 쥐고 다음 수도 선수가 된다.',
    codeAnalogy: '이 리팩토링을 하면 다음 기능 추가가 더 쉬워지는 연쇄 효과가 있는 액션.',
  },
  {
    ko: '후수', jp: '後手', en: 'Gote',
    definition: '상대의 수에 반응하는 수. 주도권을 잃는다.',
    codeAnalogy: '급한 버그 수정처럼 구조적 개선 없이 반응만 하는 액션.',
  },
  {
    ko: '정석', jp: '定石', en: 'Joseki',
    definition: '코너에서 검증된 일련의 수. 양쪽 모두 최선이라 합의된 패턴.',
    codeAnalogy: 'Strangler Fig, Extract Service 같은 검증된 리팩토링 패턴 적용.',
  },
  {
    ko: '포석', jp: '布石', en: 'Fuseki',
    definition: '초반 전체 판을 아우르는 전략적 배치. 이후 전투의 기반.',
    codeAnalogy: '초기 아키텍처 결정. 잘못된 포석은 게임 내내 불리함을 초래한다.',
  },
  {
    ko: '단수', jp: '単手', en: 'Atari',
    definition: '돌 하나만 더 두면 따낼 수 있는 상태. 즉각 대응 필요.',
    codeAnalogy: '건강도 < -0.5인 위험 모듈. 지금 손대지 않으면 곧 장애 발생.',
  },
  {
    ko: '패', jp: '劫', en: 'Ko',
    definition: '두 그룹이 서로를 계속 잡을 수 있는 무한 반복 상황. 규칙으로 제한.',
    codeAnalogy: '순환 의존성. A→B→A 형태의 모듈 순환. 해소하지 않으면 영원히 문제.',
  },
  {
    ko: '사활', jp: '死活', en: 'Life and Death',
    definition: '돌 그룹이 살 수 있는지 죽을 수밖에 없는지 판단하는 것.',
    codeAnalogy: '모듈이 장기적으로 유지 가능한지(살아있는 코드) 판단. 테스트 없는 고복잡도 모듈은 죽어가는 중.',
  },
  {
    ko: '집', jp: '地', en: 'Territory',
    definition: '자신의 돌로 둘러싼 빈 점. 게임 최종 점수의 기반.',
    codeAnalogy: '테스트로 커버된 신뢰 가능한 코드 영역. 넓을수록 안전하게 기능 추가 가능.',
  },
  {
    ko: '기보', jp: '棋譜', en: 'Kifu (Game Record)',
    definition: '바둑 대국의 모든 수를 기록한 문서. SGF 형식이 표준.',
    codeAnalogy: '개발 히스토리. 어떤 순서로 어떤 이유로 변경했는지 기록. UKDL 파일로 저장.',
  },
  {
    ko: '수읽기', jp: '読み', en: 'Reading',
    definition: '앞으로 펼쳐질 변화를 머릿속으로 계산하는 것. 프로는 수십 수 앞을 읽는다.',
    codeAnalogy: 'MCTS 시뮬레이션. 각 리팩토링 선택지가 3수 앞까지 어떤 결과를 낳는지 계산.',
  },
  {
    ko: '승률', jp: '勝率', en: 'Win Rate',
    definition: 'AI(KataGo, Leela Zero)가 현재 보드 상태에서 승리 확률을 0-100%로 표시.',
    codeAnalogy: 'Win-Rate = healthScore×0.35 + testCoverage×0.25 + complexityInv×0.20 + velocity×0.10 + debtInv×0.10',
  },
];

// ── Open Source References ────────────────────────────────────

export const GO_REFERENCES = [
  {
    name: 'KataGo',
    desc: '가장 강력한 오픈소스 바둑 AI. AlphaGo Zero 방식 + 독자적 개선.',
    url: 'https://github.com/lightvector/KataGo',
    relevance: '우리 Win-Rate 미터의 원본 모델. KataGo의 winrate 표시 방식을 코딩에 적용.',
  },
  {
    name: 'Leela Zero',
    desc: 'AlphaGo Zero 논문 재현 오픈소스. 자가 대국으로 학습.',
    url: 'https://github.com/leela-zero/leela-zero',
    relevance: 'MCTS + 정책/가치 네트워크 구조. 우리 heuristic MCTS의 이론적 기반.',
  },
  {
    name: 'SGF Specification (FF[4])',
    desc: 'Smart Game Format 공식 명세. 바둑 기보 표준 포맷.',
    url: 'https://www.red-bean.com/sgf/sgf4.html',
    relevance: '우리 기보 내보내기 형식. 모든 바둑 소프트웨어에서 열 수 있음.',
  },
  {
    name: 'AlphaGo Zero Paper',
    desc: 'Mastering the game of Go without human knowledge (Silver et al., 2017)',
    url: 'https://www.nature.com/articles/nature24270',
    relevance: '자가 대국 MCTS의 이론적 근거. 우리 수읽기 엔진의 알고리즘 기반.',
  },
  {
    name: 'Sabaki (SGF Editor)',
    desc: '오픈소스 바둑 기보 편집기. SGF 파일 열기/편집.',
    url: 'https://github.com/SabakiHQ/Sabaki',
    relevance: '우리가 내보낸 .sgf 파일을 이 프로그램으로 열어 복기할 수 있음.',
  },
];
