import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { Language, Library } from '../data/mandala';
import { useTheme, ThemeToggle } from '../lib/theme';
import { AI_MODELS, PROVIDER_INFO, loadAISettings, saveAISettings, testAPIKey, generateStepPrompt, type AISettings, type Provider } from '../lib/ai-client';
import {
  buildDependencyGraph, topologicalSort, criticalPath, analyzeRipple, generateCheckpoints,
  extractIntent, buildAdaptiveContext, savePromptFeedback,
  type TaskNode, type ExtractedIntent,
} from '../lib/spec-engine';
import {
  generateFullProject, downloadAsZip, downloadAllFiles,
  type VirtualFile, type ProjectState,
} from '../lib/code-generator';
import { runProject, teardown, type ContainerStatus } from '../lib/webcontainer';

// ═══════════════════════════════════════════════════════════════
// SpecPage — 학습과학 기반 바이브 코딩 Spec 생성기
// good-prompt-generator 컨셉: 프로파일링 질문 → 인지과학 기반
// 개발 단계별 최적화 프롬프트 자동 생성
// ═══════════════════════════════════════════════════════════════

// ── Profile — 핵심 5개 질문 (나머지 자동 추론) ──────────────────

interface ProfileState {
  // 5개 핵심 질문
  appGoal: string;          // 1. 뭘 만들고 싶은가
  experience: string;       // 2. 개발 경험 수준
  timePerDay: string;       // 3. 하루에 얼마나
  outputStyle: string;      // 4. 어떤 수준으로
  preferredAI: string[];    // 5. 어떤 AI로

  // 자동 추론 (5개 답변에서 파생)
  devStyle: string[];
  cognitiveStyle: string;
  motivation: string[];
  priorKnowledge: string;
  challenges: string;
  deployTarget: string;
  teamSize: string;
}

const INITIAL_PROFILE: ProfileState = {
  appGoal: '', experience: '', timePerDay: '', outputStyle: '', preferredAI: [],
  devStyle: [], cognitiveStyle: '', motivation: [], priorKnowledge: '',
  challenges: '', deployTarget: '', teamSize: '',
};

// ── 5개 답변에서 나머지 7개 자동 추론 ───────────────────────────

function autoInferProfile(p: ProfileState, lang: string, lib: string): ProfileState {
  const goal = p.appGoal.toLowerCase();
  const next = { ...p };

  // devStyle 추론: 경험 수준 + 앱 목표
  if (p.devStyle.length === 0) {
    if (p.experience === 'beginner') next.devStyle = ['프로토타입 먼저', 'AI 페어 프로그래밍'];
    else if (p.experience === 'advanced') next.devStyle = ['TDD (테스트 먼저)', '데이터 먼저'];
    else next.devStyle = ['프로토타입 먼저', 'UI 먼저'];
  }

  // cognitiveStyle 추론: 앱 목표 키워드
  if (!next.cognitiveStyle) {
    if (goal.match(/차트|시각|대시보드|그래프|디자인|UI/)) next.cognitiveStyle = 'visual';
    else if (goal.match(/분석|데이터|통계|계산|알고리즘/)) next.cognitiveStyle = 'analytical';
    else if (goal.match(/자동화|봇|스크립트|API/)) next.cognitiveStyle = 'hands-on';
    else next.cognitiveStyle = 'visual';
  }

  // motivation 추론: outputStyle
  if (next.motivation.length === 0) {
    if (p.outputStyle === 'production') next.motivation = ['스타트업', '업무 자동화'];
    else if (p.outputStyle === 'polished') next.motivation = ['포트폴리오', '사이드 프로젝트'];
    else next.motivation = ['학습 목적', '재미'];
  }

  // priorKnowledge 추론: 선택한 언어/라이브러리
  if (!next.priorKnowledge) {
    if (p.experience === 'beginner') next.priorKnowledge = `${lang} 기초 문법`;
    else if (p.experience === 'advanced') next.priorKnowledge = `${lang} 숙련, ${lib} 경험 있음`;
    else next.priorKnowledge = `${lang} 기본, ${lib} 초보`;
  }

  // challenges 추론
  if (!next.challenges) {
    if (p.experience === 'beginner') next.challenges = '프로젝트 구조 잡기, 에러 디버깅';
    else if (goal.match(/실시간|real.?time/)) next.challenges = 'WebSocket/실시간 데이터 처리';
    else if (goal.match(/AI|LLM|머신러닝/)) next.challenges = 'AI API 연동, 비용 관리';
    else next.challenges = '아키텍처 설계, 상태 관리';
  }

  // deployTarget 추론
  if (!next.deployTarget) {
    if (p.outputStyle === 'production') next.deployTarget = 'fullstack';
    else if (lib.match(/Streamlit|Flask|Django|FastAPI/i)) next.deployTarget = 'Railway';
    else next.deployTarget = 'Vercel';
  }

  // teamSize 추론
  if (!next.teamSize) {
    next.teamSize = p.outputStyle === 'production' ? 'team' : 'solo';
  }

  return next;
}

// ── Development Stages × Cognitive Science ──────────────────────
// 인지과학 이론을 실제 개발 단계에 매핑
// 각 단계는 초보→시니어까지 레벨별 구체적 행동 포함

interface DevTheory {
  id: string;
  name: string;
  icon: string;
  devStage: string;        // 매핑된 개발 단계
  badukPhase: string;      // 바둑 기보 단계
  desc: string;            // 인지과학 설명
  devDesc: string;         // 개발자 관점 설명
  beginner: string;        // 초보자 행동
  intermediate: string;    // 중급자 행동
  advanced: string;        // 고급자 행동
  worldClass: string;      // 세계 최고 수준
}

const THEORIES: DevTheory[] = [
  {
    id: 'cogload', name: '인지부하 관리', icon: '⚖️',
    devStage: '프로젝트 설계', badukPhase: '포석',
    desc: '작업 기억 용량 내에서 정보량 최적화',
    devDesc: '한 번에 처리할 수 있는 복잡도를 넘지 않도록 구조를 분해',
    beginner: '파일 3개 이하로 시작. 한 파일 = 한 기능. 주석 많이.',
    intermediate: 'Feature-based 디렉토리. 모듈 간 의존성 최소화.',
    advanced: 'Clean Architecture 레이어 분리. DI 컨테이너 설계.',
    worldClass: 'DSL 설계로 도메인 복잡도 자체를 낮춤. 인지 모델링 기반 API 설계.',
  },
  {
    id: 'elaboration', name: '정교화 설계', icon: '🔗',
    devStage: '아키텍처 + 데이터 모델', badukPhase: '정석',
    desc: '새로운 지식을 기존 지식과 연결하여 이해 강화',
    devDesc: '이미 아는 패턴/프레임워크와 새 요구사항을 연결해 설계',
    beginner: 'CRUD 패턴부터. "이건 Todo앱의 X와 같다" 비유 활용.',
    intermediate: '디자인 패턴 적용 (Observer, Strategy). 기존 프로젝트 경험 연결.',
    advanced: 'DDD 유비쿼터스 언어로 도메인 모델링. 이벤트 소싱 패턴.',
    worldClass: '도메인 전문가와 Co-design. Category Theory 기반 타입 설계.',
  },
  {
    id: 'flow', name: '몰입 구현', icon: '🌊',
    devStage: '핵심 기능 개발', badukPhase: '중반전',
    desc: '실력과 난이도가 일치할 때 최적 몰입 상태 진입',
    devDesc: '너무 쉽지도 어렵지도 않은 태스크로 연속 몰입',
    beginner: '30분 단위 포모도로. 한 번에 한 함수만. 즉시 실행 가능한 코드.',
    intermediate: '1-2시간 딥워크 세션. TDD 레드-그린-리팩터 리듬.',
    advanced: '3시간+ 아키텍처 세션. 복잡한 알고리즘을 점진적으로 구현.',
    worldClass: '프로토타입→프로덕션 연속 흐름. 컴파일러/런타임 수준 최적화 몰입.',
  },
  {
    id: 'retrieval', name: '인출 테스트', icon: '🧠',
    devStage: '테스트 + 디버깅', badukPhase: '선수',
    desc: '기억을 능동적으로 인출하면 학습이 강화됨',
    devDesc: '코드를 보지 않고 핵심 로직을 재구현할 수 있는지 테스트',
    beginner: '콘솔 로그로 확인. 빈 파일에서 함수 1개 다시 작성해보기.',
    intermediate: '단위 테스트 작성 = 인출학습. 100% 커버리지 목표.',
    advanced: '통합/E2E 테스트. 프로퍼티 기반 테스트. 카오스 엔지니어링.',
    worldClass: '형식 검증(Formal Verification). Fuzzing. 프로덕션 메트릭 기반 테스트.',
  },
  {
    id: 'feynman', name: '파인만 리뷰', icon: '👨‍🏫',
    devStage: '코드 리뷰 + 리팩토링', badukPhase: '묘수',
    desc: '12살 아이에게 설명할 수 없으면 이해하지 못한 것',
    devDesc: '코드의 모든 결정을 비전문가에게 설명할 수 있어야 함',
    beginner: 'README를 초등학생 눈높이로 작성. 각 함수에 "이 함수는..." 주석.',
    intermediate: 'PR 설명에 Why를 명시. ADR(Architecture Decision Record) 작성.',
    advanced: 'RFC 문서 작성. 기술 블로그로 아키텍처 설명. 팀 지식 공유.',
    worldClass: '논문/컨퍼런스 발표. 오픈소스 문서화. 후배 멘토링으로 자기 지식 검증.',
  },
  {
    id: 'dualcoding', name: '이중부호화 UI', icon: '🎨',
    devStage: 'UI/UX + 시각화', badukPhase: '묘수',
    desc: '시각 + 언어 채널을 동시에 활용하면 이해도 2배',
    devDesc: '코드 + 다이어그램을 병행해서 시스템을 이해하고 설계',
    beginner: 'Figma로 와이어프레임 먼저. 스크린샷으로 진행상황 기록.',
    intermediate: 'Mermaid 다이어그램 + 코드. 컴포넌트 스토리북.',
    advanced: 'C4 아키텍처 다이어그램. 성능 대시보드. 실시간 모니터링.',
    worldClass: 'Observable Notebook. 인터랙티브 문서화. 코드↔시각화 양방향 동기화.',
  },
  {
    id: 'spacing', name: '간격 배포', icon: '📅',
    devStage: '배포 + 유지보수', badukPhase: '끝내기',
    desc: '분산 반복이 집중 반복보다 장기 기억에 효과적',
    devDesc: '점진적 배포와 주기적 복습으로 장기 유지 가능한 코드',
    beginner: '배포 후 1일/3일/7일에 코드 다시 읽기. 간단한 기능 추가로 복습.',
    intermediate: 'CI/CD 파이프라인. 카나리 배포. 주간 리팩토링 세션.',
    advanced: 'Feature flag 기반 점진적 롤아웃. SLO/SLI 모니터링.',
    worldClass: '블루-그린/카오스 배포. 자동 롤백. 기술 부채 스프린트 정기화.',
  },
];

