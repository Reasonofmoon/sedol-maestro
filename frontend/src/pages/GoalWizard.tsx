// ============================================================
// GoalWizard — 3단계 온보딩 위저드
// Step 1: 목표 선택 → Step 2: 경험 수준 → Step 3: AI 추천 결과
// 바둑 메타포: 포석(목표) → 행마(선택) → 수순(기보)
// ============================================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GOALS, EXPERIENCES, recommend,
  type Goal, type Experience, type Recommendation,
} from '@/lib/recommend';
import { generateVibePrompts } from '@/lib/prompt-generator';

// ── Step indicator ─────────────────────────────────────────

function StepBar({ step }: { step: number }) {
  const labels = ['목표 설정', '경험 수준', '추천 결과'];
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {labels.map((label, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={`
            w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
            transition-all duration-300
            ${i + 1 <= step
              ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30'
              : 'bg-white/5 text-white/30 border border-white/10'
            }
          `}>
            {i + 1}
          </div>
          <span className={`text-xs hidden sm:inline ${i + 1 <= step ? 'text-cyan-400' : 'text-white/20'}`}>
            {label}
          </span>
          {i < 2 && <div className={`w-8 sm:w-12 h-px ${i + 1 < step ? 'bg-cyan-500' : 'bg-white/10'}`} />}
        </div>
      ))}
    </div>
  );
}

// ── Step 1: Goal selection ─────────────────────────────────

