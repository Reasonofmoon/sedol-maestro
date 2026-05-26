// ============================================================
// Vibe Coding Prompt Generator
// GoalWizard 추천 결과 → Claude Code 실행용 프롬프트 생성
// Harness Engineering: 에이전트가 기보 수순대로 코드를 생성
// ============================================================

import type { Recommendation, Goal } from './recommend';

export interface VibePrompt {
  moveNumber: number;
  badge: string;
  title: string;
  prompt: string;
}

export function generateVibePrompts(rec: Recommendation, goal: Goal): VibePrompt[] {
  const lang = rec.language;
  const libs = rec.libraries;

  const prompts: VibePrompt[] = [];

  // Move 1: 포석 — Project scaffolding
  const framework = libs.find(l => l.category === 'framework' || l.category === 'web');
  prompts.push({
    moveNumber: 1,
    badge: '●포석',
    title: `${lang.name} 프로젝트 초기화`,
    prompt: buildFusekiPrompt(lang.name, framework?.name, goal),
  });

  // Move 2: 정석 — Apply standard patterns
  if (framework) {
    prompts.push({
      moveNumber: 2,
      badge: '○정석',
      title: `${framework.name} 정석 적용`,
      prompt: buildJosekiPrompt(lang.name, framework.name, libs, goal),
    });
  }

  // Move 3: 선수 — Core logic
  prompts.push({
    moveNumber: prompts.length + 1,
    badge: '○선수',
    title: '핵심 기능 구현',
    prompt: buildSentePrompt(lang.name, libs, goal),
  });

  // Move 4: 묘수 — Optimization
  prompts.push({
    moveNumber: prompts.length + 1,
    badge: '★묘수',
    title: 'AI/최적화 적용',
    prompt: buildMyoPrompt(lang.name, libs, goal),
  });

  // Move 5: 끝내기 — Deploy
  prompts.push({
    moveNumber: prompts.length + 1,
    badge: '●끝내기',
    title: '배포 + 테스트',
    prompt: buildEndgamePrompt(lang.name, libs, goal),
  });

  return prompts;
}

function buildFusekiPrompt(lang: string, framework: string | undefined, goal: Goal): string {
  const goalLabel = {
    webapp: '웹 애플리케이션', mobile: '모바일 앱', ai: 'AI/ML 프로젝트',
    data: '데이터 분석 도구', desktop: '데스크탑 앱', cli: 'CLI 도구',
    game: '게임', api: 'API 서버',
  }[goal];

  return `${lang}로 ${goalLabel}을 만들려고 합니다.
${framework ? `${framework} 프레임워크를 사용하여` : ''} 프로젝트를 초기화해주세요.

요구사항:
- ${lang} 최신 버전 사용
- TypeScript strict 모드 (해당 시)
- 프로젝트 폴더 구조 생성
- 패키지 매니저 설정 (package.json / requirements.txt / Cargo.toml 등)
- .gitignore 설정
- 기본 린팅 설정`;
}

function buildJosekiPrompt(_lang: string, framework: string, libs: { name: string; category: string }[], goal: Goal): string {
  const dbLib = libs.find(l => l.category === 'db');
  const testLib = libs.find(l => l.category === 'testing');

  return `${framework} 정석 패턴을 적용해주세요.

구현할 것:
- ${framework} 기본 라우팅/페이지 구조
${dbLib ? `- ${dbLib.name}으로 데이터베이스 연동 (스키마 설계 포함)` : ''}
${testLib ? `- ${testLib.name} 테스트 환경 설정` : ''}
- 에러 핸들링 패턴
- 환경 변수 관리 (.env)

아키텍처: ${goal === 'api' ? 'Clean Architecture / 계층 분리' : 'Feature-based 디렉토리 구조'}`;
}

function buildSentePrompt(_lang: string, _libs: { name: string; category: string }[], goal: Goal): string {
  const goalFeatures = {
    webapp: '사용자 인증, CRUD 페이지, 검색 기능',
    mobile: '메인 화면, 네비게이션, 데이터 동기화',
    ai: 'AI 모델 통합, 프롬프트 엔지니어링, 스트리밍 응답',
    data: '데이터 수집, 전처리 파이프라인, 시각화 대시보드',
    desktop: '메인 윈도우, 시스템 트레이, 파일 관리',
    cli: '명령어 파싱, 출력 포매팅, 설정 관리',
    game: '게임 루프, 입력 처리, 렌더링 파이프라인',
    api: 'RESTful 엔드포인트, 인증/인가, 데이터 검증',
  }[goal];

  return `핵심 비즈니스 로직을 구현해주세요 (선수 확보).

구현할 핵심 기능:
${goalFeatures}

기술 요구사항:
- ${_lang} best practices 준수
- 에러 케이스 핸들링
- 타입 안전성 확보
- 각 기능에 대한 기본 테스트 작성`;
}

function buildMyoPrompt(_lang: string, libs: { name: string; category: string }[], _goal: Goal): string {
  const aiLib = libs.find(l => l.category === 'ai');

  return `묘수(최적화)를 적용해주세요.

최적화 대상:
${aiLib ? `- ${aiLib.name} 통합으로 AI 기능 추가` : '- 성능 최적화 (번들 사이즈, 로딩 속도)'}
- UX 개선 (로딩 상태, 에러 메시지, 접근성)
- 캐싱 전략 적용
- 보안 강화 (입력 검증, CSRF 방어)

품질 기준:
- Lighthouse 점수 90+ (웹인 경우)
- 메모리 누수 없음
- 접근성 (ARIA 라벨, 키보드 네비게이션)`;
}

function buildEndgamePrompt(_lang: string, _libs: { name: string; category: string }[], goal: Goal): string {
  return `끝내기 — 배포 준비를 완료해주세요.

체크리스트:
- [ ] 환경별 설정 분리 (dev/staging/prod)
- [ ] CI/CD 파이프라인 (GitHub Actions)
- [ ] 헬스체크 엔드포인트
- [ ] 에러 모니터링 설정
- [ ] README.md 작성
- [ ] 전체 테스트 통과 확인

배포 대상: ${goal === 'webapp' || goal === 'api' ? 'Vercel / Railway' : goal === 'mobile' ? 'App Store / Play Store' : '로컬 배포'}`;
}
