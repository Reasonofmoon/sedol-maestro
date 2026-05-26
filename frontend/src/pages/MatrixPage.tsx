import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LANGUAGES, CATEGORIES } from '../data/mandala';
import type { Language, Library } from '../data/mandala';
import { useTheme, ThemeToggle } from '../lib/theme';
import { Tutorial, useTutorial } from '../components/Tutorial/Tutorial';

// ═══════════════════════════════════════════════════════════════
// MatrixPage — 바둑판 + 만다라 매트릭스 통합
// 가로축: 프로그래밍 언어 (바둑판의 열)
// 세로축: 라이브러리 (바둑판의 행)
// 교차점 = 만다라 셀 = 바둑 착점
// ═══════════════════════════════════════════════════════════════

export default function MatrixPage() {
  const navigate = useNavigate();
  const { resolved } = useTheme();
  const isDark = resolved === 'dark';
  const tutorial = useTutorial();

  const [selectedLang, setSelectedLang] = useState<Language | null>(null);
  const [selectedLib, setSelectedLib] = useState<Library | null>(null);
  const [filterCat, setFilterCat] = useState<string | null>(null);
  const [hoveredLib, setHoveredLib] = useState<string | null>(null);

  const filteredLibs = selectedLang
    ? selectedLang.libraries.filter(l => !filterCat || l.category === filterCat)
    : [];

  const handleNext = () => {
    if (!selectedLang || !selectedLib) return;
    navigate('/spec', { state: { language: selectedLang, library: selectedLib } });
  };

  // Map a library to a Go board coordinate (for visual connection)
  const libToCoord = (libIdx: number, totalLibs: number) => {
    const col = Math.floor((libIdx % 4) * 4.5) + 2; // spread across cols
    const row = Math.floor(libIdx / 4) * 3 + 2;      // spread across rows
    return { col: Math.min(col, 18), row: Math.min(row, 18) };
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-[#0d1117] text-white' : 'bg-slate-50 text-slate-800'}`}
         style={{ fontFamily: "'Inter', sans-serif" }}>

      {tutorial.show && <Tutorial onClose={tutorial.close} />}

      {/* Header */}
      <header className={`sticky top-0 z-40 border-b backdrop-blur-md ${isDark ? 'border-white/10 bg-[#0d1117]/90' : 'border-slate-200 bg-white/90'}`}>
        <div className="mx-auto max-w-[1200px] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-black tracking-tighter cursor-pointer" onClick={() => navigate('/')}>
              <span className="text-cyan-600 dark:text-cyan-400">碁</span>Vibe
              <span className={`text-xs ml-2 ${isDark ? 'text-white/40' : 'text-slate-400'}`}>만다라 매트릭스</span>
            </h1>
            <ThemeToggle />
            <button onClick={() => tutorial.setShow(true)}
              className={`px-2 py-1 rounded-lg text-xs ${isDark ? 'bg-white/10 text-white/50 hover:bg-white/20' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
              ❓ 가이드
            </button>
          </div>
          <button onClick={handleNext} disabled={!selectedLang || !selectedLib}
            className="px-5 py-2 rounded-xl bg-cyan-500 text-white font-semibold text-sm hover:bg-cyan-400 disabled:opacity-30 transition-all">
            다음: Spec 생성 →
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-[1200px] px-6 py-6">

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6 text-xs">
          {[
            { n: '1', label: '언어 선택', active: true },
            { n: '2', label: '라이브러리', active: !!selectedLang },
            { n: '3', label: 'Spec 생성', active: false },
            { n: '4', label: '로드맵', active: false },
            { n: '5', label: '워크벤치', active: false },
          ].map((s, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <span className={isDark ? 'text-white/20' : 'text-slate-300'}>→</span>}
              <span className={`px-3 py-1 rounded-full ${
                s.active ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 font-bold'
                         : isDark ? 'bg-white/5 text-white/30' : 'bg-slate-100 text-slate-400'
              }`}>
                {s.n}. {s.label}
              </span>
            </span>
          ))}
        </div>

        {/* ── 가로축: 언어 선택 (바둑판 열) ── */}
        <div className="mb-6">
          <h2 className={`text-sm font-bold mb-3 ${isDark ? 'text-white/60' : 'text-slate-500'}`}>
            가로축 — 프로그래밍 언어 <span className={isDark ? 'text-white/30' : 'text-slate-400'}>(바둑판의 열)</span>
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {LANGUAGES.map(lang => (
              <button key={lang.id}
                onClick={() => { setSelectedLang(lang); setSelectedLib(null); setFilterCat(null); }}
                className={`flex-shrink-0 px-5 py-4 rounded-xl border transition-all text-left min-w-[160px]
                  ${selectedLang?.id === lang.id
                    ? `${lang.color} border-current ring-2 ring-current/30 ${lang.textColor}`
                    : isDark ? 'bg-white/5 border-white/10 hover:bg-white/10 text-white/70'
                             : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700 shadow-sm'
                  }`}
              >
                <div className="text-2xl mb-1">{lang.icon}</div>
                <div className="font-bold text-sm">{lang.name}</div>
                <div className={`text-xs mt-1 line-clamp-2 ${isDark ? 'text-white/40' : 'text-slate-400'}`}>
                  {lang.description}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── 세로축: 만다라 라이브러리 그리드 (바둑판 행) ── */}
        {selectedLang ? (
          <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-sm font-bold ${isDark ? 'text-white/60' : 'text-slate-500'}`}>
                세로축 — {selectedLang.icon} {selectedLang.name} 라이브러리
                <span className={isDark ? 'text-white/30' : 'text-slate-400'}> (바둑판의 행 — 착점하세요)</span>
              </h2>
              <div className="flex gap-1.5 flex-wrap">
                <button onClick={() => setFilterCat(null)}
                  className={`px-2.5 py-1 rounded-lg text-xs ${!filterCat
                    ? (isDark ? 'bg-white/20 text-white' : 'bg-slate-800 text-white')
                    : (isDark ? 'bg-white/5 text-white/40 hover:bg-white/10' : 'bg-slate-100 text-slate-500 hover:bg-slate-200')
                  }`}>전체</button>
                {CATEGORIES.map(cat => {
                  const count = selectedLang.libraries.filter(l => l.category === cat.id).length;
                  if (count === 0) return null;
                  return (
                    <button key={cat.id} onClick={() => setFilterCat(filterCat === cat.id ? null : cat.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs ${filterCat === cat.id
                        ? (isDark ? 'bg-white/20 text-white' : 'bg-slate-800 text-white')
                        : (isDark ? 'bg-white/5 text-white/40 hover:bg-white/10' : 'bg-slate-100 text-slate-500 hover:bg-slate-200')
                      }`}>{cat.icon} {cat.name} ({count})</button>
                  );
                })}
              </div>
            </div>

            {/* ── 통합 보드: 미니 바둑판 + 만다라 셀 ── */}
            <div className={`rounded-2xl p-4 mb-4 border ${isDark ? 'bg-[#1a1f2e] border-white/10' : 'bg-amber-50 border-amber-200/50'}`}>
              {/* Mini Go board grid overlaid with library cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {filteredLibs.map((lib, i) => {
                  const coord = libToCoord(i, filteredLibs.length);
                  const isSelected = selectedLib?.name === lib.name;
                  const isHovered = hoveredLib === lib.name;

                  return (
                    <button key={lib.name}
                      onClick={() => setSelectedLib(lib)}
                      onMouseEnter={() => setHoveredLib(lib.name)}
                      onMouseLeave={() => setHoveredLib(null)}
                      className={`relative p-4 rounded-xl border text-left transition-all group
                        ${isSelected
                          ? `${selectedLang.color} border-current ${selectedLang.textColor} ring-2 ring-current/30 scale-[1.02]`
                          : isHovered
                          ? (isDark ? 'bg-white/10 border-white/20 scale-[1.01]' : 'bg-white border-slate-300 shadow-md scale-[1.01]')
                          : isDark ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-white border-slate-200 hover:shadow-sm'
                        }`}
                    >
                      {/* Go coordinate badge */}
                      <span className={`absolute top-2 right-2 text-[9px] font-mono rounded px-1 py-0.5
                        ${isDark ? 'bg-white/10 text-white/30' : 'bg-slate-100 text-slate-400'}`}>
                        {String.fromCharCode(65 + (coord.col > 8 ? coord.col + 1 : coord.col))}{19 - coord.row}
                      </span>

                      {/* Stone indicator */}
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs
                          ${isSelected
                            ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30'
                            : isDark ? 'bg-white/10' : 'bg-slate-100'
                          }`} style={isSelected ? { animation: 'stonePlace 0.3s ease-out' } : {}}>
                          {lib.icon}
                        </div>
                        <span className="font-bold text-sm">{lib.name}</span>
                      </div>

                      <p className={`text-xs line-clamp-2 ${
                        isDark ? 'text-white/40 group-hover:text-white/60' : 'text-slate-400 group-hover:text-slate-600'
                      }`}>{lib.description}</p>

                      <div className="flex items-center gap-2 mt-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                          lib.difficulty === 'beginner' ? 'bg-green-500/20 text-green-600 dark:text-green-400' :
                          lib.difficulty === 'intermediate' ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400' :
                          'bg-red-500/20 text-red-600 dark:text-red-400'
                        }`}>
                          {lib.difficulty === 'beginner' ? '초급' : lib.difficulty === 'intermediate' ? '중급' : '고급'}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? 'bg-white/5 text-white/30' : 'bg-slate-50 text-slate-400'}`}>
                          {CATEGORIES.find(c => c.id === lib.category)?.icon} {CATEGORIES.find(c => c.id === lib.category)?.name}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selection summary */}
            {selectedLib && (
              <div className={`p-4 rounded-xl border flex items-center justify-between animate-fade-in
                ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center text-lg">
                    {selectedLang.icon}
                  </div>
                  <span className={isDark ? 'text-white/40' : 'text-slate-300'}>×</span>
                  <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center text-lg">
                    {selectedLib.icon}
                  </div>
                  <div>
                    <div className="text-sm font-bold">{selectedLang.name} × {selectedLib.name}</div>
                    <div className={`text-xs ${isDark ? 'text-white/40' : 'text-slate-400'}`}>
                      이 착점으로 앱을 만듭니다 — 다음 단계에서 AI가 개발 Spec을 생성합니다
                    </div>
                  </div>
                </div>
                <button onClick={handleNext}
                  className="px-5 py-2 rounded-xl bg-cyan-500 text-white font-semibold text-sm hover:bg-cyan-400 transition-colors">
                  착점 확정 → Spec 생성
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Empty state: mini Go board preview */
          <div className="text-center py-16">
            <div className={`inline-block p-6 rounded-2xl mb-4 ${isDark ? 'bg-[#1a1f2e]' : 'bg-amber-50'}`}>
              <div className="grid grid-cols-5 gap-2 w-32 mx-auto">
                {Array.from({ length: 25 }, (_, i) => (
                  <div key={i} className={`w-5 h-5 rounded-full ${
                    i === 12 ? 'bg-cyan-500/40 animate-pulse' :
                    [0, 4, 20, 24, 6, 18].includes(i) ? (isDark ? 'bg-white/10' : 'bg-amber-300/40') :
                    'bg-transparent'
                  }`} style={{
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)'}`,
                  }} />
                ))}
              </div>
            </div>
            <p className={`text-sm ${isDark ? 'text-white/30' : 'text-slate-400'}`}>
              언어를 선택하면 바둑판 위에 라이브러리 만다라가 펼쳐집니다
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
