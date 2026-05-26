// ============================================================
// GlossaryPanel — 바둑 용어 사전 + 오픈소스 참고 자료
// ============================================================

import { useState } from 'react';
import { BADUK_GLOSSARY, GO_REFERENCES } from '../../lib/goNotation';

type Tab = 'glossary' | 'refs';

export function GlossaryPanel() {
  const [tab, setTab] = useState<Tab>('glossary');
  const [search, setSearch] = useState('');

  const filtered = BADUK_GLOSSARY.filter(t =>
    !search ||
    t.ko.includes(search) ||
    t.en.toLowerCase().includes(search.toLowerCase()) ||
    t.definition.includes(search)
  );

  return (
    <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/3 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-white/8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-white/40">
            바둑 참고 자료
          </span>
          <div className="flex gap-1">
            {(['glossary', 'refs'] as Tab[]).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`text-[10px] px-2 py-1 rounded transition-colors
                  ${tab === t ? 'bg-slate-200 dark:bg-white/10 text-slate-800 dark:text-white/70' : 'text-slate-500 dark:text-white/25 hover:text-slate-700 dark:hover:text-white/50'}`}>
                {t === 'glossary' ? '용어 사전' : '참고 자료'}
              </button>
            ))}
          </div>
        </div>
        {tab === 'glossary' && (
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="검색 (예: 묘수, sente)"
            className="w-full text-xs bg-slate-50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-lg px-3 py-1.5
                       text-slate-800 dark:text-white/60 placeholder:text-slate-400 dark:placeholder:text-white/20 focus:outline-none focus:border-cyan-500 dark:focus:border-white/20"
          />
        )}
      </div>

      {/* Glossary tab */}
      {tab === 'glossary' && (
        <div className="divide-y divide-slate-200 dark:divide-white/5 max-h-80 overflow-y-auto">
          {filtered.map(term => (
            <div key={term.ko} className="px-4 py-3 hover:bg-slate-200 dark:hover:bg-white/3 transition-colors">
              {/* Term header */}
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-sm font-bold text-slate-900 dark:text-white/90">{term.ko}</span>
                <span className="text-[10px] text-slate-400 dark:text-white/30">{term.jp}</span>
                <span className="text-[10px] text-cyan-600 dark:text-cyan-400/70 ml-auto shrink-0">{term.en}</span>
              </div>
              {/* Definition */}
              <p className="text-[11px] text-slate-600 dark:text-white/45 leading-relaxed mb-1.5">
                {term.definition}
              </p>
              {/* Code analogy */}
              <div className="rounded bg-cyan-50 dark:bg-cyan-500/5 border border-cyan-200 dark:border-cyan-500/10 px-2.5 py-1.5">
                <span className="text-[10px] text-cyan-700 dark:text-cyan-400/60">코딩 대응: </span>
                <span className="text-[10px] text-slate-600 dark:text-white/50">{term.codeAnalogy}</span>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="px-4 py-6 text-center text-xs text-slate-400 dark:text-white/20">
              검색 결과 없음
            </div>
          )}
        </div>
      )}

      {/* References tab */}
      {tab === 'refs' && (
        <div className="divide-y divide-slate-200 dark:divide-white/5 max-h-80 overflow-y-auto">
          {GO_REFERENCES.map(ref => (
            <div key={ref.name} className="px-4 py-3 hover:bg-slate-200 dark:hover:bg-white/3 transition-colors">
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="text-sm font-bold text-slate-900 dark:text-white/90">{ref.name}</span>
                <a href={ref.url} target="_blank" rel="noopener noreferrer"
                  className="text-[10px] text-cyan-600 dark:text-cyan-400/70 hover:text-cyan-700 dark:hover:text-cyan-400 transition-colors shrink-0">
                  GitHub →
                </a>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-white/45 leading-relaxed mb-1.5">{ref.desc}</p>
              <div className="rounded bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/10 px-2.5 py-1.5">
                <span className="text-[10px] text-amber-600 dark:text-amber-400/60">관련성: </span>
                <span className="text-[10px] text-slate-600 dark:text-white/50">{ref.relevance}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
