# baduck-coding (碁Vibe) - 재현 명세서

## 제품 개요

"바둑처럼 코드를 읽고, 묘수를 찾다" — 코드베이스를 바둑판 위의 돌로 시각화하고, MCTS(Monte Carlo Tree Search) 알고리즘 기반으로 코드 개선 후보수를 분석하는 AI 코딩 워크벤치. GitHub URL 또는 로컬 폴더의 코드를 분석하여 바둑 기보 형태로 코드 품질을 표현하며, Claude AI를 활용한 묘수(최적 리팩토링) 분석을 제공한다. SGF(Smart Game Format) 표준 기보 내보내기를 지원한다.

## 기술 스택

### 프론트엔드

| 구분 | 기술 | 버전 |
|------|------|------|
| 프레임워크 | React | ^19.0.0 |
| 언어 | TypeScript | ~5.6.2 |
| 빌드 | Vite | ^6.0.5 |
| 라우팅 | react-router-dom | ^7.5.0 |
| 스타일링 | Tailwind CSS | ^3.4.14 |
| WebContainer | @webcontainer/api | ^1.6.1 |
| 배포 (프론트) | Vercel | - |

### 백엔드

| 구분 | 기술 | 버전 |
|------|------|------|
| 런타임 | Node.js | >=18.0.0 |
| 프레임워크 | Express | ^4.19.2 |
| AI | @anthropic-ai/sdk (Claude) | ^0.55.0 |
| Git 조작 | simple-git | ^3.25.0 |
| 임시 파일 | tmp-promise | ^3.0.3 |
| CORS | cors | ^2.8.5 |
| 배포 (백엔드) | Railway (Nixpacks) | - |

### 기타 패키지 (packages/)

- `cli`, `encoder`, `kifu`, `mcts`, `probability`, `ukdl-bridge`

## 디렉터리 구조

```
baduck-coding/
├── package.json              # 프론트엔드 의존성 (go-vibe)
├── vite.config.ts            # Vite 설정
├── vercel.json               # Vercel 배포 설정 (COOP/COEP 헤더 포함)
├── railway.json              # Railway 백엔드 배포 설정
├── tailwind.config.js
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
├── index.html
├── src/
│   ├── App.tsx               # 메인 앱 (홈/스캔/씽킹/레디/플레잉 상태머신)
│   ├── main.tsx
│   ├── api/
│   │   └── client.ts         # API 클라이언트 (analyzeProject, pingBackend, readLocalFolder)
│   ├── components/
│   │   ├── Board/            # 바둑판 시각화 (19x19 격자)
│   │   ├── Candidates/       # 후보수 목록 (MoveCandidates)
│   │   ├── Glossary/         # 바둑 용어 사전
│   │   ├── Kifu/             # 기보 패널 (KifuPanel)
│   │   ├── MoveTree/         # MCTS 탐색 트리 시각화
│   │   ├── Tutorial/         # 튜토리얼
│   │   └── WinRate/          # 승률 미터 (WinRateMeter)
│   ├── data/
│   ├── lib/
│   └── pages/
│       ├── LandingPage.tsx
│       ├── MatrixPage.tsx
│       ├── RoadmapPage.tsx
│       └── SpecPage.tsx
├── backend/
│   ├── package.json          # 백엔드 의존성 (baduck-backend)
│   ├── tsconfig.json
│   └── src/
│       ├── server.ts         # Express 서버 진입점
│       ├── analyzer.ts       # 코드 분석 엔진
│       ├── candidates.ts     # 후보수 생성
│       ├── llm.ts            # Claude AI 연동
│       └── rate-limiter.ts   # API 레이트 리미터
├── packages/                 # 모노레포 내부 패키지
│   ├── cli/
│   ├── encoder/
│   ├── kifu/
│   ├── mcts/
│   ├── probability/
│   └── ukdl-bridge/
└── dist/                     # 빌드 출력
```

## 아키텍처 상세

### 상태 머신 (Phase)

```
home → scanning → thinking → ready ⇄ playing
```

- **home**: GitHub URL 입력 또는 로컬 폴더 선택
- **scanning**: 코드 분석 진행 (프로그레스 바)
- **thinking**: MCTS 탐색 시뮬레이션 (프로그레스 바)
- **ready**: 후보수 표시, 사용자가 선택 가능
- **playing**: 착점 확정, 기보에 기록

