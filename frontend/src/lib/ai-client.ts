// ============================================================
// AI Client — 멀티 프로바이더 LLM 클라이언트
// Anthropic, OpenAI, Google, Groq, Mistral, DeepSeek, Ollama
// API Key는 localStorage에 저장 (브라우저 로컬 전용)
// ============================================================

export type Provider = 'anthropic' | 'openai' | 'google' | 'groq' | 'mistral' | 'deepseek' | 'ollama';

export interface AIModel {
  id: string;
  name: string;
  provider: Provider;
  maxTokens: number;
  inputPrice: string;
  outputPrice: string;
}

// 2026년 3월 기준 최신 모델
export const AI_MODELS: AIModel[] = [
  // ── Anthropic Claude ──
  { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', provider: 'anthropic', maxTokens: 128000, inputPrice: '$5', outputPrice: '$25' },
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', provider: 'anthropic', maxTokens: 64000, inputPrice: '$3', outputPrice: '$15' },
  { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', provider: 'anthropic', maxTokens: 64000, inputPrice: '$1', outputPrice: '$5' },
  // ── OpenAI ──
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', maxTokens: 16384, inputPrice: '$2.50', outputPrice: '$10' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', maxTokens: 16384, inputPrice: '$0.15', outputPrice: '$0.60' },
  { id: 'o3-mini', name: 'o3-mini', provider: 'openai', maxTokens: 65536, inputPrice: '$1.10', outputPrice: '$4.40' },
  // ── Google Gemini ──
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'google', maxTokens: 65536, inputPrice: '$1.25', outputPrice: '$10' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'google', maxTokens: 65536, inputPrice: '$0.15', outputPrice: '$0.60' },
  // ── Groq (초고속 추론) ──
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', provider: 'groq', maxTokens: 32768, inputPrice: '$0.59', outputPrice: '$0.79' },
  { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 70B', provider: 'groq', maxTokens: 16384, inputPrice: '$0.75', outputPrice: '$0.99' },
  { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', provider: 'groq', maxTokens: 32768, inputPrice: '$0.24', outputPrice: '$0.24' },
  // ── Mistral ──
  { id: 'mistral-large-latest', name: 'Mistral Large', provider: 'mistral', maxTokens: 32768, inputPrice: '$2', outputPrice: '$6' },
  { id: 'mistral-small-latest', name: 'Mistral Small', provider: 'mistral', maxTokens: 32768, inputPrice: '$0.10', outputPrice: '$0.30' },
  { id: 'codestral-latest', name: 'Codestral (코딩 특화)', provider: 'mistral', maxTokens: 32768, inputPrice: '$0.30', outputPrice: '$0.90' },
  // ── DeepSeek ──
  { id: 'deepseek-chat', name: 'DeepSeek V3', provider: 'deepseek', maxTokens: 65536, inputPrice: '$0.27', outputPrice: '$1.10' },
  { id: 'deepseek-reasoner', name: 'DeepSeek R1 (추론)', provider: 'deepseek', maxTokens: 65536, inputPrice: '$0.55', outputPrice: '$2.19' },
  // ── Ollama (로컬) ──
  { id: 'llama3.3', name: 'Llama 3.3 (로컬)', provider: 'ollama', maxTokens: 8192, inputPrice: '무료', outputPrice: '무료' },
  { id: 'deepseek-r1:14b', name: 'DeepSeek R1 14B (로컬)', provider: 'ollama', maxTokens: 8192, inputPrice: '무료', outputPrice: '무료' },
  { id: 'qwen2.5-coder:7b', name: 'Qwen 2.5 Coder 7B (로컬)', provider: 'ollama', maxTokens: 8192, inputPrice: '무료', outputPrice: '무료' },
];

export const PROVIDER_INFO: Record<Provider, { name: string; icon: string; urlHint: string; keyPrefix: string }> = {
  anthropic: { name: 'Anthropic', icon: '🧠', urlHint: 'console.anthropic.com', keyPrefix: 'sk-ant-' },
  openai:    { name: 'OpenAI', icon: '🤖', urlHint: 'platform.openai.com', keyPrefix: 'sk-' },
  google:    { name: 'Google Gemini', icon: '💎', urlHint: 'aistudio.google.com', keyPrefix: 'AIza' },
  groq:      { name: 'Groq', icon: '⚡', urlHint: 'console.groq.com', keyPrefix: 'gsk_' },
  mistral:   { name: 'Mistral', icon: '🌬️', urlHint: 'console.mistral.ai', keyPrefix: '' },
  deepseek:  { name: 'DeepSeek', icon: '🐋', urlHint: 'platform.deepseek.com', keyPrefix: 'sk-' },
  ollama:    { name: 'Ollama (로컬)', icon: '🦙', urlHint: 'localhost:11434', keyPrefix: '' },
};

export interface AISettings {
  provider: Provider;
  apiKey: string;
  modelId: string;
  ollamaUrl?: string;  // Ollama 커스텀 URL
}

const STORAGE_KEY = 'govibe-ai-settings';

// ── API Key obfuscation (not encryption, but prevents casual snooping) ──

function obfuscate(plain: string): string {
  if (!plain) return '';
  return btoa(plain.split('').map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ ((i % 7) + 3))).join(''));
}

