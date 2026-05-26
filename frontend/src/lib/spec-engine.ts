// ============================================================
// Spec Engine — CodeSpeak을 넘어서는 지능형 Spec 생성 엔진
//
// CodeSpeak 한계 5가지 극복:
// 1. DependencyPlanner: 태스크 간 의존성 그래프 + 최적 실행 순서
// 2. AdaptivePrompt: 실패 패턴 학습 + 수준별 프롬프트 적응
// 3. IntentExtractor: WHY 추출 + 대안 제안
// 4. RippleAnalyzer: 변경 영향도 분석 (파일 간 파급 효과)
// 5. IncrementalValidator: 단계별 검증 체크포인트
// ============================================================

// ── 1. DependencyPlanner ────────────────────────────────────────
// CodeSpeak: 모든 태스크를 병렬로 던짐 (의존성 무시)
// 碁Vibe: 태스크 간 의존성 그래프를 만들고 최적 실행 순서를 계산

export interface TaskNode {
  id: string;
  title: string;
  phase: string;           // 포석, 정석, 중반전 등
  dependsOn: string[];     // 선행 태스크 ID
  unlocksNext: string[];   // 이 태스크 완료 시 해금되는 태스크
  parallelGroup?: string;  // 병렬 실행 가능 그룹
  estimatedMinutes: number;
  risk: 'low' | 'medium' | 'high';
  layer: 'data' | 'logic' | 'ui' | 'infra' | 'test' | 'deploy';
}

export function buildDependencyGraph(
  appGoal: string,
  lang: string,
  lib: string,
  experience: string,
): TaskNode[] {
  const isBegin = experience === 'beginner';
  const isAdv = experience === 'advanced';

  // 기본 태스크 그래프 — 바둑 기보 순서대로
  const tasks: TaskNode[] = [
    // ── 포석: 기반 ──
    {
      id: 'T1-scaffold', title: '프로젝트 스캐폴딩',
      phase: '포석', dependsOn: [], unlocksNext: ['T2-types', 'T2-config'],
      parallelGroup: undefined, estimatedMinutes: isBegin ? 30 : 15,
      risk: 'low', layer: 'infra',
    },
    {
      id: 'T2-types', title: '핵심 타입/인터페이스 정의',
      phase: '포석', dependsOn: ['T1-scaffold'], unlocksNext: ['T3-data', 'T3-api'],
      parallelGroup: 'A', estimatedMinutes: isBegin ? 45 : 20,
      risk: 'low', layer: 'data',
    },
    {
      id: 'T2-config', title: '환경 설정 + Git 초기화',
      phase: '포석', dependsOn: ['T1-scaffold'], unlocksNext: ['T6-deploy'],
      parallelGroup: 'A', estimatedMinutes: 15,
      risk: 'low', layer: 'infra',
    },

    // ── 정석: 데이터 + API ──
    {
      id: 'T3-data', title: '데이터 모델 + DB 스키마',
      phase: '정석', dependsOn: ['T2-types'], unlocksNext: ['T4-core', 'T3-api'],
      parallelGroup: 'B', estimatedMinutes: isBegin ? 60 : 30,
      risk: 'medium', layer: 'data',
    },
    {
      id: 'T3-api', title: 'API 엔드포인트 설계',
      phase: '정석', dependsOn: ['T2-types'], unlocksNext: ['T4-core', 'T4-fetch'],
      parallelGroup: 'B', estimatedMinutes: isBegin ? 45 : 25,
      risk: 'medium', layer: 'logic',
    },

    // ── 중반전: 핵심 구현 ──
    {
      id: 'T4-core', title: '핵심 비즈니스 로직',
      phase: '중반전', dependsOn: ['T3-data', 'T3-api'], unlocksNext: ['T4-ui', 'T5-test'],
      estimatedMinutes: isBegin ? 120 : 60,
      risk: 'high', layer: 'logic',
    },
    {
      id: 'T4-ui', title: '메인 UI 컴포넌트',
      phase: '중반전', dependsOn: ['T4-core'], unlocksNext: ['T4-fetch'],
      estimatedMinutes: isBegin ? 90 : 45,
      risk: 'medium', layer: 'ui',
    },
    {
      id: 'T4-fetch', title: '데이터 페칭 + 상태 관리',
      phase: '중반전', dependsOn: ['T3-api', 'T4-ui'], unlocksNext: ['T5-edge'],
      estimatedMinutes: isBegin ? 60 : 30,
      risk: 'high', layer: 'logic',
    },

    // ── 선수: 엣지케이스 + 테스트 ──
    {
      id: 'T5-edge', title: '에러 처리 + 로딩 상태',
      phase: '선수', dependsOn: ['T4-fetch'], unlocksNext: ['T5-test'],
      parallelGroup: 'C', estimatedMinutes: isBegin ? 60 : 30,
      risk: 'medium', layer: 'ui',
    },
    {
      id: 'T5-test', title: '핵심 기능 테스트',
      phase: '선수', dependsOn: ['T4-core'], unlocksNext: ['T6-polish'],
      parallelGroup: 'C', estimatedMinutes: isAdv ? 45 : 60,
      risk: 'low', layer: 'test',
    },

    // ── 묘수: 차별화 ──
    {
      id: 'T6-polish', title: 'UX 완성 + 반응형 + 다크모드',
      phase: '묘수', dependsOn: ['T5-edge', 'T5-test'], unlocksNext: ['T6-myo'],
      estimatedMinutes: isBegin ? 60 : 40,
      risk: 'low', layer: 'ui',
    },
    {
      id: 'T6-myo', title: '★ 묘수 — 차별화 기능',
      phase: '묘수', dependsOn: ['T6-polish'], unlocksNext: ['T7-deploy'],
      estimatedMinutes: isAdv ? 60 : 90,
      risk: 'high', layer: 'logic',
    },

    // ── 끝내기: 배포 ──
    {
      id: 'T7-deploy', title: '배포 + README + 복습 스케줄',
      phase: '끝내기', dependsOn: ['T6-myo'], unlocksNext: [],
      estimatedMinutes: isBegin ? 60 : 30,
      risk: 'low', layer: 'deploy',
    },
  ];

  return tasks;
}

