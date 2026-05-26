// ============================================================
// KifuPanel — Development game record panel
// Shows move history with win-rate trend + SGF export
// ============================================================

import { toSGF } from '../../lib/goNotation';

interface KifuMove {
  moveNumber: number;
  intent: string;
  type: string;
  badge: string;
  winRateBefore: number;
  winRateAfter: number;
  deltaWinRate: number;
  isMyo: boolean;
}

interface KifuPanelProps {
  moves: KifuMove[];
  currentMove: number;
  onSelectMove: (n: number) => void;
}

export function KifuPanel({ moves, currentMove, onSelectMove }: KifuPanelProps) {
  const maxRate = Math.max(...moves.map(m => m.winRateAfter), 10);

  const handleExportSGF = () => {
    const sgfMoves = moves.map(m => ({
      moveNumber: m.moveNumber,
      intent: m.intent,
      badge: m.badge,
      winRateBefore: m.winRateBefore,
      winRateAfter: m.winRateAfter,
      isMyo: m.isMyo,
    }));
    const sgf = toSGF(sgfMoves, 'Project');
    const blob = new Blob([sgf], { type: 'application/x-go-sgf' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `baduck-kifu-${new Date().toISOString().slice(0,10)}.sgf`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="kifu-panel rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/3 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-white/8">
        <span className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-white/40">KIFU 기보</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400 dark:text-white/25">{moves.length}수</span>
          {moves.length > 0 && (
            <button onClick={handleExportSGF}
              className="text-[10px] text-cyan-600 dark:text-cyan-400/60 hover:text-cyan-700 dark:hover:text-cyan-400 border border-cyan-300 dark:border-cyan-500/20
                         hover:border-cyan-400 dark:hover:border-cyan-500/40 rounded px-1.5 py-0.5 transition-all"
              title="SGF 형식으로 기보 내보내기 (Sabaki 등으로 열 수 있음)">
              SGF 내보내기
            </button>
          )}
        </div>
      </div>

      {/* Mini sparkline */}
      {moves.length > 1 && (
        <div className="px-4 py-2 border-b border-slate-200 dark:border-white/5">
          <svg width="100%" height="32" className="overflow-visible">
            {moves.map((m, i) => {
              const x = (i / (moves.length - 1)) * 100;
              const y = 32 - (m.winRateAfter / 100) * 32;
              const nextMove = moves[i + 1];
              const nx = nextMove ? ((i + 1) / (moves.length - 1)) * 100 : x;
              const ny = nextMove ? 32 - (nextMove.winRateAfter / 100) * 32 : y;
              return (
                <g key={i}>
                  {nextMove && (
                    <line
                      x1={`${x}%`} y1={y} x2={`${nx}%`} y2={ny}
                      stroke={m.isMyo ? '#f59e0b' : '#22d3ee'}
                      strokeWidth="1.5" strokeOpacity="0.6"
                    />
                  )}
                  <circle
                    cx={`${x}%`} cy={y} r={m.isMyo ? 4 : 2}
                    fill={m.isMyo ? '#f59e0b' : '#22d3ee'}
                    opacity={i + 1 === currentMove ? 1 : 0.5}
                  />
                </g>
              );
            })}
          </svg>
        </div>
      )}

      {/* Move list */}
      <div className="divide-y divide-slate-200 dark:divide-white/5 max-h-64 overflow-y-auto">
        {moves.map((m) => {
          const isActive = m.moveNumber === currentMove;
          const badgeColor = m.isMyo ? 'text-amber-600 dark:text-amber-300' :
                             m.badge.includes('선수') ? 'text-cyan-600 dark:text-cyan-300' :
                             m.badge.includes('정석') ? 'text-emerald-600 dark:text-emerald-300' :
                             m.badge.includes('실착') ? 'text-red-600 dark:text-red-400' :
                             'text-slate-400 dark:text-white/30';
          const dStr = m.deltaWinRate >= 0 ? `+${m.deltaWinRate}%` : `${m.deltaWinRate}%`;
          const dColor = m.deltaWinRate >= 5 ? 'text-green-600 dark:text-green-400' : m.deltaWinRate < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400 dark:text-white/30';

          return (
            <button
              key={m.moveNumber}
              onClick={() => onSelectMove(m.moveNumber)}
              className={`w-full text-left flex items-center gap-3 px-4 py-2
                transition-colors hover:bg-slate-200 dark:hover:bg-white/5
                ${isActive ? 'bg-cyan-50 dark:bg-cyan-500/10 ring-1 ring-inset ring-cyan-500/20' : ''}`}
            >
              <span className="text-[10px] text-slate-400 dark:text-white/25 w-6 text-right font-mono shrink-0">
                {m.moveNumber}
              </span>
              <span className={`text-[10px] font-bold shrink-0 ${badgeColor}`}>
                {m.badge.slice(0,2)}
              </span>
              <span className="flex-1 text-xs text-slate-700 dark:text-white/60 truncate">{m.intent.slice(0,32)}</span>
              <span className="text-[10px] text-slate-500 dark:text-white/30 font-mono shrink-0">{m.winRateAfter}%</span>
              <span className={`text-[10px] font-mono shrink-0 ${dColor}`}>{dStr}</span>
            </button>
          );
        })}
      </div>

      {/* Replay controls */}
      <div className="flex items-center justify-center gap-2 px-4 py-2 border-t border-slate-200 dark:border-white/5">
        {[
          { label: '◀◀', onClick: () => onSelectMove(1) },
          { label: '◀',  onClick: () => onSelectMove(Math.max(1, currentMove - 1)) },
          { label: '●',  onClick: () => {} },
          { label: '▶',  onClick: () => onSelectMove(Math.min(moves.length, currentMove + 1)) },
          { label: '▶▶', onClick: () => onSelectMove(moves.length) },
        ].map(({ label, onClick }) => (
          <button
            key={label}
            onClick={onClick}
            className="text-xs text-slate-500 dark:text-white/30 hover:text-slate-800 dark:hover:text-white/70 transition-colors px-2 py-1"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