function deobfuscate(encoded: string): string {
  if (!encoded) return '';
  try {
    const decoded = atob(encoded);
    return decoded.split('').map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ ((i % 7) + 3))).join('');
  } catch { return ''; }
}

export function loadAISettings(): AISettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Deobfuscate API key
      if (parsed._k) {
        parsed.apiKey = deobfuscate(parsed._k);
        delete parsed._k;
      }
      return parsed;
    }
  } catch {}
  return { provider: 'anthropic', apiKey: '', modelId: 'claude-sonnet-4-6' };
}

export function saveAISettings(settings: AISettings) {
  // Store obfuscated key, never plain text
  const toStore = { ...settings, _k: obfuscate(settings.apiKey), apiKey: undefined };
  delete (toStore as any).apiKey;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
}

// ── Provider API endpoints ──────────────────────────────────────

function getEndpoint(settings: AISettings): { url: string; headers: Record<string, string>; buildBody: (sys: string, user: string, maxTok: number) => any; extractText: (data: any) => string } {
  switch (settings.provider) {
    case 'anthropic':
      return {
        url: 'https://api.anthropic.com/v1/messages',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': settings.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        buildBody: (sys, user, maxTok) => ({
          model: settings.modelId, max_tokens: maxTok,
          system: sys, messages: [{ role: 'user', content: user }],
        }),
        extractText: (data) => data.content?.find((b: any) => b.type === 'text')?.text || '',
      };

    case 'google':
      return {
        url: `https://generativelanguage.googleapis.com/v1beta/models/${settings.modelId}:generateContent?key=${settings.apiKey}`,
        headers: { 'Content-Type': 'application/json' },
        buildBody: (sys, user, _maxTok) => ({
          system_instruction: { parts: [{ text: sys }] },
          contents: [{ parts: [{ text: user }] }],
          generationConfig: { maxOutputTokens: 4096 },
        }),
        extractText: (data) => data.candidates?.[0]?.content?.parts?.[0]?.text || '',
      };

    case 'groq':
      return {
        url: 'https://api.groq.com/openai/v1/chat/completions',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.apiKey}` },
        buildBody: (sys, user, maxTok) => ({
          model: settings.modelId, max_tokens: maxTok,
          messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
        }),
        extractText: (data) => data.choices?.[0]?.message?.content || '',
      };

    case 'mistral':
      return {
        url: 'https://api.mistral.ai/v1/chat/completions',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.apiKey}` },
        buildBody: (sys, user, maxTok) => ({
          model: settings.modelId, max_tokens: maxTok,
          messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
        }),
        extractText: (data) => data.choices?.[0]?.message?.content || '',
      };

    case 'deepseek':
      return {
        url: 'https://api.deepseek.com/chat/completions',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.apiKey}` },
        buildBody: (sys, user, maxTok) => ({
          model: settings.modelId, max_tokens: maxTok,
          messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
        }),
        extractText: (data) => data.choices?.[0]?.message?.content || '',
      };

    case 'ollama':
      return {
        url: `${settings.ollamaUrl || 'http://localhost:11434'}/api/chat`,
        headers: { 'Content-Type': 'application/json' },
        buildBody: (sys, user, _maxTok) => ({
          model: settings.modelId, stream: false,
          messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
        }),
        extractText: (data) => data.message?.content || '',
      };

    default: // openai and OpenAI-compatible
      return {
        url: 'https://api.openai.com/v1/chat/completions',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.apiKey}` },
        buildBody: (sys, user, maxTok) => ({
          model: settings.modelId, max_tokens: maxTok,
          messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
        }),
        extractText: (data) => data.choices?.[0]?.message?.content || '',
      };
  }
}

// ── Test API Key ────────────────────────────────────────────────

