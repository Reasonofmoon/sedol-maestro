// ============================================================
// KifuPanel — Development game record panel
// Shows move history with win-rate trend
// ============================================================

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

  return (
    <div className="kifu-panel rounded-xl border border-white/10 bg-white/3 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/8">
        <span className="text-xs font-bold uppercase tracking-widest text-white/40">KIFU 기보</span>
        <span className="text-[10px] text-white/25">{moves.length}수</span>
      </div>

      {/* Mini sparkline */}
      {moves.length > 1 && (
        <div className="px-4 py-2 border-b border-white/5">
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
      <div className="divide-y divide-white/5 max-h-64 overflow-y-auto">
        {moves.map((m) => {
          const isActive = m.moveNumber === currentMove;
          const badgeColor = m.isMyo ? 'text-amber-300' :
                             m.badge.includes('선수') ? 'text-cyan-300' :
                             m.badge.includes('정석') ? 'text-emerald-300' :
                             m.badge.includes('실착') ? 'text-red-400' :
                             'text-white/30';
          const dStr = m.deltaWinRate >= 0 ? `+${m.deltaWinRate}%` : `${m.deltaWinRate}%`;
          const dColor = m.deltaWinRate >= 5 ? 'text-green-400' : m.deltaWinRate < 0 ? 'text-red-400' : 'text-white/30';

          return (
            <button
              key={m.moveNumber}
              onClick={() => onSelectMove(m.moveNumber)}
              className={`w-full text-left flex items-center gap-3 px-4 py-2
                transition-colors hover:bg-white/5
                ${isActive ? 'bg-cyan-500/10 ring-1 ring-inset ring-cyan-500/20' : ''}`}
            >
              <span className="text-[10px] text-white/25 w-6 text-right font-mono shrink-0">
                {m.moveNumber}
              </span>
              <span className={`text-[10px] font-bold shrink-0 ${badgeColor}`}>
                {m.badge.slice(0,2)}
              </span>
              <span className="flex-1 text-xs text-white/60 truncate">{m.intent.slice(0,32)}</span>
              <span className="text-[10px] text-white/30 font-mono shrink-0">{m.winRateAfter}%</span>
              <span className={`text-[10px] font-mono shrink-0 ${dColor}`}>{dStr}</span>
            </button>
          );
        })}
      </div>

      {/* Replay controls */}
      <div className="flex items-center justify-center gap-2 px-4 py-2 border-t border-white/5">
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
            className="text-xs text-white/30 hover:text-white/70 transition-colors px-2 py-1"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
