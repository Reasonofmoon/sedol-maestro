// ============================================================
// MoveTree — Visual MCTS search tree (수읽기)
// Shows D1-D3 depth, Q values, visit counts, myo detection
// ============================================================

interface TreeNode {
  id: string;
  intent: string;
  type: string;
  badge: string;
  q: number;
  prior: number;
  visits: number;
  depth: number;
  children: TreeNode[];
  isMyo?: boolean;
}

interface MoveTreeProps {
  root: TreeNode;
  currentWinRate: number;
}

function TreeNodeRow({ node, isLast, prefix }: { node: TreeNode; isLast: boolean; prefix: string }) {
  const connector = isLast ? '└─' : '├─';
  const childPrefix = isLast ? '  ' : '│ ';

  const badgeColor = node.badge === '★묘수' ? 'text-amber-600 dark:text-amber-300' :
                     node.badge === '○선수' ? 'text-cyan-600 dark:text-cyan-300' :
                     node.badge === '○정석' ? 'text-emerald-600 dark:text-emerald-300' :
                     node.badge === '✗실착' ? 'text-red-600 dark:text-red-400' :
                     'text-slate-400 dark:text-white/30';

  const qBarWidth = Math.max(0, Math.min(100, (node.q + 1) / 2 * 100));

  return (
    <div>
      <div className="flex items-center gap-2 py-0.5">
        {/* Tree connector */}
        <span className="text-slate-400 dark:text-white/15 font-mono text-[11px] shrink-0 select-none">
          {prefix}{connector}
        </span>

        {/* Badge */}
        <span className={`text-[10px] font-semibold shrink-0 ${badgeColor}`}>
          {node.badge.slice(0,2)}
        </span>

        {/* Intent */}
        <span className="text-xs text-slate-700 dark:text-white/70 flex-1 truncate">{node.intent.slice(0,36)}</span>

        {/* Stats */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-16 h-1.5 rounded-full bg-slate-200 dark:bg-white/8">
            <div
              className="h-full rounded-full bg-cyan-500/80 dark:bg-cyan-400/50"
              style={{ width: `${qBarWidth}%` }}
            />
          </div>
          <span className="text-[10px] text-slate-500 dark:text-white/35 font-mono w-16 text-right">
            Q={node.q.toFixed(2)} N={node.visits}
          </span>
        </div>
      </div>

      {/* Children */}
      {node.children.map((child, i) => (
        <TreeNodeRow
          key={child.id}
          node={child}
          isLast={i === node.children.length - 1}
          prefix={prefix + childPrefix}
        />
      ))}
    </div>
  );
}

export function MoveTree({ root, currentWinRate }: MoveTreeProps) {
  const children = root.children.sort((a, b) => b.visits - a.visits);

  return (
    <div className="move-tree rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/3 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-white/8">
        <span className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-white/40">
          수읽기 TREE
        </span>
        <span className="text-[10px] text-slate-400 dark:text-white/25">D1-D3 깊이</span>
      </div>

      {/* Current state */}
      <div className="px-4 py-2 border-b border-slate-200 dark:border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan-500 dark:bg-cyan-400" />
          <span className="text-xs text-slate-500 dark:text-white/50">현재 상태: Win-Rate {currentWinRate}%</span>
        </div>
      </div>

      {/* Tree nodes */}
      <div className="px-3 py-2 font-mono overflow-x-auto">
        {children.map((child, i) => (
          <TreeNodeRow
            key={child.id}
            node={child}
            isLast={i === children.length - 1}
            prefix=""
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2 border-t border-slate-200 dark:border-white/5 flex-wrap">
        {[
          { label: '★묘수', color: 'text-amber-600 dark:text-amber-300' },
          { label: '○선수', color: 'text-cyan-600 dark:text-cyan-300' },
          { label: '○정석', color: 'text-emerald-600 dark:text-emerald-300' },
          { label: '△후수', color: 'text-slate-500 dark:text-white/30' },
          { label: '✗실착', color: 'text-red-600 dark:text-red-400' },
        ].map(({ label, color }) => (
          <span key={label} className={`text-[10px] font-semibold ${color}`}>{label}</span>
        ))}
      </div>
    </div>
  );
}
