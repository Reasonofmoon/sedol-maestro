// ============================================================
// Board — 19×19 Go board showing code health as stone positions
// Stones = modules. Health → color. Atari = red ring.
// ============================================================

const BOARD_SIZE = 19;
const HOSHI = [[3,3],[3,9],[3,15],[9,3],[9,9],[9,15],[15,3],[15,9],[15,15]];

interface Stone {
  x: number;      // 0-18
  y: number;      // 0-18
  health: number; // -1 to +1
  inAtari: boolean;
  isMyo?: boolean;
  isGhost?: boolean;
  label?: string;
  moduleId?: string;
}

interface BoardProps {
  stones: Stone[];
  onIntersectionClick?: (x: number, y: number) => void;
  highlightPos?: [number, number];
}

function stoneColor(health: number, inAtari: boolean, isMyo?: boolean, isGhost?: boolean): string {
  if (isGhost) return 'rgba(34,211,238,0.3)';
  if (isMyo) return '#f59e0b';
  if (inAtari) return '#ef4444';
  if (health >= 0.5) return '#22c55e';
  if (health >= 0) return '#22d3ee';
  if (health >= -0.5) return '#f59e0b';
  return '#ef4444';
}

export function Board({ stones, onIntersectionClick, highlightPos }: BoardProps) {
  const stoneMap = new Map<string, Stone>();
  for (const s of stones) stoneMap.set(`${s.x},${s.y}`, s);

  return (
    <div
      className="board relative select-none"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)`,
        gridTemplateRows: `repeat(${BOARD_SIZE}, 1fr)`,
        aspectRatio: '1',
        background: 'radial-gradient(ellipse at center, #1a1f2e 0%, #0d1117 100%)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '12px',
        padding: '12px',
        gap: '0',
      }}
    >
      {Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, idx) => {
        const x = idx % BOARD_SIZE;
        const y = Math.floor(idx / BOARD_SIZE);
        const key = `${x},${y}`;
        const stone = stoneMap.get(key);
        const isHoshi = HOSHI.some(([hx, hy]) => hx === x && hy === y);
        const isHighlight = highlightPos && highlightPos[0] === x && highlightPos[1] === y;

        return (
          <div
            key={key}
            onClick={() => onIntersectionClick?.(x, y)}
            className="relative flex items-center justify-center cursor-pointer"
            style={{ aspectRatio: '1' }}
            title={stone ? `${stone.label ?? stone.moduleId}: health=${stone.health.toFixed(2)}` : undefined}
          >
            {/* Grid lines */}
            <div className="absolute inset-0 pointer-events-none">
              {y > 0            && <div className="absolute top-0 left-1/2 w-px h-1/2 bg-white/10" />}
              {y < BOARD_SIZE-1 && <div className="absolute bottom-0 left-1/2 w-px h-1/2 bg-white/10" />}
              {x > 0            && <div className="absolute left-0 top-1/2 w-1/2 h-px bg-white/10" />}
              {x < BOARD_SIZE-1 && <div className="absolute right-0 top-1/2 w-1/2 h-px bg-white/10" />}
            </div>

            {/* Hoshi star point */}
            {isHoshi && !stone && (
              <div className="absolute w-1.5 h-1.5 rounded-full bg-white/20 pointer-events-none" />
            )}

            {/* Highlight pulse */}
            {isHighlight && !stone && (
              <div className="absolute inset-1 rounded-full bg-cyan-500/20 animate-pulse" />
            )}

            {/* Stone */}
            {stone && (
              <div
                className="relative rounded-full transition-all duration-300"
                style={{
                  width: '78%',
                  height: '78%',
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
  );
}
