// ============================================================
// Recommendation Engine — 목표 + 경험 수준 → 언어/라이브러리 추천
// 바둑 메타포: 목표 = 포석 방향, 추천 = 최적 착점
// ============================================================

import { LANGUAGES, type Language, type Library } from '@/data/mandala';

export type Goal =
  | 'webapp'    // 웹 애플리케이션
  | 'mobile'    // 모바일 앱
  | 'ai'        // AI/ML 프로젝트
  | 'data'      // 데이터 분석
  | 'desktop'   // 데스크탑 앱
  | 'cli'       // CLI 도구
  | 'game'      // 게임
  | 'api';      // API/백엔드

export type Experience = 'beginner' | 'some' | 'intermediate' | 'advanced';

export interface GoalOption {
  id: Goal;
  label: string;
  icon: string;
  description: string;
  categories: Library['category'][];
}

export const GOALS: GoalOption[] = [
  { id: 'webapp',  label: '웹 애플리케이션',  icon: '🌐', description: '브라우저에서 동작하는 웹 서비스', categories: ['web', 'framework'] },
  { id: 'mobile',  label: '모바일 앱',       icon: '📱', description: 'iOS/Android 앱 개발', categories: ['mobile', 'framework'] },
  { id: 'ai',      label: 'AI/ML 프로젝트',  icon: '🤖', description: '머신러닝, LLM, 데이터 사이언스', categories: ['ai', 'data'] },
  { id: 'data',    label: '데이터 분석',      icon: '📊', description: '데이터 수집, 분석, 시각화', categories: ['data', 'db'] },
  { id: 'desktop', label: '데스크탑 앱',      icon: '🖥️', description: 'Windows/Mac/Linux 앱', categories: ['framework'] },
  { id: 'cli',     label: 'CLI 도구',        icon: '⌨️', description: '터미널 명령줄 도구', categories: ['util'] },
  { id: 'game',    label: '게임',            icon: '🎮', description: '게임 개발', categories: ['framework'] },
  { id: 'api',     label: 'API/백엔드',      icon: '🔌', description: 'REST API, 서버 개발', categories: ['web', 'db', 'devops'] },
];

export interface ExperienceOption {
  id: Experience;
  label: string;
  icon: string;
  maxDifficulty: Library['difficulty'];
}

export const EXPERIENCES: ExperienceOption[] = [
  { id: 'beginner',     label: '처음이에요',      icon: '🌱', maxDifficulty: 'beginner' },
  { id: 'some',         label: '조금 해봤어요',    icon: '📖', maxDifficulty: 'beginner' },
  { id: 'intermediate', label: '중급이에요',       icon: '⚡', maxDifficulty: 'intermediate' },
  { id: 'advanced',     label: '고급이에요',       icon: '🏆', maxDifficulty: 'advanced' },
];

// ── 목표별 언어 적합도 점수표 ──────────────────────────
const LANGUAGE_SCORES: Record<Goal, Record<string, number>> = {
  webapp:  { typescript: 10, python: 6, rust: 3, go: 5, java: 7, swift: 1 },
  mobile:  { typescript: 8, python: 1, rust: 2, go: 1, java: 7, swift: 10 },
  ai:      { typescript: 4, python: 10, rust: 3, go: 2, java: 5, swift: 3 },
  data:    { typescript: 3, python: 10, rust: 2, go: 2, java: 6, swift: 1 },
  desktop: { typescript: 5, python: 3, rust: 9, go: 2, java: 6, swift: 8 },
  cli:     { typescript: 5, python: 7, rust: 9, go: 10, java: 3, swift: 2 },
  game:    { typescript: 4, python: 3, rust: 9, go: 2, java: 5, swift: 4 },
  api:     { typescript: 8, python: 8, rust: 5, go: 10, java: 9, swift: 3 },
};

// ── 난이도 필터 ────────────────────────────────────────
const DIFFICULTY_ORDER: Library['difficulty'][] = ['beginner', 'intermediate', 'advanced'];

function isDifficultyAllowed(lib: Library['difficulty'], max: Library['difficulty']): boolean {
  return DIFFICULTY_ORDER.indexOf(lib) <= DIFFICULTY_ORDER.indexOf(max);
}