// 위상 정렬 — 의존성 순서대로 정렬
export function topologicalSort(tasks: TaskNode[]): TaskNode[] {
  const map = new Map(tasks.map(t => [t.id, t]));
  const visited = new Set<string>();
  const result: TaskNode[] = [];

  function visit(id: string) {
    if (visited.has(id)) return;
    visited.add(id);
    const task = map.get(id);
    if (!task) return;
    for (const dep of task.dependsOn) visit(dep);
    result.push(task);
  }

  for (const t of tasks) visit(t.id);
  return result;
}

// 크리티컬 패스 계산
export function criticalPath(tasks: TaskNode[]): { path: string[]; totalMinutes: number } {
  const sorted = topologicalSort(tasks);
  const earliest = new Map<string, number>();

  for (const t of sorted) {
    const depMax = t.dependsOn.length > 0
      ? Math.max(...t.dependsOn.map(d => (earliest.get(d) || 0)))
      : 0;
    earliest.set(t.id, depMax + t.estimatedMinutes);
  }

  // Backtrack from the last task
  let maxTime = 0;
  let maxId = '';
  for (const [id, time] of earliest) {
    if (time > maxTime) { maxTime = time; maxId = id; }
  }

  const path: string[] = [];
  let current = maxId;
  while (current) {
    path.unshift(current);
    const task = sorted.find(t => t.id === current);
    if (!task || task.dependsOn.length === 0) break;
    // Pick the dependency with the latest finish time
    current = task.dependsOn.reduce((best, d) =>
      (earliest.get(d) || 0) > (earliest.get(best) || 0) ? d : best
    , task.dependsOn[0]);
  }

  return { path, totalMinutes: maxTime };
}


// ── 2. AdaptivePromptEngine ─────────────────────────────────────
// CodeSpeak: 정적 프롬프트 템플릿 (사용자 수준/실패 무시)
// 碁Vibe: 실패 패턴 기록 + 수준별 자동 적응

export interface PromptHistory {
  stepId: string;
  prompt: string;
  wasUseful: boolean;  // 사용자 피드백
  failureReason?: string;
  timestamp: number;
}

const HISTORY_KEY = 'govibe-prompt-history';

export function loadPromptHistory(): PromptHistory[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch { return []; }
}

export function savePromptFeedback(entry: PromptHistory) {
  const history = loadPromptHistory();
  history.push(entry);
  // Keep last 50
  const trimmed = history.slice(-50);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
}

