import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme, ThemeToggle } from '../lib/theme';

// ═══════════════════════════════════════════════════════════════
// RoadmapPage — 개발 로드맵 + Skills 트리
// Spec에서 생성된 단계를 시각적 로드맵으로 표시
// 바둑 기보처럼 각 수(개발 단계)가 연결되어 전체 흐름을 보여줌
// ═══════════════════════════════════════════════════════════════

interface SpecStep {
  phase: string;
  title: string;
  description: string;
  tasks: string[];
  tools: string[];
  vibePrompt: string;
  estimatedMinutes: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

interface GeneratedSpec {
  appName: string;
  summary: string;
  techStack: string[];
  steps: SpecStep[];
  totalEstimatedHours: number;
  successCriteria: string[];
}

export default function RoadmapPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { spec } = (location.state || {}) as { spec?: GeneratedSpec };
  const { resolved } = useTheme();
  const isDark = resolved === 'dark';

  // CodeSpeak-style step status: pending → in_progress → done/skipped
  type StepStatus = 'pending' | 'in_progress' | 'done' | 'skipped';

  const [stepStatuses, setStepStatuses] = useState<StepStatus[]>(() => {
    try {
      const saved = localStorage.getItem('govibe-roadmap-progress');
      if (saved) return JSON.parse(saved);
    } catch {}
    return spec ? spec.steps.map(() => 'pending' as StepStatus) : [];
  });
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  // Persist progress
  useEffect(() => {
    if (stepStatuses.length > 0) {
      localStorage.setItem('govibe-roadmap-progress', JSON.stringify(stepStatuses));
    }
  }, [stepStatuses]);

  // Compat: completedSteps set for progress calc
  const completedSteps = new Set(stepStatuses.map((s, i) => s === 'done' ? i : -1).filter(i => i >= 0));