// ── 추천 결과 ──────────────────────────────────────────

export interface Recommendation {
  language: Language;
  score: number;
  libraries: (Library & { reason: string })[];
  kifuSequence: KifuStep[];
}

export interface KifuStep {
  moveNumber: number;
  badge: string;
  label: string;
  description: string;
  winRate: number;
}

export function recommend(goal: Goal, experience: Experience): Recommendation[] {
  const goalOption = GOALS.find(g => g.id === goal)!;
  const expOption = EXPERIENCES.find(e => e.id === experience)!;
  const scores = LANGUAGE_SCORES[goal];

  const results: Recommendation[] = LANGUAGES
    .map(lang => {
      const score = scores[lang.id] ?? 0;

      // 목표 카테고리에 맞는 라이브러리 필터링
      const matchedLibs = lang.libraries
        .filter(lib =>
          goalOption.categories.includes(lib.category) &&
          isDifficultyAllowed(lib.difficulty, expOption.maxDifficulty)
        )
        .map(lib => ({
          ...lib,
          reason: `${goalOption.label}에 적합한 ${lib.category} 도구`,
        }));

      // 테스팅 라이브러리도 항상 포함 (경험 수준에 맞는 것)
      const testLib = lang.libraries.find(
        lib => lib.category === 'testing' && isDifficultyAllowed(lib.difficulty, expOption.maxDifficulty)
      );
      if (testLib && !matchedLibs.some(l => l.name === testLib.name)) {
        matchedLibs.push({ ...testLib, reason: '품질 보장을 위한 테스트 도구' });
      }

      // 바둑 기보 스타일 개발 수순 생성
      const kifuSequence = generateKifu(lang, matchedLibs, goal);

      return { language: lang, score, libraries: matchedLibs, kifuSequence };
    })
    .filter(r => r.score >= 3 && r.libraries.length > 0)
    .sort((a, b) => b.score - a.score);

  return results.slice(0, 3); // Top 3 추천
}

function generateKifu(
  lang: Language,
  libs: (Library & { reason: string })[],
  goal: Goal
): KifuStep[] {
  const steps: KifuStep[] = [
    {
      moveNumber: 1,
      badge: '●포석',
      label: `${lang.name} 프로젝트 초기화`,
      description: `${lang.name} 개발 환경 세팅 + 프로젝트 구조 생성`,
      winRate: 15,
    },
  ];

  let wr = 15;
  const coreLib = libs.find(l => l.category === 'framework' || l.category === 'web');
  if (coreLib) {
    wr += 20;
    steps.push({
      moveNumber: 2,
      badge: '○정석',
      label: `${coreLib.name} 정석 적용`,
      description: coreLib.description,
      winRate: wr,
    });
  }

  const dbLib = libs.find(l => l.category === 'db');
  if (dbLib) {
    wr += 15;
    steps.push({
      moveNumber: steps.length + 1,
      badge: '○선수',
      label: `${dbLib.name} 데이터 레이어`,
      description: dbLib.description,
      winRate: wr,
    });
  }

  // 핵심 기능 구현
  wr += 20;
  steps.push({
    moveNumber: steps.length + 1,
    badge: '★묘수',
    label: '핵심 기능 구현',
    description: `${goal === 'ai' ? 'AI 모델 통합' : goal === 'mobile' ? 'UI/UX 구현' : '비즈니스 로직 구현'}`,
    winRate: wr,
  });

  const testLib = libs.find(l => l.category === 'testing');
  if (testLib) {
    wr += 12;
    steps.push({
      moveNumber: steps.length + 1,
      badge: '○선수',
      label: `${testLib.name} 테스트 작성`,
      description: '핵심 기능의 안전성 확보',
      winRate: wr,
    });
  }

  wr = Math.min(wr + 10, 95);
  steps.push({
    moveNumber: steps.length + 1,
    badge: '●끝내기',
    label: '배포 + 최적화',
    description: '프로덕션 배포 및 성능 최적화',
    winRate: wr,
  });

  return steps;
}