export function getFailurePatterns(): string[] {
  const history = loadPromptHistory();
  return history
    .filter(h => !h.wasUseful && h.failureReason)
    .map(h => h.failureReason!)
    .slice(-5);
}

export function buildAdaptiveContext(experience: string): string {
  const failures = getFailurePatterns();
  const history = loadPromptHistory();
  const successRate = history.length > 0
    ? Math.round(history.filter(h => h.wasUseful).length / history.length * 100)
    : -1;

  let context = '';

  if (failures.length > 0) {
    context += `\n## 이전 실패 패턴 (이 부분을 개선해주세요)\n`;
    failures.forEach(f => { context += `- ⚠ ${f}\n`; });
  }

  if (successRate >= 0) {
    context += `\n프롬프트 성공률: ${successRate}% (${history.length}회 기록)\n`;
  }

  if (experience === 'beginner') {
    context += `\n## 초보자 최적화\n- 모든 용어에 한 줄 설명 추가\n- 코드 블록마다 "이 코드가 하는 일:" 주석\n- 한 번에 1개 파일만 수정\n- 실행 결과 예시를 반드시 포함\n`;
  } else if (experience === 'advanced') {
    context += `\n## 고급자 최적화\n- 설명 최소화, 코드 중심\n- 설계 대안 2개 이상 제시\n- 성능/확장성 트레이드오프 명시\n- Edge case 자동 포함\n`;
  }

  return context;
}


// ── 3. IntentExtractor ──────────────────────────────────────────
// CodeSpeak: spec을 문자 그대로 해석 (WHY 무시)
// 碁Vibe: 사용자 목표에서 WHY를 추출하고 대안을 제안

export interface ExtractedIntent {
  what: string;       // 무엇을 만드는가
  why: string;        // 왜 만드는가 (추론)
  who: string;        // 누구를 위한 것인가
  alternatives: string[]; // 대안적 접근법
  risks: string[];    // 예상 리스크
}

export function extractIntent(appGoal: string, lang: string, lib: string): ExtractedIntent {
  const goal = appGoal.toLowerCase();

  // WHO 추론
  const whoPatterns: [RegExp, string][] = [
    [/학생|공부|학습/, '학생/학습자'],
    [/회사|업무|직장|팀/, '직장인/팀'],
    [/사이드|개인|나를|내가/, '개인 사용자'],
    [/고객|사용자|유저|클라이언트/, '최종 사용자/고객'],
    [/스타트업|창업|MVP/, '스타트업 팀'],
  ];
  const who = whoPatterns.find(([re]) => re.test(goal))?.[1] || '일반 사용자';

  // WHY 추론
  const whyPatterns: [RegExp, string][] = [
    [/자동화|효율|편리|빠르/, '반복 작업을 자동화하여 시간 절약'],
    [/대시보드|모니터링|시각화|차트/, '데이터를 시각적으로 파악하여 의사결정 개선'],
    [/관리|tracking|추적/, '정보를 체계적으로 관리하고 추적'],
    [/쇼핑|커머스|결제|판매/, '온라인 거래를 가능하게 하여 수익 창출'],
    [/소셜|공유|커뮤니티|채팅/, '사람들을 연결하고 소통 촉진'],
    [/학습|교육|퀴즈|코스/, '학습 경험을 개선하고 성과 향상'],
    [/포트폴리오|이력서|프로필/, '개인 브랜딩과 경력 향상'],
    [/게임|재미|엔터/, '몰입감 있는 경험 제공'],
  ];
  const why = whyPatterns.find(([re]) => re.test(goal))?.[1] || '사용자의 특정 문제를 효율적으로 해결';

  // 대안 제안
  const alternatives: string[] = [];
  if (goal.includes('앱') || goal.includes('웹')) {
    alternatives.push(`${lib} 대신 ${lang === 'TypeScript' ? 'Svelte/SvelteKit' : lang === 'Python' ? 'Streamlit' : 'Tauri'}로 더 빠르게 프로토타입`);
  }
  if (!goal.includes('api') && !goal.includes('서버')) {
    alternatives.push('BaaS(Firebase/Supabase)로 백엔드 없이 구현');
  }
  alternatives.push(`v0.dev/Bolt.new으로 UI를 먼저 생성한 후 로직 추가`);
  if (goal.length > 50) {
    alternatives.push('MVP를 먼저 만들고 점진적으로 기능 추가 (Lean 접근)');
  }

  // 리스크
  const risks: string[] = [];
  if (goal.length > 200) risks.push('범위가 넓음 — MVP로 좁혀서 시작 권장');
  if (goal.includes('실시간') || goal.includes('real-time')) risks.push('실시간 기능은 WebSocket/SSE 복잡도 증가');
  if (goal.includes('결제') || goal.includes('payment')) risks.push('결제 연동은 보안/규제 고려 필수');
  if (goal.includes('AI') || goal.includes('LLM')) risks.push('AI API 비용 관리 필요');

  return {
    what: appGoal.slice(0, 100),
    why,
    who,
    alternatives,
    risks,
  };
}


