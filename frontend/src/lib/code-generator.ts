// ============================================================
// Code Generator — LLM이 실제 코드 파일을 생성
// CodeSpeak의 spec→code 파이프라인을 브라우저에서 구현
//
// 플로우:
// 1. Spec 단계별로 LLM에 코드 생성 요청
// 2. 응답에서 파일 경로 + 내용 파싱
// 3. 메모리에 가상 파일시스템 구축
// 4. JSZip으로 ZIP 다운로드
// ============================================================

import type { AISettings } from './ai-client';

// ── Virtual File System ─────────────────────────────────────────

export interface VirtualFile {
  path: string;
  content: string;
  language: string;
  stepIndex: number;   // 어떤 단계에서 생성됐는지
}

export interface GenerationResult {
  files: VirtualFile[];
  stepIndex: number;
  success: boolean;
  error?: string;
}

export interface ProjectState {
  files: VirtualFile[];
  currentStep: number;
  totalSteps: number;
  status: 'idle' | 'generating' | 'done' | 'error';
  log: string[];
}

// ── LLM Code Generation ────────────────────────────────────────

function getEndpoint(settings: AISettings): {
  url: string;
  headers: Record<string, string>;
  buildBody: (sys: string, user: string) => any;
  extractText: (data: any) => string;
} {
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
        buildBody: (sys, user) => ({
          model: settings.modelId, max_tokens: 8192,
          system: sys, messages: [{ role: 'user', content: user }],
        }),
        extractText: (data) => data.content?.find((b: any) => b.type === 'text')?.text || '',
      };
    case 'google':
      return {
        url: `https://generativelanguage.googleapis.com/v1beta/models/${settings.modelId}:generateContent?key=${settings.apiKey}`,
        headers: { 'Content-Type': 'application/json' },
        buildBody: (sys, user) => ({
          system_instruction: { parts: [{ text: sys }] },
          contents: [{ parts: [{ text: user }] }],
          generationConfig: { maxOutputTokens: 8192 },
        }),
        extractText: (data) => data.candidates?.[0]?.content?.parts?.[0]?.text || '',
      };
    case 'ollama':
      return {
        url: `${settings.ollamaUrl || 'http://localhost:11434'}/api/chat`,
        headers: { 'Content-Type': 'application/json' },
        buildBody: (sys, user) => ({
          model: settings.modelId, stream: false,
          messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
        }),
        extractText: (data) => data.message?.content || '',
      };
    default: // openai-compatible (openai, groq, mistral, deepseek)
      const urls: Record<string, string> = {
        openai: 'https://api.openai.com/v1/chat/completions',
        groq: 'https://api.groq.com/openai/v1/chat/completions',
        mistral: 'https://api.mistral.ai/v1/chat/completions',
        deepseek: 'https://api.deepseek.com/chat/completions',
      };
      return {
        url: urls[settings.provider] || urls.openai,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.apiKey}` },
        buildBody: (sys, user) => ({
          model: settings.modelId, max_tokens: 8192,
          messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
        }),
        extractText: (data) => data.choices?.[0]?.message?.content || '',
      };
  }
}

// ── Parse code blocks from LLM response ─────────────────────────

export function parseCodeBlocks(response: string): VirtualFile[] {
  const files: VirtualFile[] = [];
  // Match: ```lang:path/to/file.ext or FILE: path or // file: path
  const blockRegex = /(?:(?:FILE|file|파일)[:\s]+([^\n`]+)\n)?```(\w*)\n([\s\S]*?)```/g;
  const headerRegex = /(?:#{1,3}\s+)?(?:FILE|file|파일)[:\s]+`?([^\n`]+)`?\s*\n```(\w*)\n([\s\S]*?)```/g;

  // Try header pattern first (more structured)
  let match;
  const seen = new Set<string>();

  for (const regex of [headerRegex, blockRegex]) {
    regex.lastIndex = 0;
    while ((match = regex.exec(response)) !== null) {
      let path = (match[1] || '').trim();
      const lang = match[2] || '';
      const content = match[3] || '';

      // Skip if no path, try to infer from language
      if (!path && lang) {
        // Look backwards for a filename hint
        const before = response.slice(Math.max(0, match.index - 200), match.index);
        const fileHint = before.match(/[`"]([a-zA-Z0-9_\-/.]+\.[a-zA-Z]+)[`"]/);
        if (fileHint) path = fileHint[1];
      }

      if (!path || seen.has(path)) continue;
      seen.add(path);

      // Clean path
      path = path.replace(/^[`"']|[`"']$/g, '').replace(/^\/+/, '');

      files.push({ path, content: content.trimEnd(), language: lang || inferLang(path), stepIndex: 0 });
    }
  }

  // Fallback: if no files found, try simpler pattern
  if (files.length === 0) {
    const simpleRegex = /```(\w+)\n([\s\S]*?)```/g;
    let idx = 0;
    while ((match = simpleRegex.exec(response)) !== null) {
      const lang = match[1];
      const content = match[2];
      if (content.trim().length < 10) continue;
      const ext = langToExt(lang);
      files.push({
        path: `generated/file${idx}.${ext}`,
        content: content.trimEnd(),
        language: lang,
        stepIndex: 0,
      });
      idx++;
    }
  }

  return files;
}

function inferLang(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx',
    py: 'python', go: 'go', rs: 'rust', java: 'java',
    json: 'json', md: 'markdown', css: 'css', html: 'html',
    yml: 'yaml', yaml: 'yaml', toml: 'toml', sql: 'sql',
    sh: 'bash', swift: 'swift', kt: 'kotlin', rb: 'ruby',
  };
  return map[ext] || ext;
}

function langToExt(lang: string): string {
  const map: Record<string, string> = {
    typescript: 'ts', javascript: 'js', python: 'py', go: 'go',
    rust: 'rs', java: 'java', json: 'json', css: 'css',
    html: 'html', bash: 'sh', swift: 'swift', kotlin: 'kt',
    tsx: 'tsx', jsx: 'jsx', ruby: 'rb', sql: 'sql',
  };
  return map[lang.toLowerCase()] || 'txt';
}

// ── Generate code for a single step ─────────────────────────────

export async function generateStepCode(
  settings: AISettings,
  context: {
    lang: string;
    lib: string;
    appGoal: string;
    phase: string;
    stepTitle: string;
    tasks: string[];
    existingFiles: VirtualFile[];  // 이전 단계에서 생성된 파일들
  },
): Promise<GenerationResult> {
  const ep = getEndpoint(settings);

  const existingContext = context.existingFiles.length > 0
    ? `\n\n## 이전 단계에서 생성된 파일\n${context.existingFiles.map(f => `- \`${f.path}\``).join('\n')}\n\n이 파일들이 이미 존재합니다. 참조하되 다시 생성하지 마세요.`
    : '';

  const systemPrompt = `당신은 시니어 풀스택 개발자입니다. 사용자의 요청에 따라 실제로 작동하는 코드 파일을 생성합니다.

규칙:
1. 각 파일을 다음 형식으로 출력하세요:
   FILE: path/to/file.ext
   \`\`\`lang
   코드 내용
   \`\`\`
2. 실제로 동작하는 코드만 생성하세요 (placeholder 금지)
3. import 경로는 프로젝트 내 상대 경로를 사용하세요
4. 파일당 200줄 이내로 유지하세요
5. 한국어 주석으로 핵심 로직을 설명하세요`;

  const userPrompt = `## 프로젝트: ${context.appGoal}
## 기술 스택: ${context.lang} × ${context.lib}
## 현재 단계: ${context.phase} — ${context.stepTitle}

## 이 단계에서 구현할 태스크
${context.tasks.map((t, i) => `${i + 1}. ${t}`).join('\n')}
${existingContext}

위 태스크를 구현하는 실제 코드 파일들을 생성해주세요.
각 파일은 "FILE: 경로" 형식으로 시작하세요.`;

  try {
    const res = await fetch(ep.url, {
      method: 'POST',
      headers: ep.headers,
      body: JSON.stringify(ep.buildBody(systemPrompt, userPrompt)),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { files: [], stepIndex: 0, success: false, error: (err as any).error?.message || `HTTP ${res.status}` };
    }

    const data = await res.json();
    const text = ep.extractText(data);
    const files = parseCodeBlocks(text);

    return { files, stepIndex: 0, success: true };
  } catch (err: any) {
    return { files: [], stepIndex: 0, success: false, error: err.message };
  }
}

// ── Generate full project (all steps) ───────────────────────────

export async function generateFullProject(
  settings: AISettings,
  steps: Array<{ phase: string; title: string; tasks: string[] }>,
  context: { lang: string; lib: string; appGoal: string },
  onProgress: (stepIdx: number, total: number, files: VirtualFile[]) => void,
): Promise<ProjectState> {
  const allFiles: VirtualFile[] = [];
  const log: string[] = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    onProgress(i, steps.length, allFiles);
    log.push(`[${i + 1}/${steps.length}] ${step.phase} — ${step.title} 생성 중...`);

    const result = await generateStepCode(settings, {
      lang: context.lang,
      lib: context.lib,
      appGoal: context.appGoal,
      phase: step.phase,
      stepTitle: step.title,
      tasks: step.tasks,
      existingFiles: allFiles,
    });

    if (result.success) {
      const newFiles = result.files.map(f => ({ ...f, stepIndex: i }));
      allFiles.push(...newFiles);
      log.push(`  ✓ ${newFiles.length}개 파일 생성: ${newFiles.map(f => f.path).join(', ')}`);
    } else {
      log.push(`  ✗ 실패: ${result.error}`);
    }
  }

  onProgress(steps.length, steps.length, allFiles);

  return {
    files: allFiles,
    currentStep: steps.length,
    totalSteps: steps.length,
    status: 'done',
    log,
  };
}

// ── ZIP Download ────────────────────────────────────────────────
// JSZip 없이 순수 JS로 ZIP 생성 (간단한 구현)

export function downloadAsZip(files: VirtualFile[], projectName: string) {
  // Use a simple approach: create individual file downloads if ZIP is complex
  // Or use the ZIP format manually

  // For simplicity, create a single concatenated file with clear separators
  // that can be split by a script, OR generate actual ZIP

  // Using Blob-based ZIP creation (minimal implementation)
  const encoder = new TextEncoder();

  // Simple: download as a shell script that creates all files
  let script = `#!/bin/bash\n# ${projectName} — Generated by 碁Vibe\n# Run: bash ${projectName}.sh\n\nset -e\n\n`;
  script += `echo "🎯 ${projectName} 프로젝트 생성 중..."\n\n`;

  // Create directories first
  const dirs = new Set<string>();
  for (const f of files) {
    const parts = f.path.split('/');
    for (let i = 1; i < parts.length; i++) {
      dirs.add(parts.slice(0, i).join('/'));
    }
  }
  if (dirs.size > 0) {
    script += `# 디렉토리 생성\nmkdir -p ${[...dirs].join(' ')}\n\n`;
  }

  // Write files
  for (const f of files) {
    const escaped = f.content.replace(/'/g, "'\\''");
    script += `# ${f.path}\ncat > '${f.path}' << 'GOVIBE_EOF'\n${f.content}\nGOVIBE_EOF\n\n`;
  }

  script += `echo "✅ ${files.length}개 파일 생성 완료!"\necho "다음 단계: cd ${projectName} && ${files.some(f => f.path.includes('package.json')) ? 'npm install && npm run dev' : 'cat README.md'}"\n`;

  const blob = new Blob([script], { type: 'text/x-shellscript' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${projectName.replace(/[^a-z0-9가-힣\-_]/gi, '-')}.sh`;
  a.click();
  URL.revokeObjectURL(url);
}

// Also offer individual file download
export function downloadAllFiles(files: VirtualFile[], projectName: string) {
  // Create a single markdown with all files (more universal)
  let md = `# ${projectName}\n\nGenerated by 碁Vibe — ${new Date().toISOString().slice(0, 10)}\n\n`;
  md += `## Files (${files.length})\n\n`;

  for (const f of files) {
    md += `### \`${f.path}\`\n\n\`\`\`${f.language}\n${f.content}\n\`\`\`\n\n`;
  }

  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${projectName.replace(/[^a-z0-9가-힣\-_]/gi, '-')}-code.md`;
  a.click();
  URL.revokeObjectURL(url);
}