function GoalStep({ onSelect }: { onSelect: (goal: Goal) => void }) {
  return (
    <div className="space-y-6 animate-in">
      <div className="text-center space-y-2">
        <h2 className="text-2xl sm:text-3xl font-black text-white">
          무엇을 만들고 싶으세요?
        </h2>
        <p className="text-white/40 text-sm sm:text-base">
          목표를 선택하면 최적의 언어와 라이브러리를 추천합니다
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto">
        {GOALS.map(goal => (
          <button
            key={goal.id}
            onClick={() => onSelect(goal.id)}
            className="
              group flex flex-col items-center gap-2 p-4 sm:p-5 rounded-2xl
              bg-white/[0.03] border border-white/[0.06]
              hover:bg-cyan-500/10 hover:border-cyan-500/30
              active:scale-[0.97] transition-all duration-200
              touch-manipulation
            "
          >
            <span className="text-3xl sm:text-4xl group-hover:scale-110 transition-transform">
              {goal.icon}
            </span>
            <span className="text-sm font-semibold text-white/70 group-hover:text-cyan-400 transition-colors">
              {goal.label}
            </span>
            <span className="text-[10px] text-white/25 leading-tight text-center hidden sm:block">
              {goal.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Step 2: Experience level ───────────────────────────────

function ExperienceStep({
  goal,
  onSelect,
  onBack,
}: {
  goal: Goal;
  onSelect: (exp: Experience) => void;
  onBack: () => void;
}) {
  const goalOption = GOALS.find(g => g.id === goal)!;

  return (
    <div className="space-y-6 animate-in">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 mb-2">
          <span>{goalOption.icon}</span>
          <span className="text-cyan-400 text-sm font-medium">{goalOption.label}</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-white">
          프로그래밍 경험은?
        </h2>
        <p className="text-white/40 text-sm sm:text-base">
          수준에 맞는 라이브러리를 추천합니다
        </p>
      </div>

      <div className="flex flex-col gap-3 max-w-md mx-auto">
        {EXPERIENCES.map(exp => (
          <button
            key={exp.id}
            onClick={() => onSelect(exp.id)}
            className="
              group flex items-center gap-4 p-4 sm:p-5 rounded-2xl
              bg-white/[0.03] border border-white/[0.06]
              hover:bg-cyan-500/10 hover:border-cyan-500/30
              active:scale-[0.98] transition-all duration-200
              touch-manipulation text-left
            "
          >
            <span className="text-3xl group-hover:scale-110 transition-transform">{exp.icon}</span>
            <div>
              <div className="text-base font-semibold text-white/80 group-hover:text-cyan-400 transition-colors">
                {exp.label}
              </div>
              <div className="text-xs text-white/30">
                {exp.id === 'beginner' && '코딩을 한 번도 해본 적 없어요'}
                {exp.id === 'some' && '간단한 프로그램을 만들어본 적 있어요'}
                {exp.id === 'intermediate' && '프로젝트를 혼자 진행할 수 있어요'}
                {exp.id === 'advanced' && '복잡한 시스템을 설계할 수 있어요'}
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="text-center">
        <button onClick={onBack} className="text-white/30 hover:text-white/60 text-sm transition-colors">
          ← 목표 다시 선택
        </button>
      </div>
    </div>
  );
}

// ── Step 3: Recommendation result ──────────────────────────

function ResultStep({
  recommendations,
  goal,
  onBack,
  onStart,
}: {
  recommendations: Recommendation[];
  goal: Goal;
  experience: Experience;
  onBack: () => void;
  onStart: (rec: Recommendation) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [selected, setSelected] = useState(0);
  const rec = recommendations[selected];
  if (!rec) return null;

  return (
    <div className="space-y-6 animate-in max-w-3xl mx-auto">
      <div className="text-center space-y-2">
        <h2 className="text-2xl sm:text-3xl font-black text-white">
          추천 스택
        </h2>
        <p className="text-white/40 text-sm">
          바둑의 수순처럼, 최적의 개발 경로를 설계했습니다
        </p>
      </div>

      {/* Language tabs */}
      <div className="flex justify-center gap-2">
        {recommendations.map((r, i) => (
          <button
            key={r.language.id}
            onClick={() => setSelected(i)}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
              transition-all duration-200 touch-manipulation
              ${i === selected
                ? `${r.language.color} border border-current/30 ${r.language.textColor}`
                : 'bg-white/[0.03] border border-white/[0.06] text-white/40 hover:text-white/60'
              }
            `}
          >
            <span>{r.language.icon}</span>
            <span>{r.language.name}</span>
            {i === 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">Best</span>}
          </button>
        ))}
      </div>

      {/* Recommendation card */}
      <div className="grid sm:grid-cols-2 gap-4">
        {/* Libraries */}
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5 space-y-3">
          <h3 className={`text-sm font-bold uppercase tracking-wider ${rec.language.textColor}`}>
            추천 라이브러리
          </h3>
          <div className="space-y-2">
            {rec.libraries.map(lib => (
              <div key={lib.name} className="flex items-start gap-3 p-2 rounded-lg hover:bg-white/[0.03] transition-colors">
                <span className="text-lg mt-0.5">{lib.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white/80">{lib.name}</div>
                  <div className="text-[11px] text-white/30 leading-tight">{lib.description}</div>
                </div>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full shrink-0 ${
                  lib.difficulty === 'beginner' ? 'bg-green-500/15 text-green-400' :
                  lib.difficulty === 'intermediate' ? 'bg-blue-500/15 text-blue-400' :
                  'bg-orange-500/15 text-orange-400'
                }`}>
                  {lib.difficulty === 'beginner' ? '입문' : lib.difficulty === 'intermediate' ? '중급' : '고급'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Kifu sequence */}
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5 space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400">
            개발 수순 (기보)
          </h3>
          <div className="space-y-2.5">
            {rec.kifuSequence.map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs font-mono w-4 text-right text-white/20">{step.moveNumber}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0"
                  style={{
                    backgroundColor: stepColor(step.badge) + '22',
                    color: stepColor(step.badge),
                  }}>
                  {step.badge}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-white/60 truncate">{step.label}</div>
                </div>
                <span className="text-xs font-bold" style={{ color: stepColor(step.badge) }}>
                  {step.winRate}%
                </span>
              </div>
            ))}
          </div>

          {/* Win rate bar */}
          <div className="h-1.5 rounded-full overflow-hidden bg-white/5 mt-3">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-700"
              style={{ width: `${rec.kifuSequence[rec.kifuSequence.length - 1]?.winRate ?? 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <button
          onClick={() => onStart(rec)}
          className="
            w-full sm:w-auto px-8 py-4 rounded-2xl
            bg-cyan-500 text-white font-bold text-base
            hover:bg-cyan-400 active:scale-[0.98]
            transition-all shadow-lg shadow-cyan-500/20
            touch-manipulation
          "
        >
          🎯 이 스택으로 보드 보기
        </button>
        <button
          onClick={() => {
            const prompts = generateVibePrompts(rec, goal);
            const text = prompts.map(p =>
              `═══ 수 #${p.moveNumber} ─ ${p.badge} ═══\n${p.title}\n${'─'.repeat(40)}\n${p.prompt}\n`
            ).join('\n');
            navigator.clipboard.writeText(text).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            });
          }}
          className="
            w-full sm:w-auto px-6 py-4 rounded-2xl
            border border-amber-500/30 text-amber-400 font-semibold text-sm
            hover:bg-amber-500/10 active:scale-[0.98]
            transition-all touch-manipulation
          "
        >
          {copied ? '✓ 복사됨!' : '⚡ 바이브 코딩 프롬프트 복사'}
        </button>
        <button
          onClick={onBack}
          className="text-white/30 hover:text-white/60 text-sm transition-colors"
        >
          ← 다시 선택
        </button>
      </div>
    </div>
  );
}

function stepColor(badge: string): string {
  if (badge.includes('포석')) return '#64748b';
  if (badge.includes('정석')) return '#3b82f6';
  if (badge.includes('묘수')) return '#f59e0b';
  if (badge.includes('선수')) return '#22d3ee';
  if (badge.includes('끝내기')) return '#22c55e';
  return '#94a3b8';
}

// ── Main Wizard ────────────────────────────────────────────

export default function GoalWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [experience, setExperience] = useState<Experience | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  const handleGoalSelect = (g: Goal) => {
    setGoal(g);
    setStep(2);
  };

  const handleExperienceSelect = (e: Experience) => {
    setExperience(e);
    const recs = recommend(goal!, e);
    setRecommendations(recs);
    setStep(3);
  };

  const handleStart = (rec: Recommendation) => {
    // Navigate to board with recommendation state
    navigate('/board', {
      state: {
        language: rec.language,
        libraries: rec.libraries,
        kifuSequence: rec.kifuSequence,
        goal,
        experience,
      },
    });
  };

  return (
    <div className="min-h-screen bg-[#07090F] flex flex-col"
         style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#07090F]/90 backdrop-blur-md">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <span className="text-lg sm:text-xl font-black">
              <span className="text-cyan-400">碁</span><span className="text-white">Vibe</span>
            </span>
          </button>
          <span className="text-[10px] font-mono text-white/15 border border-white/[0.06] rounded px-2 py-0.5">
            Goal Wizard
          </span>
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 flex flex-col justify-center px-4 sm:px-6 py-8 sm:py-12">
        <StepBar step={step} />

        {step === 1 && <GoalStep onSelect={handleGoalSelect} />}
        {step === 2 && goal && (
          <ExperienceStep
            goal={goal}
            onSelect={handleExperienceSelect}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && goal && experience && (
          <ResultStep
            recommendations={recommendations}
            goal={goal}
            experience={experience}
            onBack={() => setStep(2)}
            onStart={handleStart}
          />
        )}
      </main>
    </div>
  );
}