// ── SpecStep interface ──────────────────────────────────────────

interface SpecStep {
  phase: string;
  title: string;
  description: string;
  tasks: string[];
  tools: string[];
  vibePrompt: string;       // 인지과학 최적화 프롬프트
  cogTheory: string;        // 적용된 인지과학 이론
  estimatedMinutes: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

interface GeneratedSpec {
  appName: string;
  summary: string;
  techStack: string[];
  steps: SpecStep[];
  totalEstimatedHours: number;
  successCriteria: string[];
  appliedTheories: string[];
  devProfile: string;       // 생성된 개발자 프로필 요약
}

// ── Component ───────────────────────────────────────────────────

export default function SpecPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language, library } = (location.state || {}) as { language?: Language; library?: Library };
  const { resolved } = useTheme();
  const isDark = resolved === 'dark';

  const [profile, setProfile] = useState<ProfileState>(INITIAL_PROFILE);
  const [spec, setSpec] = useState<GeneratedSpec | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  // ── AI Settings ─────────────────────────────────────────────
  const [aiSettings, setAiSettings] = useState<AISettings>(loadAISettings);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [aiTesting, setAiTesting] = useState(false);
  const [aiGenerating, setAiGenerating] = useState<number | null>(null);
  const [aiPrompts, setAiPrompts] = useState<Record<number, string>>({});

  // ── Code Generation State ───────────────────────────────────
  const [codeGen, setCodeGen] = useState<ProjectState | null>(null);
  const [codeGenStep, setCodeGenStep] = useState(0);
  const [showCodePanel, setShowCodePanel] = useState(false);

  // ── WebContainer State ──────────────────────────────────────
  const [wcStatus, setWcStatus] = useState<ContainerStatus>('idle');
  const [wcLogs, setWcLogs] = useState<string[]>([]);
  const [wcPreviewUrl, setWcPreviewUrl] = useState<string | null>(null);
  const iframeRef = useState<HTMLIFrameElement | null>(null);

  const handleRunInBrowser = async () => {
    if (!codeGen?.files.length) return;
    setWcLogs([]);
    setWcPreviewUrl(null);
    await runProject(
      codeGen.files, lang, lib,
      (msg) => setWcLogs(prev => [...prev.slice(-100), msg]),
      setWcStatus,
      (url) => setWcPreviewUrl(url),
    );
  };

  const handleGenerateProject = async () => {
    if (!spec || !aiSettings.apiKey) return;
    setShowCodePanel(true);
    setCodeGen({ files: [], currentStep: 0, totalSteps: spec.steps.length, status: 'generating', log: ['프로젝트 코드 생성 시작...'] });

    const result = await generateFullProject(
      aiSettings,
      spec.steps.map(s => ({ phase: s.phase, title: s.title, tasks: s.tasks })),
      { lang, lib, appGoal: profile.appGoal },
      (stepIdx, total, files) => {
        setCodeGenStep(stepIdx);
        setCodeGen(prev => prev ? { ...prev, currentStep: stepIdx, files: [...files] } : null);
      },
    );

    setCodeGen(result);
  };

  const updateAiSettings = (patch: Partial<AISettings>) => {
    const next = { ...aiSettings, ...patch };
    // Auto-switch model when provider changes
    if (patch.provider && patch.provider !== aiSettings.provider) {
      const firstModel = AI_MODELS.find(m => m.provider === patch.provider);
      if (firstModel) next.modelId = firstModel.id;
    }
    setAiSettings(next);
    saveAISettings(next);
    setAiTestResult(null);
  };

  const handleTestKey = async () => {
    setAiTesting(true);
    setAiTestResult(null);
    const result = await testAPIKey(aiSettings);
    setAiTestResult(result);
    setAiTesting(false);
  };

  const handleGenerateAI = async (stepIdx: number) => {
    if (!spec || !aiSettings.apiKey) return;
    const step = spec.steps[stepIdx];
    setAiGenerating(stepIdx);
    const result = await generateStepPrompt(aiSettings, {
      lang, lib,
      appGoal: profile.appGoal,
      phase: step.phase,
      stepTitle: step.title,
      cogTheory: step.cogTheory,
      tasks: step.tasks,
      experience: profile.experience || 'intermediate',
      cognitiveStyle: profile.cognitiveStyle || 'balanced',
      challenges: profile.challenges,
    });
    if (result.ok) {
      setAiPrompts(prev => ({ ...prev, [stepIdx]: result.prompt }));
    } else {
      setAiPrompts(prev => ({ ...prev, [stepIdx]: `⚠ 생성 실패: ${result.error}` }));
    }
    setAiGenerating(null);
  };

  const lang = language?.name || 'TypeScript';
  const lib = library?.name || 'React';

  // Progress: 5개 핵심 질문 기준
  const filledCount = [
    profile.appGoal.length > 10,    // 1. 뭘 만들 건지
    !!profile.experience,           // 2. 경험 수준
    !!profile.timePerDay,           // 3. 하루 시간
    !!profile.outputStyle,          // 4. 품질 목표
    profile.preferredAI.length > 0, // 5. AI 도구
  ].filter(Boolean).length;

  const progressPercent = Math.round((filledCount / 5) * 100);

  // 5개 답변에서 나머지 7개 자동 추론
  const fullProfile = autoInferProfile(profile, lang, lib);

  // Update field helper
  const set = <K extends keyof ProfileState>(key: K, val: ProfileState[K]) =>
    setProfile(p => ({ ...p, [key]: val }));

  const toggleArray = (key: 'devStyle' | 'motivation' | 'preferredAI', val: string) =>
    setProfile(p => ({
      ...p,
      [key]: p[key].includes(val) ? p[key].filter(v => v !== val) : [...p[key], val],
    }));

  // ── Real-time Spec generation ─────────────────────────────────

  const generateSpec = useCallback((): GeneratedSpec | null => {
    if (filledCount < 2) return null; // 2개만 채워도 시작

    // 자동 추론된 전체 프로필 사용
    const p = fullProfile;
    const goal = p.appGoal || `${lib} 기반 앱`;
    const appName = goal.length > 40 ? goal.slice(0, 40) + '...' : goal;
    const isBegin = p.experience === 'beginner';
    const isAdv = p.experience === 'advanced';
    const time = p.timePerDay || '1-2시간';
    const cogStyle = p.cognitiveStyle || 'visual';

    // Determine cognitive load level
    const cogLoadLevel = isBegin ? '낮은' : isAdv ? '높은' : '중간';

    // Build dev profile summary
    const devProfile = [
      `${p.experience || '중급'} 수준의 ${lang} 개발자`,
      p.devStyle.length > 0 ? `선호 스타일: ${p.devStyle.join(', ')}` : null,
      `인지 스타일: ${cogStyle}`,
      `일일 투자: ${time}`,
      p.motivation.length > 0 ? `동기 요인: ${p.motivation.join(', ')}` : null,
    ].filter(Boolean).join(' · ');

    // Build theory-optimized prompts for each phase
    const phases: SpecStep[] = [
      {
        phase: 'Phase 1: 포석 (布石)',
        title: '프로젝트 구조 설계 + 환경 구성',
        description: `인지부하 이론 적용 — ${cogLoadLevel} 복잡도로 시작해 점진적으로 확장. ${isBegin ? '스캐폴딩 도구를 활용해 최소 설정으로 시작합니다.' : '커스텀 구조를 설계합니다.'}`,
        tasks: [
          `${lang} + ${lib} 프로젝트 생성`,
          '디렉토리 구조 설계 (feature-based)',
          '의존성 설치 + 개발 도구 설정',
          'Git 초기화 + .gitignore',
          isBegin ? '기본 예제 코드로 동작 확인' : '아키텍처 다이어그램 작성',
        ],
        tools: [lang, lib, 'Git', 'VS Code'],
        cogTheory: '인지부하 이론 — 초기 정보량을 최소화해 작업 기억 과부하 방지',
        vibePrompt: buildVibePrompt('포석', {
          goal, lang, lib, cogStyle, isBegin,
          instruction: `${lang}과 ${lib}로 새 프로젝트를 만들어줘.

## 요구사항
- 목표: ${goal}
- 폴더 구조: feature-based architecture
- ${isBegin ? '초보자가 이해하기 쉽게 각 파일에 주석을 달아줘' : '확장 가능한 구조로 설계해줘'}
- ${cogStyle === 'visual' ? '디렉토리 트리를 ASCII 아트로 먼저 보여줘' : ''}
- 각 파일의 역할을 간단히 설명해줘 (파인만 기법: 12살 아이도 이해할 수 있게)

## 인지부하 최적화
한 번에 3개 이하의 파일만 생성하고, 각 파일이 왜 필요한지 설명한 후 다음으로 넘어가줘.`,
        }),
        estimatedMinutes: isBegin ? 45 : 30,
        difficulty: 'easy',
      },
      {
        phase: 'Phase 2: 정석 (定石)',
        title: '데이터 모델 + API 설계',
        description: `정교화 이론 적용 — 기존 지식(${p.priorKnowledge || '기본 프로그래밍'})과 연결하며 새로운 개념을 도입. 이중부호화로 다이어그램+코드를 병행합니다.`,
        tasks: [
          '핵심 데이터 타입/인터페이스 정의',
          'API 엔드포인트 설계',
          '상태 관리 전략 결정',
          p.deployTarget === 'fullstack' ? '데이터베이스 스키마 설계' : 'Mock 데이터 구성',
          '타입 안전성 검증',
        ],
        tools: [lib, lang, p.deployTarget === 'fullstack' ? 'Prisma/SQLAlchemy' : 'Mock Data'],
        cogTheory: '정교화 이론 + 이중부호화 — 기존 지식과 연결하며 시각+코드 동시 제시',
        vibePrompt: buildVibePrompt('정석', {
          goal, lang, lib, cogStyle, isBegin,
          instruction: `${goal}에 필요한 데이터 모델과 API를 설계해줘.

## 정교화 학습 전략
1. 먼저 일상 언어로 데이터 흐름을 설명해줘 (파인만 기법)
2. ${cogStyle === 'visual' ? 'Mermaid 다이어그램으로 데이터 관계를 그려줘' : '텍스트 기반 ERD를 보여줘'}
3. 그 다음 ${lang} 타입/인터페이스로 구현해줘
${p.priorKnowledge ? `4. 내가 이미 아는 ${p.priorKnowledge}과 비교해서 설명해줘` : ''}

## 인지부하 관리
- 핵심 엔티티 3개 이하로 시작
- 각 타입마다 "왜 이런 구조인지" 한 줄 설명
- CRUD 엔드포인트를 표로 정리해줘`,
        }),
        estimatedMinutes: isBegin ? 90 : 60,
        difficulty: 'medium',
      },
      {
        phase: 'Phase 3: 중반전 (中盤)',
        title: '핵심 기능 구현',
        description: `몰입상태(Flow) 이론 적용 — 난이도를 실력에 맞춰 조절. ${time} 단위로 달성 가능한 마일스톤을 설정합니다. 간격효과를 위해 세션 사이 복습 포인트를 배치합니다.`,
        tasks: [
          '메인 화면 UI 구현',
          '핵심 비즈니스 로직 작성',
          '데이터 페칭 + 상태 관리 연결',
          '사용자 인터랙션 처리',
          '중간 테스트 — 인출학습 체크포인트',
        ],
        tools: [lib, lang, 'State Management'],
        cogTheory: '몰입상태(Flow) + 간격효과 — 적정 난이도 유지 + 세션 간 복습',
        vibePrompt: buildVibePrompt('중반전', {
          goal, lang, lib, cogStyle, isBegin,
          instruction: `${goal}의 핵심 기능을 구현해줘.

## 몰입 상태 최적화 전략
이 기능을 ${time} 세션 ${isBegin ? '3' : '2'}개로 나눠서 구현할 거야.

### 세션 1: UI 뼈대
- 사용자가 처음 앱을 열었을 때 보는 화면
- ${cogStyle === 'visual' ? '먼저 와이어프레임을 ASCII/Mermaid로 그려줘' : '컴포넌트 계층 구조를 먼저 설명해줘'}
- 더미 데이터로 동작하도록

### 세션 2: 로직 연결
- 실제 데이터 페칭
- 상태 관리 연결
- 기본 에러 처리

${isBegin ? '### 세션 3: 이해도 확인\n- 각 함수가 하는 일을 한 문장으로 설명해줘\n- 내가 직접 수정해볼 수 있는 챌린지 3개를 줘' : ''}

## 간격학습 복습 포인트
각 세션 시작 전에 "이전 세션에서 만든 것 요약" 섹션을 넣어줘 (인출학습).
${p.challenges ? `\n## 예상 어려움 대비\n${p.challenges}에 대해 미리 대처 방안을 설명해줘.` : ''}`,
        }),
        estimatedMinutes: isBegin ? 240 : 180,
        difficulty: 'hard',
      },
      {
        phase: 'Phase 4: 선수 (先手)',
        title: '부가 기능 + UX 완성',
        description: `자기결정 이론 적용 — ${p.motivation.length > 0 ? p.motivation.join('/') : '자율성과 유능감'}을 강화하는 방식으로 부가 기능을 추가. 선택의 자유를 주면서도 가이드를 제공합니다.`,
        tasks: [
          '부가 기능 구현 (선택적)',
          '에러 핸들링 + 로딩 상태',
          '반응형 디자인',
          p.outputStyle === 'polished' ? '마이크로 애니메이션 추가' : '기능적 완성도 확보',
          '접근성 (a11y) 기본 적용',
        ],
        tools: [lib, 'Tailwind CSS', 'Error Boundary'],
        cogTheory: '자기결정 이론 — 자율성/유능감/관계성 강화',
        vibePrompt: buildVibePrompt('선수', {
          goal, lang, lib, cogStyle, isBegin,
          instruction: `${goal}의 완성도를 높여줘.

## 자기결정 이론 적용
아래 목록에서 내가 우선순위를 정해서 진행할 거야. 각 항목의 난이도와 효과를 알려줘:

### 선택 가능한 수 (착점 후보):
1. 에러/로딩/빈 상태 처리 — UX 안정성
2. 반응형 레이아웃 (모바일/데스크탑)
3. 다크모드 지원
4. ${p.outputStyle === 'polished' ? '마이크로 애니메이션 + 전환 효과' : '성능 최적화'}
5. 접근성 (키보드 네비게이션, aria 속성)

각 항목을 구현할 때:
- 왜 이것이 중요한지 한 문장 설명 (동기 부여)
- 구현 코드
- "잘했다" 포인트 — 내가 뭘 배웠는지 확인 (유능감 강화)`,
        }),
        estimatedMinutes: isBegin ? 150 : 120,
        difficulty: 'medium',
      },
      {
        phase: 'Phase 5: 묘수 (妙手)',
        title: 'AI 최적화 + 차별화 기능',
        description: `파인만 기법 + 인출학습 적용 — 지금까지 만든 것을 "12살 아이에게 설명하듯" 정리하고, 전체 아키텍처를 한 눈에 이해할 수 있게 정교화합니다. 이 단계에서 프로젝트의 결정적 차별화 요소를 추가합니다.`,
        tasks: [
          '전체 아키텍처 리뷰 + 리팩토링',
          '차별화 기능 추가 (AI 연동/실시간/고급 UX)',
          '성능 최적화',
          '코드 품질 점검 (파인만 기법으로 자기 설명)',
          '인출학습 — 빈 화면에서 핵심 로직 다시 작성',
        ],
        tools: [lang, lib, 'Claude AI', 'Lighthouse'],
        cogTheory: '파인만 기법 + 인출학습 — 설명할 수 없으면 이해하지 못한 것',
        vibePrompt: buildVibePrompt('묘수', {
          goal, lang, lib, cogStyle, isBegin,
          instruction: `이 프로젝트에 결정적인 묘수를 놓자.

## 파인만 기법 — 전체 정리
먼저 이 프로젝트를 프로그래밍을 모르는 사람에게 설명하듯 요약해줘:
1. 이 앱은 ___를 하는 앱이다
2. 핵심 데이터는 ___이다
3. 사용자는 ___를 하면 ___가 일어난다

## 묘수 — 차별화 기능
${goal}을 다른 비슷한 앱과 차별화할 수 있는 기능 3가지를 제안해줘.
각 기능에 대해:
- 왜 이것이 "묘수"인지 (비직관적이지만 임팩트가 큰 이유)
- 구현 난이도 (쉬움/보통/어려움)
- 구현 코드

가장 효과적인 것 1개를 추천하고 구현해줘.

## 인출학습 체크
구현 후, 이 기능의 핵심 로직을 주석 없이 빈 파일에 다시 작성할 수 있는지 테스트해줘.`,
        }),
        estimatedMinutes: isAdv ? 90 : 120,
        difficulty: isBegin ? 'hard' : 'medium',
      },
      {
        phase: 'Phase 6: 끝내기 (終局)',
        title: '테스트 + 배포 + 문서화',
        description: `간격효과 + 인출학습 최종 적용 — 전체 프로젝트를 복기하며 핵심 학습 포인트를 정리합니다. 배포 후 1일/3일/7일 복습 스케줄을 설정합니다.`,
        tasks: [
          '핵심 기능 테스트 작성',
          `배포 (${profile.deployTarget || 'Vercel'})`,
          'README.md 작성 (파인만 기법)',
          'SEO + 메타태그 설정',
          '복습 스케줄 설정 (1일/3일/7일)',
        ],
        tools: ['Vitest/pytest', profile.deployTarget || 'Vercel', 'GitHub'],
        cogTheory: '간격효과 + 인출학습 — 완성 후 분산 복습으로 장기 기억화',
        vibePrompt: buildVibePrompt('끝내기', {
          goal, lang, lib, cogStyle, isBegin,
          instruction: `프로젝트를 마무리하고 배포해줘.

## 테스트 (인출학습)
핵심 기능 ${isBegin ? '3' : '5'}개에 대한 테스트를 작성해줘.
테스트 작성 자체가 "내가 이 코드를 이해했는지" 확인하는 인출학습이야.

## 배포
${profile.deployTarget || 'Vercel'}에 배포하는 단계별 가이드를 줘.

## README (파인만 기법)
README를 작성해줘. 핵심 원칙:
- 프로그래밍을 모르는 사람도 이해할 수 있게
- 스크린샷/GIF 포함 위치 표시
- 설치 → 실행 → 배포 3단계로 정리

## 간격학습 복습 스케줄
| 시점 | 복습 내용 |
|------|----------|
| 1일 후 | 핵심 데이터 모델을 빈 파일에서 다시 작성 |
| 3일 후 | 메인 기능 로직을 기억만으로 구현 |
| 7일 후 | 전체 프로젝트 구조를 백지에서 설계 |
| 14일 후 | 새로운 기능을 추가해보기 |`,
        }),
        estimatedMinutes: 90,
        difficulty: 'easy',
      },
    ];

    return {
      appName,
      summary: `${lang} × ${lib} — ${goal}`,
      techStack: [lang, lib, ...profile.preferredAI, profile.deployTarget || 'Vercel'].filter(Boolean),
      steps: phases,
      totalEstimatedHours: Math.round(phases.reduce((s, p) => s + p.estimatedMinutes, 0) / 60),
      successCriteria: [
        '모든 핵심 기능이 정상 작동',
        '반응형 디자인 (모바일/데스크탑)',
        '에러 핸들링 + 로딩 상태 처리 완료',
        '테스트 커버리지 확보',
        'README.md 작성 (파인만 기법)',
        '간격학습 복습 스케줄 실행',
      ],
      appliedTheories: THEORIES.map(t => t.name),
      devProfile,
    };
  }, [fullProfile, filledCount, lang, lib]);

  // Auto-regenerate spec when profile changes
  useEffect(() => {
    const s = generateSpec();
    setSpec(s);
  }, [generateSpec]);

  const handleGoToRoadmap = () => {
    if (!spec) return;
    navigate('/roadmap', { state: { spec, language, library } });
  };

  const copyPrompt = (idx: number, prompt: string) => {
    navigator.clipboard.writeText(prompt);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  // ── Export .kifu.md (CodeSpeak-style spec file) ────────────────
  const exportKifuMd = () => {
    if (!spec) return;
    const date = new Date().toISOString().slice(0, 10);
    let md = `# ${spec.appName}\n`;
    md += `# 碁Vibe Spec — .kifu.md format (CodeSpeak-inspired)\n`;
    md += `# Generated: ${date}\n\n`;
    md += `## Project\n`;
    md += `- **Stack:** ${spec.techStack.join(', ')}\n`;
    md += `- **Profile:** ${spec.devProfile}\n`;
    md += `- **Estimated:** ~${spec.totalEstimatedHours}h\n`;
    md += `- **Applied Theories:** ${spec.appliedTheories.join(', ')}\n\n`;
    md += `## Spec\n\n`;
    md += `${spec.summary}\n\n`;

    spec.steps.forEach((step, i) => {
      md += `---\n\n`;
      md += `### ${step.phase}\n`;
      md += `**${step.title}** (~${step.estimatedMinutes}min, ${step.difficulty})\n\n`;
      md += `> 🧠 ${step.cogTheory}\n\n`;
      md += `${step.description}\n\n`;
      md += `**Tasks:**\n`;
      step.tasks.forEach(t => { md += `- [ ] ${t}\n`; });
      md += `\n**Tools:** ${step.tools.join(', ')}\n\n`;
      md += `**Vibe Prompt:**\n\`\`\`\n${step.vibePrompt}\n\`\`\`\n\n`;
    });

    md += `---\n\n## Success Criteria\n\n`;
    spec.successCriteria.forEach(c => { md += `- [ ] ${c}\n`; });

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(spec.appName || 'project').replace(/[^a-z0-9가-힣]/gi, '-').slice(0, 30)}.kifu.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Select helper ─────────────────────────────────────────────
  const cls = (cond: boolean) =>
    cond
      ? (isDark ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400' : 'bg-cyan-50 border-cyan-500 text-cyan-700')
      : (isDark ? 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50');

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-[#0d1117] text-white' : 'bg-slate-50 text-slate-800'}`}
         style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* Header */}
      <header className={`sticky top-0 z-40 border-b backdrop-blur-md ${isDark ? 'border-white/10 bg-[#0d1117]/90' : 'border-slate-200 bg-white/90'}`}>
        <div className="mx-auto max-w-[1200px] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-black tracking-tighter cursor-pointer" onClick={() => navigate('/')}>
              <span className="text-cyan-600 dark:text-cyan-400">碁</span>Vibe
            </h1>
            <span className={`text-xs ${isDark ? 'text-white/40' : 'text-slate-400'}`}>Spec 생성기</span>
            <ThemeToggle />
            {language && library && (
              <span className={`text-xs font-mono px-2 py-0.5 rounded ${isDark ? 'bg-white/10 text-white/50' : 'bg-slate-100 text-slate-500'}`}>
                {language.icon} {lang} × {library.icon} {lib}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowAiPanel(!showAiPanel)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                aiSettings.apiKey
                  ? (isDark ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100')
                  : (isDark ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30' : 'bg-amber-50 text-amber-600 hover:bg-amber-100')
              }`}>
              {aiSettings.apiKey ? '🟢 AI 연결됨' : '⚙️ AI 설정'}
            </button>
            <button onClick={() => navigate('/matrix')} className={`px-3 py-1.5 rounded-lg text-xs ${isDark ? 'bg-white/10 text-white/60 hover:bg-white/20' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
              ← 매트릭스
            </button>
            {spec && (
              <button onClick={exportKifuMd}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${isDark ? 'bg-violet-500/20 text-violet-400 hover:bg-violet-500/30' : 'bg-violet-50 text-violet-600 hover:bg-violet-100'}`}>
                📄 .kifu.md 저장
              </button>
            )}
            {spec && aiSettings.apiKey && (
              <button onClick={handleGenerateProject}
                disabled={codeGen?.status === 'generating'}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                  codeGen?.status === 'generating'
                    ? 'bg-amber-500/20 text-amber-400 animate-pulse'
                    : 'bg-emerald-500 text-white hover:bg-emerald-400'
                }`}>
                {codeGen?.status === 'generating'
                  ? `⚡ 생성 중 ${codeGenStep}/${spec.steps.length}...`
                  : codeGen?.status === 'done'
                  ? `✓ ${codeGen.files.length}개 파일 생성됨`
                  : '⚡ 프로젝트 코드 생성'}
              </button>
            )}
            {spec && (
              <button onClick={handleGoToRoadmap}
                className="px-4 py-1.5 rounded-lg text-sm font-semibold bg-cyan-500 text-white hover:bg-cyan-400">
                로드맵 →
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── AI Settings Panel (collapsible) ── */}
      {showAiPanel && (
        <div className={`border-b ${isDark ? 'bg-[#161b22] border-white/10' : 'bg-white border-slate-200'}`}>
          <div className="mx-auto max-w-[1200px] px-6 py-4">
            <div className="flex items-start gap-6 flex-wrap">
              {/* Provider — 7개 프로바이더 */}
              <div>
                <label className={`text-[10px] font-bold block mb-1 ${isDark ? 'text-white/40' : 'text-slate-500'}`}>Provider</label>
                <div className="flex gap-1 flex-wrap">
                  {(Object.keys(PROVIDER_INFO) as Provider[]).map(p => {
                    const info = PROVIDER_INFO[p];
                    return (
                      <button key={p} onClick={() => updateAiSettings({ provider: p })}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] border transition-all ${
                          aiSettings.provider === p
                            ? (isDark ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400' : 'bg-cyan-50 border-cyan-500 text-cyan-700')
                            : (isDark ? 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100')
                        }`}>
                        {info.icon} {info.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Model */}
              <div>
                <label className={`text-[10px] font-bold block mb-1 ${isDark ? 'text-white/40' : 'text-slate-500'}`}>Model</label>
                <select value={aiSettings.modelId}
                  onChange={e => updateAiSettings({ modelId: e.target.value })}
                  className={`px-3 py-1.5 rounded-lg text-xs border ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'}`}>
                  {AI_MODELS.filter(m => m.provider === aiSettings.provider).map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({m.inputPrice}/{m.outputPrice})</option>
                  ))}
                </select>
              </div>

              {/* API Key / Ollama URL */}
              <div className="flex-1 min-w-[250px]">
                <label className={`text-[10px] font-bold block mb-1 ${isDark ? 'text-white/40' : 'text-slate-500'}`}>
                  {aiSettings.provider === 'ollama' ? 'Ollama URL' : 'API Key'}
                  <span className={`ml-1 ${isDark ? 'text-white/20' : 'text-slate-300'}`}>
                    {aiSettings.provider === 'ollama' ? '(로컬 서버)' : `(${PROVIDER_INFO[aiSettings.provider].urlHint})`}
                  </span>
                </label>
                <div className="flex gap-2">
                  {aiSettings.provider === 'ollama' ? (
                    <input type="text" value={aiSettings.ollamaUrl || 'http://localhost:11434'}
                      onChange={e => updateAiSettings({ ollamaUrl: e.target.value })}
                      placeholder="http://localhost:11434"
                      className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-mono border focus:outline-none focus:ring-2 focus:ring-cyan-500/30 ${
                        isDark ? 'bg-white/5 border-white/10 text-white placeholder:text-white/20' : 'bg-slate-50 border-slate-200 placeholder:text-slate-400'
                      }`}
                    />
                  ) : (
                    <input type="password" value={aiSettings.apiKey}
                      onChange={e => updateAiSettings({ apiKey: e.target.value })}
                      placeholder={PROVIDER_INFO[aiSettings.provider].keyPrefix + '...'}
                      className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-mono border focus:outline-none focus:ring-2 focus:ring-cyan-500/30 ${
                        isDark ? 'bg-white/5 border-white/10 text-white placeholder:text-white/20' : 'bg-slate-50 border-slate-200 placeholder:text-slate-400'
                      }`}
                    />
                  )}
                  <button onClick={handleTestKey} disabled={aiTesting || (aiSettings.provider !== 'ollama' && !aiSettings.apiKey)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all disabled:opacity-40 ${
                      isDark ? 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30' : 'bg-cyan-50 text-cyan-600 hover:bg-cyan-100'
                    }`}>
                    {aiTesting ? '테스트 중...' : '🔑 테스트'}
                  </button>
                </div>
              </div>
            </div>

            {/* Test result */}
            {aiTestResult && (
              <div className={`mt-3 px-3 py-2 rounded-lg text-xs ${
                aiTestResult.ok
                  ? (isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600')
                  : (isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600')
              }`}>
                {aiTestResult.message}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main: 2-column layout like good-prompt-generator */}
      <div className="mx-auto max-w-[1200px] px-6 py-6 grid lg:grid-cols-[420px_1fr] gap-6">

        {/* ── LEFT: Profile Questions ── */}
        <div className="space-y-5 lg:max-h-[calc(100vh-80px)] lg:overflow-y-auto lg:pr-3">

          {/* Progress */}
          <div className={`p-4 rounded-xl border ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold">프로필 완성도</span>
              <span className="text-xs font-mono text-cyan-500">{filledCount}/5</span>
            </div>
            <div className={`h-2 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-100'}`}>
              <div className="h-full bg-cyan-500 transition-all duration-500 rounded-full" style={{ width: `${progressPercent}%` }} />
            </div>
            {/* Development stage badges — mapped from cognitive science */}
            <div className="mt-3 space-y-1.5">
              {THEORIES.map(t => {
                const level = profile.experience || 'intermediate';
                const action = level === 'beginner' ? t.beginner
                  : level === 'advanced' ? t.advanced : t.intermediate;
                return (
                  <div key={t.id} className={`flex items-start gap-2 p-2 rounded-lg text-[10px] leading-relaxed transition-all
                    ${isDark ? 'bg-white/[0.03] hover:bg-white/[0.06]' : 'bg-slate-50 hover:bg-slate-100'}`}
                    title={`${t.devDesc}\n\n세계 최고 수준: ${t.worldClass}`}>
                    <span className="text-sm shrink-0 mt-0.5">{t.icon}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold">{t.name}</span>
                        <span className={`px-1 py-0.5 rounded text-[8px] ${isDark ? 'bg-cyan-500/15 text-cyan-400' : 'bg-cyan-50 text-cyan-600'}`}>
                          {t.badukPhase}
                        </span>
                        <span className={isDark ? 'text-white/20' : 'text-slate-300'}>→</span>
                        <span className={isDark ? 'text-white/40' : 'text-slate-500'}>{t.devStage}</span>
                      </div>
                      <div className={`mt-0.5 ${isDark ? 'text-white/30' : 'text-slate-400'}`}>
                        {action}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ═══ 5개 핵심 질문 ═══ */}
          <div className={`p-3 rounded-lg text-xs text-center ${isDark ? 'bg-cyan-500/10 text-cyan-400' : 'bg-cyan-50 text-cyan-700'}`}>
            5개 질문만 답하면 AI가 나머지를 자동 추론합니다
          </div>

          {/* Q1: 뭘 만들 건가 */}
          <QuestionGroup num={1} title="어떤 앱을 만들고 싶나요?" icon="🎯" isDark={isDark}>
            <textarea value={profile.appGoal} onChange={e => set('appGoal', e.target.value)}
              placeholder={`예: "${lib}로 실시간 주식 대시보드 만들기. 차트, 관심 종목, 가격 알림."\n\n구체적으로 쓸수록 좋은 Spec이 나옵니다.`}
              className={`w-full h-28 px-3 py-2 rounded-lg text-sm resize-none border focus:outline-none focus:ring-2 focus:ring-cyan-500/30 ${isDark ? 'bg-white/5 border-white/10 text-white placeholder:text-white/20' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400'}`}
            />
          </QuestionGroup>

          {/* Q2: 개발 경험 */}
          <QuestionGroup num={2} title="개발 경험은?" icon="📊" isDark={isDark}>
            <div className="flex gap-2">
              {[['beginner', '🌱 입문'], ['intermediate', '🌿 중급'], ['advanced', '🌳 고급']].map(([val, label]) => (
                <button key={val} onClick={() => set('experience', val)}
                  className={`flex-1 px-3 py-2.5 rounded-lg text-xs border transition-all ${cls(profile.experience === val)}`}>
                  {label}
                </button>
              ))}
            </div>
          </QuestionGroup>

          {/* Q3: 하루 시간 */}
          <QuestionGroup num={3} title="하루에 얼마나 쓸 수 있나요?" icon="⏰" isDark={isDark}>
            <div className="flex gap-2">
              {['30분', '1시간', '2시간', '3시간+'].map(v => (
                <button key={v} onClick={() => set('timePerDay', v)}
                  className={`flex-1 px-3 py-2.5 rounded-lg text-xs border transition-all ${cls(profile.timePerDay === v)}`}>
                  {v}
                </button>
              ))}
            </div>
          </QuestionGroup>

          {/* Q4: 품질 목표 */}
          <QuestionGroup num={4} title="어떤 수준으로 만들 건가요?" icon="✨" isDark={isDark}>
            <div className="flex gap-2">
              {[['mvp', '🚀 MVP — 빠르게 검증'], ['polished', '💎 정교하게 — 포트폴리오급'], ['production', '🏢 프로덕션 — 실서비스']].map(([val, label]) => (
                <button key={val} onClick={() => set('outputStyle', val)}
                  className={`flex-1 px-3 py-2.5 rounded-lg text-xs border transition-all text-left ${cls(profile.outputStyle === val)}`}>
                  {label}
                </button>
              ))}
            </div>
          </QuestionGroup>

          {/* Q5: AI 도구 */}
          <QuestionGroup num={5} title="어떤 AI와 함께 코딩할 건가요?" icon="🤖" isDark={isDark} multi>
            <div className="flex flex-wrap gap-2">
              {['Claude', 'ChatGPT', 'Cursor', 'Copilot', 'v0.dev', 'Bolt.new', 'Gemini', 'DeepSeek'].map(v => (
                <button key={v} onClick={() => toggleArray('preferredAI', v)}
                  className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${cls(profile.preferredAI.includes(v))}`}>
                  {v}
                </button>
              ))}
            </div>
          </QuestionGroup>

          {/* ═══ 자동 추론 결과 (접기/펼치기) ═══ */}
          {filledCount >= 2 && (
            <details className={`rounded-xl border overflow-hidden ${isDark ? 'bg-white/[0.02] border-white/10' : 'bg-white border-slate-200'}`}>
              <summary className={`px-4 py-3 cursor-pointer text-xs font-bold flex items-center gap-2 ${isDark ? 'text-white/50 hover:text-white/70' : 'text-slate-500 hover:text-slate-700'}`}>
                <span>🧠 AI 자동 추론 결과</span>
                <span className={`text-[10px] font-normal ${isDark ? 'text-white/30' : 'text-slate-400'}`}>(5개 답변에서 7개 항목 추론)</span>
              </summary>
              <div className={`px-4 pb-4 space-y-2 text-xs ${isDark ? 'text-white/40' : 'text-slate-500'}`}>
                <div className="flex justify-between"><span>개발 스타일</span><span className="font-mono">{fullProfile.devStyle.join(', ') || '—'}</span></div>
                <div className="flex justify-between"><span>인지 스타일</span><span className="font-mono">{fullProfile.cognitiveStyle || '—'}</span></div>
                <div className="flex justify-between"><span>동기</span><span className="font-mono">{fullProfile.motivation.join(', ') || '—'}</span></div>
                <div className="flex justify-between"><span>사전 지식</span><span className="font-mono">{fullProfile.priorKnowledge || '—'}</span></div>
                <div className="flex justify-between"><span>예상 어려움</span><span className="font-mono">{fullProfile.challenges || '—'}</span></div>
                <div className="flex justify-between"><span>배포 환경</span><span className="font-mono">{fullProfile.deployTarget || '—'}</span></div>
                <div className="flex justify-between"><span>팀 규모</span><span className="font-mono">{fullProfile.teamSize || '—'}</span></div>
              </div>
            </details>
          )}
        </div>

        {/* ── RIGHT: Live Spec ── */}
        <div className="lg:max-h-[calc(100vh-80px)] lg:overflow-y-auto">
          {spec ? (
            <div className="space-y-4">
              {/* Summary */}
              <div className={`p-5 rounded-xl border ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold">{spec.appName}</h3>
                  <button onClick={handleGoToRoadmap}
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-cyan-500 text-white hover:bg-cyan-400">
                    로드맵 →
                  </button>
                </div>
                <p className={`text-xs mb-2 ${isDark ? 'text-white/50' : 'text-slate-500'}`}>{spec.devProfile}</p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {spec.techStack.map(t => (
                    <span key={t} className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-[10px]">{t}</span>
                  ))}
                </div>
                <div className={`flex gap-4 text-xs ${isDark ? 'text-white/40' : 'text-slate-400'}`}>
                  <span>📋 {spec.steps.length}수</span>
                  <span>⏱️ ~{spec.totalEstimatedHours}시간</span>
                  <span>🧠 {spec.appliedTheories.length}개 인지과학 이론</span>
                </div>
              </div>

              {/* ── Beyond CodeSpeak: Intent + Dependencies + Ripple ── */}
              {(() => {
                const intent = extractIntent(profile.appGoal, lang, lib);
                const tasks = buildDependencyGraph(profile.appGoal, lang, lib, profile.experience || 'intermediate');
                const cp = criticalPath(tasks);
                const ripples = analyzeRipple(tasks);
                const checkpoints = generateCheckpoints(tasks, lang, lib);
                const adaptiveCtx = buildAdaptiveContext(profile.experience || 'intermediate');
                const layerColors: Record<string, string> = {
                  data: 'bg-blue-500', logic: 'bg-amber-500', ui: 'bg-emerald-500',
                  infra: 'bg-slate-500', test: 'bg-violet-500', deploy: 'bg-cyan-500',
                };

                return (
                  <>
                    {/* Intent Analysis — WHY */}
                    <div className={`p-4 rounded-xl border ${isDark ? 'bg-violet-500/5 border-violet-500/20' : 'bg-violet-50 border-violet-200'}`}>
                      <div className="text-xs font-bold text-violet-600 dark:text-violet-400 mb-2">
                        🎯 Intent 분석 <span className={`font-normal ${isDark ? 'text-white/30' : 'text-slate-400'}`}>(CodeSpeak에 없는 기능)</span>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-xs mb-3">
                        <div>
                          <div className={isDark ? 'text-white/30' : 'text-slate-400'}>WHO</div>
                          <div className="font-bold">{intent.who}</div>
                        </div>
                        <div>
                          <div className={isDark ? 'text-white/30' : 'text-slate-400'}>WHY</div>
                          <div className="font-bold">{intent.why}</div>
                        </div>
                        <div>
                          <div className={isDark ? 'text-white/30' : 'text-slate-400'}>WHAT</div>
                          <div className="font-bold truncate">{intent.what}</div>
                        </div>
                      </div>
                      {intent.alternatives.length > 0 && (
                        <div className="mb-2">
                          <div className={`text-[10px] mb-1 ${isDark ? 'text-white/30' : 'text-slate-400'}`}>💡 대안적 접근법</div>
                          {intent.alternatives.map((a, i) => (
                            <div key={i} className={`text-[10px] py-0.5 ${isDark ? 'text-violet-300/60' : 'text-violet-600/70'}`}>→ {a}</div>
                          ))}
                        </div>
                      )}
                      {intent.risks.length > 0 && (
                        <div>
                          <div className={`text-[10px] mb-1 ${isDark ? 'text-white/30' : 'text-slate-400'}`}>⚠ 예상 리스크</div>
                          {intent.risks.map((r, i) => (
                            <div key={i} className="text-[10px] text-red-400/70 py-0.5">⚠ {r}</div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Dependency Graph + Critical Path */}
                    <div className={`p-4 rounded-xl border ${isDark ? 'bg-amber-500/5 border-amber-500/20' : 'bg-amber-50 border-amber-200'}`}>
                      <div className="text-xs font-bold text-amber-600 dark:text-amber-400 mb-2">
                        🔗 의존성 그래프 + 크리티컬 패스 <span className={`font-normal ${isDark ? 'text-white/30' : 'text-slate-400'}`}>({tasks.length}개 태스크, ~{Math.round(cp.totalMinutes / 60)}h)</span>
                      </div>
                      <div className="space-y-1">
                        {topologicalSort(tasks).map(task => {
                          const isCritical = cp.path.includes(task.id);
                          const ripple = ripples.find(r => r.taskId === task.id);
                          const checkpoint = checkpoints.find(c => c.taskId === task.id);
                          return (
                            <div key={task.id} className={`flex items-center gap-2 text-[10px] py-1 px-2 rounded ${
                              isCritical ? (isDark ? 'bg-red-500/10' : 'bg-red-50') : ''
                            }`}>
                              {/* Layer dot */}
                              <span className={`w-2 h-2 rounded-full shrink-0 ${layerColors[task.layer] || 'bg-slate-500'}`} />
                              {/* Phase */}
                              <span className={`w-10 shrink-0 ${isDark ? 'text-white/30' : 'text-slate-400'}`}>{task.phase.slice(0, 3)}</span>
                              {/* Title */}
                              <span className={`flex-1 ${isCritical ? 'font-bold text-red-500' : ''}`}>
                                {task.title}
                                {isCritical && <span className="text-red-400 ml-1">★CP</span>}
                              </span>
                              {/* Dependencies arrow */}
                              {task.dependsOn.length > 0 && (
                                <span className={isDark ? 'text-white/20' : 'text-slate-300'}>
                                  ←{task.dependsOn.length}
                                </span>
                              )}
                              {/* Ripple score */}
                              {ripple && ripple.rippleScore > 0.3 && (
                                <span className="text-amber-500" title={`파급 효과: ${ripple.affectedLayers.join(', ')}`}>
                                  {'●'.repeat(Math.ceil(ripple.rippleScore * 3))}
                                </span>
                              )}
                              {/* Checkpoint */}
                              {checkpoint && checkpoint.autoTestCommand && (
                                <span className="text-emerald-500" title={checkpoint.autoTestCommand}>✓</span>
                              )}
                              {/* Time */}
                              <span className={isDark ? 'text-white/20' : 'text-slate-300'}>{task.estimatedMinutes}m</span>
                            </div>
                          );
                        })}
                      </div>
                      {/* Legend */}
                      <div className="flex flex-wrap gap-2 mt-3 pt-2 border-t border-white/5">
                        {Object.entries(layerColors).map(([layer, color]) => (
                          <span key={layer} className={`flex items-center gap-1 text-[9px] ${isDark ? 'text-white/30' : 'text-slate-400'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${color}`} />
                            {layer}
                          </span>
                        ))}
                        <span className="text-[9px] text-red-400 font-bold ml-2">★CP = 크리티컬 패스</span>
                        <span className="text-[9px] text-amber-500 ml-1">● = 파급 효과</span>
                      </div>
                    </div>
                  </>
                );
              })()}

              {/* Steps with prompts */}
              {spec.steps.map((step, i) => (
                <div key={i} className={`p-4 rounded-xl border ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                      ${step.difficulty === 'easy' ? 'bg-green-500/20 text-green-500' :
                        step.difficulty === 'medium' ? 'bg-yellow-500/20 text-yellow-500' :
                        'bg-red-500/20 text-red-500'}`}>
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <div className={`text-[10px] ${isDark ? 'text-white/40' : 'text-slate-400'}`}>{step.phase}</div>
                      <div className="text-sm font-bold">{step.title}</div>
                    </div>
                    <span className={`text-[10px] ${isDark ? 'text-white/30' : 'text-slate-400'}`}>~{step.estimatedMinutes}분</span>
                  </div>

                  <p className={`text-xs mb-2 ${isDark ? 'text-white/40' : 'text-slate-500'}`}>{step.description}</p>

                  {/* Cognitive theory badge */}
                  <div className={`text-[10px] px-2 py-1 rounded mb-3 inline-block ${isDark ? 'bg-violet-500/10 text-violet-400' : 'bg-violet-50 text-violet-600'}`}>
                    🧠 {step.cogTheory}
                  </div>

                  {/* Vibe prompt — copyable */}
                  <div className="relative">
                    <div className={`p-3 rounded-lg border ${isDark ? 'bg-cyan-500/5 border-cyan-500/20' : 'bg-cyan-50 border-cyan-200'}`}>
                      <div className="text-[10px] text-cyan-600 dark:text-cyan-400 mb-1 font-bold">💬 바이브 코딩 프롬프트</div>
                      <pre className={`text-xs font-mono leading-relaxed whitespace-pre-wrap pr-10 ${isDark ? 'text-cyan-300/70' : 'text-cyan-800/70'}`}>
                        {step.vibePrompt}
                      </pre>
                    </div>
                    <button onClick={() => copyPrompt(i, aiPrompts[i] || step.vibePrompt)}
                      className={`absolute top-2 right-2 px-2 py-1 rounded text-[10px] ${isDark ? 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30' : 'bg-cyan-100 text-cyan-600 hover:bg-cyan-200'}`}>
                      {copiedIdx === i ? '✓ 복사됨' : '📋 복사'}
                    </button>
                  </div>

                  {/* AI-generated prompt (if available) */}
                  {aiPrompts[i] && (
                    <div className={`mt-2 p-3 rounded-lg border ${isDark ? 'bg-amber-500/5 border-amber-500/20' : 'bg-amber-50 border-amber-200'}`}>
                      <div className="text-[10px] text-amber-600 dark:text-amber-400 mb-1 font-bold">★ AI 묘수 프롬프트 ({AI_MODELS.find(m => m.id === aiSettings.modelId)?.name})</div>
                      <pre className={`text-xs font-mono leading-relaxed whitespace-pre-wrap ${isDark ? 'text-amber-300/70' : 'text-amber-800/70'}`}>
                        {aiPrompts[i]}
                      </pre>
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => copyPrompt(i, aiPrompts[i])}
                          className={`px-2 py-1 rounded text-[10px] ${isDark ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30' : 'bg-amber-100 text-amber-600 hover:bg-amber-200'}`}>
                          {copiedIdx === i ? '✓ 복사됨' : '📋 AI 프롬프트 복사'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* AI Generate button */}
                  <button
                    onClick={() => handleGenerateAI(i)}
                    disabled={!aiSettings.apiKey || aiGenerating !== null}
                    className={`mt-2 w-full py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-30 ${
                      aiGenerating === i
                        ? (isDark ? 'bg-amber-500/20 text-amber-400 animate-pulse' : 'bg-amber-50 text-amber-600 animate-pulse')
                        : (isDark ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20' : 'bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-200')
                    }`}>
                    {aiGenerating === i ? '★ AI 묘수 생성 중...' :
                     !aiSettings.apiKey ? '⚙️ AI 설정 필요 (상단 클릭)' :
                     aiPrompts[i] ? '★ AI 묘수 재생성' : '★ AI 묘수 프롬프트 생성'}
                  </button>
                </div>
              ))}

              {/* ═══ Generated Code Panel ═══ */}
              {showCodePanel && codeGen && (
                <div className={`p-5 rounded-xl border ${isDark ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      ⚡ 생성된 코드 ({codeGen.files.length}개 파일)
                    </div>
                    {codeGen.status === 'done' && codeGen.files.length > 0 && (
                      <div className="flex gap-2 flex-wrap">
                        <button onClick={handleRunInBrowser}
                          disabled={wcStatus === 'booting' || wcStatus === 'installing' || wcStatus === 'running'}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                            wcStatus === 'running' || wcPreviewUrl
                              ? 'bg-emerald-500 text-white'
                              : wcStatus === 'booting' || wcStatus === 'installing'
                              ? 'bg-amber-500/20 text-amber-400 animate-pulse'
                              : 'bg-violet-500 text-white hover:bg-violet-400'
                          }`}>
                          {wcPreviewUrl ? '✓ 실행 중' :
                           wcStatus === 'booting' ? '🔄 부팅...' :
                           wcStatus === 'installing' ? '📦 설치...' :
                           wcStatus === 'running' ? '🚀 시작...' :
                           '▶ 브라우저에서 실행'}
                        </button>
                        <button onClick={() => downloadAllFiles(codeGen.files, profile.appGoal.slice(0, 20) || 'project')}
                          className="px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-500 text-white hover:bg-emerald-400">
                          📄 다운로드
                        </button>
                        <button onClick={() => downloadAsZip(codeGen.files, profile.appGoal.slice(0, 20) || 'project')}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold ${isDark ? 'bg-white/10 text-white/70 hover:bg-white/20' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                          🖥️ .sh
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Progress */}
                  {codeGen.status === 'generating' && (
                    <div className="mb-3">
                      <div className={`h-2 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-emerald-100'}`}>
                        <div className="h-full bg-emerald-500 transition-all duration-500 rounded-full"
                          style={{ width: `${(codeGen.currentStep / codeGen.totalSteps) * 100}%` }} />
                      </div>
                      <div className={`text-[10px] mt-1 ${isDark ? 'text-white/30' : 'text-slate-400'}`}>
                        {spec.steps[codeGen.currentStep]?.phase} — {spec.steps[codeGen.currentStep]?.title}
                      </div>
                    </div>
                  )}

                  {/* File list */}
                  {codeGen.files.length > 0 && (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {codeGen.files.map((file, i) => (
                        <details key={i} className={`rounded-lg border overflow-hidden ${isDark ? 'bg-white/[0.02] border-white/10' : 'bg-white border-slate-200'}`}>
                          <summary className={`px-3 py-2 cursor-pointer text-xs flex items-center gap-2 ${isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}>
                            <span className={`w-2 h-2 rounded-full ${
                              file.language.match(/ts|js|tsx|jsx/) ? 'bg-blue-500' :
                              file.language === 'python' ? 'bg-yellow-500' :
                              file.language === 'css' ? 'bg-pink-500' :
                              file.language === 'json' ? 'bg-amber-500' :
                              'bg-slate-400'
                            }`} />
                            <span className="font-mono font-bold">{file.path}</span>
                            <span className={isDark ? 'text-white/20' : 'text-slate-300'}>
                              {file.content.split('\n').length}줄
                            </span>
                          </summary>
                          <pre className={`px-3 py-2 text-[11px] font-mono leading-relaxed overflow-x-auto ${isDark ? 'bg-[#0d1117] text-emerald-300/70' : 'bg-slate-50 text-slate-700'}`}>
                            {file.content}
                          </pre>
                        </details>
                      ))}
                    </div>
                  )}

                  {/* ── WebContainer Preview ── */}
                  {wcPreviewUrl && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          🌐 라이브 미리보기
                        </span>
                        <a href={wcPreviewUrl} target="_blank" rel="noopener noreferrer"
                          className="text-[10px] text-cyan-500 hover:underline">
                          새 탭에서 열기 ↗
                        </a>
                      </div>
                      <div className={`rounded-lg overflow-hidden border ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
                        <iframe
                          src={wcPreviewUrl}
                          className="w-full bg-white"
                          style={{ height: '400px' }}
                          title="Live Preview"
                        />
                      </div>
                    </div>
                  )}

                  {/* WebContainer Logs */}
                  {wcLogs.length > 0 && (
                    <details className="mt-3" open={!wcPreviewUrl}>
                      <summary className={`text-[10px] cursor-pointer ${isDark ? 'text-white/30' : 'text-slate-400'}`}>
                        {wcStatus === 'running' || wcPreviewUrl ? '✓' : '⏳'} 실행 로그 ({wcLogs.length})
                      </summary>
                      <div className={`mt-1 p-2 rounded text-[10px] font-mono leading-relaxed max-h-40 overflow-y-auto ${isDark ? 'bg-[#0d1117] text-emerald-300/60' : 'bg-slate-900 text-emerald-300/80'}`}>
                        {wcLogs.map((l, i) => <div key={i}>{l}</div>)}
                      </div>
                    </details>
                  )}

                  {/* Code Gen Log */}
                  {codeGen.log.length > 0 && (
                    <details className="mt-3">
                      <summary className={`text-[10px] cursor-pointer ${isDark ? 'text-white/30' : 'text-slate-400'}`}>
                        생성 로그 ({codeGen.log.length})
                      </summary>
                      <div className={`mt-1 p-2 rounded text-[10px] font-mono leading-relaxed ${isDark ? 'bg-white/5 text-white/40' : 'bg-slate-50 text-slate-500'}`}>
                        {codeGen.log.map((l, i) => <div key={i}>{l}</div>)}
                      </div>
                    </details>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="text-5xl mb-4">🧠</div>
                <p className={`text-sm ${isDark ? 'text-white/30' : 'text-slate-400'}`}>
                  왼쪽 5개 질문 중 2개만 답하면<br />AI가 나머지를 추론해서 Spec을 생성합니다
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Question Group wrapper ──────────────────────────────────────

function QuestionGroup({ num, title, icon, isDark, multi, children }: {
  num: number; title: string; icon: string; isDark: boolean; multi?: boolean; children: React.ReactNode;
}) {
  return (
    <div className={`p-4 rounded-xl border ${isDark ? 'bg-white/[0.02] border-white/10' : 'bg-white border-slate-200'}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${isDark ? 'bg-cyan-500/20 text-cyan-400' : 'bg-cyan-50 text-cyan-600'}`}>
          {num}
        </span>
        <span className="text-xs">{icon}</span>
        <span className="text-xs font-bold">{title}</span>
        {multi && <span className={`text-[9px] ${isDark ? 'text-white/30' : 'text-slate-400'}`}>(복수 선택)</span>}
      </div>
      {children}
    </div>
  );
}

// ── Vibe prompt builder (QCAES-Osmani + Cognitive Science) ──────

function buildVibePrompt(phase: string, ctx: {
  goal: string; lang: string; lib: string; cogStyle: string; isBegin: boolean; instruction: string;
}): string {
  // QCAES persona mapping per phase
  const qcaesMap: Record<string, { persona: string; lemma: string; osmani: string }> = {
    '포석': {
      persona: 'FP 전문가 (First Principles Vibe Extractor)',
      lemma: 'Lemma 1 — 기본 원칙의 재정의: Vibe를 핵심 가치/목표/UX로 해체',
      osmani: 'Be specific about your goal + Provide rich context',
    },
    '정석': {
      persona: '초공간 DB 엔지니어 (Hyper-Architecture Scaffolder)',
      lemma: 'Lemma 2 — 구조의 재구성: 기능→모듈→기술스택 체계적 분해',
      osmani: 'Provide rich context + Include examples of inputs/outputs',
    },
    '중반전': {
      persona: '양자 경로 적분 IT 개발자 (Iterative Refinement Partner)',
      lemma: 'Lemma 4 — 경로 다양성: 점진적 개발/반복 수정/피드백 루프',
      osmani: 'Break down complex tasks + Iterate and refine',
    },
    '선수': {
      persona: '다중 우주 EC 분석가 (Edge Case Explorer)',
      lemma: 'Lemma 7 — 경계의 초월: 예외 상황 사전 고려 + 대안 해결책',
      osmani: 'Ask for edge case handling + Leverage roles or personas',
    },
    '묘수': {
      persona: '양자 OT 엔지니어 (Prompt Optimization Specialist)',
      lemma: 'Lemma 8 — 최적화의 극대화: 최적 프롬프트 템플릿 변환',
      osmani: 'Provide examples + Leverage roles + Ask for explanations',
    },
    '끝내기': {
      persona: '양자 얽힘 CM 전문가 (Clarity Communicator)',
      lemma: 'Lemma 9 — 소통의 명료화: 진행 상황/오류/다음 단계 명확 전달',
      osmani: 'Ask focused follow-ups + Maintain code clarity and consistency',
    },
  };

  const q = qcaesMap[phase] || qcaesMap['포석'];

  return `# ${ctx.lang} × ${ctx.lib} — ${phase}
## 프로젝트: ${ctx.goal}

> **QCAES Persona:** ${q.persona}
> **${q.lemma}**
> **Osmani 원칙:** ${q.osmani}

### 시스템 역할
당신은 Vibe Coder 어시스턴트입니다. 사용자의 추상적 아이디어('Vibe')를 실행 가능한 코드로 전환합니다.
- John Carmack의 첫 원리 사고로 문제를 분해하세요
- ${ctx.isBegin ? '초보자에게 설명하듯 각 단계를 명확히 안내하세요' : '효율적으로 핵심만 전달하세요'}
- ${ctx.cogStyle === 'visual' ? '다이어그램/시각 자료를 먼저 제시하세요 (이중부호화 이론)' : ctx.cogStyle === 'hands-on' ? '즉시 실행 가능한 코드를 먼저 제시하세요' : '논리적 설명 후 코드를 제시하세요'}
- 안티패턴 주의: 모호한 프롬프트(Vague), 과적 프롬프트(Overloaded) 금지

---

${ctx.instruction}

---
### EchoPrompt 체크
위 내용을 구현하기 전에, "제가 이해한 바로는..." 형태로 요구사항을 요약하고 확인을 받으세요.
구현 후에는 "이 코드가 하는 일을 한 문장으로 설명하면..." 형태로 자기검증하세요.`;
}
