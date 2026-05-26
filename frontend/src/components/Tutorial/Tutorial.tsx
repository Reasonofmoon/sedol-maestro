import { useState, useEffect } from 'react';

// ═══════════════════════════════════════════════════════════════
// Tutorial — 단계별 사용 가이드 오버레이
// 처음 방문자에게 앱 사용법을 애니메이션으로 안내
// ═══════════════════════════════════════════════════════════════

interface TutorialStep {
  title: string;
  desc: string;
  icon: string;
  highlight?: string;  // CSS class for the highlighted area
}

const STEPS: TutorialStep[] = [
  {
    title: '1. 만다라 매트릭스',
    desc: '가로축에서 프로그래밍 언어를, 세로축에서 라이브러리를 선택합니다. 바둑판의 각 교차점이 기술 스택의 한 셀입니다.',
    icon: '🎯',
  },
  {
    title: '2. 앱 목표 입력',
    desc: '만들고 싶은 앱의 최종 모습을 구체적으로 설명합니다. AI가 이를 분석해 개발 Spec을 자동 생성합니다.',
    icon: '✍️',
  },
  {
    title: '3. 개발 로드맵',
    desc: '바둑의 기보처럼 각 개발 단계가 수순으로 펼쳐집니다. 포석→정석→중반→선수→묘수→끝내기 순서로 진행됩니다.',
    icon: '🗺️',
  },
  {
    title: '4. 바이브 코딩 프롬프트',
    desc: '각 단계마다 최적의 AI 프롬프트가 제공됩니다. 복사해서 Claude/ChatGPT에 붙여넣으면 바이브 코딩이 시작됩니다.',
    icon: '💬',
  },
  {
    title: '5. 코드 분석 워크벤치',
    desc: 'GitHub URL을 입력하면 코드가 바둑판 위에 펼쳐집니다. 각 돌은 모듈이고, 건강도에 따라 색이 바뀝니다. AI가 묘수를 찾아냅니다.',
    icon: '♟️',
  },
  {
    title: '6. SGF 기보 저장',
    desc: '코드 개선 기록이 바둑 SGF 기보 파일로 저장됩니다. 실제 바둑 뷰어에서 열 수 있는 표준 포맷입니다.',
    icon: '📋',
  },
];

export function Tutorial({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const handleClose = () => {
    setVisible(false);
    localStorage.setItem('govibe-tutorial-done', '1');
    setTimeout(onClose, 300);
  };

  const handleNext = () => {
    if (isLast) handleClose();
    else setStep(s => s + 1);
  };

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center transition-all duration-300
        ${visible ? 'opacity-100' : 'opacity-0'}`}
      onClick={handleClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Card */}
      <div
        className={`relative w-full max-w-md mx-4 rounded-2xl overflow-hidden transition-all duration-500
          ${visible ? 'translate-y-0 scale-100' : 'translate-y-8 scale-95'}
          bg-white dark:bg-[#161b22] border border-slate-200 dark:border-white/10 shadow-2xl`}
        onClick={e => e.stopPropagation()}
      >
        {/* Top gradient bar */}
        <div className="h-1.5 bg-gradient-to-r from-cyan-500 via-amber-500 to-emerald-500" />

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 pt-4">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                i === step ? 'w-6 bg-cyan-500' :
                i < step ? 'bg-cyan-500/40' : 'bg-slate-300 dark:bg-white/10'
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="px-8 py-6 text-center">
          <div className="text-5xl mb-4 animate-bounce" style={{ animationDuration: '2s' }}>
            {current.icon}
          </div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">
            {current.title}
          </h3>
          <p className="text-sm text-slate-500 dark:text-white/50 leading-relaxed">
            {current.desc}
          </p>
        </div>

        {/* Board illustration for step 5 */}
        {step === 4 && (
          <div className="mx-8 mb-4 p-3 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
            <div className="grid grid-cols-5 gap-1">
              {[0.8, -0.3, 0.5, 0.2, -0.6, 0.6, 0.9, -0.1, 0.4, 0.7, -0.4, 0.3, 0.1, 0.8, -0.2,
                0.5, 0.6, 0.2, -0.5, 0.4, 0.7, -0.3, 0.9, 0.1, 0.6].map((h, i) => (
                <div key={i} className="aspect-square rounded-full transition-all duration-500"
                  style={{
                    backgroundColor: h >= 0.5 ? '#22c55e' : h >= 0 ? '#0ea5e9' : h >= -0.3 ? '#f59e0b' : '#ef4444',
                    opacity: 0.3 + Math.abs(h) * 0.7,
                    animationDelay: `${i * 60}ms`,
                  }}
                />
              ))}
            </div>
            <div className="text-[10px] text-slate-400 dark:text-white/30 text-center mt-2">
              🟢 건강 · 🔵 보통 · 🟡 주의 · 🔴 위험(단수)
            </div>
          </div>
        )}

        {/* Mandala illustration for step 1 */}
        {step === 0 && (
          <div className="mx-8 mb-4 p-3 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
            <div className="flex justify-center gap-3 mb-2">
              {['🐍 Python', '📘 TS', '🦀 Rust', '🐹 Go'].map(l => (
                <span key={l} className="text-[10px] px-2 py-1 rounded bg-cyan-500/20 text-cyan-600 dark:text-cyan-400">{l}</span>
              ))}
            </div>
            <div className="text-[10px] text-slate-400 dark:text-white/30 text-center">
              ↕ 각 언어의 라이브러리가 세로로 펼쳐집니다
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="px-8 pb-6 flex items-center justify-between">
          <button onClick={handleClose}
            className="text-xs text-slate-400 dark:text-white/30 hover:text-slate-600 dark:hover:text-white/60 transition-colors">
            건너뛰기
          </button>
          <button onClick={handleNext}
            className="px-6 py-2 rounded-xl bg-cyan-500 text-white text-sm font-semibold hover:bg-cyan-400 transition-colors">
            {isLast ? '시작하기' : '다음 →'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function useTutorial() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('govibe-tutorial-done')) {
      setShow(true);
    }
  }, []);

  return { show, setShow, close: () => setShow(false) };
}
