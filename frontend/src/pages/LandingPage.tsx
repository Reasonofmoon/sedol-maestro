// ============================================================
// Landing Page — 碁Vibe: 바둑처럼 두면 앱이 완성된다
// 모바일 퍼스트, 터치 친화적 디자인
// ============================================================

import { useNavigate } from 'react-router-dom';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#07090F] text-white flex flex-col"
         style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#07090F]/90 backdrop-blur-md">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <span className="text-lg sm:text-xl font-black">
            <span className="text-cyan-400">碁</span>Vibe
          </span>
          <button
            onClick={() => navigate('/wizard')}
            className="px-4 sm:px-5 py-2 rounded-xl bg-cyan-500 text-white text-sm font-semibold
                       hover:bg-cyan-400 active:scale-[0.97] transition-all touch-manipulation"
          >
            시작하기
          </button>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-12 sm:py-20 text-center">
        {/* Glow background */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-64 sm:w-96 h-64 sm:h-96 rounded-full blur-3xl bg-cyan-500/5" />
          <div className="absolute bottom-1/4 right-1/4 w-48 sm:w-80 h-48 sm:h-80 rounded-full blur-3xl bg-amber-500/5" />
        </div>

        <div className="relative space-y-6 sm:space-y-8 max-w-2xl">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-amber-500/20 bg-amber-500/5">
            <span className="text-amber-500">★</span>
            <span className="text-sm font-medium text-amber-300">바둑처럼 두면 앱이 완성된다</span>
          </div>

          {/* Title */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight">
            목표를 말하면
            <br />
            <span className="text-cyan-400">바이브 코딩</span> 수순을
            <br />
            자동 설계합니다
          </h1>

          {/* Description */}
          <p className="text-base sm:text-lg text-white/40 leading-relaxed max-w-lg mx-auto">
            <strong className="text-white/70">만들고 싶은 것</strong>을 선택하면,
            AI가 <strong className="text-amber-300">기보(棋譜)</strong>처럼
            최적의 언어 · 라이브러리 · 개발 수순을 설계합니다.
          </p>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={() => navigate('/wizard')}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-cyan-500 text-white font-bold text-base
                         hover:bg-cyan-400 active:scale-[0.98] transition-all
                         shadow-lg shadow-cyan-500/20 touch-manipulation"
            >
              🎯 목표 설정하고 시작하기
            </button>
            <button
              onClick={() => navigate('/board')}
              className="w-full sm:w-auto px-6 py-4 rounded-2xl border border-white/10
                         text-white/50 hover:text-white/80 hover:bg-white/5
                         transition-all touch-manipulation text-sm"
            >
              보드 바로 보기
            </button>
          </div>

          {/* Features */}
          <div className="grid grid-cols-3 gap-4 pt-8 sm:pt-12">
            {[
              { icon: '🎯', title: '목표 기반', desc: '뭘 만들지 선택하면 끝' },
              { icon: '♟️', title: '바둑 수순', desc: '기보처럼 단계별 가이드' },
              { icon: '⚡', title: '바이브 코딩', desc: 'AI가 프롬프트 자동 생성' },
            ].map(f => (
              <div key={f.title} className="space-y-2">
                <span className="text-2xl sm:text-3xl">{f.icon}</span>
                <div className="text-xs sm:text-sm font-semibold text-white/60">{f.title}</div>
                <div className="text-[10px] sm:text-xs text-white/25">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