  if (!spec) {
    return (
      <div className="min-h-screen bg-[#0d1117] text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-white/40 mb-4">Spec이 없습니다. 먼저 Spec을 생성해주세요.</p>
          <button onClick={() => navigate('/matrix')}
            className="px-5 py-2 rounded-xl bg-cyan-500 text-white text-sm hover:bg-cyan-400">
            매트릭스로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  const cycleStatus = (idx: number) => {
    setStepStatuses(prev => {
      const next = [...prev];
      const cycle: StepStatus[] = ['pending', 'in_progress', 'done', 'skipped'];
      const current = cycle.indexOf(next[idx] || 'pending');
      next[idx] = cycle[(current + 1) % cycle.length];
      return next;
    });
  };

  const progressPercent = Math.round((completedSteps.size / spec.steps.length) * 100);

  const copyPrompt = (idx: number, prompt: string) => {
    navigator.clipboard.writeText(prompt);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const badukPhaseMap: Record<string, { badge: string; color: string }> = {
    '포석': { badge: '●포석', color: 'bg-slate-500/20 text-slate-400' },
    '정석': { badge: '○정석', color: 'bg-blue-500/20 text-blue-400' },
    '중반': { badge: '◈중반', color: 'bg-amber-500/20 text-amber-400' },
    '선수': { badge: '○선수', color: 'bg-green-500/20 text-green-400' },
    '묘수': { badge: '★묘수', color: 'bg-yellow-500/20 text-yellow-400' },
    '끝내기': { badge: '□끝내기', color: 'bg-cyan-500/20 text-cyan-400' },
  };

  const getBaduk = (phase: string) => {
    for (const [key, val] of Object.entries(badukPhaseMap)) {
      if (phase.includes(key)) return val;
    }
    return { badge: '●', color: 'bg-white/10 text-white/60' };
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-[#0d1117] text-white' : 'bg-slate-50 text-slate-800'}`}
         style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* Header */}
      <header className={`sticky top-0 z-40 border-b backdrop-blur-md ${isDark ? 'border-white/10 bg-[#0d1117]/90' : 'border-slate-200 bg-white/90'}`}>
        <div className="mx-auto max-w-[900px] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-black tracking-tighter cursor-pointer" onClick={() => navigate('/')}>
              <span className="text-cyan-600 dark:text-cyan-400">碁</span>Vibe
            </h1>
            <span className={`text-xs ${isDark ? 'text-white/40' : 'text-slate-400'}`}>개발 로드맵</span>
            <ThemeToggle />
          </div>
          <div className="flex gap-2">
            <button onClick={() => navigate(-1)}
              className="px-3 py-1.5 rounded-lg text-xs bg-white/10 text-white/60 hover:bg-white/20">← Spec</button>
            <button onClick={() => navigate('/app')}
              className="px-4 py-1.5 rounded-lg text-sm font-semibold bg-cyan-500 text-white hover:bg-cyan-400">
              워크벤치 →
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[900px] px-6 py-8">

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6 text-xs text-white/40">
          <span className="px-3 py-1 rounded-full bg-white/5 cursor-pointer hover:bg-white/10" onClick={() => navigate('/matrix')}>1. 언어</span>
          <span>→</span>
          <span className="px-3 py-1 rounded-full bg-white/5 cursor-pointer hover:bg-white/10" onClick={() => navigate(-1)}>3. Spec</span>
          <span>→</span>
          <span className="px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-400 font-bold">4. 로드맵</span>
          <span>→</span>
          <span className="px-3 py-1 rounded-full bg-white/5 cursor-pointer hover:bg-white/10" onClick={() => navigate('/app')}>5. 워크벤치</span>
        </div>

        {/* Project header */}
        <div className="mb-6 p-5 rounded-xl bg-white/5 border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold text-white">{spec.appName}</h2>
            <span className="text-xs font-mono text-white/40">{spec.steps.length}수</span>
          </div>
          <p className="text-xs text-white/50 mb-3">{spec.summary}</p>

          {/* Progress bar */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full bg-cyan-500 transition-all duration-500 rounded-full"
                   style={{ width: `${progressPercent}%` }} />
            </div>
            <span className="text-xs font-bold text-cyan-400">{progressPercent}%</span>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {spec.techStack.map(t => (
              <span key={t} className="px-2 py-0.5 rounded bg-white/10 text-white/40 text-[10px]">{t}</span>
            ))}
          </div>
        </div>

        {/* Roadmap timeline */}
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[19px] top-0 bottom-0 w-0.5 bg-white/10" />

          <div className="space-y-4">
            {spec.steps.map((step, idx) => {
              const active = activeStep === idx;
              const baduk = getBaduk(step.phase);
              const status = stepStatuses[idx] || 'pending';
              return (
                <div key={idx} className="relative pl-12">
                  {/* Node — click to cycle: pending → in_progress → done → skipped */}
                  <button
                    onClick={() => cycleStatus(idx)}
                    title={`상태: ${status} (클릭하여 변경)`}
                    className={`absolute left-0 top-1 w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold
                      transition-all border-2 z-10
                      ${status === 'done' ? 'bg-cyan-500 border-cyan-400 text-white scale-110' :
                        status === 'in_progress' ? 'bg-amber-500 border-amber-400 text-white scale-105 animate-pulse' :
                        status === 'skipped' ? 'bg-slate-500 border-slate-400 text-white/60 scale-95' :
                        isDark ? 'bg-[#0d1117] border-white/20 text-white/60 hover:border-cyan-500/50' :
                        'bg-white border-slate-300 text-slate-500 hover:border-cyan-500'
                      }`}
                  >
                    {status === 'done' ? '✓' : status === 'in_progress' ? '▶' : status === 'skipped' ? '—' : idx + 1}
                  </button>

                  {/* Card */}
                  <div
                    onClick={() => setActiveStep(active ? null : idx)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all
                      ${status === 'done' ? (isDark ? 'bg-cyan-500/5 border-cyan-500/20' : 'bg-cyan-50 border-cyan-200') :
                        status === 'in_progress' ? (isDark ? 'bg-amber-500/5 border-amber-500/20' : 'bg-amber-50 border-amber-200') :
                        status === 'skipped' ? (isDark ? 'bg-white/[0.02] border-white/5' : 'bg-slate-50 border-slate-100') :
                        active ? (isDark ? 'bg-white/10 border-white/20' : 'bg-white border-slate-300') :
                        isDark ? 'bg-white/5 border-white/10 hover:bg-white/8' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${baduk.color}`}>
                        {baduk.badge}
                      </span>
                      <span className="text-xs text-white/40">{step.phase}</span>
                      <span className="ml-auto text-[10px] text-white/30">~{step.estimatedMinutes}분</span>
                    </div>

                    <h3 className={`text-sm font-bold mb-1 ${status === 'done' ? 'text-cyan-600 dark:text-cyan-400 line-through' : status === 'skipped' ? 'line-through opacity-50' : ''}`}>
                      {step.title}
                    </h3>

                    {active && (
                      <div className="mt-3 space-y-3 animate-fade-in">
                        <p className="text-xs text-white/50">{step.description}</p>

                        {/* Tasks checklist */}
                        <div>
                          <div className="text-[10px] text-white/40 mb-1 font-bold">태스크</div>
                          <ul className="space-y-1">
                            {step.tasks.map((task, j) => (
                              <li key={j} className="flex items-start gap-2 text-xs text-white/60">
                                <span className="text-white/20">○</span>
                                {task}
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Vibe prompt — copyable */}
                        <div className="relative">
                          <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                            <div className="text-[10px] text-cyan-400 mb-1 font-bold">💬 바이브 코딩 프롬프트</div>
                            <p className="text-xs text-cyan-300/80 font-mono leading-relaxed pr-8">{step.vibePrompt}</p>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); copyPrompt(idx, step.vibePrompt); }}
                            className="absolute top-2 right-2 px-2 py-1 rounded text-[10px] bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30"
                          >
                            {copiedIdx === idx ? '✓ 복사됨' : '📋 복사'}
                          </button>
                        </div>

                        {/* Tools */}
                        <div className="flex flex-wrap gap-1.5">
                          {step.tools.map(t => (
                            <span key={t} className="px-2 py-0.5 rounded bg-white/10 text-white/40 text-[10px]">{t}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Success criteria */}
        <div className="mt-8 p-5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <h3 className="text-sm font-bold text-emerald-400 mb-2">🏆 성공 기준 (끝내기)</h3>
          <ul className="space-y-1.5">
            {spec.successCriteria.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-emerald-300/70">
                <span className="mt-0.5">●</span>{c}
              </li>
            ))}
          </ul>
        </div>

        {/* CTA to workbench */}
        <div className="mt-8 text-center">
          <button onClick={() => navigate('/app')}
            className="px-8 py-3 rounded-xl bg-cyan-500 text-white font-bold text-sm hover:bg-cyan-400 transition-colors">
            🎯 워크벤치에서 코드 분석 시작 →
          </button>
        </div>
      </div>
    </div>
  );
}
