// ============================================================
// Baduck Coding Workbench — Main App
// 바둑처럼 두면 세계 최고 수준의 앱이 만들어진다
// ============================================================

import { useState, useMemo } from 'react';
import { Board } from './components/Board/Board';
import { WinRateMeter } from './components/WinRate/WinRateMeter';
import { MoveCandidates } from './components/Candidates/MoveCandidates';
import { MoveTree } from './components/MoveTree/MoveTree';
import { KifuPanel } from './components/Kifu/KifuPanel';

// ── Demo data (payment system MVP sprint) ────────────────────

const DEMO_WIN_RATES = [45, 51, 58, 63, 65, 64, 73, 78, 82];

const DEMO_MOVES = [
  { moveNumber:1, intent:'초기 프로젝트 구조 설정',   type:'fuseki', badge:'●포석', winRateBefore:45, winRateAfter:51, deltaWinRate:6,  isMyo:false },
  { moveNumber:2, intent:'핵심 도메인 모델 정의',     type:'fuseki', badge:'●포석', winRateBefore:51, winRateAfter:58, deltaWinRate:7,  isMyo:false },
  { moveNumber:3, intent:'Repository 패턴 적용',     type:'joseki', badge:'○정석', winRateBefore:58, winRateAfter:63, deltaWinRate:5,  isMyo:false },
  { moveNumber:4, intent:'인증 모듈 TDD 시작',        type:'sente',  badge:'○선수', winRateBefore:63, winRateAfter:65, deltaWinRate:2,  isMyo:false },
  { moveNumber:5, intent:'긴급버그: 세션 만료 수정', type:'gote',   badge:'△후수', winRateBefore:65, winRateAfter:64, deltaWinRate:-1, isMyo:false },
  { moveNumber:6, intent:'AuthService 추출',          type:'sente',  badge:'★묘수', winRateBefore:64, winRateAfter:73, deltaWinRate:9,  isMyo:true  },
];

const DEMO_CANDIDATES = [
  { rank:1, actionId:'act:add-auth-tests',  intent:'Add Auth Tests',          type:'sente',  badge:'○선수' as const, probability:54, qValue:0.71, visits:18, deltaHealth:0.12, deltaWinRate:5, myoReasons:[] },
  { rank:2, actionId:'act:extract-user',    intent:'Extract UserService',      type:'sente',  badge:'○선수' as const, probability:31, qValue:0.65, visits:12, deltaHealth:0.09, deltaWinRate:4, myoReasons:[] },
  { rank:3, actionId:'act:strangler-fig',   intent:'Strangler Fig Controller', type:'joseki', badge:'○정석' as const, probability:18, qValue:0.41, visits:4,  deltaHealth:0.06, deltaWinRate:2, myoReasons:[] },
  { rank:4, actionId:'act:fix-memory-leak', intent:'Fix Memory Leak EventBus', type:'gote',   badge:'△후수' as const, probability:11, qValue:0.24, visits:2,  deltaHealth:0.03, deltaWinRate:1, myoReasons:[] },
];

const DEMO_TREE = {
  id: 'root', intent: '현재 상태', type: 'root', badge: '●', q: 0, prior: 1, visits: 48, depth: 0, isMyo: false,
  children: [
    {
      id: 'c1', intent: 'Add Auth Tests', type: 'sente', badge: '○선수', q: 0.71, prior: 0.54, visits: 18, depth: 1, isMyo: false,
      children: [
        { id: 'c1a', intent: 'Refactor Routes', type: 'sente', badge: '○선수', q: 0.68, prior: 0.6, visits: 9, depth: 2, isMyo: false, children: [] },
        { id: 'c1b', intent: 'Add API Docs',    type: 'joseki', badge: '○정석', q: 0.62, prior: 0.4, visits: 7, depth: 2, isMyo: false, children: [] },
      ],
    },
    {
      id: 'c2', intent: 'Extract UserService', type: 'sente', badge: '○선수', q: 0.65, prior: 0.31, visits: 12, depth: 1, isMyo: false,
      children: [
        { id: 'c2a', intent: '연쇄 선수 1', type: 'sente', badge: '○선수', q: 0.61, prior: 0.5, visits: 6, depth: 2, isMyo: false, children: [] },
        { id: 'c2b', intent: '연쇄 선수 2', type: 'sente', badge: '○선수', q: 0.58, prior: 0.45, visits: 5, depth: 2, isMyo: false, children: [] },
      ],
    },
    { id: 'c3', intent: 'Fix Memory Leak', type: 'gote', badge: '△후수', q: 0.24, prior: 0.11, visits: 2, depth: 1, isMyo: false, children: [] },
  ],
};