export async function testAPIKey(settings: AISettings): Promise<{ ok: boolean; message: string; latencyMs?: number }> {
  if (settings.provider !== 'ollama' && !settings.apiKey.trim()) {
    return { ok: false, message: 'API Key를 입력해주세요' };
  }

  const start = Date.now();
  const ep = getEndpoint(settings);

  try {
    const res = await fetch(ep.url, {
      method: 'POST',
      headers: ep.headers,
      body: JSON.stringify(ep.buildBody('You are a test assistant.', 'Say "ok" in one word.', 32)),
    });

    const latencyMs = Date.now() - start;

    if (res.ok) {
      const data = await res.json();
      const text = ep.extractText(data);
      const provider = PROVIDER_INFO[settings.provider];
      return { ok: true, message: `✓ ${provider.icon} ${settings.modelId} 연결 성공 (${latencyMs}ms) — "${text.trim().slice(0, 50)}"`, latencyMs };
    } else {
      const err = await res.json().catch(() => ({}));
      const errMsg = (err as any).error?.message || (err as any).message || `HTTP ${res.status}`;
      return { ok: false, message: `✗ ${errMsg}` };
    }
  } catch (err: any) {
    if (settings.provider === 'ollama') {
      return { ok: false, message: `✗ Ollama 서버에 연결할 수 없습니다. ollama serve 실행 중인지 확인하세요.` };
    }
    return { ok: false, message: `✗ 네트워크 오류: ${err.message}` };
  }
}

// ── Generate AI Prompt for a step ───────────────────────────────

export async function generateStepPrompt(
  settings: AISettings,
  context: {
    lang: string; lib: string; appGoal: string; phase: string;
    stepTitle: string; cogTheory: string; tasks: string[];
    experience: string; cognitiveStyle: string; challenges: string;
  },
): Promise<{ ok: boolean; prompt: string; error?: string }> {
  if (settings.provider !== 'ollama' && !settings.apiKey.trim()) {
    return { ok: false, prompt: '', error: 'API Key가 설정되지 않았습니다' };
  }

  const systemPrompt = `당신은 Vibe Coder 어시스턴트입니다. QCAES-Osmani 방법론에 기반하여 개발자가 AI와 효과적으로 소통할 수 있는 최적의 바이브 코딩 프롬프트를 생성합니다.

핵심 원칙:
- John Carmack의 첫 원리 사고로 문제를 분해
- Addy Osmani의 프롬프트 엔지니어링 원칙 적용
- 인지과학 이론을 개발 단계에 맞게 적용
- 사용자 경험 수준에 맞는 난이도 조절
- 구체적이고 즉시 실행 가능한 프롬프트 생성

반드시 한국어로 답변하세요. 마크다운 형식으로 구조화하세요.`;

  const userPrompt = `다음 개발 단계에 최적화된 바이브 코딩 프롬프트를 생성해주세요.

## 컨텍스트
- **기술 스택**: ${context.lang} × ${context.lib}
- **앱 목표**: ${context.appGoal}
- **현재 단계**: ${context.phase} — ${context.stepTitle}
- **적용 인지과학**: ${context.cogTheory}
- **개발자 수준**: ${context.experience || '중급'}
- **인지 스타일**: ${context.cognitiveStyle || '균형형'}
${context.challenges ? `- **예상 어려움**: ${context.challenges}` : ''}

## 이 단계의 태스크
${context.tasks.map((t, i) => `${i + 1}. ${t}`).join('\n')}

## 요청
위 컨텍스트를 바탕으로, 이 단계에서 AI에게 가장 효과적으로 요청할 수 있는 **묘수 프롬프트**를 생성해주세요.

프롬프트에 반드시 포함:
1. 시스템 역할 설정 (Osmani: Leverage roles)
2. 구체적 목표 (Osmani: Be specific)
3. 충분한 컨텍스트 (Osmani: Provide rich context)
4. 단계별 분해 (Osmani: Break down complex tasks)
5. 입출력 예시 (Osmani: Include examples)
6. 인지과학 최적화 (해당 단계의 이론 적용)
7. EchoPrompt 검증 ("제가 이해한 바로는..." 패턴)

최종 프롬프트만 출력하세요. 설명 없이 프롬프트 본문만.`;

  const ep = getEndpoint(settings);

  try {
    const res = await fetch(ep.url, {
      method: 'POST',
      headers: ep.headers,
      body: JSON.stringify(ep.buildBody(systemPrompt, userPrompt, 4096)),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, prompt: '', error: (err as any).error?.message || (err as any).message || `HTTP ${res.status}` };
    }

    const data = await res.json();
    const text = ep.extractText(data);
    return { ok: true, prompt: text };

  } catch (err: any) {
    return { ok: false, prompt: '', error: err.message };
  }
}
