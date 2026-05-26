import { useState } from 'react';
import { Send, Sparkles, MessageSquare, Award, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface PrayerPost {
  id: string;
  title: string;
  author: string;
  content: string;
  category: 'build' | 'deploy' | 'refactor' | 'atari';
  createdAt: string;
  blessing?: {
    agentName: string;
    comment: string;
    suggestedMove: string;
  };
}

const INITIAL_PRAYERS: PrayerPost[] = [
  {
    id: '1',
    title: 'Stripe Webhook 타입 에러 제발 해결하게 해주세요',
    author: 'Reasonofmoon',
    content: '어제부터 Webhook 서명 검증에서 계속 500 에러 납니다... 에이전트님 제발 해결해주세요. 빌드 성공 축도 부탁드립니다. 🙏',
    category: 'build',
    createdAt: '10분 전',
    blessing: {
      agentName: 'Maestro Agent (Claude-3.5)',
      comment: '개발자님의 간절함이 클라우드 서버에 닿았습니다. 이 에러는 Stripe API 버전 불일치로 인한 사활(Atari) 위기입니다. 서명 검증 함수에 payload.toString() 처리를 더해 안전하게 가드(Defense Stone)하십시오. 빌드의 은총이 함께할 것입니다.',
      suggestedMove: '묘수: StripeWebhook.ts #L32 - payload parsing 버퍼화'
    }
  },
  {
    id: '2',
    title: '배포 서버 스케일 아웃 무사 통과 기원',
    author: 'Lucy원장님',
    content: '내일 아침 ConnectEdu 프로덕션 서버 확장 작업이 있습니다. 다운타임 없이 완벽하게 이뤄지도록 우주의 기운과 젠킨스 신께 기도드립니다.',
    category: 'deploy',
    createdAt: '2시간 전',
    blessing: {
      agentName: 'Orchestrator Agent (Gemini-Flash)',
      comment: '내일 포석(Architecture)의 중요한 한 수이군요. 부하 분산 헬스체크 주기를 10초로 늘려 Nginx가 돌발 트래픽 예외(Exception)를 부드럽게 넘어가도록 행마하십시오. 무중단 배포를 축원합니다.',
      suggestedMove: '정석: nginx.conf - keepalive_timeout 65 설정'
    }
  }
];

export function PrayerBoard() {
  const [prayers, setPrayers] = useState<PrayerPost[]>(INITIAL_PRAYERS);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<'build' | 'deploy' | 'refactor'>('build');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    // Simulate AI Generator responding instantly with tech humor
    const aiComments = [
      "Jenkins 신의 강복이 함께하시어 해당 PR은 충돌 없이 머지될 것입니다. 묘수: git rebase origin/main 후 착점하십시오.",
      "타입 가드(Type Guard) 돌을 아끼지 마십시오. string | undefined 상태인 변수가 사활을 위협하고 있습니다. 선수: if(!data) return; 삽입.",
      "UiPath Maestro가 감시하는 안전지대입니다. 빌드 실패 시 Action Center 로봇이 묘수 구조 헬기를 띄울 예정이니 평안히 커밋하십시오."
    ];
    const aiMoves = [
      "정석: package.json - lock파일 강제 리셋",
      "★묘수: middleware.ts - edge runtime 캐시 가드",
      "선수: AppError.ts - error boundary 포석"
    ];

    const randomIdx = Math.floor(Math.random() * aiComments.length);

    const newPrayer: PrayerPost = {
      id: Date.now().toString(),
      title,
      author: 'Developer (You)',
      content,
      category,
      createdAt: '방금 전',
      blessing: {
        agentName: 'Maestro Bot',
        comment: aiComments[randomIdx],
        suggestedMove: aiMoves[randomIdx]
      }
    };

    setPrayers(prev => [newPrayer, ...prev]);
    setTitle('');
    setContent('');
  };

  return (
    <div className="w-full h-full flex flex-col gap-6 text-slate-800 dark:text-slate-200">
      
      {/* ── Top Hero ── */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-cyan-500/10 to-violet-500/10 border border-cyan-500/20 flex items-start gap-4">
        <Sparkles className="text-cyan-400 shrink-0 mt-1" size={24} />
        <div className="space-y-1">
          <h2 className="text-lg font-bold">祈禱 (빌드 기원) & 棋道 (바둑의 도리) 보드</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            개발자 특유의 빌드 성공 기원 밈(Meme)과 바둑의 정성스러운 복기(Code Review) 정신을 결합한 소셜 공간입니다.
            간절한 기도를 올리면 AI 에이전트가 즉각 기술적인 은총과 함께 묘수 훈수를 남겨 드립니다.
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-[400px_1fr] gap-6 items-start min-h-0 flex-1">
        
        {/* ── Left Side: Create Prayer Request ── */}
        <div className="p-5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 space-y-4">
          <h3 className="text-base font-bold flex items-center gap-2">
            <MessageSquare size={18} className="text-cyan-500" />
            간절한 빌드 기원글 올리기
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 dark:text-white/40">카테고리</label>
              <div className="flex gap-2">
                {(['build', 'deploy', 'refactor'] as const).map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                      category === cat
                        ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/20'
                        : 'bg-slate-200 dark:bg-white/5 text-slate-600 dark:text-white/50 border border-slate-300 dark:border-transparent'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 dark:text-white/40">기도 제목</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="예: 타입스크립트 빌드 터지지 않게..."
                className="w-full px-3 py-2 text-sm rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 dark:text-white/40">기도 내용 (기원 및 예외 세부사항)</label>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="컴파일러에게 전할 간절한 소망이나, 현재 겪고 있는 아타리(위기) 상황을 설명해 주세요..."
                rows={4}
                className="w-full px-3 py-2 text-sm rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 resize-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-cyan-600 dark:bg-cyan-500 text-white font-bold text-sm hover:bg-cyan-700 dark:hover:bg-cyan-400 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <Send size={14} />
              <span>기도 올리기 (Submit Prayer)</span>
            </button>
          </form>
        </div>

        {/* ── Right Side: Prayer Feed & Hall of Fame ── */}
        <div className="flex flex-col gap-6 overflow-y-auto max-h-[700px] pr-2">
          
          {/* Honor Kifu Board (UiPath 구출 이력) */}
          <div className="p-5 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-3 shrink-0">
            <h4 className="text-sm font-bold text-amber-500 flex items-center gap-2">
              <Award size={18} />
              Maestro Hall of Kifu (UiPath 사활 구출 이력)
            </h4>
            <div className="grid sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 flex items-start gap-3">
                <ShieldAlert className="text-rose-400 shrink-0 mt-0.5" size={16} />
                <div className="space-y-0.5">
                  <div className="font-semibold">Move 78: Atari Rescue in PaymentFlow.ts</div>
                  <div className="text-slate-500 dark:text-white/40">3회 연속 빌드 실패 예외 감지 후 Action Center 묘수 착점으로 에이전트 자가 복구 성공!</div>
                  <div className="text-[10px] text-emerald-400 font-bold mt-1">✓ Win-rate 회복: 42% -> 94%</div>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 flex items-start gap-3">
                <CheckCircle2 className="text-emerald-400 shrink-0 mt-0.5" size={16} />
                <div className="space-y-0.5">
                  <div className="font-semibold">Move 102: Auth Middleware Lock</div>
                  <div className="text-slate-500 dark:text-white/40">JWT 토큰 만료 예외 분기를 standard joseki로 수정하여 배포 릴리즈 안착</div>
                  <div className="text-[10px] text-emerald-400 font-bold mt-1">✓ 빌드 패스 완료</div>
                </div>
              </div>
            </div>
          </div>

          {/* Prayer Posts List */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-slate-500 dark:text-white/40">실시간 피드 (Real-time Prayer Feed)</h4>
            {prayers.map(post => (
              <div
                key={post.id}
                className="p-5 rounded-2xl bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 space-y-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                      post.category === 'build' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' :
                      post.category === 'deploy' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                    }`}>
                      {post.category}
                    </span>
                    <h5 className="text-base font-bold">{post.title}</h5>
                  </div>
                  <span className="text-xs text-slate-400 dark:text-white/30">{post.createdAt}</span>
                </div>

                <p className="text-sm text-slate-600 dark:text-white/70 leading-relaxed font-light">{post.content}</p>
                <div className="text-xs text-slate-400 dark:text-white/40">작성자: <span className="font-mono">{post.author}</span></div>

                {/* AI Blessing Response */}
                {post.blessing && (
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.01] border-l-4 border-amber-400 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-500 flex items-center gap-1">
                        <Sparkles size={12} />
                        {post.blessing.agentName}의 축도(Blessing Move)
                      </span>
                    </div>
                    <p className="text-slate-500 dark:text-white/60 leading-relaxed">{post.blessing.comment}</p>
                    <div className="font-mono text-cyan-400 font-bold bg-cyan-950/20 dark:bg-cyan-950/40 p-2 rounded border border-cyan-900/30">
                      {post.blessing.suggestedMove}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

        </div>

      </div>

    </div>
  );
}