// ── 4. RippleAnalyzer ───────────────────────────────────────────
// CodeSpeak: 파일 간 영향도 분석 없음
// 碁Vibe: 각 태스크가 영향을 주는 레이어를 표시

export interface RippleEffect {
  taskId: string;
  affectedLayers: ('data' | 'logic' | 'ui' | 'infra' | 'test' | 'deploy')[];
  rippleScore: number;  // 0-1, 높을수록 파급 효과 큼
}

export function analyzeRipple(tasks: TaskNode[]): RippleEffect[] {
  const map = new Map(tasks.map(t => [t.id, t]));

  return tasks.map(task => {
    // 이 태스크가 해금하는 모든 후속 태스크의 레이어를 수집
    const affected = new Set<string>();
    affected.add(task.layer);

    const queue = [...task.unlocksNext];
    const visited = new Set<string>();
    while (queue.length > 0) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      const t = map.get(id);
      if (t) {
        affected.add(t.layer);
        queue.push(...t.unlocksNext);
      }
    }

    return {
      taskId: task.id,
      affectedLayers: [...affected] as RippleEffect['affectedLayers'],
      rippleScore: Math.min(1, affected.size / 6),
    };
  });
}


// ── 5. IncrementalValidator ─────────────────────────────────────
// CodeSpeak: 마지막에만 테스트 실행
// 碁Vibe: 각 태스크 완료 후 검증 체크포인트

export interface ValidationCheckpoint {
  taskId: string;
  checks: string[];
  autoTestCommand?: string;
}

export function generateCheckpoints(tasks: TaskNode[], lang: string, lib: string): ValidationCheckpoint[] {
  return tasks.map(task => {
    const checks: string[] = [];
    let autoTest: string | undefined;

    switch (task.layer) {
      case 'infra':
        checks.push('프로젝트가 빌드 오류 없이 실행되는가?');
        checks.push('개발 서버가 정상 시작되는가?');
        autoTest = lang === 'TypeScript' ? 'npm run dev' : lang === 'Python' ? 'python manage.py runserver' : undefined;
        break;
      case 'data':
        checks.push('타입/스키마에 누락된 필드가 없는가?');
        checks.push('필수 관계(FK)가 모두 정의되었는가?');
        autoTest = lang === 'TypeScript' ? 'npx tsc --noEmit' : undefined;
        break;
      case 'logic':
        checks.push('핵심 함수가 예상 입력에 올바른 출력을 반환하는가?');
        checks.push('에러 케이스가 처리되는가?');
        autoTest = lang === 'TypeScript' ? 'npx vitest run' : lang === 'Python' ? 'pytest' : undefined;
        break;
      case 'ui':
        checks.push('주요 화면이 레이아웃 깨짐 없이 렌더링되는가?');
        checks.push('반응형: 모바일(375px)과 데스크탑(1280px) 확인');
        break;
      case 'test':
        checks.push('핵심 경로 테스트가 모두 통과하는가?');
        checks.push('엣지 케이스 테스트가 포함되었는가?');
        autoTest = lang === 'TypeScript' ? 'npx vitest run --coverage' : 'pytest --cov';
        break;
      case 'deploy':
        checks.push('프로덕션 빌드가 성공하는가?');
        checks.push('배포 URL이 정상 접근 가능한가?');
        autoTest = lang === 'TypeScript' ? 'npm run build' : 'python -m build';
        break;
    }

    // 묘수 단계: 추가 검증
    if (task.phase === '묘수') {
      checks.push('이 기능이 다른 비슷한 앱과 명확히 차별화되는가?');
      checks.push('파인만 테스트: 비개발자에게 이 기능을 30초 내에 설명할 수 있는가?');
    }

    return { taskId: task.id, checks, autoTestCommand: autoTest };
  });
}
