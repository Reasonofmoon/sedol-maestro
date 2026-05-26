// ============================================================
// Board — 19×19 Go board with real Go coordinate labels
// Columns: A-T (skipping I), Rows: 19-1 (top to bottom)
// Stones = modules. Health → color. Atari = red ring.
// ============================================================

import { colLabel, rowLabel } from '../../lib/goNotation';

const BOARD_SIZE = 19;
const HOSHI = [[3,3],[3,9],[3,15],[9,3],[9,9],[9,15],[15,3],[15,9],[15,15]];

interface Stone {
  x: number; y: number; health: number;
  inAtari: boolean; isMyo?: boolean; isGhost?: boolean;
  label?: string; moduleId?: string;
}

interface BoardProps {
  stones: Stone[];
  isDark?: boolean;
  onIntersectionClick?: (x: number, y: number) => void;
  highlightPos?: [number, number];
}

function stoneColor(health: number, inAtari: boolean, isMyo?: boolean, isGhost?: boolean): string {
  if (isGhost) return 'rgba(34,211,238,0.3)';
  if (isMyo) return '#f59e0b';
  if (inAtari) return '#ef4444';
  if (health >= 0.5) return '#22c55e';
  if (health >= 0) return '#0ea5e9'; // slightly darker cyan for both modes
  if (health >= -0.5) return '#f59e0b';
  return '#ef4444';
}

export function Board({ stones, onIntersectionClick, highlightPos, isDark = true }: BoardProps) {
  const stoneMap = new Map<string, Stone>();
  for (const s of stones) stoneMap.set(`${s.x},${s.y}`, s);

  return (
    <div className="board-wrapper select-none" style={{ display: 'flex', flexDirection: 'column', gap: 0, width: '100%', height: '100%' }}>
      {/* Column labels (A-T, skipping I) */}
      <div style={{ display: 'grid', gridTemplateColumns: `20px repeat(${BOARD_SIZE}, 1fr)`, marginBottom: 2 }}>
        <div /> {/* corner spacer */}
        {Array.from({ length: BOARD_SIZE }, (_, x) => (
          <div key={x} className="text-center text-[9px] text-slate-500 dark:text-white/20 font-mono">{colLabel(x)}</div>
        ))}
      </div>

      {/* Board + row labels */}
      <div style={{ display: 'flex', gap: 0, flex: 1, minHeight: 0 }}>
        {/* Row labels (19 → 1) */}
        <div style={{ display: 'flex', flexDirection: 'column', width: 20, justifyContent: 'space-around' }}>
          {Array.from({ length: BOARD_SIZE }, (_, y) => (
            <div key={y} className="text-[9px] text-slate-500 dark:text-white/20 font-mono text-right pr-1 leading-none" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
              {rowLabel(y)}
            </div>
          ))}
        </div>

        {/* Board grid */}
        <div
          className="board relative shadow-xl"
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)`,
            gridTemplateRows: `repeat(${BOARD_SIZE}, 1fr)`,
            background: isDark ? 'radial-gradient(ellipse at center, #1a1f2e 0%, #0d1117 100%)' : 'radial-gradient(ellipse at center, #fce0a2 0%, #e6b465 100%)',
            border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.3)',
            borderRadius: '4px',
            padding: '8px',
          }}
        >
          {Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, idx) => {
            const x = idx % BOARD_SIZE;
            const y = Math.floor(idx / BOARD_SIZE);
            const key = `${x},${y}`;
            const stone = stoneMap.get(key);
            const isHoshi = HOSHI.some(([hx, hy]) => hx === x && hy === y);
            const isHighlight = highlightPos && highlightPos[0] === x && highlightPos[1] === y;
            const goTitle = `${colLabel(x)}${rowLabel(y)}${stone ? ` — ${stone.label ?? ''} (health: ${stone.health.toFixed(2)})` : ''}`;

            return (
              <div key={key} onClick={() => onIntersectionClick?.(x, y)}
                className="relative flex items-center justify-center cursor-pointer"
                style={{ aspectRatio: '1' }} title={goTitle}
              >
                {/* Grid lines */}
                <div className="absolute inset-0 pointer-events-none">
                  {y > 0            && <div className={`absolute top-0 left-1/2 w-px h-1/2 ${isDark ? 'bg-white/10' : 'bg-black/20'}`} />}
                  {y < BOARD_SIZE-1 && <div className={`absolute bottom-0 left-1/2 w-px h-1/2 ${isDark ? 'bg-white/10' : 'bg-black/20'}`} />}
                  {x > 0            && <div className={`absolute left-0 top-1/2 w-1/2 h-px ${isDark ? 'bg-white/10' : 'bg-black/20'}`} />}
                  {x < BOARD_SIZE-1 && <div className={`absolute right-0 top-1/2 w-1/2 h-px ${isDark ? 'bg-white/10' : 'bg-black/20'}`} />}
                </div>

                {isHoshi && !stone && <div className={`absolute w-1.5 h-1.5 rounded-full ${isDark ? 'bg-white/20' : 'bg-black/40'} pointer-events-none`} />}
                {isHighlight && !stone && <div className="absolute inset-1 rounded-full bg-cyan-500/20 animate-pulse" />}

                {stone && (
                  <div className="relative rounded-full transition-all duration-300"
                    style={{
                      width: '78%', height: '78%',
                      backgroundColor: stoneColor(stone.health, stone.inAtari, stone.isMyo, stone.isGhost),
                      boxShadow: stone.inAtari
                        ? '0 0 0 2px rgba(239,68,68,0.6), 0 0 8px rgba(239,68,68,0.4)'
                        : stone.isMyo
                        ? '0 0 0 2px rgba(245,158,11,0.8), 0 0 12px rgba(245,158,11,0.5)'
                        : '0 2px 4px rgba(0,0,0,0.4)',
                      opacity: stone.isGhost ? 0.6 : 1,
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