### 데이터 흐름

```
사용자 입력 (GitHub URL / 로컬 폴더)
  → 프론트엔드: POST /api/analyze (또는 File System Access API로 로컬 파일 읽기)
  → 백엔드: analyzer.ts (코드 분석) → candidates.ts (후보수 생성) → llm.ts (Claude AI 묘수 분석)
  → 응답: stones[], candidates[], mctsTree, analysis{winRate, avgHealth, ...}
  → 프론트엔드: Board에 돌 배치 → WinRate 표시 → 후보수 목록 렌더링
  → 사용자: 후보수 선택 → 착점 확정 → 기보(Kifu)에 기록
  → SGF 기보 파일 다운로드 가능
```

### 핵심 데이터 타입

- **Stone**: `{x, y, health, inAtari, label}` — 바둑판 위 코드 모듈
- **Candidate**: `{rank, actionId, intent, type, badge, probability, qValue, visits, deltaWinRate, ...}` — 후보 착점
  - badge: `★묘수 | ○선수 | ○정석 | △후수 | ✗실착`
- **MctsNode**: 재귀 트리 구조 `{id, intent, q, prior, visits, children[]}`
- **KifuMove**: `{moveNumber, intent, winRateBefore, winRateAfter, goCoord, sgfCoord}`

### API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/analyze` | 코드베이스 분석 (GitHub URL 또는 파일 배열) |
| GET | `/api/health` | 백엔드 헬스 체크 |

## 핵심 모듈/컴포넌트 설명

### 프론트엔드 컴포넌트

- **Board**: 19x19 바둑판 SVG 렌더링, 돌(Stone) + 고스트 돌(미리보기) 표시
- **WinRateMeter**: 승률 게이지 (healthScore, testCoverage, complexityInv 등 5요소)
- **MoveCandidates**: 후보수 목록 (확률, Q값, 방문 횟수 표시)
- **MoveTree**: MCTS 탐색 트리 시각화
- **KifuPanel**: 기보 목록 + 내비게이션 (수 이동 재현)

### 백엔드 모듈

- **analyzer.ts**: 코드 파일 파싱, 복잡도/건강도/PageRank 계산, 모듈을 바둑판 좌표에 매핑
- **candidates.ts**: 분석 결과 기반 리팩토링 후보수 생성 (MCTS 시뮬레이션)
- **llm.ts**: Anthropic Claude API 연동, 묘수(최적 개선점) 분석
- **rate-limiter.ts**: API 호출 빈도 제한

### 좌표 체계

- Go 좌표: A-T열 (I 제외) x 1-19행
- SGF 좌표: a-s x a-s (Smart Game Format 표준)

## 환경 변수

| 변수명 | 위치 | 설명 |
|--------|------|------|
| `VITE_API_URL` | 프론트엔드 | 백엔드 API URL (기본: `http://localhost:3001`) |
| `ANTHROPIC_API_KEY` | 백엔드 | Claude AI API 키 |

## 실행 방법

```bash
# 프론트엔드
cd baduck-coding
npm install
npm run dev          # Vite 개발 서버

# 백엔드
cd baduck-coding/backend
npm install
npm run dev          # ts-node-dev 개발 서버 (포트 3001)

# 프로덕션 빌드
npm run build        # Vite 빌드 (프론트엔드)
cd backend && npm run build && npm start  # 백엔드
```

## 배포

- **프론트엔드**: Vercel (`vercel.json` — COOP/COEP 헤더, SPA 리라이트)
- **백엔드**: Railway (`railway.json` — Nixpacks 빌더, 실패 시 자동 재시작)

## 재현 시 주의사항

- WebContainer API(`@webcontainer/api`)가 포함되어 있어 COOP/COEP 헤더 필수
- 로컬 폴더 읽기는 File System Access API 사용 (Chrome/Edge 전용)
- 파일 크기 제한: 최대 150파일, 파일당 150KB
- 지원 확장자: `.ts, .tsx, .js, .jsx, .py, .go, .java, .cs, .rb, .vue`
- 백엔드 없이도 프론트엔드는 동작하나, 분석 기능은 백엔드 필요
- `packages/` 내 모노레포 패키지들(cli, encoder, kifu, mcts, probability, ukdl-bridge)은 독립 모듈