const DEMO_STONES = [
  { x: 3, y: 3, health: 0.6, inAtari: false, label: 'domain/index.ts' },
  { x: 3, y: 9, health: -0.4, inAtari: true, label: 'auth/auth.ts' },
  { x: 9, y: 3, health: 0.2, inAtari: false, label: 'api/routes.ts' },
  { x: 9, y: 9, health: 0.7, inAtari: false, label: 'services/payment.ts' },
  { x: 15, y: 3, health: -0.6, inAtari: true, label: 'controllers/user.ts' },
  { x: 15, y: 9, health: 0.5, inAtari: false, label: 'models/order.ts' },
  { x: 3, y: 15, health: 0.3, inAtari: false, label: 'utils/validator.ts' },
  { x: 9, y: 15, health: -0.3, inAtari: false, label: 'middleware/session.ts' },
  { x: 15, y: 15, health: 0.4, inAtari: false, label: 'config/env.ts' },
  // Ghost stones: next move suggestions
  { x: 4, y: 9, health: 0.8, inAtari: false, isGhost: true, label: '[제안] Add Auth Tests' },
  { x: 3, y: 10, health: 0.7, inAtari: false, isGhost: true, label: '[제안] Extract UserService' },
];

// ─────────────────────────────────────────────────────────────

export default function App() {
  const [currentMove, setCurrentMove] = useState(6);
  const [selectedCandidate, setSelectedCandidate] = useState<string | undefined>();

  const prevWinRate = DEMO_WIN_RATES[currentMove - 2] ?? 0;
  const currentWinRate = DEMO_WIN_RATES[currentMove - 1] ?? 73;
  const delta = currentWinRate - prevWinRate;
  const trend: 'rising' | 'stable' | 'falling' = delta > 2 ? 'rising' : delta < -2 ? 'falling' : 'stable';

  const demoComponents = {
    healthScore: 0.65, testCoverage: 0.30, complexityInv: 0.68, velocity: 0.70, debtRatioInv: 0.72,
  };

  return (
    <div className="min-h-screen bg-[#0d1117] text-white font-sans">
      {/* ── Header ── */}
      <header className="sticky top-0 z-40 border-b border-white/8 bg-[#0d1117]/90 backdrop-blur-md">
        <div className="mx-auto max-w-[1600px] px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-xl font-black tracking-tight">
              <span className="text-cyan-400">바둑</span>
              <span className="text-white/80">코딩</span>
            </div>
            <span className="text-xs text-white/20 font-mono">Workbench v1.0</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-white/30">
            <span>수{currentMove} / {DEMO_MOVES.length}</span>
            <span className="text-amber-300 font-semibold">★묘수 1개 발견</span>
            <span className="text-white/20">|</span>
            <span>Win-Rate <span className="text-green-400 font-bold">{currentWinRate}%</span></span>
          </div>
        </div>
      </header>

      {/* ── Main layout ── */}
      <div className="mx-auto max-w-[1600px] px-6 py-6 grid grid-cols-[1fr_320px] gap-6 h-[calc(100vh-60px)]">

        {/* ── Left: Board + Move Tree ── */}
        <div className="flex flex-col gap-4 min-h-0">
          {/* Board */}
          <div className="flex-1 min-h-0 max-h-[580px]">
            <Board stones={DEMO_STONES as any} />
          </div>
          {/* Move Tree */}
          <div className="shrink-0">
            <MoveTree root={DEMO_TREE as any} currentWinRate={currentWinRate} />
          </div>
        </div>

        {/* ── Right panel ── */}
        <div className="flex flex-col gap-4 overflow-y-auto">
          {/* Win-Rate Meter */}
          <WinRateMeter
            value={currentWinRate}
            prev={prevWinRate}
            components={demoComponents}
            trend={trend}
          />

          {/* Move Candidates */}
          <MoveCandidates
            candidates={DEMO_CANDIDATES}
            totalSims={48}
            elapsedMs={3200}
            onSelect={setSelectedCandidate}
            selectedId={selectedCandidate}
          />

          {/* Kifu Panel */}
          <KifuPanel
            moves={DEMO_MOVES}
            currentMove={currentMove}
            onSelectMove={setCurrentMove}
          />
        </div>
      </div>
    </div>
  );
}
