import { useState, useEffect, useRef, useCallback } from 'react';
import { Board } from './components/Board/Board';
import { WinRateMeter } from './components/WinRate/WinRateMeter';
import { MoveCandidates } from './components/Candidates/MoveCandidates';
import { MoveTree } from './components/MoveTree/MoveTree';
import { KifuPanel } from './components/Kifu/KifuPanel';
import { analyzeProject, readLocalFolder, pingBackend } from './api/client';
import type { AnalyzeResponse, Stone as ApiStone, Candidate as ApiCandidate, MctsNode } from './api/client';
import GoalWizard from './pages/GoalWizard';
import { PrayerBoard } from './components/Gido/PrayerBoard';

// ── Go coordinate system (A-T, skipping I) ────────────────────
const GO_COLS = 'ABCDEFGHJKLMNOPQRST'; // 19 chars, no I

function toGoCoord(x: number, y: number): string {
  const col = GO_COLS[Math.min(x, 18)] ?? '?';
  const row = 19 - Math.min(y, 18);
  return `${col}${row}`;
}

// ── SGF (Smart Game Format) export ─────────────────────────────
function toSgfCoord(x: number, y: number): string {
  const a = 'a'.charCodeAt(0);
  return String.fromCharCode(a + Math.min(x, 18)) + String.fromCharCode(a + Math.min(y, 18));
}

function exportSGF(moves: KifuMove[], projectName: string): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  let sgf = `(;FF[4]GM[1]SZ[19]AP[BaduckCoding:2.0]DT[${date}]\n`;
  sgf += `GN[${projectName}]PB[Developer]PW[TechDebt]\n`;
  sgf += `C[Baduck Coding Workbench — 코드베이스 기보]\n`;

  moves.forEach((m, i) => {
    const color = i % 2 === 0 ? 'B' : 'W';
    const coord = toSgfCoord(m.boardX ?? (i % 19), m.boardY ?? Math.floor(i / 19));
    sgf += `;${color}[${coord}]C[${m.intent} | WR:${m.winRateAfter}%]`;
    if ((i + 1) % 5 === 0) sgf += '\n';
  });

  sgf += ')';
  return sgf;
}

// ── Types ───────────────────────────────────────────────────────

type Phase = 'home' | 'scanning' | 'thinking' | 'ready' | 'playing';

interface Stone {
  x: number; y: number; health: number;
  inAtari: boolean; isMyo?: boolean; isGhost?: boolean; label?: string;
  goCoord?: string; // A1-T19
}

interface KifuMove {
  moveNumber: number; intent: string; type: string; badge: string;
  winRateBefore: number; winRateAfter: number; deltaWinRate: number; isMyo: boolean;
  boardX?: number; boardY?: number; goCoord?: string; sgfCoord?: string;
}

interface Candidate {
  rank: number; actionId: string; intent: string; type: string;
  badge: '★묘수' | '○선수' | '○정석' | '△후수' | '✗실착';
  probability: number; qValue: number; visits: number;
  deltaHealth: number; deltaWinRate: number; myoReasons: string[];
  targetFile?: string;
  newStone?: { x: number; y: number; health: number; inAtari: boolean; isMyo?: boolean; label?: string };
}

// ── App ─────────────────────────────────────────────────────────

