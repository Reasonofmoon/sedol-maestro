# 🏆 Sedol Maestro (세돌 마에스트로)
### 棋道(바둑의 길)와 祈禱(빌드의 간절함)를 융합한 AI-인간 협업 "한 수" 오케스트레이터

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![UiPath](https://img.shields.io/badge/UiPath-Maestro%20Case%20Track-orange.svg)](https://uipath.com)
[![Framework](https://img.shields.io/badge/Framework-React%20%7C%20Express%20%7C%20TypeScript-teal.svg)](#)

> **"이세돌 9단의 78수처럼, 전체 판세를 뒤흔들 '단 하나의 한 수'를 과학적으로 계산하여 에이전트를 자동 구출한다."**

**Sedol Maestro**는 엔터프라이즈 레벨의 AI 코딩 협업 플랫폼으로, 3가지 독자적 자산(`app-factory`, `baduck-coding`, `gido-board`)을 하나로 융합하고 **UiPath Maestro Case (Track 1)** 오케스트레이션으로 인간과 에이전트 간의 동적 예외(Exception-heavy Workload)를 조율합니다.

---

## 💡 Architecture & Synergy

```
                                  [ Perception ]
                                  (app-factory)
                                        │
                                        ▼  (board_state.json)
                                  [ Strategy ]
                                (baduck-coding UI)
                                        │
                                        ▼  (Decision Action)
                           [ Orchestration & Exception ]
                             (UiPath Maestro Case 1)
                                        │
                                        ▼  (Kifu & Post-Review)
                                  [ Governance ]
                                  (gido-board)
```

1. **Perception (`app-factory`)**: 코드베이스의 복잡도와 구조적 스펙을 바둑의 "형세 분석판"으로 변환합니다.
2. **Strategy (`baduck-coding` UI)**: 19x19 격자 UI 위에서 AI가 계산한 각 수(수정 프롬프트, 리팩토링 목표)의 승률 및 리스크를 확인하고 최적의 **'한 수'**를 선택합니다.
3. **Orchestration (`UiPath Maestro Case`)**: 코딩 에이전트가 돌발 빌드 에러(사활/Atari)를 만났을 때, UiPath가 프로세스를 안전하게 멈추고 Action Center를 통해 인간에게 묘수를 요구(Human-in-the-Loop)하여 파이프라인을 복원합니다.
4. **Governance (`gido-board`)**: 성공의 수순을 기보(SGF) 로그로 박제하고, 개발자들의 간절함이 담긴 **"빌드 성공 祈禱(기도)"** 게시판에 AI 에이전트가 격려와 기술적 오류 피드백을 다는 소셜 재미를 제공합니다.

---

## 📂 Repository Structure

이 리포지토리는 단일 **npm Workspace Monorepo** 구조로 깔끔하게 설계되었습니다.

```bash
sedol-maestro/
├── package.json          # 모노레포 루트 의존성 및 스크립트
├── uipath/               # UiPath Maestro Case 정의서 및 오케스트레이션 액티비티
├── frontend/             # app-factory + baduck-coding + gido-board 통합 React 애플리케이션
└── backend/              # Node/Express API 및 LLM 커넥터
```

---

## 🛠️ Quick Start (개발용)

### 1. 의존성 패키지 설치
```bash
npm install
```

### 2. 로컬 개발 서버 실행
```bash
# 프론트엔드 및 백엔드 동시 실행 (향후 스크립트 튜닝 예정)
npm run dev:frontend
npm run dev:backend
```

---

## 📄 License
이 프로젝트는 **MIT License**에 따라 자유롭게 배포 및 수정이 가능합니다.
궁금하신 점이 있거나 기여하고 싶으시다면 GitHub Issues를 열어주세요!

---
**Made with ❤️ for UiPath AgentHack 2026**
