// ============================================================
// MoveCandidates — Probability panel for next move candidates
// KataGo-style: probability bars + Q value + myo badge
// ============================================================

interface MoveCandidate {
  rank: number;
  actionId: string;
  intent: string;
  type: string;
  badge: '★묘수' | '○선수' | '○정석' | '△후수' | '✗실착';
  probability: number;    // 0-100
  qValue: number;
  visits: number;
  deltaHealth: number;
  deltaWinRate: number;
  myoReasons?: string[];
}

interface MoveCandidatesProps {
  candidates: MoveCandidate[];
  totalSims: number;
  elapsedMs: number;
  onSelect: (actionId: string) => void;
  selectedId?: string;
  onHover?: (actionId: string | null) => void;
}

const BADGE_STYLES: Record<MoveCandidate['badge'], { bg: string; text: string; border: string }> = {
  '★묘수': { bg: 'bg-amber-100 dark:bg-amber-500/15', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-300 dark:border-amber-500/30' },
  '○선수': { bg: 'bg-cyan-100 dark:bg-cyan-500/15',  text: 'text-cyan-700 dark:text-cyan-300',  border: 'border-cyan-300 dark:border-cyan-500/30' },
  '○정석': { bg: 'bg-emerald-100 dark:bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-300 dark:border-emerald-500/30' },
  '△후수': { bg: 'bg-slate-200 dark:bg-white/5',     text: 'text-slate-600 dark:text-white/40',  border: 'border-slate-300 dark:border-white/10' },
  '✗실착': { bg: 'bg-red-100 dark:bg-red-500/10',  text: 'text-red-700 dark:text-red-400',   border: 'border-red-300 dark:border-red-500/25' },
};

export function MoveCandidates({ candidates, totalSims, elapsedMs, onSelect, selectedId, onHover }: MoveCandidatesProps) {
  return (
    <div className="move-candidates rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/3 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-white/8">
        <span className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-white/40">
          NEXT MOVE CANDIDATES
        </span>
        <span className="text-[10px] text-slate-400 dark:text-white/25">
          MCTS {totalSims}sim / {(elapsedMs/1000).toFixed(1)}s
        </span>
      </div>

      {/* Candidate list */}
      <div className="divide-y divide-slate-200 dark:divide-white/5">
        {candidates.map((c) => {
          const style = BADGE_STYLES[c.badge];
          const isSelected = c.actionId === selectedId;
          const dH = c.deltaHealth >= 0 ? `+${c.deltaHealth.toFixed(2)}` : c.deltaHealth.toFixed(2);
          const dW = c.deltaWinRate >= 0 ? `+${c.deltaWinRate}%` : `${c.deltaWinRate}%`;

          return (
            <button
              key={c.actionId}
              onClick={() => onSelect(c.actionId)}
              onMouseEnter={() => onHover?.(c.actionId)}
              onMouseLeave={() => onHover?.(null)}
              className={`w-full text-left px-4 py-3 transition-all hover:bg-slate-200 dark:hover:bg-white/5
                ${isSelected ? 'bg-slate-200 dark:bg-white/8 ring-1 ring-inset ring-cyan-500/30' : ''}`}
            >
              {/* Row 1: Badge + intent + deltas */}
              <div className="flex items-center gap-2 mb-2">
                <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border
                  ${style.bg} ${style.text} ${style.border}`}>
                  {c.badge}
                </span>
                <span className="flex-1 text-xs font-medium text-slate-800 dark:text-white/80 truncate">
                  {c.intent}
                </span>
                <span className="shrink-0 text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">{dH}</span>
                <span className={`shrink-0 text-[10px] font-mono ${c.deltaWinRate >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{dW}</span>
              </div>

              {/* Row 2: Probability bar + stats */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 rounded-full bg-slate-300 dark:bg-white/8">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${style.bg.replace('/15', '/60').replace('-100', '-400')}`}
                    style={{ width: `${c.probability}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold text-slate-600 dark:text-white/60 w-8 text-right">{c.probability}%</span>
                <span className="text-[10px] text-slate-400 dark:text-white/25">N={c.visits}</span>
                <span className="text-[10px] text-slate-400 dark:text-white/25">Q={c.qValue.toFixed(2)}</span>
              </div>

              {/* Myo reasons */}
              {c.badge === '★묘수' && c.myoReasons && c.myoReasons.length > 0 && (
                <div className="mt-1.5 text-[10px] text-amber-600 dark:text-amber-300/70">
                  → {c.myoReasons[0]}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
