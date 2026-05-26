/**
 * 碁道코딩 — LLM Provider Abstraction
 *
 * Provides a unified interface for calling LLM APIs (Claude / OpenAI).
 * Falls back to heuristic-based action generation when no API key is available.
 *
 * This is the "정책 네트워크(Policy Network)" input layer.
 */

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage?: { inputTokens: number; outputTokens: number };
}

export interface LLMConfig {
  provider: 'anthropic' | 'openai' | 'heuristic';
  apiKey?: string;
  model?: string;
  maxTokens?: number;
}

/**
 * Detect available LLM provider from environment variables.
 */
export function detectLLMConfig(): LLMConfig {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (anthropicKey) {
    return {
      provider: 'anthropic',
      apiKey: anthropicKey,
      model: process.env.GIDO_MODEL || 'claude-sonnet-4-20250514',
      maxTokens: 4096,
    };
  }

  if (openaiKey) {
    return {
      provider: 'openai',
      apiKey: openaiKey,
      model: process.env.GIDO_MODEL || 'gpt-4o',
      maxTokens: 4096,
    };
  }

  return { provider: 'heuristic' };
}

/**
 * Call the LLM API with the given messages.
 * Uses native fetch — no SDK dependency.
 */
export async function callLLM(
  config: LLMConfig,
  messages: LLMMessage[]
): Promise<LLMResponse> {
  if (config.provider === 'heuristic') {
    throw new Error('Heuristic mode — no LLM call available');
  }

  if (config.provider === 'anthropic') {
    return callAnthropic(config, messages);
  }

  return callOpenAI(config, messages);
}

async function callAnthropic(config: LLMConfig, messages: LLMMessage[]): Promise<LLMResponse> {
  const systemMsg = messages.find(m => m.role === 'system');
  const userMsgs = messages.filter(m => m.role !== 'system');

  const body = {
    model: config.model,
    max_tokens: config.maxTokens || 4096,
    system: systemMsg?.content || '',
    messages: userMsgs.map(m => ({ role: m.role, content: m.content })),
  };

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic API error (${res.status}): ${errText}`);
  }

  const data = await res.json() as any;
  return {
    content: data.content?.[0]?.text || '',
    model: data.model || config.model || 'unknown',
    usage: data.usage ? {
      inputTokens: data.usage.input_tokens,
      outputTokens: data.usage.output_tokens,
    } : undefined,
  };
}

async function callOpenAI(config: LLMConfig, messages: LLMMessage[]): Promise<LLMResponse> {
  const body = {
    model: config.model,
    max_tokens: config.maxTokens || 4096,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
  };

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI API error (${res.status}): ${errText}`);
  }

  const data = await res.json() as any;
  return {
    content: data.choices?.[0]?.message?.content || '',
    model: data.model || config.model || 'unknown',
    usage: data.usage ? {
      inputTokens: data.usage.prompt_tokens,
      outputTokens: data.usage.completion_tokens,
    } : undefined,
  };
}
