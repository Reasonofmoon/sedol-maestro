// ============================================================
// WinRateMeter — KataGo-style real-time win-rate display
// Shows project vitality as a Go AI win-rate percentage
// ============================================================

import { useMemo } from 'react';

interface WinRateComponents {
  healthScore: number;
  testCoverage: number;
  complexityInv: number;
  velocity: number;
  debtRatioInv: number;
}

interface WinRateMeterProps {
  value: number;           // 0-100
  prev?: number;
  components?: WinRateComponents;
  trend?: 'rising' | 'stable' | 'falling';
}

const COMPONENT_LABELS: Record<keyof WinRateComponents, string> = {
  healthScore:   '모듈 건강도',
  testCoverage:  '테스트 커버리지',
  complexityInv: '복잡도 역수',
  velocity:      '개발 속도',
  debtRatioInv:  '기술 부채 역수',
};

const WEIGHTS: Record<keyof WinRateComponents, number> = {
  healthScore:   0.35,
  testCoverage:  0.25,
  complexityInv: 0.20,
  velocity:      0.10,
  debtRatioInv:  0.10,
};

export function WinRateMeter({ value, prev, components, trend = 'stable' }: WinRateMeterProps) {
  const delta = prev !== undefined ? value - prev : 0;

  const barColor = value >= 70 ? '#22c55e' : value >= 40 ? '#f59e0b' : '#ef4444';
  const trendIcon = trend === 'rising' ? '↗' : trend === 'falling' ? '↘' : '→';
  const trendColor = trend === 'rising' ? '#22c55e' : trend === 'falling' ? '#ef4444' : '#6b7280';

  return (
    <div className="win-rate-meter rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-widest text-white/40">
          PROJECT VITALITY
        </span>
        <span style={{ color: trendColor }} className="text-xs font-semibold">
          {trendIcon} {delta !== 0 ? (delta > 0 ? `+${delta}%` : `${delta}%`) : '안정'}
        </span>
      </div>

      {/* Main bar */}
      <div className="space-y-1">
        <div className="flex items-end justify-between">
          <span className="text-3xl font-black text-white">{value}%</span>
          {prev !== undefined && (
            <span className="text-xs text-white/30">이전: {prev}%</span>
          )}
        </div>
        <div className="h-3 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${value}%`, backgroundColor: barColor }}
          />
        </div>
      </div>

      {/* Component breakdown */}
      {components && (
        <div className="space-y-1.5 pt-1 border-t border-white/5">
          {(Object.keys(WEIGHTS) as Array<keyof WinRateComponents>).map(k => {
            const v = components[k];
            const contribution = Math.round(v * WEIGHTS[k] * 100);
            return (
              <div key={k} className="flex items-center gap-2">
                <span className="text-[10px] text-white/35 w-24 shrink-0">{COMPONENT_LABELS[k]}</span>
                <div className="flex-1 h-1.5 rounded-full bg-white/8">
                  <div
                    className="h-full rounded-full bg-cyan-400/60 transition-all duration-500"
                    style={{ width: `${v * 100}%` }}
                  />
                </div>
                <span className="text-[10px] text-white/30 w-8 text-right">{contribution}%</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