export default function App() {
  const [activeTab, setActiveTab] = useState<'factory' | 'workbench' | 'gido'>('workbench');
  const [isDark, setIsDark] = useState(true);
  const [phase, setPhase] = useState<Phase>('home');
  const [progress, setProgress] = useState(0);
  const [winRate, setWinRate] = useState(0);
  const [stones, setStones] = useState<Stone[]>([]);
  const [ghostStones, setGhostStones] = useState<Stone[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [mctsTree, setMctsTree] = useState<MctsNode | null>(null);
  const [kifuMoves, setKifuMoves] = useState<KifuMove[]>([]);
  const [currentKifuMove, setCurrentKifuMove] = useState(0);
  const [selectedId, setSelectedId] = useState('');
  const [toast, setToast] = useState<{ msg: string; color: string } | null>(null);
  const [githubUrl, setGithubUrl] = useState('');
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [analysisInfo, setAnalysisInfo] = useState<AnalyzeResponse['analysis'] | null>(null);
  const [projectName, setProjectName] = useState('');
  const [usedLLM, setUsedLLM] = useState(false);
  const [error, setError] = useState('');
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Theme ──────────────────────────────────────────────────────
  useEffect(() => {
    if (isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDark]);

  // ── Backend health check on mount ──────────────────────────────
  useEffect(() => {
    pingBackend().then(setBackendOk);
  }, []);

  // ── Cleanup ────────────────────────────────────────────────────
  useEffect(() => () => { if (progressRef.current) clearInterval(progressRef.current); }, []);

  const prevWinRate = kifuMoves.length > 0 ? kifuMoves[kifuMoves.length - 1].winRateBefore : 0;
  const trend: 'rising' | 'stable' | 'falling' = winRate > prevWinRate + 2 ? 'rising' : winRate < prevWinRate - 2 ? 'falling' : 'stable';
  const selectedCandidate = candidates.find(c => c.actionId === selectedId);
  const allStones = [...stones, ...ghostStones];

  const showToast = useCallback((msg: string, color = '#22d3ee') => {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ── Convert API stones to board stones with Go coordinates ─────
  function apiStonesToBoard(apiStones: ApiStone[]): Stone[] {
    return apiStones.map(s => ({
      x: s.x, y: s.y,
      health: s.health,
      inAtari: s.inAtari,
      label: `${s.label} [${toGoCoord(s.x, s.y)}]`,
      goCoord: toGoCoord(s.x, s.y),
    }));
  }

  // ── Convert API candidates to app candidates ──────────────────
  function apiCandidatesToApp(apiCands: ApiCandidate[]): Candidate[] {
    return apiCands.map(c => ({
      rank: c.rank,
      actionId: c.actionId,
      intent: c.intent,
      type: c.type,
      badge: c.badge,
      probability: c.probability,
      qValue: c.qValue,
      visits: c.visits,
      deltaHealth: c.deltaHealth,
      deltaWinRate: c.deltaWinRate,
      myoReasons: c.myoReasons,
      targetFile: c.targetFile,
      newStone: c.boardX != null && c.boardY != null ? {
        x: c.boardX, y: c.boardY,
        health: Math.max(0.3, c.deltaHealth + 0.5),
        inAtari: false,
        isMyo: c.badge === '★묘수',
        label: `${c.targetFile?.split('/').pop() ?? c.intent} [${toGoCoord(c.boardX, c.boardY)}]`,
      } : undefined,
    }));
  }

  // ── ANALYZE: the main action ───────────────────────────────────
  const handleAnalyze = useCallback(async (input: { githubUrl?: string; files?: { path: string; content: string }[] }) => {
    setPhase('scanning');
    setProgress(0);
    setError('');
    setCandidates([]);
    setMctsTree(null);
    setGhostStones([]);
    setSelectedId('');

    // Extract project name
    if (input.githubUrl) {
      const name = input.githubUrl.replace(/\.git$/, '').split('/').pop() ?? 'project';
      setProjectName(name);
    } else {
      setProjectName('local-project');
    }

    // Animate scan progress
    let p = 0;
    progressRef.current = setInterval(() => {
      p += Math.random() * 4 + 1;
      if (p > 85) p = 85; // Cap at 85 until real response
      setProgress(Math.round(p));
    }, 200);

    try {
      const response = await analyzeProject(input);

      // Stop progress animation
      if (progressRef.current) clearInterval(progressRef.current);
      setProgress(100);

      // Apply real data
      const boardStones = apiStonesToBoard(response.stones);
      setStones(boardStones);
      setWinRate(response.analysis.winRate);
      setAnalysisInfo(response.analysis);
      setUsedLLM(!!(response as any).usedLLM);

      // Record initial kifu move
      const initMove: KifuMove = {
        moveNumber: 1,
        intent: '판 읽기 — 코드베이스 스캔 완료',
        type: 'fuseki',
        badge: '●포석',
        winRateBefore: 0,
        winRateAfter: response.analysis.winRate,
        deltaWinRate: response.analysis.winRate,
        isMyo: false,
      };
      setKifuMoves([initMove]);
      setCurrentKifuMove(1);

      // Transition to thinking phase
      setTimeout(() => {
        setPhase('thinking');
        setProgress(0);

        // Animate MCTS thinking
        let tp = 0;
        progressRef.current = setInterval(() => {
          tp += Math.random() * 10 + 5;
          if (tp >= 100) {
            tp = 100;
            if (progressRef.current) clearInterval(progressRef.current);
            setProgress(100);

            setTimeout(() => {
              // Apply candidates and tree
              const appCands = apiCandidatesToApp(response.candidates);
              setCandidates(appCands);
              setMctsTree(response.mctsTree);

              // Show ghost stones for top 2
              const ghosts = appCands.slice(0, 2)
                .filter(c => c.newStone)
                .map(c => ({ ...c.newStone!, isGhost: true }));
              setGhostStones(ghosts);

              setPhase('ready');

              const hasMyo = appCands.some(c => c.badge === '★묘수');
              if (hasMyo) showToast('★ 묘수 발견! — AI가 최적의 수를 찾았습니다', '#f59e0b');
              else showToast('수읽기 완료 — 후보수를 선택하세요', '#22d3ee');
            }, 400);
          }
          setProgress(Math.round(tp));
        }, 80);
      }, 600);

    } catch (err: any) {
      if (progressRef.current) clearInterval(progressRef.current);
      setError(err.message || '분석 실패');
      setPhase('home');
      showToast(`분석 실패: ${err.message}`, '#ef4444');
    }
  }, [showToast]);

  // ── GitHub URL submit ──────────────────────────────────────────
  const handleGithubSubmit = useCallback(() => {
    if (!githubUrl.trim()) return;
    handleAnalyze({ githubUrl: githubUrl.trim() });
  }, [githubUrl, handleAnalyze]);

  // ── Local folder select ────────────────────────────────────────
  const handleLocalFolder = useCallback(async () => {
    try {
      const files = await readLocalFolder();
      if (files.length === 0) {
        showToast('코드 파일을 찾을 수 없습니다', '#ef4444');
        return;
      }
      showToast(`${files.length}개 파일 로드 완료`, '#22d3ee');
      handleAnalyze({ files });
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        showToast(err.message || '폴더 읽기 실패', '#ef4444');
      }
    }
  }, [handleAnalyze, showToast]);

  // ── Candidate select ──────────────────────────────────────────
  const handleSelectCandidate = useCallback((actionId: string) => {
    if (phase !== 'ready') return;
    setSelectedId(prev => prev === actionId ? '' : actionId);
    const c = candidates.find(p => p.actionId === actionId);
    if (c?.newStone) setGhostStones([{ ...c.newStone, isGhost: true }]);
  }, [phase, candidates]);

  // ── PLAY MOVE ─────────────────────────────────────────────────
  const handlePlay = useCallback(() => {
    if (!selectedCandidate || phase !== 'ready') return;
    setPhase('playing');
    const c = selectedCandidate;
    const newWinRate = Math.min(100, Math.max(0, winRate + c.deltaWinRate));

    // Add stone to board
    if (c.newStone) {
      setStones(prev => {
        const filtered = prev.filter(s => !(s.x === c.newStone!.x && s.y === c.newStone!.y));
        return [...filtered, {
          ...c.newStone!,
          isGhost: false,
          goCoord: toGoCoord(c.newStone!.x, c.newStone!.y),
        }];
      });
    }

    // Record in kifu with Go/SGF coordinates
    const bx = c.newStone?.x ?? 9;
    const by = c.newStone?.y ?? 9;
    const newMove: KifuMove = {
      moveNumber: kifuMoves.length + 1,
      intent: c.intent,
      type: c.type,
      badge: c.badge,
      winRateBefore: winRate,
      winRateAfter: newWinRate,
      deltaWinRate: c.deltaWinRate,
      isMyo: c.badge === '★묘수',
      boardX: bx,
      boardY: by,
      goCoord: toGoCoord(bx, by),
      sgfCoord: toSgfCoord(bx, by),
    };

    setKifuMoves(prev => [...prev, newMove]);
    setCurrentKifuMove(newMove.moveNumber);
    setWinRate(newWinRate);
    setGhostStones([]);
    setSelectedId('');

    showToast(
      c.badge === '★묘수' ? `★ 묘수! ${toGoCoord(bx, by)} → Win-Rate +${c.deltaWinRate}%` :
      c.deltaWinRate > 0 ? `착점 ${toGoCoord(bx, by)} ▲ +${c.deltaWinRate}%` :
      `착점 ${toGoCoord(bx, by)} ▼ ${c.deltaWinRate}%`,
      c.badge === '★묘수' ? '#f59e0b' : c.deltaWinRate > 0 ? '#22c55e' : '#ef4444'
    );

    setTimeout(() => setPhase('ready'), 800);
  }, [selectedCandidate, phase, winRate, kifuMoves, showToast]);

  // ── SGF Download ───────────────────────────────────────────────
  const handleSGFExport = useCallback(() => {
    if (kifuMoves.length === 0) return;
    const sgf = exportSGF(kifuMoves, projectName);
    const blob = new Blob([sgf], { type: 'application/x-go-sgf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName || 'baduck'}-kifu.sgf`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('SGF 기보 파일 다운로드', '#22c55e');
  }, [kifuMoves, projectName, showToast]);

  // ── Kifu replay ────────────────────────────────────────────────
  const handleKifuNav = useCallback((n: number) => {
    setCurrentKifuMove(n);
    const move = kifuMoves[n - 1];
    if (move) setWinRate(move.winRateAfter);
  }, [kifuMoves]);

  // ═══════════════════════════════════════════════════════════════
  // RENDER: UNIFIED PORTAL
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-300 ${isDark ? 'dark bg-[#0d1117]' : 'bg-slate-50'}`} style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-full text-sm font-bold shadow-xl backdrop-blur-md border border-white/10 animate-pulse"
             style={{ backgroundColor: toast.color + '22', borderColor: toast.color + '55', color: toast.color }}>
          {toast.msg}
        </div>
      )}

      {/* ── Unified Header ── */}
      <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-white/10 bg-white/90 dark:bg-[#0d1117]/90 backdrop-blur-md">
        <div className="mx-auto max-w-[1600px] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-black tracking-tighter text-slate-800 dark:text-white cursor-pointer"
                onClick={() => { setActiveTab('workbench'); setPhase('home'); }}>
              <span className="text-cyan-600 dark:text-cyan-400">碁</span>Maestro
              <span className="text-xs text-slate-400 dark:text-white/40 ml-1">v2.0</span>
            </h1>

            {projectName && activeTab === 'workbench' && (
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-white/40">
                {projectName}
              </span>
            )}

            <div className="flex items-center gap-2">
              <button onClick={() => setIsDark(!isDark)}
                className="px-2.5 py-1.5 rounded-lg text-sm bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-white hover:bg-slate-200 dark:hover:bg-white/20 transition-colors border border-slate-200 dark:border-transparent"
                title="Toggle Theme">
                {isDark ? '☀️' : '🌙'}
              </button>
              {activeTab === 'workbench' && phase === 'ready' && (
                <>
                  <button onClick={handlePlay}
                    disabled={!selectedId}
                    className="px-4 py-1.5 rounded-lg text-sm font-semibold bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/40 hover:bg-emerald-100 dark:hover:bg-emerald-500/30 disabled:opacity-50 transition-colors">
                    착점 확정
                  </button>
                  <button onClick={handleSGFExport}
                    disabled={kifuMoves.length === 0}
                    className="px-4 py-1.5 rounded-lg text-sm font-semibold bg-violet-50 dark:bg-violet-500/20 text-violet-600 dark:text-violet-300 border border-violet-200 dark:border-violet-500/40 hover:bg-violet-100 dark:hover:bg-violet-500/30 disabled:opacity-50 transition-colors">
                    SGF 기보 저장
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ── 3-Tabs Navigation Pill ── */}
          <div className="flex items-center bg-slate-100 dark:bg-white/5 rounded-xl p-1 gap-1 border border-slate-200 dark:border-white/5">
            <button
              onClick={() => setActiveTab('factory')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'factory'
                  ? 'bg-cyan-500 text-white shadow-md'
                  : 'text-slate-500 dark:text-white/50 hover:bg-slate-200 dark:hover:bg-white/5'
              }`}
            >
              🧩 Spec Factory
            </button>
            <button
              onClick={() => setActiveTab('workbench')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'workbench'
                  ? 'bg-cyan-500 text-white shadow-md'
                  : 'text-slate-500 dark:text-white/50 hover:bg-slate-200 dark:hover:bg-white/5'
              }`}
            >
              碁 Workbench
            </button>
            <button
              onClick={() => setActiveTab('gido')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'gido'
                  ? 'bg-cyan-500 text-white shadow-md'
                  : 'text-slate-500 dark:text-white/50 hover:bg-slate-200 dark:hover:bg-white/5'
              }`}
            >
              🙏 Prayer Board
            </button>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono text-slate-500 dark:text-white/40">
            {activeTab === 'workbench' && phase === 'scanning' && <span className="text-cyan-600 dark:text-cyan-400">스캔 중 {progress}%</span>}
            {activeTab === 'workbench' && phase === 'thinking' && <span className="text-amber-600 dark:text-amber-400">MCTS 탐색 {progress}%</span>}
            {activeTab === 'workbench' && phase === 'ready' && <span className="text-emerald-600 dark:text-emerald-400">후보 착점 준비</span>}
            {activeTab === 'workbench' && phase === 'playing' && <span className="text-emerald-600 dark:text-emerald-400">착수 중...</span>}
            {activeTab === 'workbench' && (
              <>
                <span>|</span>
                <span>수{currentKifuMove}</span>
                <span>|</span>
                <span>Win-Rate <strong className="text-green-600 dark:text-green-400">{winRate}%</strong></span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Sub Progress bar for Workbench ── */}
      {activeTab === 'workbench' && (phase === 'scanning' || phase === 'thinking') && (
        <div className="w-full h-1 bg-slate-200 dark:bg-white/5">
          <div
            className="h-full transition-all duration-200"
            style={{
              width: `${progress}%`,
              backgroundColor: phase === 'scanning' ? '#22d3ee' : '#f59e0b',
            }}
          />
        </div>
      )}

      {/* ── Main Tab Content ── */}
      <main className="flex-1 min-h-0 overflow-y-auto">
        
        {/* Tab 1: Spec Factory (GoalWizard) */}
        {activeTab === 'factory' && (
          <div className="h-full">
            <GoalWizard />
          </div>
        )}

        {/* Tab 2: Baduck Workbench */}
        {activeTab === 'workbench' && (
          <>
            {phase === 'home' ? (
              <div className="min-h-[calc(100vh-80px)] flex flex-col items-center justify-center px-4 transition-colors duration-300">
                <div className="w-full max-w-xl text-center">
                  <h1 className="text-5xl font-black tracking-tighter mb-2 text-slate-800 dark:text-white">
                    <span className="text-cyan-600 dark:text-cyan-400">碁</span>Maestro
                  </h1>
                  <p className="text-slate-500 dark:text-white/50 text-sm mb-1">
                    바둑처럼 코드를 읽고, 묘수를 찾다
                  </p>
                  <p className="text-xs text-slate-400 dark:text-white/30 mb-8">
                    Sedol Maestro Workbench v2.0 — SGF 기보법 지원 · Claude AI 묘수 분석
                  </p>

                  <div className="flex items-center justify-center gap-2 mb-6 text-xs">
                    <span className={`w-2 h-2 rounded-full ${backendOk === true ? 'bg-green-400' : backendOk === false ? 'bg-red-400' : 'bg-yellow-400 animate-pulse'}`} />
                    <span className="text-slate-500 dark:text-white/40">
                      {backendOk === true ? 'API 서버 연결됨' : backendOk === false ? 'API 서버 연결 실패' : '연결 확인 중...'}
                    </span>
                  </div>

                  <div className="flex gap-2 mb-4">
                    <input
                      type="text"
                      value={githubUrl}
                      onChange={e => setGithubUrl(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleGithubSubmit()}
                      placeholder="https://github.com/user/repo"
                      className="flex-1 px-4 py-3 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/30 border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 text-sm font-mono"
                    />
                    <button
                      onClick={handleGithubSubmit}
                      disabled={!githubUrl.trim() || backendOk === false}
                      className="px-6 py-3 rounded-xl bg-cyan-600 dark:bg-cyan-500 text-white font-semibold text-sm hover:bg-cyan-700 dark:hover:bg-cyan-400 disabled:opacity-40 transition-colors"
                    >
                      판 읽기
                    </button>
                  </div>

                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex-1 h-px bg-slate-200 dark:bg-white/10" />
                    <span className="text-xs text-slate-400 dark:text-white/30">또는</span>
                    <div className="flex-1 h-px bg-slate-200 dark:bg-white/10" />
                  </div>

                  <button
                    onClick={handleLocalFolder}
                    disabled={backendOk === false}
                    className="w-full px-6 py-3 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-white/70 border border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/20 disabled:opacity-40 transition-colors text-sm font-medium"
                  >
                    📂 로컬 폴더 선택
                  </button>
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-[1600px] px-6 py-6 grid grid-cols-[1fr_360px] gap-6 h-[calc(100vh-80px)]">
                <div className="flex flex-col gap-6 min-w-0 min-h-0 overflow-y-auto pb-8">
                  <div className="w-full flex justify-center">
                    <div className="w-full max-w-[800px] border border-slate-200 dark:border-transparent rounded-xl flex items-center justify-center">
                      <Board stones={allStones as any} isDark={isDark} />
                    </div>
                  </div>
                  {mctsTree && (
                    <div className="w-full border border-slate-200 dark:border-transparent rounded-xl overflow-hidden shrink-0 mt-4">
                      <MoveTree root={mctsTree as any} currentWinRate={winRate} />
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-4 overflow-y-auto pb-8">
                  <WinRateMeter
                    value={winRate}
                    prev={prevWinRate}
                    components={{
                      healthScore: analysisInfo ? analysisInfo.avgHealth : 0,
                      testCoverage: analysisInfo ? analysisInfo.testCoverage : 0,
                      complexityInv: analysisInfo ? Math.max(0, 1 - analysisInfo.avgComplexity / 50) : 0,
                      velocity: 0.5,
                      debtRatioInv: 0.7,
                    }}
                    trend={trend}
                  />
                  <MoveCandidates
                    candidates={phase === 'ready' || phase === 'playing' ? candidates as any : []}
                    totalSims={candidates.reduce((s, c) => s + c.visits, 0) || 0}
                    elapsedMs={3200}
                    onSelect={handleSelectCandidate}
                    selectedId={selectedId}
                  />
                  <KifuPanel
                    moves={kifuMoves}
                    currentMove={currentKifuMove}
                    onSelectMove={handleKifuNav}
                  />
                </div>
              </div>
            )}
          </>
        )}

        {/* Tab 3: Prayer Board */}
        {activeTab === 'gido' && (
          <div className="mx-auto max-w-[1600px] px-6 py-6 h-full">
            <PrayerBoard />
          </div>
        )}

      </main>
    </div>
  );
}
